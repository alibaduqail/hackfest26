import { Application, Assets, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { LinkDef, PersonDef, PersonState, RoomDef, Scenario, WorldState } from "../engine/types";
import { blocked } from "../engine/routing";
import { appearance, cargoUnits, residentPose } from "./presentation";
import { movementTransition, pumpOperating, waterDepth } from "./visual-state";
import { alongPath, containsRoom, pathPoints, cutawaySpot, roomFloor, traversalPoint, LIFT_BOARD, LIFT_ALIGHT } from "./cutaway-geometry";
import { constrainCamera, elasticCamera, fitZoom, type Bounds } from "./camera";

export type Selection = { kind: "room" | "person" | "cart" | "link"; id: string };
type Point = { x: number; y: number };
type RoomVisual = { root: Container; lights: Graphics; shade: Graphics; water: Graphics; status: Text; name: Text; selection: Graphics; pumpOn?: Sprite; pumpOff?: Sprite };
type PersonVisual = { root: Container; body: Graphics; legs: Graphics; bag: Graphics; tag: Text };
const ink = 0x111916, amber = 0xd7ac6b, pale = 0xd9d6be, teal = 0x76928a, rust = 0x9b6850;
function line(g: Graphics, a: Point, b: Point, color: number, width = 1, alpha = 1) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha });
}
function label(value: string, x: number, y: number, size = 14, color = pale) {
  const t = new Text({ text: value, style: { fontFamily: '"Aptos", "Segoe UI", sans-serif', fontSize: size, fill: color, fontWeight: "500" } });
  t.position.set(x, y);
  return t;
}
function roomOutline(r: RoomDef): Point[] {
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
}

export class WorldRenderer {
  app = new Application();
  world = new Container();
  rooms = new Map<string, RoomVisual>();
  people = new Map<string, PersonVisual>();
  cart = new Container();
  selection = new Graphics();
  connectionOverlay = new Graphics();
  state?: WorldState;
  playing = true;
  followId: string | null = null;
  selected: Selection | null = null;
  zoom = 0.65;
  camera = { x: 0, y: 0 };
  fps = 0;
  private roomDefs: Map<string, RoomDef>;
  private personDefs: Map<string, PersonDef>;
  private linkDefs: Map<string, LinkDef>;
  private targets = new Map<string, Point>();
  private movement = new Map<string, { key: string; progress: number }>();
  private renderedProgress = new Map<string, number>();
  private snapActors = new Set<string>();
  private cartCargo = new Graphics();
  private cartCue = label("", -32, -66, 15);
  private inspectorOpen = false;
  private destroyed = false;
  private appDestroyed = false;
  private resize?: ResizeObserver;
  private viewSize = { width: 0, height: 0 };
  private motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  private pointerPositions = new Map<number, Point>();
  private pinchDistance = 0;
  private pointerStart = { x: 0, y: 0, cx: 0, cy: 0 };
  private moved = false;
  private down = false;
  private zoomSnap?: ReturnType<typeof setTimeout>;
  private cameraMove?: { from: { x: number; y: number; zoom: number }; to: { x: number; y: number; zoom: number }; start: number };
  private cameraBounds: Bounds;
  private art = new Map<string, Texture>();
  private artWarning?: HTMLElement;
  constructor(public host: HTMLElement, public scenario: Scenario, public onSelect: (s: Selection) => void, public onCamera: () => void) {
    this.roomDefs = new Map(scenario.rooms.map(r => [r.id, r]));
    this.personDefs = new Map(scenario.residents.map(p => [p.id, p]));
    this.linkDefs = new Map(scenario.links.map(l => [l.id, l]));
    const bounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const include = (p: Point) => { bounds.left = Math.min(bounds.left, p.x); bounds.top = Math.min(bounds.top, p.y); bounds.right = Math.max(bounds.right, p.x); bounds.bottom = Math.max(bounds.bottom, p.y); };
    for (const room of scenario.rooms) roomOutline(room).forEach(include);
    for (const link of scenario.links) pathPoints(this.roomDefs.get(link.a)!, this.roomDefs.get(link.b)!, link.kind).forEach(include);
    this.cameraBounds = { left: bounds.left - 36, top: bounds.top - 44, right: bounds.right + 36, bottom: bounds.bottom + 84 };
  }
  private disposeApp() {
    if (this.appDestroyed || !this.app.renderer) return;
    this.appDestroyed = true;
    this.app.destroy(true, { children: true });
  }
  async init() {
    await this.app.init({ resizeTo: this.host, background: 0x121a17, antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, preference: "webgl" });
    if (this.destroyed) { this.disposeApp(); return; }
    const assets = ["/art/pump/on.svg", "/art/pump/off.svg"];
    const loaded = await Promise.allSettled(assets.map(path => Assets.load<Texture>(path)));
    if (this.destroyed) { this.disposeApp(); return; }
    loaded.forEach((result, i) => { if (result.status === "fulfilled") this.art.set(assets[i], result.value); });
    if (loaded.some(r => r.status === "rejected")) {
      const warning = document.createElement("div");
      warning.setAttribute("role", "status");
      warning.textContent = "Some world artwork could not load. Basic shapes are shown; reload to retry.";
      Object.assign(warning.style, { position: "absolute", bottom: "12px", left: "12px", zIndex: "2", background: "#29352f", color: "#fff1d3", padding: "8px 12px", maxWidth: "320px" });
      this.host.appendChild(warning); this.artWarning = warning;
    }
    this.host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute("aria-label", "Side cutaway of the Hollow settlement. Drag to pan, scroll to zoom, or use Explore to select rooms and residents with the keyboard.");
    this.app.canvas.setAttribute("role", "img");
    this.app.stage.addChild(this.world); this.world.sortableChildren = true;
    this.drawWorld(); this.makePeople(); this.makeCart();
    this.connectionOverlay.zIndex = 40; this.selection.zIndex = 50;
    this.world.addChild(this.connectionOverlay, this.selection);
    this.district(1, false); this.input();
    this.viewSize = { width: this.host.clientWidth, height: this.host.clientHeight };
    this.resize = new ResizeObserver(() => {
      const width = this.host.clientWidth, height = this.host.clientHeight;
      this.camera.x += (width - this.viewSize.width) / 2; this.camera.y += (height - this.viewSize.height) / 2;
      this.viewSize = { width, height }; this.cameraMove = undefined; this.app.resize(); this.transform(); this.snapCamera();
    });
    this.resize.observe(this.host); this.app.ticker.add(() => this.frame());
  }
  private drawWorld() {
    const rock = new Graphics(), b = this.cameraBounds;
    rock.zIndex = -10000;
    rock.rect(b.left - 300, b.top - 300, b.right - b.left + 600, b.bottom - b.top + 600).fill(0x26312a);
    const rowCount = Math.min(70, Math.ceil((b.bottom - b.top + 480) / 57));
    const columnCount = Math.min(100, Math.ceil((b.right - b.left + 400) / 103));
    for (let row = 0; row < rowCount; row++) {
      const y = b.top - 240 + row * (b.bottom - b.top + 480) / rowCount;
      line(rock, { x: b.left - 250, y }, { x: b.right + 250, y: y + 8 }, row % 2 ? 0x313d32 : 0x1c2720, 7, 0.6);
      for (let column = 0; column < columnCount; column++) {
        const x = b.left - 220 + column * (b.right - b.left + 400) / columnCount + (row % 3) * 32;
        rock.poly([x, y, x + 17, y + 8, x + 29, y + 3, x + 43, y + 16]).stroke({ color: 0x465144, width: 2, alpha: 0.5 });
        line(rock, { x: x + 17, y: y + 8 }, { x: x + 12, y: y + 25 }, ink, 3, 0.6);
      }
    }
    this.world.addChild(rock);
    const links = new Graphics(); links.zIndex = -5000;
    for (const l of this.scenario.links) {
      const points = pathPoints(this.roomDefs.get(l.a)!, this.roomDefs.get(l.b)!, l.kind);
      for (let i = 1; i < points.length; i++) {
        line(links, points[i - 1], points[i], ink, l.kind === "lift" ? 18 : 20);
        line(links, points[i - 1], points[i], l.kind === "lift" ? 0x6a7770 : 0x56665c, l.kind === "lift" ? 4 : 10);
      }
    }
    this.world.addChild(links);
    for (const room of [...this.scenario.rooms].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))) this.drawRoom(room);
    const shafts = new Graphics(); shafts.zIndex = 20;
    for (const link of this.scenario.links.filter(l => l.kind === "lift")) {
      const points = pathPoints(this.roomDefs.get(link.a)!, this.roomDefs.get(link.b)!, link.kind);
      if (points.length !== 6) continue;
      const a = points[2], b = points[3];
      for (const dx of [-14, 14]) line(shafts, { x: a.x + dx, y: a.y }, { x: b.x + dx, y: b.y }, 0x91a398, 3, 0.7);
      for (const p of [a, b]) line(shafts, { x: p.x - 16, y: p.y + 3 }, { x: p.x + 16, y: p.y + 3 }, 0xb4b6a0, 4);
    }
    this.world.addChild(shafts);
  }
  private drawRoom(d: RoomDef) {
    const root = new Container(); root.position.set(d.x, d.y); root.zIndex = 10;
    const g = new Graphics(), w = d.w, h = d.h, floor = h - 15;
    g.rect(0, 0, w, h).fill(ink).rect(5, 5, Math.max(1, w - 10), Math.max(1, h - 10)).fill(d.district === 1 ? 0x35423b : d.district === 2 ? 0x303c34 : 0x3b463a);
    g.rect(5, 6, Math.max(1, w - 10), Math.max(2, h * 0.29)).fill({ color: 0x202c25, alpha: 0.6 });
    for (let x = 8; x < w - 6; x += Math.max(62, w / 100)) {
      line(g, { x, y: 8 }, { x, y: floor - 4 }, 0x202b24, 2, 0.65);
      line(g, { x: x + 5, y: 31 }, { x: Math.min(w - 8, x + 50), y: 31 }, 0x617061, 1, 0.35);
    }
    line(g, { x: 10, y: Math.min(34, floor - 10) }, { x: w - 10, y: Math.min(34, floor - 10) }, ink, 10);
    line(g, { x: 10, y: Math.min(34, floor - 10) }, { x: w - 10, y: Math.min(34, floor - 10) }, 0x6b8174, 5);
    g.rect(0, floor, w, h - floor).fill(0x58635a).rect(0, floor, w, 3).fill(0x879087);
    for (let x = 14; x < w; x += Math.max(47, w / 100)) line(g, { x, y: floor + 5 }, { x: x - 3, y: h - 2 }, 0x202a24, 2, 0.8);
    this.drawFixture(g, d, floor);
    const lights = new Graphics();
    for (let x = Math.min(65, w / 2); x < w; x += Math.max(180, w / 40)) {
      lights.ellipse(x, 42, 65, 48).fill({ color: 0xc69f55, alpha: 0.07 });
      lights.circle(x, 18, 4).fill(amber);
    }
    const shade = new Graphics(); shade.rect(4, 4, Math.max(1, w - 8), Math.max(1, h - 8)).fill({ color: 0x09140f, alpha: 0.38 }); shade.visible = false;
    const water = new Graphics(), selection = new Graphics();
    const name = label(d.name, 12, 10, Math.min(16, Math.max(10, w / 15)), pale);
    const status = label("", 12, 30, 12, 0xe8b084);
    root.addChild(g, lights, shade, water, name, status, selection);
    const visual: RoomVisual = { root, lights, shade, water, status, name, selection };
    if (d.kind === "pump" && this.art.has("/art/pump/on.svg") && this.art.has("/art/pump/off.svg")) {
      const width = Math.min(176, Math.max(16, w * 0.44)), height = Math.min(112, Math.max(15, h * 0.76));
      const off = new Sprite(this.art.get("/art/pump/off.svg")!), on = new Sprite(this.art.get("/art/pump/on.svg")!);
      off.position.set(w * 0.5 - width / 2, floor - height * 0.9); on.position.copyFrom(off.position);
      off.width = on.width = width; off.height = on.height = height;
      root.addChildAt(off, 1); root.addChildAt(on, 2); visual.pumpOff = off; visual.pumpOn = on;
    }
    this.rooms.set(d.id, visual); this.world.addChild(root);
  }
  private drawFixture(g: Graphics, d: RoomDef, floor: number) {
    const w = d.w, x = Math.max(8, w * 0.23), width = Math.max(10, Math.min(w * 0.56, 220)), y = floor - Math.min(70, Math.max(12, d.h * 0.52));
    const box = (bx: number, by: number, bw: number, bh: number, color: number) => { g.roundRect(bx, by, bw, bh, 3).fill(color).stroke({ color: ink, width: 3 }); };
    switch (d.kind) {
      case "home": case "clinic":
        box(x, floor - 29, width, 20, d.kind === "clinic" ? 0x81958b : 0x6c7664); box(x + 5, floor - 40, width * 0.3, 12, 0xa3a894);
        if (d.kind === "clinic") { g.rect(x + width * .7, y + 2, 6, 25).rect(x + width * .7 - 9, y + 11, 24, 6).fill(0xc2b8a0); } break;
      case "farm":
        for (let i = 0; i < 4; i++) { const px = x + (i + .5) * width / 4; line(g, { x: px, y: floor - 18 }, { x: px, y: floor - 53 }, 0x89a078, 3); g.ellipse(px - 7, floor - 42, 9, 4).ellipse(px + 7, floor - 49, 9, 4).fill(0x6e8b66); } box(x, floor - 19, width, 13, 0x695c48); break;
      case "mess":
        box(x, floor - 44, width, 9, 0x91755d); line(g, { x: x + 12, y: floor - 35 }, { x: x + 12, y: floor }, ink, 5); line(g, { x: x + width - 12, y: floor - 35 }, { x: x + width - 12, y: floor }, ink, 5); break;
      case "depot": case "workshop":
        for (let i = 0; i < 3; i++) { box(x + i * width / 3, floor - 31, width / 3 - 3, 26, d.kind === "depot" ? 0x887555 : 0x5e7771); }
        if (d.kind === "workshop") line(g, { x, y: floor - 38 }, { x: x + width, y: floor - 38 }, 0xaaa88f, 6); break;
      case "pump": box(x + width * .2, y, width * .6, floor - y - 5, 0x526c65); g.circle(x + width * .5, (y + floor) / 2, Math.min(19, width / 5)).stroke({ color: 0x879c89, width: 4 }); break;
      case "fan":
        box(x, y, width, floor - y - 5, 0x44594e); g.circle(x + width / 2, (y + floor) / 2, Math.min(27, width / 3)).stroke({ color: 0x9aa596, width: 4 });
        line(g, { x: x + width / 2 - 17, y: (y + floor) / 2 }, { x: x + width / 2 + 17, y: (y + floor) / 2 }, 0x9aa596, 4); break;
      case "tap": case "recycler":
        box(x, y, width * .45, floor - y - 5, 0x60786d); box(x + width * .54, y + 12, width * .38, floor - y - 17, 0x4c6b68);
        if (d.kind === "tap") { line(g, { x: x + width * .55, y: y + 6 }, { x: x + width * .8, y: y + 6 }, 0xa2b7aa, 5); line(g, { x: x + width * .8, y: y + 6 }, { x: x + width * .8, y: y + 17 }, 0xa2b7aa, 5); }
        else { g.circle(x + width * .2, y + 20, Math.min(12, width * .1)).stroke({ color: 0xa0b2a3, width: 3 }); }
        break;
      case "plant": case "switchgear": case "relay":
        for (let i = 0; i < 3; i++) { const bx = x + i * width / 3; box(bx, y, Math.max(2, width / 3 - 5), floor - y - 5, d.kind === "relay" ? 0x635e53 : 0x4d6256); for (let j = 0; j < 3; j++) line(g, { x: bx + 5, y: y + 12 + j * 12 }, { x: bx + width / 3 - 10, y: y + 12 + j * 12 }, 0x9a9c85, 2); }
        if (d.kind === "plant") g.circle(x + width / 2, y + 24, Math.min(14, width / 8)).stroke({ color: 0xb2aa8c, width: 4 });
        if (d.kind === "switchgear") g.poly([x + width / 2, y + 9, x + width / 2 - 7, y + 23, x + width / 2, y + 23, x + width / 2 - 4, y + 35, x + width / 2 + 9, y + 18, x + width / 2 + 2, y + 18]).fill(0xc3ad77);
        if (d.kind === "relay") { line(g, { x: x + width / 2, y }, { x: x + width / 2, y: y - 10 }, 0xb0b8a4, 2); g.circle(x + width / 2, y - 12, 3).fill(0xb0b8a4); }
        break;
      case "checkpoint": case "gate":
        box(x, y, width, floor - y - 5, 0x56685a);
        if (d.kind === "gate") for (let i = 0; i < 4; i++) line(g, { x: x + i * width / 4, y }, { x: x + i * width / 4, y: floor - 5 }, 0x94a091, 3);
        else { line(g, { x, y: floor - 30 }, { x: x + width, y: floor - 30 }, 0xc1a079, 5); box(x + width * .7, y + 5, width * .2, 15, 0x8b725d); }
        break;
    }
  }
  private makePeople() {
    for (const def of this.scenario.residents) {
      const root = new Container(), body = new Graphics(), legs = new Graphics(), bag = new Graphics(), a = appearance(def);
      body.poly([-9, -31, -12, -24, -10, -12, 10, -12, 11, -24, 8, -31]).fill(a.shirt).stroke({ color: ink, width: 2.5 });
      body.poly([-10, -27, -15, -21, -14, -14, -10, -14]).fill(a.shirt).stroke({ color: ink, width: 1.5 });
      body.circle(-13, -13, 2.5).fill(a.skin).stroke({ color: ink, width: 1 });
      body.ellipse(0, -39, 8, 9).fill(a.skin).stroke({ color: ink, width: 2 });
      body.poly([-8, -42, -7, -47, -1, -49, 6, -46, 7, -42, 2, -44, -2, -42]).fill(a.hair);
      if (a.hairStyle === 1) body.ellipse(-8, -41, 3, 6).fill(a.hair);
      if (a.hairStyle === 2) body.poly([-8, -43, -11, -32, -5, -33, -3, -43]).fill(a.hair);
      body.circle(3, -39, 1.1).fill(ink);
      line(body, { x: 3, y: -34 }, { x: 6, y: -34 }, ink, 1);
      line(body, { x: -7, y: -28 }, { x: 5, y: -27 }, 0x202c24, 1, .6);
      if (a.technical) { body.roundRect(-9, -50, 18, 7, 3).fill(0xb39d6c).stroke({ color: ink, width: 1.5 }); line(body, { x: -11, y: -44 }, { x: 10, y: -44 }, 0xd1bf8a, 2); }
      if (a.grower) { body.rect(-5, -25, 10, 14).fill(a.apron); line(body, { x: -4, y: -25 }, { x: -4, y: -30 }, 0xc4b794, 1); }
      if (a.medical) { body.rect(4, -24, 3, 9).rect(1, -21, 9, 3).fill(0xdce3cd); body.rect(-6, -16, 7, 3).fill(0x829f96); }
      legs.rect(-6, -12, 5, 12).rect(2, -12, 5, 12).fill(0x26362e);
      legs.rect(-7, -3, 7, 3).rect(2, -3, 8, 3).fill(ink);
      bag.roundRect(7, -24, 12, 11, 2).fill(0xb49a6c).stroke({ color: ink, width: 2 }); bag.visible = false;
      const tag = label(def.name.split(" ")[0], -24, -69, 14); tag.visible = false;
      root.addChild(legs, body, bag, tag); this.people.set(def.id, { root, body, legs, bag, tag }); this.world.addChild(root);
    }
  }
  private makeCart() {
    const frame = new Graphics();
    frame.roundRect(-34, -22, 68, 16, 3).fill(0x60837d).stroke({ color: ink, width: 3 });
    frame.circle(-23, -4, 7).circle(22, -4, 7).fill(ink).stroke({ color: 0xa1aea0, width: 2 });
    line(frame, { x: -34, y: -16 }, { x: -47, y: -34 }, 0x94aca1, 4);
    this.cart.addChild(frame, this.cartCargo, this.cartCue); this.world.addChild(this.cart);
  }
  update(state: WorldState, playing: boolean) {
    this.state = state; this.playing = playing;
    const track = (id: string, key: string, progress: number) => {
      const next = movementTransition(this.movement.get(id), { key, progress });
      this.movement.set(id, { key: next.key, progress: next.progress });
      if (next.snap) { this.renderedProgress.set(id, progress); this.snapActors.add(id); }
    };
    const roomStates = new Map(state.rooms.map(r => [r.id, r]));
    const counts = new Map<string, number>(), slots = new Map<string, number>();
    for (const p of state.people) if (!p.edgeId) counts.set(p.roomId, (counts.get(p.roomId) ?? 0) + 1);
    for (const p of state.people) {
      track(p.id, `${state.runId}:${p.edgeId ?? `room:${p.roomId}`}:${p.fromId}:${p.toId}`, p.edgeId ? p.edgeProgress : 0);
      const room = this.roomDefs.get(p.roomId), def = this.personDefs.get(p.id), view = this.people.get(p.id);
      if (!room || !def || !view) continue;
      const slot = slots.get(room.id) ?? 0;
      if (!p.edgeId) slots.set(room.id, slot + 1);
      const link = p.edgeId ? this.linkDefs.get(p.edgeId) : undefined;
      const from = this.roomDefs.get(p.fromId), to = this.roomDefs.get(p.toId);
      const point = link && from && to ? traversalPoint(from, to, link.kind, p.edgeProgress) : cutawaySpot(room, slot, counts.get(room.id) ?? 1);
      this.targets.set(p.id, point);
      const pose = residentPose(def, p, room);
      view.bag.visible = cargoUnits(p.bag) > 0;
      view.body.rotation = pose === "sleep" ? Math.PI / 2 : pose === "bend" ? 0.4 : 0;
      view.legs.scale.y = pose === "sit" ? 0.55 : 1;
      view.root.alpha = roomStates.get(room.id)?.powered === false ? 0.72 : 1;
    }
    const c = state.cart;
    track("cart", `${state.runId}:${c.edgeId ?? `room:${c.roomId}`}:${c.fromId}:${c.toId}`, c.edgeId ? c.progress : 0);
    const depth = waterDepth(state, this.scenario);
    const waterSurfaces = new Map<string, number>();
    for (const l of this.scenario.links.filter(l => l.kind === "sump")) {
      const a = this.roomDefs.get(l.a)!, b = this.roomDefs.get(l.b)!;
      const surface = Math.max(roomFloor(a).y, roomFloor(b).y) - depth * 65;
      for (const id of [l.a, l.b]) waterSurfaces.set(id, Math.min(waterSurfaces.get(id) ?? Infinity, surface));
    }
    for (const r of state.rooms) {
      const v = this.rooms.get(r.id), d = this.roomDefs.get(r.id); if (!v || !d) continue;
      v.shade.visible = !r.powered; v.lights.visible = r.powered;
      v.status.text = [!r.powered ? "Power off" : r.reason === "Waiting for staff" ? "Waiting for staff" : "", r.occupants ? `${r.occupants} inside` : ""].filter(Boolean).join(" · ");
      if (v.pumpOn && v.pumpOff) { v.pumpOn.visible = pumpOperating(r); v.pumpOff.visible = !v.pumpOn.visible; }
      v.water.clear();
      const surface = waterSurfaces.get(d.id);
      if (surface !== undefined && depth > 0 && surface < roomFloor(d).y) {
        const height = Math.min(d.h - 15, roomFloor(d).y - surface);
        v.water.rect(5, d.h - 15 - height, Math.max(1, d.w - 10), height).fill({ color: 0x467e7a, alpha: 0.65 });
        line(v.water, { x: 5, y: d.h - 15 - height }, { x: d.w - 5, y: d.h - 15 - height }, 0x9fbfb0, 2);
      }
    }
    this.connectionOverlay.clear();
    for (const link of this.scenario.links) {
      const points = pathPoints(this.roomDefs.get(link.a)!, this.roomDefs.get(link.b)!, link.kind), p = alongPath(points, 0.5);
      if (link.kind === "sump" && depth > 0) {
        const surface = Math.max(points[0].y, points[points.length - 1].y) - depth * 65;
        for (let i = 1; i < points.length; i++) {
          let a = points[i - 1], b = points[i];
          if (a.y < surface && b.y < surface) continue;
          if (a.y < surface) a = { x: a.x + (b.x - a.x) * (surface - a.y) / (b.y - a.y), y: surface };
          if (b.y < surface) b = { x: b.x + (a.x - b.x) * (surface - b.y) / (a.y - b.y), y: surface };
          line(this.connectionOverlay, a, b, 0x568b87, Math.min(12, depth * 14), 0.65);
        }
      }
      if (!blocked(link, state)) continue;
      line(this.connectionOverlay, { x: p.x - 10, y: p.y - 10 }, { x: p.x + 10, y: p.y + 10 }, rust, 4);
      line(this.connectionOverlay, { x: p.x + 10, y: p.y - 10 }, { x: p.x - 10, y: p.y + 10 }, rust, 4);
    }
    this.cartCargo.clear();
    let slot = 0;
    for (const [item, amount] of Object.entries(state.cart.cargo)) {
      if (amount <= 0) continue;
      const x = -25 + (slot % 3) * 19, y = -38 - Math.floor(slot / 3) * 15; slot++;
      this.cartCargo.rect(x, y, 16, 16).fill(item === "medicine" ? 0xb8cabe : item === "water" ? teal : 0xb69c6f).stroke({ color: ink, width: 2 });
      if (item === "medicine") this.cartCargo.rect(x + 7, y + 3, 2, 10).rect(x + 3, y + 7, 10, 2).fill(0x42645d);
    }
    this.cartCue.text = state.cart.phase === "waiting" ? "Blocked" : state.cart.phase === "loading" ? "Loading" : state.cart.phase === "unloading" ? "Unloading" : "";
    this.cartCue.visible = !!this.cartCue.text;
  }
  private personLocation(p: PersonState): Point { return this.targets.get(p.id) ?? roomFloor(this.roomDefs.get(p.roomId)!); }
  private frame() {
    if (!this.state) return;
    const reduced = this.motionPreference.matches, now = performance.now() / 1000;
    this.fps = this.app.ticker.FPS;
    for (const p of this.state.people) {
      const v = this.people.get(p.id), point = this.targets.get(p.id); if (!v || !point) continue;
      const link = p.edgeId ? this.linkDefs.get(p.edgeId) : undefined;
      const from = this.roomDefs.get(p.fromId), to = this.roomDefs.get(p.toId);
      const blend = 1 - Math.exp(-this.app.ticker.deltaMS / 45);
      const progress = this.renderedProgress.get(p.id) ?? p.edgeProgress;
      const nextProgress = reduced || !this.playing || this.snapActors.has(p.id) ? p.edgeProgress : progress + (p.edgeProgress - progress) * blend;
      this.renderedProgress.set(p.id, nextProgress);
      const rendered = link && from && to ? traversalPoint(from, to, link.kind, nextProgress) : point;
      const dx = rendered.x - v.root.x;
      if (link || reduced || !this.playing || this.snapActors.has(p.id) || (!v.root.x && !v.root.y)) v.root.position.set(rendered.x, rendered.y);
      else { v.root.x += (rendered.x - v.root.x) * blend; v.root.y += (rendered.y - v.root.y) * blend; }
      this.snapActors.delete(p.id);
      const inLift = link?.kind === "lift" && nextProgress >= LIFT_BOARD && nextProgress <= LIFT_ALIGHT;
      const walking = p.edgeId && !inLift && this.playing && !reduced && p.taskState !== "blocked";
      v.legs.rotation = walking ? Math.sin(now * 14 + (this.personDefs.get(p.id)?.appearance ?? 0)) * .18 : 0;
      if (Math.abs(dx) > .4) v.body.scale.x = dx < 0 ? -1 : 1;
      v.root.zIndex = 30; v.tag.visible = this.selected?.kind === "person" && this.selected.id === p.id;
    }
    const c = this.state.cart, link = c.edgeId ? this.linkDefs.get(c.edgeId) : undefined;
    const from = this.roomDefs.get(c.fromId), to = this.roomDefs.get(c.toId), room = this.roomDefs.get(c.roomId);
    const cartProgress = this.renderedProgress.get("cart") ?? c.progress;
    const nextCartProgress = reduced || !this.playing || this.snapActors.has("cart") ? c.progress : cartProgress + (c.progress - cartProgress) * (1 - Math.exp(-this.app.ticker.deltaMS / 45));
    this.renderedProgress.set("cart", nextCartProgress);
    const pos = link && from && to ? traversalPoint(from, to, link.kind, nextCartProgress) : room ? roomFloor(room) : { x: 0, y: 0 };
    if (link || reduced || !this.playing || this.snapActors.has("cart") || (!this.cart.x && !this.cart.y)) this.cart.position.set(pos.x, pos.y);
    else { this.cart.x += (pos.x - this.cart.x) * .25; this.cart.y += (pos.y - this.cart.y) * .25; }
    this.snapActors.delete("cart");
    this.cart.zIndex = 31;
    if (this.cameraMove) {
      const move = this.cameraMove, t = reduced ? 1 : Math.min(1, (performance.now() - move.start) / 280), ease = 1 - (1 - t) ** 3;
      this.camera.x = move.from.x + (move.to.x - move.from.x) * ease; this.camera.y = move.from.y + (move.to.y - move.from.y) * ease;
      this.zoom = move.from.zoom + (move.to.zoom - move.from.zoom) * ease; this.transform(); if (t === 1) this.cameraMove = undefined;
    } else if (this.followId) {
      const target = this.people.get(this.followId)?.root ?? (this.followId === "cart" ? this.cart : null);
      if (target) { this.camera = constrainCamera({ x: this.centerX() - target.x * this.zoom, y: this.app.screen.height / 2 - target.y * this.zoom }, this.cameraBounds, this.viewport(), this.zoom); this.transform(); }
    }
    this.selection.clear();
    const actor = this.selected?.kind === "person" ? this.people.get(this.selected.id)?.root : this.selected?.kind === "cart" ? this.cart : null;
    if (actor) this.selection.ellipse(actor.x, actor.y + 3, this.selected?.kind === "cart" ? 36 : 13, 6).stroke({ color: amber, width: 2 });
  }
  select(s: Selection) {
    this.selected = s;
    for (const [id, v] of this.rooms) {
      v.selection.clear();
      if (s.kind === "room" && s.id === id) { const room = this.roomDefs.get(id)!; v.selection.rect(2, 2, Math.max(1, room.w - 4), Math.max(1, room.h - 4)).stroke({ color: amber, width: 3 }); }
    }
  }
  focus(id: string, follow = false) {
    const room = this.roomDefs.get(id), person = this.state?.people.find(p => p.id === id), link = this.linkDefs.get(id);
    const pos = room ? { x: room.x + room.w / 2, y: room.y + room.h / 2 } : person ? this.personLocation(person) : id === "cart" ? this.cart.position : link ? traversalPoint(this.roomDefs.get(link.a)!, this.roomDefs.get(link.b)!, link.kind, .5) : null;
    if (!pos) return;
    this.followId = follow ? id : null;
    let zoom = Math.max(this.zoom, 1.05); const view = this.viewport();
    if (room) zoom = Math.max(Number.MIN_VALUE, Math.min(zoom, (view.right - view.left - 24) / room.w, (view.bottom - view.top - 24) / room.h));
    this.moveCamera(this.centerX() - pos.x * zoom, (view.top + view.bottom) / 2 - pos.y * zoom, zoom);
  }
  setInspectorOpen(open: boolean) {
    if (this.inspectorOpen === open) return;
    this.inspectorOpen = open;
    if (this.app.renderer) this.snapCamera();
  }
  private viewport(): Bounds {
    const wide = this.app.screen.width > 740;
    const hostBounds = this.host.getBoundingClientRect();
    const drawer = this.inspectorOpen ? this.host.parentElement?.querySelector<HTMLElement>(".drawer") : null;
    const fallbackDrawerWidth = wide ? 340 : Math.max(176, Math.min(340, this.app.screen.width - 164));
    const right = drawer ? Math.min(this.app.screen.width - 16, drawer.getBoundingClientRect().left - hostBounds.left - 8) : this.app.screen.width - (this.inspectorOpen ? fallbackDrawerWidth + 20 : 16);
    return {
      left: Math.min(wide ? 168 : 148, right - 32),
      top: 16,
      right,
      bottom: this.app.screen.height - 16,
    };
  }
  private centerX() {
    const v = this.viewport();
    return (v.left + v.right) / 2;
  }
  private overviewZoom() {
    return fitZoom(this.cameraBounds, this.viewport(), 0.78);
  }
  private moveCamera(x: number, y: number, zoom: number, animate = true) {
    clearTimeout(this.zoomSnap);
    const target = constrainCamera(
      { x, y },
      this.cameraBounds,
      this.viewport(),
      zoom,
    );
    if (animate && !this.motionPreference.matches)
      this.cameraMove = {
        from: { ...this.camera, zoom: this.zoom },
        to: { ...target, zoom },
        start: performance.now(),
      };
    else {
      this.cameraMove = undefined;
      this.camera = target;
      this.zoom = zoom;
      this.transform();
    }
  }
  district(d: number, animate = true) {
    const rooms = this.scenario.rooms.filter((r) => r.district === d);
    if (!rooms.length) return;
    this.followId = null;
    const points = rooms.flatMap(roomOutline),
      left = Math.min(...points.map((p) => p.x)),
      right = Math.max(...points.map((p) => p.x));
    const view = this.viewport();
    const zoom = Math.min(1.15, Math.max(this.overviewZoom(), (view.right - view.left - 24) / (right - left)));
    const top = Math.min(...points.map((p) => p.y));
    this.moveCamera(
      this.centerX() - ((left + right) / 2) * zoom,
      24 - top * zoom,
      zoom,
      animate,
    );
  }
  recenter() {
    this.followId = null;
    const b = this.cameraBounds;
    const view = this.viewport();
    const zoom = this.overviewZoom();
    this.moveCamera(
      this.centerX() - ((b.left + b.right) / 2) * zoom,
      (view.top + view.bottom) / 2 - ((b.top + b.bottom) / 2) * zoom,
      zoom,
    );
  }
  zoomBy(
    factor: number,
    x = this.app.screen.width / 2,
    y = this.app.screen.height / 2,
  ) {
    this.cameraMove = undefined;
    const minZoom = Math.min(0.22, this.zoom, this.overviewZoom());
    const next = Math.max(minZoom, Math.min(2.2, this.zoom * factor)),
      ratio = next / this.zoom;
    this.camera.x = x - (x - this.camera.x) * ratio;
    this.camera.y = y - (y - this.camera.y) * ratio;
    this.zoom = next;
    this.camera = elasticCamera(
      this.camera,
      this.cameraBounds,
      this.viewport(),
      this.zoom,
    );
    this.transform();
    clearTimeout(this.zoomSnap);
    this.zoomSnap = setTimeout(() => this.snapCamera(), 120);
  }
  pan(dx: number, dy: number) {
    clearTimeout(this.zoomSnap);
    this.cameraMove = undefined;
    this.followId = null;
    this.camera.x += dx;
    this.camera.y += dy;
    this.camera = constrainCamera(
      this.camera,
      this.cameraBounds,
      this.viewport(),
      this.zoom,
    );
    this.transform();
    this.onCamera();
  }
  private transform() {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.zoom);
    for (const v of this.rooms.values()) {
      v.name.visible = this.zoom >= 0.35;
      v.name.scale.set(1);
    }
  }
  private snapCamera() {
    if (this.down || this.destroyed) return;
    const target = constrainCamera(
      this.camera,
      this.cameraBounds,
      this.viewport(),
      this.zoom,
    );
    if (Math.hypot(target.x - this.camera.x, target.y - this.camera.y) > 0.5)
      this.moveCamera(target.x, target.y, this.zoom);
    else {
      this.camera = target;
      this.transform();
    }
  }
  private input() {
    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.onpointerdown = (e) => {
      clearTimeout(this.zoomSnap);
      this.cameraMove = undefined;
      this.pointerPositions.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      canvas.setPointerCapture(e.pointerId);
      this.down = true;
      this.moved = false;
      this.pointerStart = {
        x: e.offsetX,
        y: e.offsetY,
        cx: this.camera.x,
        cy: this.camera.y,
      };
      if (this.followId) {
        this.followId = null;
        this.onCamera();
      }
      if (this.pointerPositions.size === 2) {
        const p = [...this.pointerPositions.values()];
        this.pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      }
      canvas.style.cursor = "grabbing";
    };
    canvas.onpointermove = (e) => {
      if (!this.down) return;
      this.pointerPositions.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (this.pointerPositions.size === 2) {
        const p = [...this.pointerPositions.values()];
        const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (this.pinchDistance)
          this.zoomBy(
            dist / this.pinchDistance,
            (p[0].x + p[1].x) / 2,
            (p[0].y + p[1].y) / 2,
          );
        this.pinchDistance = dist;
        this.moved = true;
        return;
      }
      const dx = e.offsetX - this.pointerStart.x,
        dy = e.offsetY - this.pointerStart.y;
      if (Math.hypot(dx, dy) > 6) this.moved = true;
      if (this.moved) {
        this.camera.x = this.pointerStart.cx + dx;
        this.camera.y = this.pointerStart.cy + dy;
        this.camera = elasticCamera(
          this.camera,
          this.cameraBounds,
          this.viewport(),
          this.zoom,
        );
        this.transform();
        this.onCamera();
      }
    };
    canvas.onpointerup = (e) => {
      this.pointerPositions.delete(e.pointerId);
      this.down = false;
      canvas.style.cursor = "grab";
      if (this.moved) {
        this.snapCamera();
        return;
      }
      const x = (e.offsetX - this.camera.x) / this.zoom,
        y = (e.offsetY - this.camera.y) / this.zoom;
      let selected: Selection | undefined;
      if (
        Math.abs(x - this.cart.x) < 55 &&
        y > this.cart.y - 48 &&
        y < this.cart.y + 24
      )
        selected = { kind: "cart", id: "cart" };
      if (!selected && this.state) {
        const candidates: { id: string; distance: number }[] = [];
        for (const [id, p] of this.people) {
          const box = p.body.getBounds().rectangle;
          const distance = Math.hypot(x - p.root.x, y - (p.root.y - 17));
          if (
            e.offsetX >= box.x - 6 &&
            e.offsetX <= box.x + box.width + 6 &&
            e.offsetY >= box.y - 5 &&
            e.offsetY <= box.y + box.height + 10
          )
            candidates.push({ id, distance });
        }
        candidates.sort((a, b) => a.distance - b.distance);
        if (candidates.length) {
          const previous = candidates.findIndex(
            (p) => p.id === this.selected?.id,
          );
          selected = {
            kind: "person",
            id: candidates[(previous + 1) % candidates.length].id,
          };
        }
      }
      if (!selected && this.state) {
        for (const l of this.scenario.links) {
          if (!blocked(l, this.state)) continue;
          const points = pathPoints(this.roomDefs.get(l.a)!, this.roomDefs.get(l.b)!, l.kind);
          const marker = alongPath(points, 0.5);
          if (Math.hypot(x - marker.x, y - marker.y) < 16 / this.zoom) {
            selected = { kind: "link", id: l.id };
            break;
          }
        }
      }
      if (!selected) {
        const d = [...this.scenario.rooms]
          .sort((a, b) => b.y - a.y || b.x - a.x || b.id.localeCompare(a.id))
          .find((r) => containsRoom(r, { x, y }));
        if (d) selected = { kind: "room", id: d.id };
      }
      if (!selected) {
        for (const l of this.scenario.links) {
          const a = this.roomDefs.get(l.a)!,
            b = this.roomDefs.get(l.b)!;
          const points = pathPoints(a, b, l.kind);
          for (let i = 1; i < points.length; i++) {
            const p = points[i - 1],
              q = points[i],
              dx = q.x - p.x,
              dy = q.y - p.y,
              t = Math.max(
                0,
                Math.min(
                  1,
                  ((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1),
                ),
              );
            if (Math.hypot(x - (p.x + dx * t), y - (p.y + dy * t)) < 12) {
              selected = { kind: "link", id: l.id };
              break;
            }
          }
          if (selected) break;
        }
      }
      if (selected) this.onSelect(selected);
      this.snapCamera();
    };
    canvas.onpointercancel = () => {
      this.down = false;
      this.pointerPositions.clear();
      this.snapCamera();
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
    };
  }
  destroy() {
    this.destroyed = true;
    clearTimeout(this.zoomSnap);
    this.resize?.disconnect();
    this.artWarning?.remove();
    this.disposeApp();
  }
}

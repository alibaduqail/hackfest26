import {
  Application,
  Container,
  Graphics,
  Text,
  Sprite,
  Texture,
} from "pixi.js";
import type {
  PersonState,
  PersonDef,
  LinkDef,
  RoomDef,
  Scenario,
  WorldState,
} from "../engine/types";
import {
  alongPath,
  contains,
  local,
  pathPoints,
  project,
  ROOM_DEPTH,
  roomBase,
  roomOutline,
  WALL_HEIGHT,
  liftBay,
  LIFT_BOARD,
  LIFT_ALIGHT,
  traversalPoint,
  type Point,
} from "./projection";
import { blocked } from "../engine/routing";
import {
  appearance,
  cargoUnits,
  fixtureSpot,
  residentPose,
  type Pose,
} from "./presentation";
export type Selection = {
  kind: "room" | "person" | "cart" | "link";
  id: string;
};
const ink = 0x10191e,
  stone = 0x39444b,
  amber = 0xd2a76a,
  steel = 0x536973;
const rust = 0x8d6250,
  pale = 0xd0c8ac,
  teal = 0x648c8e;
function shade(color: number, factor: number) {
  return (
    (Math.min(255, Math.round((color >> 16) * factor)) << 16) |
    (Math.min(255, Math.round(((color >> 8) & 255) * factor)) << 8) |
    Math.min(255, Math.round((color & 255) * factor))
  );
}
function polygon(g: Graphics, points: Point[], color: number, alpha = 1) {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
}
function line(
  g: Graphics,
  a: Point,
  b: Point,
  color: number,
  width = 1,
  alpha = 1,
) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width, alpha });
}
function plane(
  g: Graphics,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: number,
  alpha = 1,
) {
  polygon(
    g,
    [
      local(x, z, h),
      local(x + w, z, h),
      local(x + w, z + d, h),
      local(x, z + d, h),
    ],
    color,
    alpha,
  );
}
// shortcut: fixtures use procedural geometry; replace with authored art after the direction is settled.
function block(
  g: Graphics,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: number,
  base = 0,
) {
  polygon(
    g,
    [
      local(x, z, base),
      local(x + w, z, base),
      local(x + w, z, h + base),
      local(x, z, h + base),
    ],
    shade(color, 0.76),
  );
  polygon(
    g,
    [
      local(x, z, base),
      local(x, z + d, base),
      local(x, z + d, h + base),
      local(x, z, h + base),
    ],
    shade(color, 0.56),
  );
  plane(g, x, z, w, d, h + base, color);
}
function label(text: string, x: number, y: number, size = 17, color = pale) {
  const t = new Text({
    text,
    style: {
      fontFamily: '"Aptos", "Segoe UI", sans-serif',
      fontSize: size,
      fill: color,
      fontWeight: "500",
    },
  });
  t.position.set(x, y);
  return t;
}
function glow(g: Graphics, p: Point, rx: number, ry: number, color: number) {
  for (let i = 6; i > 0; i--)
    g.ellipse(p.x, p.y, (rx * i) / 6, (ry * i) / 6).fill({
      color,
      alpha: 0.025,
    });
}
function pipe(g: Graphics, points: Point[], color: number, width = 8) {
  for (let i = 1; i < points.length; i++) {
    line(
      g,
      { x: points[i - 1].x + 2, y: points[i - 1].y + 3 },
      { x: points[i].x + 2, y: points[i].y + 3 },
      ink,
      width + 3,
    );
    line(g, points[i - 1], points[i], shade(color, 0.65), width);
    line(
      g,
      { x: points[i - 1].x, y: points[i - 1].y - 2 },
      { x: points[i].x, y: points[i].y - 2 },
      color,
      Math.max(1, width * 0.35),
    );
  }
}
function crate(g: Graphics, x: number, z: number, size = 30, h = 27, base = 0) {
  block(g, x, z, size, size * 0.8, h, 0x8e7753, base);
  line(
    g,
    local(x + 3, z, h + base - 3),
    local(x + size - 3, z, base + 3),
    0x4f4636,
    2,
  );
  line(
    g,
    local(x + size - 3, z, h + base - 3),
    local(x + 3, z, base + 3),
    0x4f4636,
    2,
  );
  plane(g, x + size * 0.45, z, 3, size * 0.8, h + base + 1, 0xb4a079);
}
function bed(g: Graphics, x: number, z: number, medical = false, base = 0) {
  block(g, x, z, 73, 38, 8, 0x414e51, base);
  block(g, x + 3, z + 2, 67, 34, 9, medical ? 0x9baaa0 : 0x687979, base + 8);
  plane(g, x + 7, z + 5, 17, 28, base + 18, 0xc9c7ae);
  plane(g, x + 28, z + 3, 40, 32, base + 18, medical ? 0x6f9995 : 0x636f73);
  for (const u of [x + 2, x + 68])
    for (const v of [z + 2, z + 34]) block(g, u, v, 4, 4, base + 18, 0x536166);
}
function plant(g: Graphics, x: number, z: number, size = 1) {
  block(g, x - 9 * size, z, 18 * size, 14 * size, 10 * size, 0x6c5c42);
  const p = local(x, z + 7, 12 * size);
  line(g, p, { x: p.x, y: p.y - 26 * size }, 0x718a68, 2);
  for (let i = 0; i < 4; i++)
    g.ellipse(
      p.x + (i % 2 ? -6 : 6) * size,
      p.y - (8 + i * 6) * size,
      8 * size,
      3 * size,
    ).fill(i % 2 ? 0x708565 : 0x93a16b);
}
function cabinet(
  g: Graphics,
  x: number,
  z: number,
  w = 48,
  h = 72,
  color = steel,
) {
  block(g, x, z, w, 29, h, color);
  const a = local(x + 6, z, h - 12),
    b = local(x + w - 6, z, h - 12);
  polygon(
    g,
    [a, b, { x: b.x, y: b.y + 18 }, { x: a.x, y: a.y + 18 }],
    0x182a30,
  );
  for (let i = 0; i < 3; i++) {
    const p = local(x + 12 + i * 10, z, h - 20);
    g.circle(p.x, p.y, 2).fill(i ? teal : amber);
  }
  for (let i = 0; i < 4; i++)
    line(
      g,
      local(x + 8, z, 12 + i * 5),
      local(x + w - 8, z, 12 + i * 5),
      0x25383f,
      2,
    );
  const p = local(x + w - 6, z, h / 2);
  g.circle(p.x, p.y, 2).fill(pale);
}
function tank(
  g: Graphics,
  x: number,
  z: number,
  r = 25,
  h = 61,
  color = steel,
) {
  const bottom = local(x, z),
    top = local(x, z, h);
  g.roundRect(bottom.x - r, bottom.y - h, r * 2, h, 6).fill(shade(color, 0.68));
  for (let i = 0; i < 6; i++)
    g.rect(
      bottom.x - r + 3 + i * r * 0.3,
      bottom.y - h + 3,
      r * 0.3,
      h - 6,
    ).fill({
      color: shade(color, 0.7 + Math.sin((i / 6) * Math.PI) * 0.48),
      alpha: 0.8,
    });
  g.ellipse(bottom.x, bottom.y, r, 9).fill(shade(color, 0.62));
  g.ellipse(top.x, top.y, r, 9)
    .fill(color)
    .stroke({ color: shade(color, 1.3), width: 1 });
  for (const dy of [h * 0.25, h * 0.75])
    g.ellipse(bottom.x, bottom.y - dy, r, 7).stroke({
      color: shade(color, 1.05),
      width: 2,
    });
  line(
    g,
    { x: bottom.x - r + 6, y: bottom.y - 4 },
    { x: top.x - r + 6, y: top.y + 2 },
    shade(color, 1.15),
    2,
  );
}
interface RoomVisual {
  root: Container;
  shade: Graphics;
  water: Graphics;
  lights: Graphics;
  status: Text;
  name: Text;
  selection: Graphics;
  fans: Container[];
  job: Graphics;
}
export class WorldRenderer {
  app = new Application();
  world = new Container();
  rooms = new Map<string, RoomVisual>();
  people = new Map<
    string,
    {
      root: Container;
      body: Sprite;
      legs: Graphics;
      cargo: Graphics;
      tag: Text;
      deck: Graphics;
      deckFront: Graphics;
      back: Texture;
      front: Texture;
      tool: Graphics;
    }
  >();
  cart = new Container();
  selection = new Graphics();
  connectionOverlay = new Graphics();
  private labels = new Container();
  private districtLabels: Text[] = [];
  state?: WorldState;
  playing = true;
  followId: string | null = null;
  selected: Selection | null = null;
  zoom = 0.65;
  camera = { x: 0, y: 0 };
  fps = 0;
  private pointerStart = { x: 0, y: 0, cx: 0, cy: 0 };
  private moved = false;
  private down = false;
  private destroyed = false;
  private resize?: ResizeObserver;
  private viewSize = { width: 0, height: 0 };
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private textures: Texture[] = [];
  private cartCargo = new Graphics();
  private cartPlatform = new Graphics();
  private cartCue = label("", -25, -63, 14, pale);
  private cartSignature = "";
  private transferUntil = 0;
  private targets = new Map<
    string,
    {
      point: Point;
      pose: Pose;
      facing: number;
      lift: boolean;
      back: boolean;
      seat: number;
    }
  >();
  private landings = new Map<
    string,
    { indicator: Graphics; gate: Graphics; status: Text }
  >();
  private liftRoomIds: Set<string>;
  private linkDefs: Map<string, LinkDef>;
  private personDefs: Map<string, PersonDef>;
  private cameraMove?: {
    from: { x: number; y: number; zoom: number };
    to: { x: number; y: number; zoom: number };
    start: number;
  };
  private inspectorOpen = false;
  private motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  private allRooms: Map<string, RoomDef>;
  private pointerPositions = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  constructor(
    public host: HTMLElement,
    public scenario: Scenario,
    public onSelect: (s: Selection) => void,
    public onCamera: () => void,
  ) {
    this.allRooms = new Map(scenario.rooms.map((r) => [r.id, r]));
    this.linkDefs = new Map(scenario.links.map((l) => [l.id, l]));
    this.personDefs = new Map(scenario.residents.map((p) => [p.id, p]));
    this.liftRoomIds = new Set(
      scenario.links
        .filter((l) => l.kind === "lift")
        .flatMap((l) => [l.a, l.b]),
    );
    const points = scenario.rooms.flatMap(roomOutline);
    this.bounds = {
      left: Math.min(...points.map((p) => p.x)) - 90,
      top: Math.min(...points.map((p) => p.y)) - 140,
      right: Math.max(...points.map((p) => p.x)) + 80,
      bottom: Math.max(...points.map((p) => p.y)) + 100,
    };
  }
  async init() {
    await this.app.init({
      resizeTo: this.host,
      background: 0x0d161c,
      antialias: true,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: "webgl",
    });
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      "aria-label",
      "Isometric Hollow settlement. Drag to pan, scroll to zoom, or use Explore to select rooms and residents with the keyboard.",
    );
    this.app.canvas.setAttribute("role", "img");
    this.app.stage.addChild(this.world);
    this.world.sortableChildren = true;
    this.drawWorld();
    this.makePeople();
    this.makeCart();
    this.world.addChild(this.connectionOverlay, this.selection);
    this.district(1, false);
    this.input();
    this.viewSize = {
      width: this.host.clientWidth,
      height: this.host.clientHeight,
    };
    this.resize = new ResizeObserver(() => {
      const width = this.host.clientWidth,
        height = this.host.clientHeight;
      this.camera.x += (width - this.viewSize.width) / 2;
      this.camera.y += (height - this.viewSize.height) / 2;
      this.viewSize = { width, height };
      this.app.resize();
      this.transform();
    });
    this.resize.observe(this.host);
    this.app.ticker.add(() => this.frame());
  }
  private pathPoints(a: RoomDef, b: RoomDef, kind: string) {
    return pathPoints(a, b, kind);
  }
  private drawWorld() {
    const back = new Graphics();
    back.zIndex = -10000;
    const b = this.bounds;
    polygon(
      back,
      [
        { x: b.left - 220, y: b.top - 180 },
        { x: b.right + 150, y: b.top + 200 },
        { x: b.right + 150, y: b.bottom + 150 },
        { x: b.left - 220, y: b.bottom + 20 },
      ],
      0x17232b,
    );
    // Authored rock grain is deterministic and never changes the simulation seed.
    for (let i = 0; i < 70; i++) {
      const y = b.top - 130 + i * 48,
        x = b.left - 170,
        span = b.right - b.left + 370;
      polygon(
        back,
        [
          { x, y },
          { x: x + span, y: y + span * 0.12 + 12 },
          { x: x + span, y: y + span * 0.12 + 45 },
          { x, y: y + 34 },
        ],
        i % 3 ? 0x18262e : 0x213039,
        0.7,
      );
      for (let j = 0; j < 9; j++) {
        const u = x + ((j * 383 + i * 71) % span),
          v = y + (u - x) * 0.12;
        line(
          back,
          { x: u, y: v },
          { x: u + 45 + (i % 51), y: v + 8 },
          0x6c7578,
          1,
          0.12,
        );
        line(
          back,
          { x: u + 17, y: v + 4 },
          { x: u + 9, y: v + 25 },
          0x07131a,
          2,
          0.55,
        );
      }
    }
    this.world.addChild(back);
    const links = new Graphics();
    links.zIndex = -5000;
    for (const l of this.scenario.links) {
      if (l.kind === "lift") continue;
      const points = this.pathPoints(
        this.allRooms.get(l.a)!,
        this.allRooms.get(l.b)!,
        l.kind,
      );
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1],
          q = points[i];
        line(
          links,
          { x: p.x, y: p.y + 10 },
          { x: q.x, y: q.y + 10 },
          0x0a1217,
          24,
        );
        line(links, p, q, 0x4a5357, 22);
        line(
          links,
          { x: p.x, y: p.y + 4 },
          { x: q.x, y: q.y + 4 },
          0x74746b,
          1,
        );
        if (l.kind !== "corridor") {
          const length = Math.hypot(q.x - p.x, q.y - p.y),
            steps = Math.max(1, Math.ceil(length / 13));
          for (let j = 0; j < steps; j++) {
            const t = j / steps,
              x = p.x + (q.x - p.x) * t,
              y = p.y + (q.y - p.y) * t;
            line(links, { x: x - 8, y }, { x: x + 8, y: y + 3 }, 0x899083, 2);
          }
        }
      }
    }
    this.world.addChild(links);
    for (const d of [...this.scenario.rooms].sort(
      (a, b) => roomBase(a).y - roomBase(b).y,
    ))
      this.drawRoom(d);
    this.drawLift();
    this.labels.zIndex = 50000;
    this.connectionOverlay.zIndex = 60000;
    this.selection.zIndex = 70000;
    this.world.addChild(this.labels);
    for (let district = 0; district < 3; district++) {
      const r = this.scenario.rooms.find(
        (r) => r.district === district && r.floor === 0,
      );
      if (!r) continue;
      const p = roomBase(r),
        l = label(
          ["Exchange", "Works", "Sump"][district],
          p.x + 45,
          p.y - 235,
          31,
          0x9ea99f,
        );
      const caption = label(
        ["Civic allocation", "Industrial sector", "Lower residential"][
          district
        ],
        p.x + 46,
        p.y - 196,
        16,
        0x657c87,
      );
      this.world.addChild(l, caption);
      this.districtLabels.push(l, caption);
    }
  }
  private drawLift() {
    // shortcut: the authored lift links form one aligned shaft; split by footprint when adding another shaft.
    const served = [...this.liftRoomIds]
      .map((id) => this.allRooms.get(id)!)
      .sort((a, b) => a.floor - b.floor);
    if (!served.length) return;
    const first = liftBay(served[0]),
      last = liftBay(served.at(-1)!),
      drop = (last.y - first.y) * 1.25;
    const rear = new Graphics(),
      near = new Graphics(),
      anchor = project(first.x, first.y, first.z);
    rear.position.set(anchor.x, anchor.y);
    near.position.copyFrom(rear.position);
    rear.zIndex = -4000;
    near.zIndex = 80000;
    polygon(
      rear,
      [
        local(0, first.d, 118),
        local(first.w, first.d, 118),
        local(first.w, first.d, -drop),
        local(0, first.d, -drop),
      ],
      0x0b141a,
    );
    polygon(
      rear,
      [
        local(first.w, 0, 118),
        local(first.w, first.d, 118),
        local(first.w, first.d, -drop),
        local(first.w, 0, -drop),
      ],
      0x27383e,
    );
    for (const x of [0, first.w]) {
      block(rear, x, first.d, 7, 8, drop + 118, 0x4a5b60, -drop);
      block(near, x, 0, 7, 8, drop + 118, 0x46565a, -drop);
      line(near, local(x + 2, 0, 118), local(x + 2, 0, -drop), 0x76817d, 1.4);
    }
    for (const x of [20, first.w - 16])
      line(
        rear,
        local(x, first.d - 3, 112),
        local(x, first.d - 3, -drop),
        0x6c7473,
        2,
      );
    block(rear, -8, 0, first.w + 22, first.d + 16, 13, 0x5b6869, 112);
    for (const room of served) {
      const base = roomBase(room),
        landing = new Container(),
        g = new Graphics(),
        x = room.w - 104;
      landing.position.set(base.x, base.y);
      landing.zIndex = base.y - 129;
      // A slab with an actual opening, and a short bridge flush with the lift threshold.
      block(g, x, 112, 104, 38, 16, 0x465356, -16);
      block(g, x, 0, 104, 12, 24, 0x3b494f, -24);
      block(g, x, 40, 28, 40, 10, 0x6b7775, -10);
      for (let z = 42; z < 80; z += 9) plane(g, x + 21, z, 5, 4, 0.4, amber);
      for (const z of [32, 88]) {
        block(g, x - 2, z, 5, 5, 39, steel);
        line(g, local(x, z, 38), local(x + 24, z, 38), 0x84908a, 3);
      }
      // Rear handrail sits behind riders. Near posts are the final occluding layer.
      line(
        g,
        local(room.w - 90, 108, 36),
        local(room.w - 7, 108, 36),
        0x75817b,
        3,
      );
      for (const u of [room.w - 90, room.w - 7])
        line(g, local(u, 108, 0), local(u, 108, 36), steel, 4);
      const indicator = new Graphics(),
        gate = new Graphics();
      const p = local(x + 22, 92, 49);
      indicator.position.set(p.x, p.y);
      const statusPos = local(x + 5, -2, -7),
        status = label(
          "",
          base.x + statusPos.x,
          base.y + statusPos.y,
          12,
          amber,
        );
      status.skew.y = Math.atan(0.22 / 0.93);
      gate.position.set(base.x, base.y);
      gate.zIndex = base.y + 75;
      landing.addChild(g, indicator);
      this.labels.addChild(status);
      this.world.addChild(landing, gate);
      this.landings.set(room.id, { indicator, gate, status });
    }
    this.world.addChild(rear, near);
  }
  private drawRoom(d: RoomDef) {
    const root = new Container(),
      base = roomBase(d);
    root.position.set(base.x, base.y);
    const g = new Graphics(),
      w = this.liftRoomIds.has(d.id) ? d.w - 104 : d.w,
      depth = ROOM_DEPTH,
      h = WALL_HEIGHT,
      deep = d.floor >= 5;
    root.zIndex = base.y - 130;
    const wall = d.district === 1 ? 0x414c52 : deep ? 0x3e4446 : 0x4a5355;
    // Open front and right walls keep people and machinery visible in the section.
    block(
      g,
      -13,
      -14,
      w + 26,
      depth + 31,
      44,
      shade(stone, deep ? 0.8 : 1.1),
      -46,
    );
    polygon(
      g,
      [
        local(-16, -18, -32),
        local(w + 17, -18, -32),
        local(w + 29, -15, -61),
        local(w - 12, -12, -79),
        local(w * 0.62, -19, -67),
        local(w * 0.3, -21, -82),
        local(-26, -18, -60),
      ],
      0x2c383f,
    );
    for (let i = 0; i < 14; i++) {
      const x = (i * 47.5 + d.floor * 11) % (w - 5),
        z = -12 - (i % 3) * 4;
      line(
        g,
        local(x, z, -37 - (i % 13)),
        local(x + 15, z, -40 - (i % 13)),
        0x68727a,
        1,
        0.25,
      );
    }
    polygon(
      g,
      [
        local(-24, depth + 23, h + 31),
        local(w + 17, depth + 28, h + 27),
        local(w + 30, depth - 10, h + 8),
        local(-10, depth - 10, h + 8),
      ],
      0x47535b,
    );
    for (let i = 0; i < 8; i++) {
      const x = (i * 73 + d.floor * 23) % w;
      polygon(
        g,
        [
          local(x, depth + 20, h + 24),
          local(Math.min(w, x + 34), depth + 20, h + 22),
          local(Math.min(w, x + 40), depth - 8, h + 9),
          local(x + 8, depth - 8, h + 10),
        ],
        i % 2 ? 0x536169 : 0x3a4952,
      );
    }
    const floorColor = [0x62665c, 0x46565a, 0x514f48][d.district];
    plane(g, 0, 0, w, depth, 0, floorColor);
    for (let x = 0; x < w; x += 44)
      for (let z = 0; z < depth; z += 38)
        plane(
          g,
          x + 1,
          z + 1,
          Math.min(42, w - x - 1),
          Math.min(36, depth - z - 1),
          0.5,
          shade(floorColor, (x + z + d.floor * 5) % 3 ? 0.92 : 1.08),
        );
    block(g, 0, depth - 10, w, 15, h, wall);
    block(g, -8, 0, 9, depth, h, shade(wall, 0.9));
    for (let x = 0; x < w; x += 62) {
      line(
        g,
        local(x, depth - 10, 0),
        local(x, depth - 10, h),
        shade(wall, 0.65),
        2,
      );
      for (let y = 23; y < h; y += 27)
        line(
          g,
          local(x, depth - 11, y),
          local(Math.min(w, x + 60), depth - 11, y),
          shade(wall, 0.72),
          1,
        );
    }
    block(g, -10, depth - 12, w + 22, 23, 11, 0x5c6563, h);
    for (let i = 0; i < 9; i++) {
      const x = 18 + ((i * 59 + d.floor * 23) % (w - 35)),
        p = local(x, depth - 12, 15 + (i % 4) * 20);
      line(g, p, { x: p.x + 4, y: p.y + 15 }, 0x29383d, 2, 0.7);
    }
    pipe(
      g,
      [
        local(12, depth - 15, h - 17),
        local(w - 15, depth - 15, h - 17),
        local(w - 15, depth - 15, 17),
      ],
      d.kind === "farm" ? 0x647e65 : 0x696c63,
      5,
    );
    // Broken paint, tie rods, and safety markings sell age without a texture dependency.
    for (const x of [14, w - 22]) {
      block(g, x, depth - 18, 7, 10, h - 4, 0x2c3b41);
      for (const y of [12, h - 10]) {
        const p = local(x + 3, depth - 19, y);
        g.circle(p.x, p.y, 2).fill(0x8b8e7e);
      }
    }
    const fans: Container[] = [];
    if (d.kind === "home" || d.kind === "clinic") {
      const medical = d.kind === "clinic";
      for (let x = 30; x < w - 75; x += medical ? 115 : 110) {
        bed(g, x, 76, medical);
        if (deep && !medical) bed(g, x, 76, false, 43);
        if (deep && !medical)
          for (const u of [x, x + 72]) block(g, u, 75, 3, 36, 65, 0x525b59);
        cabinet(g, x + 77, 92, 22, 40, medical ? 0x6c817a : 0x6e6758);
      }
      if (medical) {
        const p = local(w / 2, depth - 14, 77);
        g.rect(p.x - 4, p.y - 15, 8, 30).fill(0xb4bba5);
        g.rect(p.x - 14, p.y - 5, 28, 9).fill(0xb4bba5);
        for (let x = 92; x < w - 65; x += 115) {
          const p = local(x, 110, 73);
          line(g, local(x, 110), p, 0x9aa6a0, 2);
          line(g, p, { x: p.x + 14, y: p.y }, 0x9aa6a0, 2);
          g.roundRect(p.x + 8, p.y, 9, 17, 2).fill(0x99c3b9);
          cabinet(g, x - 5, 112, 26, 44, 0x97aaa2);
        }
        block(g, 24, 28, 45, 26, 35, 0x899e96);
        const kit = local(44, 28, 36);
        g.rect(kit.x - 3, kit.y - 13, 6, 15).fill(0xc3d3ba);
        g.rect(kit.x - 8, kit.y - 8, 16, 5).fill(0xc3d3ba);
      } else {
        for (let x = 66; x < w - 10; x += 125) {
          const p = local(x, depth - 15, 72);
          g.rect(p.x - 7, p.y - 13, 17, 22).fill(0x938565);
          g.rect(p.x - 4, p.y - 10, 11, 15).fill(0x374a50);
        }
        if (!deep) plant(g, w - 30, 40, 0.8);
        block(g, 20, 26, 52, 24, 27, 0x77644b);
        for (let x = 40; x < w - 40; x += 110) {
          plane(
            g,
            x,
            70,
            58,
            5,
            19,
            [0x94735b, 0x6f8582, 0x8e8c63][Math.floor(x / 110) % 3],
          );
          crate(g, x + 70, 35, 18, 15);
          const p = local(x + 79, 111, 50);
          line(
            g,
            { x: p.x - 7, y: p.y + 8 },
            { x: p.x + 12, y: p.y - 9 },
            0xb6a781,
            2,
          );
        }
      }
    } else if (d.kind === "farm") {
      for (const z of [39, 100]) {
        block(g, 28, z, w - 54, 34, 13, 0x6b6550);
        plane(g, 32, z + 3, w - 62, 28, 14, 0x353d32);
        for (let x = 42; x < w - 29; x += 26)
          plant(g, x, z + 10, 0.75 + (x % 3) * 0.12);
        for (let x = 60; x < w - 30; x += 112) {
          const p = local(x, z + 17, 74),
            q = local(x + 54, z + 17, 74);
          line(g, { x: p.x, y: p.y - 22 }, p, 0x6b7975, 1);
          line(g, p, q, 0xb5bd82, 4);
        }
      }
    } else if (d.kind === "workshop") {
      // Long timber bench and steel vise, with wall tools distinct from freight shelving.
      for (const x of [32, w - 56])
        for (const z of [91, 123]) block(g, x, z, 6, 6, 25, steel);
      block(g, 28, 88, w - 54, 43, 5, 0x9a8058, 25);
      block(g, w - 104, 85, 29, 26, 12, 0x788a89, 30);
      block(g, w - 111, 80, 8, 35, 8, 0x9ba5a0, 38);
      line(g, local(w - 98, 77, 35), local(w - 67, 77, 35), 0xb1b6a6, 3);
      const handle = local(w - 98, 77, 35);
      line(
        g,
        { x: handle.x + 8, y: handle.y - 7 },
        { x: handle.x + 8, y: handle.y + 8 },
        0xb1b6a6,
        3,
      );
      for (let x = 40; x < w - 35; x += 38) {
        const p = local(x, depth - 11, 79);
        line(g, p, { x: p.x + 5, y: p.y + 17 }, 0xbcaa87, 4);
        line(g, { x: p.x - 5, y: p.y }, { x: p.x + 7, y: p.y }, 0x81989b, 5);
      }
      cabinet(g, 28, 15, 40, 45, 0x526b73);
      crate(g, w - 68, 25, 30, 22);
    } else if (d.kind === "depot") {
      for (let x = 28; x < w - 60; x += 82) {
        for (const u of [x, x + 63]) block(g, u, 90, 4, 43, 83, 0x616b65);
        for (const y of [5, 39, 76]) plane(g, x, 89, 67, 45, y, 0x5b635b);
        crate(g, x + 6, 94, 24, 25, 8);
        crate(g, x + 35, 94, 23, 23, 8);
        crate(g, x + 7, 94, 25, 25, 42);
      }
      crate(g, 32, 30, 35);
      crate(g, 75, 34, 30);
      crate(g, 32, 30, 31, 25, 29);
      crate(g, 118, 31, 28);
      for (const z of [20, 71])
        line(g, local(w - 120, z, 1), local(w - 22, z, 1), amber, 2, 0.7);
      for (const x of [w - 120, w - 22])
        line(g, local(x, 20, 1), local(x, 71, 1), amber, 2, 0.7);
    } else if (d.kind === "fan" || d.kind === "plant") {
      for (let x = 70; x < w - 30; x += 120) {
        if (d.kind === "plant") {
          tank(g, x, 91, 32, 65, 0x5c7476);
          pipe(
            g,
            [
              local(x, 90, 69),
              local(x, depth - 15, h - 25),
              local(Math.min(w - 30, x + 95), depth - 15, h - 25),
            ],
            0x7d8071,
            11,
          );
          cabinet(g, x - 29, 24, 46, 35, 0x617271);
        } else {
          const p = local(x, depth - 21, 55);
          g.circle(p.x, p.y, 38)
            .fill(0x23363d)
            .stroke({ color: 0x8a9085, width: 5 });
          g.circle(p.x, p.y, 31).stroke({ color: 0x4c646b, width: 2 });
          const rotor = new Container();
          rotor.position.set(p.x, p.y);
          rotor.skew.y = 0.17;
          const blades = new Graphics();
          for (let j = 0; j < 5; j++) {
            const a = (j * Math.PI * 2) / 5;
            blades
              .ellipse(Math.cos(a) * 16, Math.sin(a) * 16, 16, 7)
              .fill(0x6d8585);
          }
          blades.circle(0, 0, 7).fill(0xb1ac8e);
          rotor.addChild(blades);
          root.addChild(rotor);
          fans.push(rotor);
          cabinet(g, x - 20, 25, 32, 38, 0x536968);
        }
      }
    } else if (d.kind === "recycler") {
      for (let x = 30; x < w - 135; x += 132) {
        block(g, x, 66, 103, 65, 30, 0x647f7e);
        plane(g, x + 6, 72, 91, 52, 31, 0x254b53);
        plane(g, x + 10, 76, 83, 44, 31.5, teal, 0.75);
        pipe(
          g,
          [
            local(x + 15, 121, 32),
            local(x + 15, 121, 65),
            local(x + 95, 121, 65),
          ],
          0xa0a58b,
          6,
        );
        line(g, local(x + 48, 70, 32), local(x + 48, 128, 32), steel, 5);
      }
      tank(g, w - 62, 110, 22, 86, 0x718583);
      pipe(
        g,
        [local(w - 62, 108, 85), local(w - 62, 30, 85), local(w - 125, 30, 38)],
        0x7d948c,
        8,
      );
      cabinet(g, 28, 20, 47, 47, 0x5a747b);
    } else if (d.kind === "tap") {
      block(g, 28, 112, w - 56, 28, 63, 0x496d76);
      for (let x = 52; x < w - 30; x += 72) {
        pipe(
          g,
          [local(x, 114, 52), local(x, 75, 52), local(x, 75, 42)],
          0xc0baa0,
          4,
        );
        block(g, x - 13, 68, 29, 23, 16, 0x6c7f79);
        tank(g, x, 73, 8, 23, 0xadc3b4);
        const p = local(x, 76, 37);
        g.circle(p.x, p.y, 5).stroke({ color: amber, width: 2 });
      }
      for (let x = 35; x < w - 40; x += 61) {
        block(g, x, 20, 19, 17, 23, 0x94ada6);
        const p = local(x + 9, 29, 25);
        g.roundRect(p.x - 5, p.y - 5, 10, 6, 2).stroke({
          color: 0xbac5b4,
          width: 2,
        });
      }
    } else if (d.kind === "pump") {
      plane(g, 40, 30, 130, 64, -1, 0x132b34);
      for (let x = 44; x < 170; x += 12)
        line(g, local(x, 30, 0), local(x, 94, 0), 0x5d787b, 3);
      block(g, 195, 76, 96, 49, 14, 0x4b6168);
      block(g, 211, 81, 66, 39, 34, 0x60868b, 14);
      const motor = local(216, 80, 32);
      g.ellipse(motor.x, motor.y, 19, 17)
        .fill(0x304e58)
        .stroke({ color: 0x8aaba9, width: 4 });
      for (let x = 230; x < 276; x += 8)
        line(g, local(x, 81, 18), local(x, 81, 44), 0x3c6571, 2);
      pipe(
        g,
        [local(102, 62, 2), local(102, 62, 22), local(213, 87, 28)],
        0x8faaa5,
        13,
      );
      pipe(
        g,
        [local(274, 108, 38), local(w - 35, 108, 38), local(w - 35, 123, 88)],
        0x799b9b,
        12,
      );
      cabinet(g, 30, 110, 46, 75, 0x526c76);
      for (const x of [w - 68, w - 36]) {
        const p = local(x, depth - 14, 76);
        g.circle(p.x, p.y, 10).fill(0xc2c5aa);
        line(g, p, { x: p.x + 4, y: p.y - 6 }, ink, 2);
      }
    } else if (d.kind === "mess") {
      for (let x = 36; x < w - 55; x += 95) {
        block(g, x, 67, 65, 30, 32, 0x83745a);
        block(g, x, 41, 65, 14, 14, 0x5b6b5e);
        block(g, x, 109, 65, 14, 14, 0x5b6b5e);
        for (const u of [x + 12, x + 46]) {
          const p = local(u, 78, 33);
          g.ellipse(p.x, p.y, 5, 3).fill(0xb7b5a2);
        }
      }
    } else if (d.kind === "gate" || d.kind === "checkpoint") {
      const p = local(w * 0.39, depth - 21, 0),
        q = local(w * 0.64, depth - 21, 0);
      polygon(
        g,
        [p, q, { x: q.x, y: q.y - 94 }, { x: p.x, y: p.y - 94 }],
        0x1d2b33,
      );
      for (let x = w * 0.4; x < w * 0.64; x += 15)
        line(g, local(x, depth - 22, 4), local(x, depth - 22, 91), 0x7d8176, 5);
      cabinet(g, w - 79, 65, 48, 64, steel);
      block(g, 30, 38, 90, 10, 52, 0x9b885a);
      for (let x = 35; x < 110; x += 19)
        line(g, local(x, 37, 49), local(x + 9, 37, 39), 0x27353a, 7);
    } else if (d.kind === "relay") {
      for (let x = 34; x < w - 38; x += 58) {
        block(g, x, 108, 41, 28, 86, 0x394d57);
        for (let h = 12; h < 80; h += 12) {
          const p = local(x + 5, 107, h);
          line(g, p, local(x + 34, 107, h), 0x7c9295, 4);
          g.circle(p.x + 3, p.y - 2, 1.6).fill(teal);
        }
      }
      block(g, 35, 31, w - 70, 30, 31, 0x788276);
      for (let x = 53; x < w - 40; x += 62) cabinet(g, x, 40, 30, 24, 0x527d83);
      pipe(g, [local(22, 129, 93), local(w - 20, 129, 93)], 0x9a8b65, 5);
    } else {
      for (let x = 34; x < w - 48; x += 64) cabinet(g, x, 91, 46, 78, steel);
      pipe(g, [local(25, 117, 14), local(w - 30, 117, 14)], 0x8a795c, 6);
    }
    // A low rail leaves the section open. Gaps mark the actual circulation route.
    for (let x = 18; x < w - 20; x += 50)
      if (Math.abs(x - w / 2) > 55) {
        line(g, local(x, 0, 0), local(x, 0, 25), rust, 3);
        line(
          g,
          local(x, 0, 25),
          local(Math.min(x + 48, w - 8), 0, 25),
          rust,
          2,
        );
      }
    const lights = new Graphics();
    lights.alpha = d.district === 2 ? 0.78 : d.district === 0 ? 0.94 : 1;
    for (let x = 52; x < w - 15; x += 146) {
      const p = local(x, depth - 22, h - 16);
      g.roundRect(p.x - 13, p.y - 4, 27, 7, 2).fill(0x302c22);
      lights.roundRect(p.x - 10, p.y - 2, 21, 4, 1).fill(0xf0ca87);
      glow(lights, p, 52, 52, 0xd6a464);
      glow(lights, local(x, 65, 0), 61, 29, 0xd7ae69);
      polygon(
        lights,
        [
          { x: p.x - 10, y: p.y + 2 },
          { x: p.x + 11, y: p.y + 2 },
          local(x + 43, 45),
          local(x - 25, 45),
        ],
        0xe4be7c,
        0.035,
      );
    }
    // Place wall-mounted rotors above the wall drawing, below the unpowered shade.
    root.addChildAt(g, 0);
    root.addChild(lights);
    const job = new Graphics();
    if (d.kind === "workshop") {
      block(job, w * 0.44, 96, 42, 23, 18, 0x66878b, 30);
      const p = local(w * 0.44 + 20, 96, 50);
      job.circle(p.x, p.y, 8).stroke({ color: 0xb3b5a1, width: 4 });
      line(
        job,
        local(w * 0.44 - 12, 95, 32),
        local(w * 0.44 + 5, 95, 50),
        amber,
        3,
      );
    }
    root.addChild(job);
    const darkness = new Graphics();
    polygon(
      darkness,
      [
        local(0, 0),
        local(w, 0),
        local(w, depth, h),
        local(0, depth, h),
        local(0, 0, h),
      ],
      0x07131b,
      0.68,
    );
    root.addChild(darkness);
    const water = new Graphics();
    root.addChild(water);
    block(
      g,
      14,
      -16,
      Math.min(w - 28, d.name.length * 9 + 28),
      3,
      24,
      0x17282e,
      -34,
    );
    const namePos = local(24, -17, -15),
      name = label(
        d.name,
        base.x + namePos.x,
        base.y + namePos.y,
        18,
        0xe0d5b7,
      );
    name.skew.y = Math.atan(0.22 / 0.93);
    this.labels.addChild(name);
    const statusPos = local(18, ROOM_DEPTH - 18, WALL_HEIGHT - 14),
      status = label("", statusPos.x, statusPos.y, 14, amber);
    root.addChild(status);
    const selection = new Graphics();
    root.addChild(selection);
    this.world.addChild(root);
    this.rooms.set(d.id, {
      root,
      shade: darkness,
      water,
      lights,
      status,
      name,
      selection,
      fans,
      job,
    });
  }
  private makePeople() {
    const figures = new Map<string, [Texture, Texture]>();
    for (const def of this.scenario.residents) {
      const a = appearance(def),
        key = `${def.role}-${def.appearance}`;
      if (!figures.has(key)) {
        const pair: Texture[] = [];
        for (const back of [false, true]) {
          const g = new Graphics(),
            w = a.width;
          g.poly([-w, -30, w - 1, -30, w + 1, -10, -w, -10]).fill(a.shirt);
          g.poly([-w, -28, -w - 3, -23, -w - 2, -13, -w + 1, -13]).fill(
            shade(a.shirt, 0.8),
          );
          g.poly([w - 2, -28, w + 2, -24, w + 2, -16, w - 1, -16]).fill(
            a.shirt,
          );
          g.circle(-w, -12, 2.5)
            .circle(w + 1, -15, 2.5)
            .fill(a.skin);
          g.rect(-3, -34, 6, 7).fill(a.skin);
          g.ellipse(0, -39, 6.4, 7.5).fill(a.skin);
          if (!back) {
            g.poly([5, -41, 8, -36, 5, -35]).fill(a.skin);
            g.circle(3, -40, 1).fill(ink);
          }
          g.ellipse(-1, -44, 6.6, 3.7).fill(a.hair);
          g.rect(-6, -43, 3, 8).fill(a.hair);
          if (back) g.ellipse(0, -40, 6, 6).fill(a.hair);
          if (a.hairStyle === 1) g.circle(-6, -41, 3.6).fill(a.hair);
          if (a.hairStyle === 2)
            g.poly([-6, -44, -8, -31, -2, -33, -1, -44]).fill(a.hair);
          if (a.technical) {
            g.roundRect(-7, -49, 14, 7, 4).fill(0xbda16b);
            g.rect(-9, -43, 19, 2).fill(0xd3b87c);
          }
          if (a.grower || a.technical) {
            g.poly([-4, -29, 4, -29, 6, -10, -6, -10]).fill(a.apron);
            g.rect(-4, -29, 2, 10).rect(3, -29, 2, 10).fill(0xc2b89a);
            g.rect(-3, -17, 7, 4).fill(shade(a.apron, 1.25));
          }
          if (a.medical) {
            g.poly([
              -7, -20, 7, -20, 9, -5, 1, -5, 0, -13, -1, -5, -8, -5,
            ]).fill(a.shirt);
            line(g, { x: -4, y: -29 }, { x: 1, y: -18 }, 0x748d88, 2);
            g.roundRect(3, -18, 9, 10, 2).fill(0x507c7d);
            g.rect(6, -16, 2, 6).rect(4, -14, 6, 2).fill(0xe5e6cc);
          }
          const texture = this.app.renderer.generateTexture({
            target: g,
            resolution: 2,
          });
          pair.push(texture);
          this.textures.push(texture);
          g.destroy();
        }
        figures.set(key, pair as [Texture, Texture]);
      }
      const [front, back] = figures.get(key)!;
      const root = new Container(),
        body = new Sprite(front);
      body.anchor.set(0.5, 1);
      body.y = -9;
      const legs = new Graphics();
      legs.rect(-5, -12, 4, 12).rect(2, -12, 4, 12).fill(0x293e48);
      legs.roundRect(-6, -2, 7, 4, 1).roundRect(2, -2, 8, 4, 1).fill(0x19272f);
      const cargo = new Graphics();
      crate(cargo, 3, -5, 16, 15);
      line(cargo, { x: 1, y: -6 }, { x: 13, y: -2 }, a.skin, 4);
      cargo.y = -18;
      cargo.visible = false;
      const tool = new Graphics();
      line(tool, { x: 4, y: -26 }, { x: 16, y: -22 }, a.skin, 3);
      line(tool, { x: 15, y: -24 }, { x: 23, y: -31 }, 0xb7bca9, 3);
      if (a.grower)
        line(tool, { x: 22, y: -34 }, { x: 27, y: -27 }, 0x9ba783, 3);
      const deck = new Graphics(),
        deckFront = new Graphics();
      block(deck, -20, -16, 40, 32, 7, 0x637a7d, -7);
      line(deck, local(-20, 16, 30), local(20, 16, 30), 0x92a19a, 2);
      for (const x of [-20, 20])
        line(deck, local(x, 16, 0), local(x, 16, 30), steel, 3);
      for (const x of [-20, 20])
        line(deckFront, local(x, -16, 0), local(x, -16, 24), steel, 3);
      line(deckFront, local(-20, -16, 12), local(20, -16, 12), 0x7b8986, 2);
      deck.visible = deckFront.visible = false;
      const tag = label(def.name.split(" ")[0], -24, -67, 16, 0xf0dfb5);
      tag.visible = false;
      root.addChild(deck, legs, body, tool, cargo, deckFront, tag);
      this.world.addChild(root);
      this.people.set(def.id, {
        root,
        body,
        legs,
        cargo,
        tag,
        deck,
        deckFront,
        front,
        back,
        tool,
      });
    }
  }
  private makeCart() {
    const g = new Graphics();
    block(this.cartPlatform, -38, -22, 76, 50, 7, steel, -9);
    line(this.cartPlatform, local(-36, 28, 34), local(36, 28, 34), 0x92a19a, 3);
    this.cartPlatform.visible = false;
    for (const z of [18, -16]) {
      if (z === -16) {
        block(g, -31, -14, 62, 35, 7, 0x599399, 8);
        plane(g, -27, -10, 54, 27, 16, 0x6f8b88);
        for (const u of [-25, 25]) block(g, u, -14, 4, 36, 10, 0x79a3a0, 15);
        for (const v of [-8, 14])
          line(g, local(-31, v, 16), local(-47, v, 33), 0x91b4ac, 4);
        line(g, local(-47, -8, 33), local(-47, 14, 33), 0xb1c5b6, 4);
      }
      for (const x of [-21, 19]) {
        const p = local(x, z, 5);
        line(g, local(x, z, 13), p, 0xb5c0ad, 3);
        g.circle(p.x, p.y, 7)
          .fill(0x101e26)
          .stroke({ color: 0x9cafaa, width: 2 });
        g.circle(p.x, p.y, 2).fill(0xc5c7af);
      }
    }
    const mark = local(-13, -15, 16),
      fleet = label("07", mark.x, mark.y - 1, 11, 0xf0e1b8);
    fleet.skew.y = Math.atan(0.22 / 0.93);
    this.cart.addChild(
      this.cartPlatform,
      g,
      this.cartCargo,
      fleet,
      this.cartCue,
    );
    this.world.addChild(this.cart);
  }
  update(state: WorldState, playing: boolean) {
    this.state = state;
    this.playing = playing;
    this.updateLiftAndCargo(state);
    const slots = new Map<string, number>();
    for (const person of state.people) {
      const def = this.personDefs.get(person.id)!,
        room = this.allRooms.get(person.roomId)!;
      const pose = residentPose(def, person, room),
        key = `${room.id}-${pose}`;
      const slot = slots.get(key) ?? 0;
      slots.set(key, slot + 1);
      const spot = fixtureSpot(
        room,
        pose,
        slot,
        this.liftRoomIds.has(room.id) ? room.w - 104 : room.w,
      );
      const link = person.edgeId ? this.linkDefs.get(person.edgeId) : undefined;
      const inLift =
        link?.kind === "lift" &&
        person.edgeProgress >= LIFT_BOARD &&
        person.edgeProgress <= LIFT_ALIGHT;
      const point = person.edgeId
        ? this.along(
            person.edgeId,
            person.fromId,
            person.toId,
            person.edgeProgress,
          )
        : project(room.x + spot.x, room.y + room.h - 15, spot.z, spot.h);
      if (inLift)
        point.x +=
          ((def.appearance % 3) - 1) *
          14 *
          Math.sin(
            (Math.PI * (person.edgeProgress - LIFT_BOARD)) /
              (LIFT_ALIGHT - LIFT_BOARD),
          );
      this.targets.set(person.id, {
        point,
        pose,
        facing: spot.facing,
        lift: inLift,
        back: pose === "work" && !appearance(def).medical,
        seat: spot.h,
      });
      const v = this.people.get(person.id)!;
      v.root.alpha = state.rooms.find((r) => r.id === room.id)?.powered
        ? 1
        : 0.74;
    }
    for (const r of state.rooms) {
      const v = this.rooms.get(r.id)!,
        d = this.allRooms.get(r.id)!;
      v.shade.visible = !r.powered;
      v.lights.visible = r.powered;
      v.status.text = r.powered ? "" : "Power lost";
      v.job.visible = r.staff > 0;
      for (const fan of v.fans) fan.alpha = r.powered ? 1 : 0.4;
      v.water.clear();
      if (d.district === 2 && d.floor >= 5 && state.waterL > 0) {
        const height = Math.min(
          62,
          (state.waterL / (this.scenario.settings.tunnelAreaM2 * 1000)) * 65,
        );
        plane(v.water, 8, 6, d.w - 16, ROOM_DEPTH - 20, height, 0x56898e, 0.52);
        polygon(
          v.water,
          [
            local(8, 6),
            local(d.w - 8, 6),
            local(d.w - 8, 6, height),
            local(8, 6, height),
          ],
          0x376874,
          0.68,
        );
        line(
          v.water,
          local(8, 6, height),
          local(d.w - 8, 6, height),
          0x9dbfb6,
          2,
          0.75,
        );
        for (let x = 25; x < d.w - 25; x += 51)
          line(
            v.water,
            local(x, 40, height + 1),
            local(x + 24, 40, height + 1),
            0xa1c1b4,
            1,
            0.5,
          );
      }
    }
    this.connectionOverlay.clear();
    for (const l of this.scenario.links) {
      if (!blocked(l, state) || l.kind === "lift") continue;
      const points = this.pathPoints(
        this.allRooms.get(l.a)!,
        this.allRooms.get(l.b)!,
        l.kind,
      );
      for (let i = 1; i < points.length; i++)
        line(
          this.connectionOverlay,
          points[i - 1],
          points[i],
          0x56898e,
          12,
          0.7,
        );
      const p = alongPath(points, 0.5);
      line(
        this.connectionOverlay,
        { x: p.x - 12, y: p.y - 12 },
        { x: p.x + 12, y: p.y + 12 },
        amber,
        4,
      );
      line(
        this.connectionOverlay,
        { x: p.x + 12, y: p.y - 12 },
        { x: p.x - 12, y: p.y + 12 },
        amber,
        4,
      );
    }
  }
  private updateLiftAndCargo(state: WorldState) {
    for (const [id, landing] of this.landings) {
      const link =
        this.scenario.links.find((l) => l.kind === "lift" && l.a === id) ??
        this.scenario.links.find((l) => l.kind === "lift" && l.b === id)!;
      const reason = blocked(link, state),
        usage = state.people.filter((p) => p.edgeId === link.id).length,
        hasCart = state.cart.edgeId === link.id;
      landing.indicator
        .clear()
        .circle(0, 0, 4)
        .fill(reason ? 0xb67a5f : usage || hasCart ? amber : teal);
      if ((usage || hasCart) && !reason)
        glow(landing.indicator, { x: 0, y: 0 }, 18, 18, amber);
      const a = this.allRooms.get(link.a)!,
        b = this.allRooms.get(link.b)!;
      landing.status.text = `L${a.floor + 1}–${b.floor + 1} · ${reason ? "No power" : `${usage}/${link.capacity}${hasCart ? " + cart" : ""}`}`;
      landing.status.style.fill = reason ? 0xe4a17b : 0xcac3a5;
      landing.gate.clear();
      if (reason) {
        const x = this.allRooms.get(id)!.w - 92;
        line(landing.gate, local(x, 40, 33), local(x, 82, 33), 0xaa785f, 5);
        line(landing.gate, local(x, 40, 12), local(x, 82, 33), 0xaa785f, 2);
      }
    }
    const signature = JSON.stringify(state.cart.cargo);
    if (signature !== this.cartSignature) {
      if (this.cartSignature) {
        this.cartCue.text =
          cargoUnits(state.cart.cargo) >
          cargoUnits(JSON.parse(this.cartSignature))
            ? "Supplies loaded"
            : "Supplies delivered";
        this.transferUntil = performance.now() + 1100;
      }
      this.cartSignature = signature;
      this.cartCargo.clear();
      let slot = 0;
      for (const [item, amount] of Object.entries(state.cart.cargo)) {
        if (amount <= 0) continue;
        const count = Math.min(4, Math.max(1, Math.ceil(amount / 12)));
        for (let i = 0; i < count; i++, slot++) {
          const x = -26 + (slot % 3) * 18,
            z = -8 + (Math.floor(slot / 3) % 2) * 17;
          block(
            this.cartCargo,
            x,
            z,
            18,
            15,
            24,
            item === "medicine" ? 0xa7bfb3 : item === "water" ? teal : 0xad945e,
            16,
          );
          plane(this.cartCargo, x + 7, z, 3, 15, 40.5, 0xd8c598);
          line(
            this.cartCargo,
            local(x + 8, z, 16),
            local(x + 8, z, 40),
            0xd8c598,
            2,
          );
          if (item === "medicine") {
            const p = local(x + 9, z, 28);
            this.cartCargo
              .rect(p.x - 1, p.y - 4, 3, 9)
              .rect(p.x - 4, p.y - 1, 9, 3)
              .fill(0x315e66);
          }
        }
      }
      if (slot)
        for (const x of [-18, 17])
          pipe(
            this.cartCargo,
            [
              local(x, -12, 16),
              local(x, -8, 42),
              local(x, 24, 42),
              local(x, 21, 16),
            ],
            0xc0b58b,
            2,
          );
    }
  }
  private location(roomId: string, id: number) {
    const r = this.allRooms.get(roomId)!;
    return project(
      r.x + 36 + ((id * 37) % Math.max(40, r.w - 80)),
      r.y + r.h - 15,
      24 + (id % 4) * 18,
    );
  }
  private along(edge: string, from: string, to: string, progress: number) {
    const l = this.linkDefs.get(edge)!;
    return traversalPoint(
      this.allRooms.get(from)!,
      this.allRooms.get(to)!,
      l.kind,
      progress,
    );
  }
  private personLocation(p: PersonState) {
    return this.targets.get(p.id)?.point ?? this.location(p.roomId, 0);
  }
  private frame() {
    if (!this.state) return;
    const now = performance.now() / 1000;
    this.reduced = this.motionPreference.matches;
    this.fps = this.app.ticker.FPS;
    for (const p of this.state.people) {
      const v = this.people.get(p.id)!,
        target = this.targets.get(p.id)!,
        pos = target.point;
      const dx = pos.x - v.root.x;
      if (this.reduced || !this.playing || (!v.root.x && !v.root.y))
        v.root.position.set(pos.x, pos.y);
      else {
        const blend = 1 - Math.exp(-this.app.ticker.deltaMS / 45);
        v.root.x += (pos.x - v.root.x) * blend;
        v.root.y += (pos.y - v.root.y) * blend;
      }
      v.root.zIndex = v.root.y;
      const walking =
        !!p.edgeId &&
        !target.lift &&
        this.playing &&
        !this.reduced &&
        p.taskState !== "blocked";
      if (!p.edgeId) v.body.scale.x = target.facing;
      else if (Math.abs(dx) > 0.4) v.body.scale.x = dx < 0 ? -1 : 1;
      v.body.texture = target.back ? v.back : v.front;
      v.body.y = target.pose === "sit" ? (target.seat > 0 ? 6 : 0) : -9;
      v.body.rotation =
        target.pose === "sleep"
          ? Math.PI / 2
          : target.pose === "bend"
            ? 0.58 * v.body.scale.x
            : walking
              ? Math.sin(now * 14) * 0.035
              : 0;
      v.legs.scale.y = target.pose === "sit" ? 0.5 : 1;
      v.legs.y = target.pose === "sit" && target.seat > 0 ? 12 : 0;
      v.legs.rotation =
        target.pose === "sleep"
          ? Math.PI / 2
          : target.pose === "sit"
            ? -0.65
            : walking
              ? Math.sin(now * 14 + this.personDefs.get(p.id)!.appearance) * 0.2
              : 0;
      v.cargo.visible = cargoUnits(p.bag) > 0;
      v.cargo.scale.x = v.body.scale.x;
      v.cargo.y = -18 + (walking ? Math.sin(now * 14) : 0);
      v.tool.visible =
        (target.pose === "work" &&
          appearance(this.personDefs.get(p.id)!).technical) ||
        target.pose === "bend";
      v.tool.scale.x = v.body.scale.x;
      v.tool.y = target.pose === "bend" ? 10 : 0;
      v.deck.visible = v.deckFront.visible = target.lift;
      v.tag.visible = this.selected?.id === p.id;
    }
    const c = this.state.cart,
      pos = c.edgeId
        ? this.along(c.edgeId, c.fromId, c.toId, c.progress)
        : (() => {
            const r = this.allRooms.get(c.roomId)!;
            return project(
              r.x + (this.liftRoomIds.has(r.id) ? r.w - 104 : r.w) - 88,
              r.y + r.h - 15,
              48,
            );
          })();
    if (this.reduced || !this.playing || (!this.cart.x && !this.cart.y))
      this.cart.position.set(pos.x, pos.y);
    else {
      this.cart.x += (pos.x - this.cart.x) * 0.25;
      this.cart.y += (pos.y - this.cart.y) * 0.25;
    }
    this.cart.zIndex = this.cart.y + 3;
    this.cartPlatform.visible = Boolean(
      c.edgeId &&
      this.linkDefs.get(c.edgeId)?.kind === "lift" &&
      c.progress >= LIFT_BOARD &&
      c.progress <= LIFT_ALIGHT,
    );
    this.cartCue.visible =
      performance.now() < this.transferUntil || c.phase === "waiting";
    if (c.phase === "waiting") this.cartCue.text = "Route blocked";
    for (const [id, v] of this.rooms)
      if (
        this.playing &&
        this.state.rooms.find((r) => r.id === id)!.powered &&
        !this.reduced
      )
        for (const fan of v.fans) fan.children[0].rotation += 0.045;
    if (this.cameraMove) {
      const move = this.cameraMove,
        t = this.reduced
          ? 1
          : Math.min(1, (performance.now() - move.start) / 280),
        ease = 1 - (1 - t) ** 3;
      this.camera.x = move.from.x + (move.to.x - move.from.x) * ease;
      this.camera.y = move.from.y + (move.to.y - move.from.y) * ease;
      this.zoom = move.from.zoom + (move.to.zoom - move.from.zoom) * ease;
      this.transform();
      if (t === 1) this.cameraMove = undefined;
    } else if (this.followId) {
      const view =
        this.people.get(this.followId)?.root ??
        (this.followId === "cart" ? this.cart : null);
      if (view) {
        this.camera.x = this.centerX() - view.x * this.zoom;
        this.camera.y = this.app.screen.height / 2 - view.y * this.zoom;
        this.transform();
      }
    }
    this.selection.clear();
    const actor =
      this.selected?.kind === "person"
        ? this.people.get(this.selected.id)?.root
        : this.selected?.kind === "cart"
          ? this.cart
          : null;
    if (actor)
      this.selection
        .ellipse(
          actor.x,
          actor.y + 5,
          this.selected?.kind === "cart" ? 32 : 15,
          6,
        )
        .stroke({ color: amber, width: 2 });
  }
  select(s: Selection) {
    this.selected = s;
    for (const [id, v] of this.rooms) {
      v.selection.clear();
      if (s.kind === "room" && s.id === id) {
        const w = this.allRooms.get(id)!.w;
        const points = [
          local(0, 0),
          local(w, 0),
          local(w, ROOM_DEPTH),
          local(0, ROOM_DEPTH),
          local(0, 0),
        ];
        for (let i = 1; i < points.length; i++)
          line(v.selection, points[i - 1], points[i], amber, 3);
      }
    }
  }
  focus(id: string, follow = false) {
    const d = this.allRooms.get(id),
      p = this.state?.people.find((p) => p.id === id),
      link = this.linkDefs.get(id);
    const pos = d
      ? project(d.x + d.w / 2, d.y + d.h - 15, 65, 30)
      : p
        ? this.personLocation(p)
        : id === "cart"
          ? this.cart.position
          : link
            ? traversalPoint(
                this.allRooms.get(link.a)!,
                this.allRooms.get(link.b)!,
                link.kind,
                0.5,
              )
            : null;
    if (!pos) return;
    this.followId = follow ? id : null;
    const zoom = Math.max(this.zoom, 1.05);
    this.moveCamera(
      this.centerX() - pos.x * zoom,
      this.app.screen.height * 0.5 - pos.y * zoom,
      zoom,
    );
  }
  setInspectorOpen(open: boolean) {
    this.inspectorOpen = open;
  }
  private centerX() {
    return (170 + this.app.screen.width - (this.inspectorOpen ? 380 : 0)) / 2;
  }
  private moveCamera(x: number, y: number, zoom: number, animate = true) {
    if (animate && !this.motionPreference.matches)
      this.cameraMove = {
        from: { ...this.camera, zoom: this.zoom },
        to: { x, y, zoom },
        start: performance.now(),
      };
    else {
      this.cameraMove = undefined;
      this.camera = { x, y };
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
    const zoom = Math.min(
      1.15,
      Math.max(0.6, (this.host.clientWidth - 140) / (right - left)),
    );
    const top = Math.min(...points.map((p) => p.y));
    this.moveCamera(
      this.centerX() - ((left + right) / 2) * zoom,
      115 - top * zoom,
      zoom,
      animate,
    );
  }
  recenter() {
    this.followId = null;
    const b = this.bounds;
    const zoom = Math.min(
      0.78,
      (this.host.clientWidth - 220 - (this.inspectorOpen ? 380 : 0)) /
        (b.right - b.left),
      (this.host.clientHeight - 150) / (b.bottom - b.top),
    );
    this.moveCamera(
      this.centerX() - ((b.left + b.right) / 2) * zoom,
      80 - b.top * zoom,
      Math.max(0.22, zoom),
    );
  }
  zoomBy(
    factor: number,
    x = this.app.screen.width / 2,
    y = this.app.screen.height / 2,
  ) {
    this.cameraMove = undefined;
    const next = Math.max(0.22, Math.min(2.2, this.zoom * factor)),
      ratio = next / this.zoom;
    this.camera.x = x - (x - this.camera.x) * ratio;
    this.camera.y = y - (y - this.camera.y) * ratio;
    this.zoom = next;
    this.transform();
  }
  pan(dx: number, dy: number) {
    this.cameraMove = undefined;
    this.followId = null;
    this.camera.x += dx;
    this.camera.y += dy;
    this.transform();
    this.onCamera();
  }
  private transform() {
    const b = this.bounds;
    this.camera.x = Math.max(
      -b.right * this.zoom + 100,
      Math.min(this.app.screen.width - 100 - b.left * this.zoom, this.camera.x),
    );
    this.camera.y = Math.max(
      -b.bottom * this.zoom + 100,
      Math.min(this.app.screen.height - 100 - b.top * this.zoom, this.camera.y),
    );
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.zoom);
    for (const v of this.rooms.values()) {
      v.name.visible = this.zoom >= 0.35;
      v.name.scale.set(1);
    }
    for (const text of this.districtLabels) text.visible = this.zoom < 0.6;
  }
  private input() {
    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.onpointerdown = (e) => {
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
      this.followId = null;
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
        this.transform();
        this.onCamera();
      }
    };
    canvas.onpointerup = (e) => {
      this.pointerPositions.delete(e.pointerId);
      this.down = false;
      canvas.style.cursor = "grab";
      if (this.moved) return;
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
      if (!selected) {
        const d = [...this.scenario.rooms]
          .sort((a, b) => roomBase(b).y - roomBase(a).y)
          .find((r) => contains(roomOutline(r), { x, y }));
        if (d) selected = { kind: "room", id: d.id };
      }
      if (!selected) {
        for (const l of this.scenario.links) {
          const a = this.allRooms.get(l.a)!,
            b = this.allRooms.get(l.b)!;
          const points = this.pathPoints(a, b, l.kind);
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
    };
    canvas.onpointercancel = () => {
      this.down = false;
      this.pointerPositions.clear();
    };
    canvas.onwheel = (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY);
    };
  }
  destroy() {
    this.destroyed = true;
    this.resize?.disconnect();
    if (this.app.renderer) {
      this.app.destroy(true, { children: true });
      for (const t of this.textures) t.destroy(true);
    }
  }
}

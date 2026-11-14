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
  RoomDef,
  RoomState,
  Scenario,
  WorldState,
} from "../engine/types";
export type Selection = {
  kind: "room" | "person" | "cart" | "link";
  id: string;
};
const palette = {
  stone: 0x243033,
  edge: 0x5b6660,
  cream: 0xdfd7bb,
  amber: 0xd6a05c,
  green: 0x819e83,
  blue: 0x6da2a4,
};
function rect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha = 1,
) {
  g.rect(x, y, w, h).fill({ color, alpha });
}
function line(
  g: Graphics,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color: number,
  width = 1,
  alpha = 1,
) {
  g.moveTo(x, y).lineTo(x2, y2).stroke({ color, width, alpha });
}
function label(
  text: string,
  x: number,
  y: number,
  size = 12,
  color = 0xb4b8a2,
) {
  const t = new Text({
    text,
    style: {
      fontFamily: "monospace",
      fontSize: size,
      fill: color,
      letterSpacing: 1,
    },
  });
  t.position.set(x, y);
  return t;
}
function crate(g: Graphics, x: number, y: number, w = 26) {
  rect(g, x, y, w, w * 0.75, 0x806143);
  rect(g, x + 2, y + 2, w - 4, w * 0.75 - 4, 0xa38558);
  line(g, x + 2, y + 2, x + w - 2, y + w * 0.75 - 2, 0x594b3e, 2);
  line(g, x + w - 2, y + 2, x + 2, y + w * 0.75 - 2, 0x594b3e, 2);
}
function bed(g: Graphics, x: number, y: number) {
  rect(g, x, y + 21, 70, 6, 0x526368);
  rect(g, x + 4, y, 64, 23, 0x76958c);
  rect(g, x + 7, y + 2, 17, 16, 0xd2c9aa);
  rect(g, x + 25, y + 3, 41, 18, 0x687b75);
  line(g, x, y + 5, x, y + 35, 0x7d8883, 3);
  line(g, x + 69, y + 13, x + 69, y + 35, 0x7d8883, 3);
}
function plant(g: Graphics, x: number, y: number, scale = 1) {
  rect(g, x - 8 * scale, y, 16 * scale, 9 * scale, 0x7b5c42);
  line(g, x, y, x, y - 22 * scale, 0x82a578, 2);
  g.ellipse(x - 5 * scale, y - 15 * scale, 8 * scale, 3 * scale).fill(0x71916c);
  g.ellipse(x + 5 * scale, y - 22 * scale, 7 * scale, 3 * scale).fill(0x96ad70);
}
function machine(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color = 0x496064,
) {
  rect(g, x, y, w, h, 0x1e2d30);
  rect(g, x + 3, y + 3, w - 6, h - 6, color);
  rect(g, x + 8, y + 8, w - 16, Math.min(24, h * 0.35), 0x22383b);
  for (let i = 0; i < 3; i++) {
    rect(g, x + 12 + i * 12, y + 13, 6, 6, i === 0 ? 0xa8b279 : 0x718f87);
  }
  for (let i = 0; i < 5; i++)
    line(
      g,
      x + 8,
      y + h - 12 - i * 4,
      x + w - 8,
      y + h - 12 - i * 4,
      0x24383a,
      2,
    );
}
interface RoomVisual {
  root: Container;
  shade: Graphics;
  water: Graphics;
  lights: Graphics;
  status: Text;
  fan?: Container;
  selection: Graphics;
  growth?: Graphics;
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
    }
  >();
  cart = new Container();
  selection = new Graphics();
  connectionOverlay = new Graphics();
  state?: WorldState;
  playing = true;
  followId: string | null = null;
  selected: Selection | null = null;
  zoom = 0.48;
  camera = { x: 0, y: 0 };
  fps = 0;
  private pointerStart = { x: 0, y: 0, cx: 0, cy: 0 };
  private moved = false;
  private down = false;
  private destroyed = false;
  private resize?: ResizeObserver;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private textures: Texture[] = [];
  private allRooms: Map<string, RoomDef>;
  private pointerPositions = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  constructor(
    public host: HTMLElement,
    public scenario: Scenario,
    public onSelect: (s: Selection) => void,
    public onCamera: () => void,
  ) {
    this.allRooms = new Map(scenario.rooms.map((r) => [r.id, r]));
  }
  async init() {
    await this.app.init({
      resizeTo: this.host,
      background: 0x10191d,
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
      "Living cutaway of the Hollow. Drag to pan; scroll to zoom. Use Explore for keyboard accessible locations and people.",
    );
    this.app.canvas.setAttribute("role", "img");
    this.app.stage.addChild(this.world);
    this.drawWorld();
    this.makePeople();
    this.makeCart();
    this.world.addChild(this.connectionOverlay);
    this.world.addChild(this.selection);
    this.recenter();
    this.input();
    this.resize = new ResizeObserver(() => {
      this.app.resize();
      this.transform();
    });
    this.resize.observe(this.host);
    this.app.ticker.add(() => this.frame());
  }
  private drawWorld() {
    const back = new Graphics();
    rect(back, -150, -200, 3200, 2400, 0x202b2c);
    for (let i = 0; i < 1250; i++) {
      const x = ((i * 127.71) % 3000) - 70,
        y = (i * 83.19) % 2100;
      line(
        back,
        x,
        y,
        x + 5 + (i % 13),
        y - 3,
        i % 3 ? 0x2d3837 : 0x38423c,
        1,
        0.5,
      );
    }
    rect(back, -100, -60, 3100, 265, 0x142127);
    for (let i = 0; i < 60; i++) {
      const x = i * 53;
      const h = 30 + ((i * 37) % 120);
      rect(back, x, 165 - h, 31, h, 0x283739, 0.6);
      rect(back, x + 5, 170 - h, 10, h - 6, 0x1b2c31);
    }
    line(back, -100, 204, 3000, 204, 0x7b8069, 5);
    line(back, -100, 217, 3000, 217, 0x3b4843, 13);
    this.world.addChild(back);
    const sky = label(
      "THE SURFACE  /  NO VERIFIED RETURN IN 30 YEARS",
      155,
      120,
      15,
      0x71868a,
    );
    this.world.addChild(sky);
    const gate = new Graphics();
    rect(gate, 180, 157, 170, 48, 0x3c4c49);
    for (let i = 0; i < 6; i++)
      line(gate, 185, 160 + i * 7, 345, 160 + i * 7, 0x7d8980, 2);
    rect(gate, 245, 137, 42, 20, 0x465a55);
    this.world.addChild(gate);
    this.world.addChild(label("SEALED", 228, 174, 12, 0xd5b578));
    for (const [d, title] of [
      "THE EXCHANGE",
      "THE WORKS",
      "THE SUMP",
    ].entries()) {
      this.world.addChild(
        label(`0${d + 1}  /  ${title}`, 130 + d * 840, 245, 20, 0xd3c9a6),
      );
      this.world.addChild(
        label(
          [
            "CARE · DISTRIBUTION · DIRECTORATE",
            "ENERGY · CULTIVATION · RECLAMATION",
            "HOMES · SHARED WATER · DRAINAGE",
          ][d],
          130 + d * 840,
          270,
          10,
          0x81928b,
        ),
      );
    }
    for (let floor = 0; floor < 8; floor++) {
      this.world.addChild(
        label(
          `L${String(floor + 1).padStart(2, "0")}`,
          25,
          350 + floor * 178,
          22,
          0x6a827c,
        ),
      );
      this.world.addChild(
        label(`−${(floor + 1) * 40}m`, 25, 378 + floor * 178, 11, 0x647a75),
      );
    }
    const links = new Graphics();
    for (const l of this.scenario.links) {
      const a = this.allRooms.get(l.a)!,
        b = this.allRooms.get(l.b)!;
      const points = this.pathPoints(a, b, l.kind);
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1],
          q = points[i];
        line(links, p.x, p.y, q.x, q.y, 0x101b1d, l.kind === "lift" ? 27 : 19);
        line(links, p.x, p.y + 9, q.x, q.y + 9, 0x657168, 2);
        if (l.kind === "stairs" || l.kind === "sump") {
          const steps = 12;
          for (let j = 0; j < steps; j++) {
            const x = p.x + ((q.x - p.x) * j) / steps,
              y = p.y + ((q.y - p.y) * j) / steps;
            line(links, x - 5, y, x + 9, y, 0x7d8b7b, 2);
          }
        }
        if (l.kind === "lift") {
          line(links, p.x - 10, p.y, p.x - 10, q.y, 0x8d9c8d, 2);
          line(links, p.x + 10, p.y, p.x + 10, q.y, 0x8d9c8d, 2);
        }
      }
    }
    this.world.addChild(links);
    for (const def of this.scenario.rooms) this.drawRoom(def);
  }
  private pathPoints(a: RoomDef, b: RoomDef, kind: string) {
    const x1 = a.x + a.w * 0.5,
      y1 = a.y + a.h - 15,
      x2 = b.x + b.w * 0.5,
      y2 = b.y + b.h - 15;
    if (y1 === y2)
      return [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
    const shaft = kind === "lift" ? a.x + a.w - 24 : a.x + 22;
    return [
      { x: x1, y: y1 },
      { x: shaft, y: y1 },
      { x: shaft, y: y2 },
      { x: x2, y: y2 },
    ];
  }
  private drawRoom(d: RoomDef) {
    const root = new Container();
    root.position.set(d.x, d.y);
    const g = new Graphics(),
      w = d.w,
      h = d.h;
    const deep = d.floor >= 5;
    const wall = deep ? 0x454b42 : d.district === 1 ? 0x3a5152 : 0x4a5b50;
    rect(g, -7, -7, w + 14, h + 20, 0x111d1f);
    rect(g, 0, 0, w, h, wall);
    rect(g, 6, 6, w - 12, h - 12, deep ? 0x343f38 : 0x33483f);
    rect(g, 8, 8, w - 16, 17, deep ? 0x59604a : 0x5a6e57, 0.7);
    for (let x = 10; x < w; x += 44) {
      line(g, x, 26, x, h - 12, wall, 1, 0.6);
      for (let y = 35; y < h - 20; y += 25) {
        line(g, x, y, x + 40, y, wall, 1, 0.45);
      }
    }
    rect(g, 0, h - 15, w, 15, 0x45574d);
    rect(g, 0, h - 15, w, 3, 0x96a18b);
    rect(g, 0, h, w, 10, 0x182724);
    for (let x = 4; x < w; x += 25) rect(g, x, h + 2, 15, 3, 0x546252);
    line(g, 0, 0, w, 0, 0xa8b39a, 3);
    line(g, 0, 0, 0, h, 0x718477, 5);
    line(g, w, 0, w, h, 0x718477, 5);
    // The same authored room bounds contain fixtures and walk anchors.
    if (d.kind === "home") {
      const rows = deep ? 2 : 1;
      for (let x = 45; x < w - 65; x += 85) {
        for (let j = 0; j < rows; j++) bed(g, x, h - 48 - j * 42);
        if (rows === 2) {
          line(g, x - 4, h - 97, x - 4, h - 13, 0x7d8b7d, 3);
          line(g, x + 74, h - 97, x + 74, h - 13, 0x7d8b7d, 3);
        }
      }
      if (!deep) {
        plant(g, w - 30, h - 31, 0.7);
        rect(g, 20, h - 50, 20, 30, 0x755f43);
      }
    } else if (d.kind === "clinic") {
      for (let x = 40; x < w - 60; x += 95) bed(g, x, h - 50);
      machine(g, w - 48, 45, 29, 50, 0x899b8c);
      rect(g, 21, 38, 30, 30, 0xbabda2);
      rect(g, 32, 43, 7, 20, 0x739489);
      rect(g, 26, 50, 20, 7, 0x739489);
    } else if (d.kind === "farm") {
      for (let row = 0; row < 2; row++) {
        rect(g, 35, 65 + row * 31, w - 65, 8, 0x736d49);
        for (let x = 48; x < w - 30; x += 35) plant(g, x, 64 + row * 31, 0.7);
      }
      for (let x = 45; x < w - 30; x += 80) {
        line(g, x, 25, x, 38, 0x8c9d7b, 2);
        rect(g, x - 20, 37, 40, 5, 0xddcc85);
      }
    } else if (d.kind === "depot" || d.kind === "workshop") {
      for (let x = 40; x < w - 50; x += 75) {
        rect(g, x, 44, 61, h - 60, 0x233830);
        line(g, x, 44, x, h - 17, 0x8b9b83, 3);
        line(g, x + 60, 44, x + 60, h - 17, 0x8b9b83, 3);
        line(g, x, 80, x + 60, 80, 0xa3aa8e, 3);
        crate(g, x + 5, 57, 21);
        crate(g, x + 29, 56, 25);
        crate(g, x + 5, 94, 24);
        crate(g, x + 31, 94, 24);
      }
      if (d.kind === "workshop") {
        rect(g, 45, 97, w - 90, 9, 0x947f55);
        for (let x = 60; x < w - 70; x += 42)
          line(g, x, 106, x, 124, 0x738b7d, 4);
      }
    } else if (d.kind === "recycler" || d.kind === "tap") {
      for (let x = 50; x < w - 45; x += 85) {
        g.roundRect(x, 43, 55, 72, 14).fill(0x54777a);
        rect(g, x + 5, 52, 45, 46, 0x42626a);
        line(g, x + 12, 66, x + 42, 66, 0x8db5b0, 2);
        line(g, x + 55, 103, x + 77, 103, 0x899b92, 6);
        line(g, x + 77, 103, x + 77, 120, 0x899b92, 6);
        g.circle(x + 28, 63, 10)
          .fill(0x1f3e43)
          .stroke({ color: 0x93b4ac, width: 2 });
      }
    } else if (d.kind === "fan") {
      for (let x = 80; x < w - 50; x += 130) {
        g.circle(x, 76, 34)
          .fill(0x1b3033)
          .stroke({ color: 0x829a92, width: 5 });
        for (let a = 0; a < 4; a++)
          line(g, x - 38, 55 + a * 14, x + 38, 55 + a * 14, 0x46625d, 1);
      }
    } else if (d.kind === "plant") {
      for (let x = 48; x < w - 70; x += 100) {
        machine(g, x, 48, 85, 65, 0x637773);
        g.circle(x + 43, 80, 25)
          .fill(0x1a3338)
          .stroke({ color: 0x84988b, width: 4 });
        for (let j = 0; j < 4; j++)
          line(g, x + 27 + j * 10, 62, x + 27 + j * 10, 99, 0x6f8d85, 3);
        line(g, x + 40, 35, x + 40, 49, 0x8d9b88, 13);
      }
      line(g, 30, 35, w - 28, 35, 0x8d9b88, 12);
    } else if (d.kind === "pump") {
      machine(g, 60, 68, 110, 50, 0x56747a);
      line(g, 165, 86, 235, 86, 0x859d95, 10);
      line(g, 235, 86, 235, 120, 0x859d95, 10);
      line(g, 235, 120, w - 35, 120, 0x859d95, 10);
      for (let x = 285; x < w - 40; x += 45) {
        rect(g, x, 38, 30, 44, 0x273d40);
        g.circle(x + 15, 57, 10).fill(0xb3bd9d);
        line(g, x + 15, 57, x + 20, 51, 0x31494c, 2);
      }
      line(g, 27, 45, 27, 121, 0xbbc8ad, 2);
      for (let y = 50; y < 121; y += 12) line(g, 27, y, 38, y, 0xbbc8ad, 2);
    } else if (d.kind === "checkpoint" || d.kind === "gate") {
      rect(g, w * 0.35, 30, w * 0.3, h - 45, 0x192c2e);
      for (let x = w * 0.35; x < w * 0.65; x += 14)
        line(g, x, 30, x, h - 16, 0x8c9986, 4);
      rect(g, 35, 73, 70, 11, 0x8c7f58);
      machine(g, w - 82, 56, 51, 56);
    } else if (d.kind === "mess") {
      for (let x = 55; x < w - 50; x += 90) {
        rect(g, x, 86, 65, 9, 0x9c8c61);
        line(g, x + 7, 94, x + 7, 122, 0x777d60, 3);
        line(g, x + 58, 94, x + 58, 122, 0x777d60, 3);
        rect(g, x - 5, 104, 18, 5, 0x738973);
        rect(g, x + 55, 104, 18, 5, 0x738973);
      }
    } else {
      for (let x = 45; x < w - 45; x += 65) machine(g, x, 40, 50, 76);
    }
    for (let x = 35; x < w - 20; x += 130) {
      line(g, x, 7, x, 22, 0x899b86, 2);
      rect(g, x - 20, 21, 40, 5, 0xe1d7a2);
      g.poly([x - 20, 27, x + 20, 27, x + 55, h - 16, x - 55, h - 16]).fill({
        color: 0xe0d9a4,
        alpha: 0.035,
      });
    }
    root.addChild(g);
    const lights = new Graphics();
    root.addChild(lights);
    const shade = new Graphics();
    rect(shade, 4, 7, w - 8, h - 21, 0x09191f, 0.62);
    root.addChild(shade);
    const water = new Graphics();
    root.addChild(water);
    const status = label("", w - 95, 9, 10, 0xc5cfb3);
    root.addChild(status);
    root.addChild(label(d.name.toUpperCase(), 12, -23, 11, 0xc7cbb2));
    const selection = new Graphics();
    root.addChild(selection);
    let fan: Container | undefined;
    if (d.kind === "fan") {
      fan = new Container();
      fan.position.set(80, 76);
      const blades = new Graphics();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        blades
          .ellipse(
            Math.cos(a) * 15,
            Math.sin(a) * 15,
            Math.abs(Math.sin(a)) * 10 + 3,
            Math.abs(Math.cos(a)) * 10 + 3,
          )
          .fill(0x8aa69b);
      }
      fan.addChild(blades);
      root.addChild(fan);
    }
    this.world.addChild(root);
    this.rooms.set(d.id, {
      root,
      shade,
      water,
      lights,
      status,
      fan,
      selection,
    });
  }
  private makePeople() {
    const colors = [
      0xb89b64, 0x879e85, 0x6e999b, 0x997e6e, 0xc3b89b, 0x8f91a1, 0x9baf92,
      0xab925d,
    ];
    for (let i = 0; i < 24; i++) {
      const g = new Graphics();
      const skin = [0xd2ac88, 0xb38362, 0x825f4a, 0xe2c4a0][i % 4];
      g.ellipse(0, 2, 8, 3).fill({ color: 0x0c1719, alpha: 0.45 });
      rect(g, -5, -22, 10, 17, colors[i % 8]);
      rect(g, -7, -20, 3, 12, skin);
      rect(g, 5, -20, 3, 12, skin);
      g.circle(0, -28, 6).fill(skin);
      g.ellipse(0, -32, 6, 3).fill(i % 3 ? 0x3c3c35 : 0xb1a899);
      rect(g, -4, -23, 8, 2, 0xe1d1a2);
      if (i % 4 === 0) {
        rect(g, -6, -35, 12, 3, 0xe1bc61);
        rect(g, -4, -38, 8, 4, 0xd6ae56);
      }
      const texture = this.app.renderer.generateTexture({
        target: g,
        resolution: 2,
      });
      this.textures.push(texture);
      g.destroy();
    }
    for (const def of this.scenario.residents) {
      const root = new Container();
      const body = new Sprite(this.textures[def.appearance % 24]);
      body.anchor.set(0.5, 1);
      const legs = new Graphics();
      rect(legs, -4, -7, 3, 10, 0x243e47);
      rect(legs, 2, -7, 3, 10, 0x263f49);
      const cargo = new Graphics();
      crate(cargo, 7, -19, 12);
      cargo.visible = false;
      root.addChild(legs, body, cargo);
      const tag = label("", -26, -49, 10, 0xeee3b8);
      root.addChild(tag);
      tag.visible = false;
      this.world.addChild(root);
      this.people.set(def.id, { root, body, legs, cargo, tag });
    }
  }
  private makeCart() {
    const g = new Graphics();
    rect(g, -22, -19, 44, 17, 0x8d9f8c);
    rect(g, -24, -3, 48, 5, 0xabc0ad);
    g.circle(-15, 6, 6).fill(0x15272b).stroke({ color: 0xa0b5a4, width: 2 });
    g.circle(15, 6, 6).fill(0x15272b).stroke({ color: 0xa0b5a4, width: 2 });
    crate(g, -17, -37, 22);
    crate(g, 6, -32, 17);
    line(g, -27, -17, -27, -2, 0xbfc8a9, 3);
    this.cart.addChild(g);
    this.world.addChild(this.cart);
  }
  update(state: WorldState, playing: boolean) {
    this.state = state;
    this.playing = playing;
    for (const r of state.rooms) {
      const v = this.rooms.get(r.id)!;
      v.shade.visible = !r.powered;
      v.status.text = !r.powered ? "NO POWER" : r.staff ? "STAFFED" : "";
      v.status.style.fill = r.powered ? 0xb1c3a1 : 0xe9b578;
      const d = this.allRooms.get(r.id)!;
      v.water.clear();
      if (d.district === 2 && d.floor >= 5 && state.waterL > 0) {
        const depth =
            state.waterL / (this.scenario.settings.tunnelAreaM2 * 1000),
          height = Math.min(d.h - 20, depth * 75);
        rect(v.water, 5, d.h - 15 - height, d.w - 10, height, 0x5cabb5, 0.45);
        line(
          v.water,
          5,
          d.h - 15 - height,
          d.w - 5,
          d.h - 15 - height,
          0x9ed6d2,
          2,
          0.7,
        );
      }
    }
    this.connectionOverlay.clear();
    for (const link of this.scenario.links) {
      if (
        !state.closedLinks.includes(link.id) &&
        !(link.kind === "checkpoint" && state.lockdown)
      )
        continue;
      const a = this.allRooms.get(link.a)!,
        b = this.allRooms.get(link.b)!;
      const points = this.pathPoints(a, b, link.kind);
      for (let i = 1; i < points.length; i++)
        line(
          this.connectionOverlay,
          points[i - 1].x,
          points[i - 1].y,
          points[i].x,
          points[i].y,
          0x77b5b6,
          11,
          0.7,
        );
      const mid = points[Math.floor(points.length / 2)];
      line(
        this.connectionOverlay,
        mid.x - 13,
        mid.y - 13,
        mid.x + 13,
        mid.y + 13,
        0xe4b476,
        4,
      );
      line(
        this.connectionOverlay,
        mid.x + 13,
        mid.y - 13,
        mid.x - 13,
        mid.y + 13,
        0xe4b476,
        4,
      );
    }
  }
  private location(roomId: string, id: number) {
    const r = this.allRooms.get(roomId)!;
    return {
      x: r.x + 45 + ((id * 31) % Math.max(60, r.w - 85)),
      y: r.y + r.h - 18 - (id % 3) * 2,
    };
  }
  private along(edge: string, from: string, to: string, progress: number) {
    const l = this.scenario.links.find((l) => l.id === edge)!,
      a = this.allRooms.get(from)!,
      b = this.allRooms.get(to)!;
    const points = this.pathPoints(a, b, l.kind);
    const lens = points
      .slice(1)
      .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let distance = lens.reduce((a, b) => a + b, 0) * progress;
    for (let i = 0; i < lens.length; i++) {
      if (distance <= lens[i] || i === lens.length - 1) {
        const p = points[i],
          q = points[i + 1],
          t = lens[i] ? distance / lens[i] : 0;
        return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      }
      distance -= lens[i];
    }
    return points[0];
  }
  private personLocation(p: PersonState) {
    return p.edgeId
      ? this.along(p.edgeId, p.fromId, p.toId, p.edgeProgress)
      : this.location(
          p.roomId,
          this.scenario.residents.findIndex((d) => d.id === p.id),
        );
  }
  private frame() {
    if (!this.state) return;
    const now = performance.now() / 1000;
    this.fps = this.app.ticker.FPS;
    for (const p of this.state.people) {
      const v = this.people.get(p.id)!,
        pos = this.personLocation(p);
      if (!v.root.x && !v.root.y) v.root.position.set(pos.x, pos.y);
      else {
        v.root.x += (pos.x - v.root.x) * 0.28;
        v.root.y += (pos.y - v.root.y) * 0.28;
      }
      const walking =
        p.taskState === "traveling" && this.playing && !this.reduced;
      v.legs.rotation = walking ? Math.sin(now * 14 + p.id.length) * 0.17 : 0;
      v.body.rotation =
        p.task === "Sleeping" && p.taskState === "resting"
          ? -Math.PI / 2
          : walking
            ? Math.sin(now * 14) * 0.025
            : p.task === "Working" &&
                p.taskState === "active" &&
                this.playing &&
                !this.reduced
              ? Math.sin(now * 3) * 0.025
              : 0;
      v.cargo.visible = p.bag.food > 0 || p.bag.water > 0;
      v.cargo.y = walking ? Math.sin(now * 14) * 1.2 : 0;
      v.root.alpha = this.zoom < 0.35 ? 0.8 : 1;
      v.tag.visible = this.selected?.id === p.id;
      v.tag.text = this.scenario.residents
        .find((d) => d.id === p.id)!
        .name.split(" ")[0];
    }
    const c = this.state.cart;
    const pos = c.edgeId
      ? this.along(c.edgeId, c.fromId, c.toId, c.progress)
      : this.location(c.roomId, 1);
    this.cart.x += (pos.x - this.cart.x) * 0.25;
    this.cart.y += (pos.y - this.cart.y) * 0.25;
    for (const [id, v] of this.rooms) {
      if (
        v.fan &&
        this.playing &&
        this.state.rooms.find((r) => r.id === id)!.powered &&
        !this.reduced
      )
        v.fan.rotation += 0.08;
    }
    if (this.followId) {
      const view =
        this.people.get(this.followId)?.root ??
        (this.followId === "cart" ? this.cart : null);
      if (view) {
        this.camera.x = this.app.screen.width / 2 - view.x * this.zoom;
        this.camera.y = this.app.screen.height / 2 - view.y * this.zoom;
        this.transform();
      }
    }
    this.selection.clear();
    if (this.selected?.kind === "person") {
      const p = this.people.get(this.selected.id)!;
      this.selection
        .ellipse(p.root.x, p.root.y + 6, 16, 6)
        .stroke({ color: 0xeac27a, width: 2 });
    } else if (this.selected?.kind === "cart")
      this.selection
        .ellipse(this.cart.x, this.cart.y + 9, 33, 10)
        .stroke({ color: 0xeac27a, width: 2 });
  }
  select(s: Selection) {
    this.selected = s;
    for (const [id, v] of this.rooms) {
      v.selection.clear();
      if (s.kind === "room" && s.id === id) {
        const d = this.allRooms.get(id)!;
        v.selection
          .rect(-4, -4, d.w + 8, d.h + 8)
          .stroke({ color: 0xe3b76f, width: 3 });
      }
    }
  }
  focus(id: string, follow = false) {
    const d = this.allRooms.get(id);
    const p = this.state?.people.find((p) => p.id === id);
    const pos = d
      ? { x: d.x + d.w / 2, y: d.y + d.h / 2 }
      : p
        ? this.personLocation(p)
        : id === "cart"
          ? this.cart.position
          : null;
    if (!pos) return;
    this.followId = follow ? id : null;
    this.zoom = Math.max(this.zoom, 0.8);
    this.camera = {
      x: this.app.screen.width * 0.5 - pos.x * this.zoom,
      y: this.app.screen.height * 0.5 - pos.y * this.zoom,
    };
    this.transform();
  }
  district(d: number) {
    this.followId = null;
    this.zoom = 0.68;
    this.camera = {
      x: this.app.screen.width / 2 - (540 + d * 840) * this.zoom,
      y: 70 - 290 * this.zoom,
    };
    this.transform();
  }
  recenter() {
    this.followId = null;
    this.zoom = Math.min(
      0.72,
      Math.max(0.5, (this.host.clientHeight - 210) / 1550),
    );
    this.camera = {
      x: (this.host.clientWidth - 2740 * this.zoom) / 2,
      y: 150 - 290 * this.zoom,
    };
    this.transform();
  }
  zoomBy(
    factor: number,
    x = this.app.screen.width / 2,
    y = this.app.screen.height / 2,
  ) {
    const next = Math.max(0.25, Math.min(1.8, this.zoom * factor)),
      ratio = next / this.zoom;
    this.camera.x = x - (x - this.camera.x) * ratio;
    this.camera.y = y - (y - this.camera.y) * ratio;
    this.zoom = next;
    this.transform();
  }
  pan(dx: number, dy: number) {
    this.followId = null;
    this.camera.x += dx;
    this.camera.y += dy;
    this.transform();
    this.onCamera();
  }
  private transform() {
    this.camera.x = Math.max(
      -2800 * this.zoom + 100,
      Math.min(this.app.screen.width - 100, this.camera.x),
    );
    this.camera.y = Math.max(
      -1900 * this.zoom + 100,
      Math.min(this.app.screen.height - 100, this.camera.y),
    );
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.zoom);
  }
  private input() {
    const canvas = this.app.canvas;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.onpointerdown = (e) => {
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
      if (Math.hypot(x - this.cart.x, y - this.cart.y) < 28)
        selected = { kind: "cart", id: "cart" };
      if (!selected && this.state) {
        let nearest = Infinity;
        for (const [id, p] of this.people) {
          const distance = Math.hypot(x - p.root.x, y - (p.root.y - 17));
          if (distance < Math.max(14, 9 / this.zoom) && distance < nearest) {
            nearest = distance;
            selected = { kind: "person", id };
          }
        }
      }
      if (!selected) {
        const d = this.scenario.rooms.find(
          (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
        );
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

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
  type Point,
} from "./projection";
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
    this.drawWorld();
    this.makePeople();
    this.makeCart();
    this.world.addChild(this.connectionOverlay, this.selection);
    this.district(1);
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
        i % 3 ? 0x1b2c36 : 0x263640,
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
    for (const l of this.scenario.links) {
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
        line(links, p, q, 0x4a5357, l.kind === "lift" ? 16 : 22);
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
            line(
              links,
              { x: x - 8, y },
              { x: x + 8, y: y + 3 },
              l.kind === "lift" ? rust : 0x899083,
              2,
            );
          }
        }
        if (l.kind === "lift") {
          line(
            links,
            { x: p.x - 12, y: p.y },
            { x: q.x - 12, y: q.y },
            0x8d6b53,
            3,
          );
          line(
            links,
            { x: p.x + 12, y: p.y },
            { x: q.x + 12, y: q.y },
            0x8d6b53,
            3,
          );
        }
      }
    }
    this.world.addChild(links);
    for (const d of [...this.scenario.rooms].sort(
      (a, b) => roomBase(a).y - roomBase(b).y,
    ))
      this.drawRoom(d);
    const shafts = new Graphics();
    for (const link of this.scenario.links.filter(
      (link) => link.kind === "lift",
    )) {
      const points = this.pathPoints(
        this.allRooms.get(link.a)!,
        this.allRooms.get(link.b)!,
        link.kind,
      );
      if (points.length < 4) continue;
      const a = points[1],
        b = points[2];
      line(shafts, a, b, 0x121f28, 32);
      for (const side of [-16, 16]) {
        line(
          shafts,
          { x: a.x + side, y: a.y - 16 },
          { x: b.x + side, y: b.y + 4 },
          0x493f36,
          8,
        );
        line(
          shafts,
          { x: a.x + side - 1, y: a.y - 16 },
          { x: b.x + side - 1, y: b.y + 4 },
          0xa5845b,
          2,
        );
      }
      for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y += 55) {
        line(
          shafts,
          { x: a.x - 16, y },
          { x: a.x + 16, y: y + 30 },
          0x686c61,
          2,
        );
        line(
          shafts,
          { x: a.x + 16, y },
          { x: a.x - 16, y: y + 30 },
          0x686c61,
          2,
        );
      }
      glow(shafts, a, 24, 22, amber);
      shafts.rect(a.x - 20, a.y - 5, 40, 7).fill(0xa48a59);
    }
    this.world.addChild(shafts, this.labels);
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
  private drawRoom(d: RoomDef) {
    const root = new Container(),
      base = roomBase(d);
    root.position.set(base.x, base.y);
    const g = new Graphics(),
      w = d.w,
      depth = ROOM_DEPTH,
      h = WALL_HEIGHT,
      deep = d.floor >= 5;
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
    plane(g, 0, 0, w, depth, 0, 0x56605c);
    for (let x = 0; x < w; x += 44)
      for (let z = 0; z < depth; z += 38)
        plane(
          g,
          x + 1,
          z + 1,
          Math.min(42, w - x - 1),
          Math.min(36, depth - z - 1),
          0.5,
          (x + z + d.floor * 5) % 3 ? 0x4c5758 : 0x5c625a,
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
      } else {
        for (let x = 66; x < w - 10; x += 125) {
          const p = local(x, depth - 15, 72);
          g.rect(p.x - 7, p.y - 13, 17, 22).fill(0x938565);
          g.rect(p.x - 4, p.y - 10, 11, 15).fill(0x374a50);
        }
        if (!deep) plant(g, w - 30, 40, 0.8);
        block(g, 20, 26, 52, 24, 27, 0x77644b);
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
    } else if (d.kind === "depot" || d.kind === "workshop") {
      for (let x = 28; x < w - 60; x += 82) {
        for (const u of [x, x + 63]) block(g, u, 90, 4, 43, 83, 0x616b65);
        for (const y of [5, 39, 76]) plane(g, x, 89, 67, 45, y, 0x5b635b);
        crate(g, x + 6, 94, 24, 25, 8);
        crate(g, x + 35, 94, 23, 23, 8);
        crate(g, x + 7, 94, 25, 25, 42);
      }
      if (d.kind === "workshop") {
        block(g, 62, 28, w - 120, 38, 37, 0x766e59);
        cabinet(g, 84, 34, 48, 58, steel);
        for (let i = 0; i < 4; i++) {
          const p = local(150 + i * 26, 38, 39);
          g.circle(p.x, p.y, 4).fill(0xa5a18c);
        }
      } else {
        crate(g, 40, 28, 37);
        crate(g, 86, 28, 31);
      }
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
    } else if (d.kind === "pump" || d.kind === "recycler" || d.kind === "tap") {
      for (let x = 65; x < w - 30; x += 105) {
        tank(
          g,
          x,
          98,
          d.kind === "pump" ? 26 : 30,
          d.kind === "tap" ? 63 : 74,
          0x54737a,
        );
        pipe(
          g,
          [
            local(x, 98, 9),
            local(x, 30, 9),
            local(Math.min(w - 20, x + 85), 30, 9),
          ],
          0x849287,
          7,
        );
        const p = local(x, 98, 54);
        g.circle(p.x, p.y, 8).fill(0xbdc5a7);
        line(g, p, { x: p.x + 4, y: p.y - 3 }, ink, 2);
      }
      if (d.kind === "pump") {
        cabinet(g, 28, 24, 56, 47, steel);
        for (let x = 190; x < w - 50; x += 72) {
          const p = local(x, depth - 17, 75);
          g.circle(p.x, p.y, 10).fill(pale);
          line(g, p, { x: p.x + 4, y: p.y - 6 }, ink, 2);
        }
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
    } else {
      for (let x = 34; x < w - 48; x += 64)
        cabinet(g, x, 91, 46, 78, d.kind === "relay" ? 0x4a646c : steel);
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
    const namePos = local(24, 0, -10),
      name = label(
        d.name,
        base.x + namePos.x,
        base.y + namePos.y,
        17,
        0xbac0b2,
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
    });
  }
  private makePeople() {
    const colors = [
      0xaf915a, 0x6c877d, 0x6b909c, 0x9f7564, 0xb3af97, 0x7d8397, 0x83927c,
      0xa08657,
    ];
    for (let i = 0; i < 24; i++) {
      const g = new Graphics(),
        skin = [0xc5a285, 0xa37659, 0x795746, 0xd8bc98][i % 4];
      g.ellipse(0, 1, 9, 3).fill({ color: ink, alpha: 0.55 });
      g.poly([-5, -24, 5, -24, 7, -9, -6, -9]).fill(colors[i % 8]);
      g.rect(-7, -23, 3, 12).fill(shade(colors[i % 8], 0.8));
      g.rect(5, -23, 3, 12).fill(colors[i % 8]);
      g.circle(0, -30, 6).fill(skin);
      g.ellipse(0, -34, 6, 3).fill(i % 3 ? 0x353b3b : 0x9b9788);
      g.rect(-4, -26, 8, 2).fill(0xb5b6a1);
      if (i % 4 === 0) {
        g.ellipse(0, -35, 8, 3).fill(amber);
        g.roundRect(-5, -40, 10, 7, 3).fill(0xb58f50);
      }
      const texture = this.app.renderer.generateTexture({
        target: g,
        resolution: 2,
      });
      this.textures.push(texture);
      g.destroy();
    }
    for (const def of this.scenario.residents) {
      const root = new Container(),
        body = new Sprite(this.textures[def.appearance % 24]);
      body.anchor.set(0.5, 1);
      const legs = new Graphics();
      legs.rect(-4, -10, 3, 11).rect(2, -10, 3, 11).fill(0x26373e);
      const cargo = new Graphics();
      crate(cargo, 8, 0, 12, 12);
      cargo.y = -15;
      cargo.visible = false;
      const tag = label(def.name.split(" ")[0], -24, -56, 17, 0xf0dfb5);
      tag.visible = false;
      root.addChild(legs, body, cargo, tag);
      this.world.addChild(root);
      this.people.set(def.id, { root, body, legs, cargo, tag });
    }
  }
  private makeCart() {
    const g = new Graphics();
    block(g, -23, 0, 46, 28, 16, 0x7d8a7d, 6);
    crate(g, -18, 3, 24, 26, 22);
    crate(g, 7, 3, 17, 20, 22);
    for (const x of [-14, 21]) {
      const p = local(x, 0);
      g.circle(p.x, p.y + 6, 6)
        .fill(ink)
        .stroke({ color: 0x9da28c, width: 2 });
    }
    this.cart.addChild(g);
    this.world.addChild(this.cart);
  }
  update(state: WorldState, playing: boolean) {
    this.state = state;
    this.playing = playing;
    for (const r of state.rooms) {
      const v = this.rooms.get(r.id)!,
        d = this.allRooms.get(r.id)!;
      v.shade.visible = !r.powered;
      v.lights.visible = r.powered;
      v.status.text = r.powered ? "" : "Power lost";
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
      if (
        !state.closedLinks.includes(l.id) &&
        !(l.kind === "checkpoint" && state.lockdown)
      )
        continue;
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
  private location(roomId: string, id: number) {
    const r = this.allRooms.get(roomId)!;
    return project(
      r.x + 36 + ((id * 37) % Math.max(40, r.w - 80)),
      r.y + r.h - 15,
      24 + (id % 4) * 18,
    );
  }
  private along(edge: string, from: string, to: string, progress: number) {
    const l = this.scenario.links.find((l) => l.id === edge)!;
    return alongPath(
      this.pathPoints(this.allRooms.get(from)!, this.allRooms.get(to)!, l.kind),
      progress,
    );
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
            : 0;
      v.cargo.visible = p.bag.food > 0 || p.bag.water > 0;
      v.cargo.y = -15 + (walking ? Math.sin(now * 14) : 0);
      v.tag.visible = this.selected?.id === p.id;
    }
    const c = this.state.cart,
      pos = c.edgeId
        ? this.along(c.edgeId, c.fromId, c.toId, c.progress)
        : this.location(c.roomId, 1);
    if (!this.cart.x && !this.cart.y) this.cart.position.set(pos.x, pos.y);
    else {
      this.cart.x += (pos.x - this.cart.x) * 0.25;
      this.cart.y += (pos.y - this.cart.y) * 0.25;
    }
    for (const [id, v] of this.rooms)
      if (
        this.playing &&
        this.state.rooms.find((r) => r.id === id)!.powered &&
        !this.reduced
      )
        for (const fan of v.fans) fan.children[0].rotation += 0.045;
    if (this.followId) {
      const view =
        this.people.get(this.followId)?.root ??
        (this.followId === "cart" ? this.cart : null);
      if (view) {
        this.camera.x = this.app.screen.width * 0.42 - view.x * this.zoom;
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
      p = this.state?.people.find((p) => p.id === id);
    const pos = d
      ? project(d.x + d.w / 2, d.y + d.h - 15, 65, 30)
      : p
        ? this.personLocation(p)
        : id === "cart"
          ? this.cart.position
          : null;
    if (!pos) return;
    this.followId = follow ? id : null;
    this.zoom = Math.max(this.zoom, 1.05);
    this.camera = {
      x: this.app.screen.width * 0.4 - pos.x * this.zoom,
      y: this.app.screen.height * 0.5 - pos.y * this.zoom,
    };
    this.transform();
  }
  district(d: number) {
    const rooms = this.scenario.rooms.filter((r) => r.district === d);
    if (!rooms.length) return;
    this.followId = null;
    const points = rooms.flatMap(roomOutline),
      left = Math.min(...points.map((p) => p.x)),
      right = Math.max(...points.map((p) => p.x));
    this.zoom = Math.min(
      1.15,
      Math.max(0.6, (this.host.clientWidth - 140) / (right - left)),
    );
    const top = Math.min(...points.map((p) => p.y));
    this.camera = {
      x:
        (this.host.clientWidth - (right - left) * this.zoom) / 2 -
        left * this.zoom,
      y: 115 - top * this.zoom,
    };
    this.transform();
  }
  recenter() {
    this.followId = null;
    const b = this.bounds;
    this.zoom = Math.min(
      0.78,
      Math.max(0.3, (this.host.clientWidth - 180) / (b.right - b.left)),
    );
    // Start close enough to read a working district; lower levels remain available by panning.
    this.camera = {
      x:
        (this.host.clientWidth - (b.right - b.left) * this.zoom) / 2 -
        b.left * this.zoom,
      y: 115 - b.top * this.zoom,
    };
    this.transform();
  }
  zoomBy(
    factor: number,
    x = this.app.screen.width / 2,
    y = this.app.screen.height / 2,
  ) {
    const next = Math.max(0.22, Math.min(2.2, this.zoom * factor)),
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
      v.name.scale.set(Math.max(1, 0.64 / this.zoom));
    }
    for (const text of this.districtLabels) text.visible = this.zoom < 0.6;
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

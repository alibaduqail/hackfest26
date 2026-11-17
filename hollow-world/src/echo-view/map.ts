// Canvas map for Echo: reads an Observation only (contract v1). No engine imports.
import type { City, Observation, Pod, Priority, Sector } from "../echo/types";

export type Variant = "tower" | "echo";
export interface DrawOpts { variant: Variant; width: number; height: number; time: number }

export const COLORS = {
  bg: "#0a1013",
  grid: "#121c21",
  lane: "#243238",
  laneEcho: "#2d4249",
  city: "#cfe3e8",
  label: "#8fa8b0",
  strata: "#f2b84b",
  outbreak: "#ff5a52",
  beacon: "#45d1c4",
  seal: "#ff3b3b",
  medical: "#ff5a52",
  supply: "#5fd09a",
  passenger: "#9db7c6",
  pulse: { announce: "#45d1c4", seal: "#ff3b3b", release: "#6fe08f" },
} as const;
const PRIORITY_COLOR: Record<Priority, string> = { medical: COLORS.medical, supply: COLORS.supply, passenger: COLORS.passenger };
const LABEL_SIDE: Record<string, "l" | "r" | "t" | "b"> = { ny: "t", s07: "b", lon: "t", mow: "t", bei: "t", tok: "t", syd: "l", lagos: "l", jak: "b", sao: "r" };

type XY = [number, number];
export interface Projection { (p: XY): XY }

/** Fit the cities and sector ends into the canvas, uniform scale, centered. */
export function makeProjection(obs: Observation, w: number, h: number): Projection {
  const pts: XY[] = [...obs.cities.map((c): XY => [c.x, c.y]), ...obs.sectors.flatMap((s) => [s.a, s.b])];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const mx = 90, my = 64;
  const k = Math.min((w - 2 * mx) / (x1 - x0 || 1), (h - 2 * my) / (y1 - y0 || 1));
  const ox = (w - k * (x1 - x0)) / 2 - k * x0, oy = (h - k * (y1 - y0)) / 2 - k * y0;
  return ([x, y]) => [ox + k * x, oy + k * y];
}

const LANE_PX = 2.6; // opposite directions of a route are drawn side by side

function lane(project: Projection, s: Sector): [XY, XY] {
  const a = project(s.a), b = project(s.b);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * LANE_PX, ny = (dx / len) * LANE_PX;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]];
}
const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Screen position of every visible pod. Pods sharing a spot fan out so none is hidden. Exported for tests. */
export function podPositions(obs: Observation, project: Projection): Map<string, XY> {
  const sectors = new Map(obs.sectors.map((s) => [s.id, s]));
  const cities = new Map(obs.cities.map((c) => [c.id, c]));
  const raw = new Map<string, XY>();
  for (const p of obs.pods) {
    if (p.status === "scheduled" || p.status === "arrived") continue;
    if (p.at < 0) {
      const c = cities.get(p.origin);
      if (c) raw.set(p.id, project([c.x, c.y]));
      continue;
    }
    const s = sectors.get(p.path[p.at]);
    if (!s) continue;
    const [a, b] = lane(project, s);
    raw.set(p.id, lerp(a, b, Math.min(1, Math.max(0, p.progress))));
  }
  const groups = new Map<string, string[]>();
  for (const [id, xy] of raw) {
    const key = `${Math.round(xy[0] / 6)},${Math.round(xy[1] / 6)}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const out = new Map(raw);
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    ids.sort();
    ids.forEach((id, i) => {
      const [x, y] = raw.get(id)!;
      const ang = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      out.set(id, [x + Math.cos(ang) * 7, y + Math.sin(ang) * 7]);
    });
  }
  return out;
}

function cityLabel(ctx: CanvasRenderingContext2D, c: City, [x, y]: XY) {
  const side = LABEL_SIDE[c.id] ?? "r";
  ctx.fillStyle = c.outbreak ? COLORS.outbreak : c.strata ? COLORS.strata : COLORS.label;
  ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textBaseline = "middle";
  const text = c.name;
  const wText = ctx.measureText(text).width;
  const [tx, ty, align] =
    side === "t" ? [x - wText / 2, y - 14, "left"] :
    side === "b" ? [x - wText / 2, y + 15, "left"] :
    side === "l" ? [x - 11 - wText, y, "left"] : [x + 11, y, "left"];
  ctx.textAlign = align as CanvasTextAlign;
  ctx.fillText(text, tx, ty);
}

function drawX(ctx: CanvasRenderingContext2D, [x, y]: XY, r: number) {
  ctx.strokeStyle = COLORS.seal;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
  ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
  ctx.stroke();
}

export function drawMap(ctx: CanvasRenderingContext2D, obs: Observation, o: DrawOpts) {
  const { width: w, height: h, variant } = o;
  const project = makeProjection(obs, w, h);
  const echo = variant === "echo";
  const down = !obs.towerUp;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  // faint equirectangular graticule (the map is the tunnel network, not the surface)
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  for (let g = 0; g <= 1.0001; g += 0.1) {
    const [x] = project([g, 0]), [, y] = project([0, g]);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const podById = new Map(obs.pods.map((p) => [p.id, p]));

  // lanes
  for (const s of obs.sectors) {
    const [a, b] = lane(project, s);
    const holder = s.holder ? podById.get(s.holder) : undefined;
    ctx.lineCap = "round";
    if (s.sealed) {
      ctx.strokeStyle = COLORS.seal; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
    } else if (holder) {
      ctx.strokeStyle = PRIORITY_COLOR[holder.priority]; ctx.lineWidth = 2.6; ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = echo && down ? COLORS.laneEcho : COLORS.lane; ctx.lineWidth = 1.2; ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.setLineDash([]);
    // sector tick at the far end
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = s.sealed ? COLORS.seal : "#34464d"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(b[0] - (dy / len) * 3.5, b[1] + (dx / len) * 3.5); ctx.lineTo(b[0] + (dy / len) * 3.5, b[1] - (dx / len) * 3.5); ctx.stroke();
    // beacon dot at the middle (Echo only)
    const m = lerp(a, b, 0.5);
    if (echo && !s.sealed) {
      ctx.fillStyle = down ? COLORS.beacon : "#1f6c66";
      ctx.beginPath(); ctx.arc(m[0], m[1], down ? 1.9 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
    if (s.sealed) { ctx.fillStyle = "rgba(10,16,19,0.85)"; ctx.beginPath(); ctx.arc(m[0], m[1], 9, 0, Math.PI * 2); ctx.fill(); drawX(ctx, m, 6.5); }
  }

  // MED-1's current path, so the reroute is readable
  const nurse = obs.pods.find((p) => p.nurse && p.id === "MED-1") ?? obs.pods.find((p) => p.nurse);
  if (nurse && nurse.rerouted && nurse.status !== "arrived") {
    const sectors = new Map(obs.sectors.map((s) => [s.id, s]));
    ctx.strokeStyle = "rgba(255,90,82,0.55)"; ctx.lineWidth = 3.4; ctx.lineJoin = "round";
    ctx.beginPath();
    nurse.path.forEach((id, i) => {
      const s = sectors.get(id); if (!s) return;
      const [a, b] = lane(project, s);
      if (i === 0) ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    });
    ctx.stroke();
  }

  // beacon pulses: expanding rings, age counts hops, time keeps them alive between frames
  if (echo) {
    const byId = new Map(obs.sectors.map((s) => [s.id, s]));
    for (const p of obs.pulses) {
      const s = byId.get(p.sectorId); if (!s) continue;
      const [a, b] = lane(project, s); const m = lerp(a, b, 0.5);
      const phase = ((o.time / 900) % 1);
      const r = 4 + phase * 16 + p.age * 5;
      ctx.strokeStyle = COLORS.pulse[p.kind];
      ctx.globalAlpha = Math.max(0, 0.9 - phase * 0.8 - p.age * 0.2);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(m[0], m[1], r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // cities
  for (const c of obs.cities) {
    const [x, y] = project([c.x, c.y]);
    const col = c.outbreak ? COLORS.outbreak : c.strata ? COLORS.strata : COLORS.city;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, c.strata || c.outbreak ? 5.5 : 4.5, 0, Math.PI * 2); ctx.fill();
    if (c.outbreak) { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 9.5, 0, Math.PI * 2); ctx.stroke(); }
    cityLabel(ctx, c, [x, y]);
  }

  // pods on top
  const pos = podPositions(obs, project);
  const order: Pod[] = [...obs.pods].sort((a, b) => rank(a.priority) - rank(b.priority));
  for (const p of order) {
    const xy = pos.get(p.id); if (!xy) continue;
    const dim = p.status === "holding" || (p.status === "waiting" && p.at >= 0);
    const r = p.priority === "medical" ? 4.6 : 3.4;
    ctx.globalAlpha = dim ? 0.38 : 1;
    if (p.priority === "medical" && !dim) {
      ctx.fillStyle = "rgba(255,90,82,0.22)"; ctx.beginPath(); ctx.arc(xy[0], xy[1], r + 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PRIORITY_COLOR[p.priority];
    ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.id === nurse?.id && p.status !== "arrived") {
      ctx.fillStyle = "#ffd5d2"; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(p.label, xy[0] + 9, xy[1] - 9);
    }
  }
}
const rank = (p: Priority) => (p === "medical" ? 2 : p === "supply" ? 1 : 0);

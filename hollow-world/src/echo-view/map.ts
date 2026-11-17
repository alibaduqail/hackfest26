// Canvas map for Echo: reads an Observation only (contract v2). No engine imports.
// v2: a sector with beacon === false is a dead zone (dim, dashed); missing = beaconed, so v1 missions draw as before.
import type { City, Observation, Pod, Priority, Sector } from "../echo/types";

export type Variant = "tower" | "echo";
/** View-only effects, kept by the screen in wall-clock ms so they stay readable at 60x. Not part of the contract. */
export interface Fx {
  pulses: { sectorId: string; kind: "announce" | "seal" | "release"; born: number }[];
  yields: { podId: string; to: string; born: number }[]; // loser and the winner it yielded to
  oldPaths: Record<string, { path: string[]; born: number }>; // path a pod abandoned when it re-planned
  frac: number; // 0..1 of a tick elapsed since the last engine step, for smooth pods
  blind: Record<string, string>; // pod id -> the unbeaconed sector it waited blind at ("?" while it still waits there)
  rejected: Record<string, true>; // pod ids whose credential-reject was logged (ghosts are revealed)
  // story beats (game only; empty on echo.html)
  speech: { podId: string; text: string; born: number }[]; // queued lines: born may be in the future
  stamps: { sectorId: string; born: number }[]; // SEALED stamps
  flashAt: number; // wall-clock ms of the TOWER OFFLINE flash, 0 = none
}
export const PULSE_MS = 900, YIELD_MS = 2200, FADE_MS = 8000, SPEECH_MS = 5000, STAMP_POP_MS = 350;
export interface DrawOpts {
  variant: Variant; width: number; height: number; time: number; fx?: Fx;
  prepare?: boolean; // beacon placement screen: beacons always drawn as amber lights
  hover?: string | null; // sector id under the cursor
}

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
  light: "#f2b84b", // a placed battery beacon
  dead: "#2a3a40",
  ghost: "#b565d6",
  seal: "#ff3b3b",
  medical: "#ff5a52",
  supply: "#5fd09a",
  passenger: "#9db7c6",
  pulse: { announce: "#45d1c4", seal: "#ff3b3b", release: "#6fe08f" },
} as const;
const PRIORITY_COLOR: Record<Priority, string> = { medical: COLORS.medical, supply: COLORS.supply, passenger: COLORS.passenger };
// label side per city, chosen so neighbours (NY/Sector 07, London/Moscow, Beijing/Tokyo) never collide
const LABEL_SIDE: Record<string, "l" | "r" | "t" | "b"> = { ny: "t", s07: "l", lon: "l", mow: "t", bei: "t", tok: "r", cairo: "r", lagos: "l", mum: "r", jak: "r", syd: "l", sao: "r" };

type XY = [number, number];
export interface Projection { (p: XY): XY }

/** Fit the cities and sector ends into the canvas, uniform scale, centered. */
export function makeProjection(obs: Observation, w: number, h: number): Projection {
  const pts: XY[] = [...obs.cities.map((c): XY => [c.x, c.y]), ...obs.sectors.flatMap((s) => [s.a, s.b])];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // fill the pane (equirectangular, so a stretch is fine); bottom inset keeps room for the tower card, top for the caption
  const ml = Math.min(112, w * 0.16), mr = Math.min(104, w * 0.15), mt = 72, mb = Math.min(124, h * 0.2);
  const kx = (w - ml - mr) / (x1 - x0 || 1), ky = (h - mt - mb) / (y1 - y0 || 1);
  const ox = ml - kx * x0, oy = mt - ky * y0;
  return ([x, y]) => [ox + kx * x, oy + ky * y];
}

const LANE_PX = 2.6; // opposite directions of a route are drawn side by side

export function lane(project: Projection, s: Sector): [XY, XY] {
  const a = project(s.a), b = project(s.b);
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * LANE_PX, ny = (dx / len) * LANE_PX;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny]];
}
const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function segDist([px, py]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** The sector lane nearest to canvas point (x, y), within maxPx. Each tunnel direction is its own lane. */
export function sectorAt(obs: Observation, w: number, h: number, x: number, y: number, maxPx = 6): string | null {
  const project = makeProjection(obs, w, h);
  let best: string | null = null, bd = maxPx;
  for (const s of obs.sectors) {
    const [a, b] = lane(project, s);
    const d = segDist([x, y], a, b);
    if (d < bd) { bd = d; best = s.id; }
  }
  return best;
}

/** Screen position of every visible pod. Pods sharing a spot fan out so none is hidden. Exported for tests. */
export function podPositions(obs: Observation, project: Projection, frac = 0): Map<string, XY> {
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
    const ahead = p.status === "moving" && !obs.over ? frac / Math.max(1, s.minutes) : 0; // glide between ticks
    raw.set(p.id, lerp(a, b, Math.min(1, Math.max(0, p.progress + ahead))));
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
  // a beacon-scarce world (some dead zone, or the placement screen) shows beacons as amber lights; v1 keeps the teal dots
  const scarce = echo && (!!o.prepare || obs.sectors.some((s) => s.beacon === false));

  // lanes
  for (const s of obs.sectors) {
    const [a, b] = lane(project, s);
    const holder = s.holder ? podById.get(s.holder) : undefined;
    const dead = echo && s.beacon === false;
    ctx.lineCap = "round";
    if (o.hover === s.id) {
      ctx.strokeStyle = "rgba(242,184,75,0.35)"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (s.sealed) {
      ctx.strokeStyle = COLORS.seal; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
    } else if (holder) {
      ctx.strokeStyle = PRIORITY_COLOR[holder.priority]; ctx.lineWidth = 2.6; ctx.setLineDash([]);
    } else if (dead) {
      ctx.strokeStyle = COLORS.dead; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
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
    if (scarce && !s.sealed && !dead) {
      ctx.fillStyle = "rgba(242,184,75,0.22)"; ctx.beginPath(); ctx.arc(m[0], m[1], 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.light; ctx.beginPath(); ctx.arc(m[0], m[1], 1.9, 0, Math.PI * 2); ctx.fill();
    } else if (echo && !s.sealed && !dead) {
      ctx.fillStyle = down ? COLORS.beacon : "#1f6c66";
      ctx.beginPath(); ctx.arc(m[0], m[1], down ? 1.9 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
    if (s.sealed) { ctx.fillStyle = "rgba(10,16,19,0.85)"; ctx.beginPath(); ctx.arc(m[0], m[1], 9, 0, Math.PI * 2); ctx.fill(); drawX(ctx, m, 6.5); }
  }

  // abandoned paths fade out, the re-planned path is drawn solid
  const sectorById = new Map(obs.sectors.map((s) => [s.id, s]));
  if (echo && o.fx) {
    for (const [podId, old] of Object.entries(o.fx.oldPaths)) {
      const pod = obs.pods.find((x) => x.id === podId); if (!pod) continue;
      const keep = new Set(pod.path);
      const alpha = Math.max(0.1, 0.65 - ((o.time - old.born) / FADE_MS) * 0.55);
      ctx.strokeStyle = `rgba(255,150,120,${alpha})`; ctx.lineWidth = 2.4; ctx.setLineDash([2, 5]);
      for (const id of old.path) {
        const s = sectorById.get(id); if (!s || keep.has(id)) continue;
        const [a, b] = lane(project, s);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }
  const nurse = obs.pods.find((p) => p.nurse && p.id === "MED-1") ?? obs.pods.find((p) => p.nurse);
  if (nurse && nurse.rerouted && nurse.status !== "arrived") {
    ctx.strokeStyle = "rgba(255,90,82,0.6)"; ctx.lineWidth = 3.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    let pen = false;
    nurse.path.forEach((id, i) => {
      const s = sectorById.get(id); if (!s) return;
      const [a, b] = lane(project, s);
      if (i < nurse.at) return; // already travelled
      if (!pen) { ctx.moveTo(a[0], a[1]); pen = true; }
      ctx.lineTo(b[0], b[1]);
    });
    ctx.stroke();
  }

  // beacon pulses: live rings born when the engine emits them; a lit beacon marks the hop
  const byId = new Map(obs.sectors.map((s) => [s.id, s]));
  const fx = o.fx;
  if (echo && fx) {
    for (const p of fx.pulses) {
      const life = (o.time - p.born) / PULSE_MS;
      const s = byId.get(p.sectorId);
      if (!s || life < 0 || life > 1) continue;
      const [a, b] = lane(project, s); const m = lerp(a, b, 0.5);
      const bold = p.kind === "seal"; // the seal ripple is the beacon story; routine announce/release rings stay faint
      ctx.strokeStyle = ctx.fillStyle = COLORS.pulse[p.kind];
      ctx.globalAlpha = (bold ? 0.95 : 0.15) * (1 - life);
      ctx.lineWidth = bold ? 1.8 : 0.8;
      ctx.beginPath(); ctx.arc(m[0], m[1], (bold ? 3 : 1.6) + life * (bold ? 17 : 3.5), 0, Math.PI * 2); ctx.stroke();
      if (bold) { ctx.beginPath(); ctx.arc(m[0], m[1], 3.2, 0, Math.PI * 2); ctx.fill(); }
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

  // SEALED stamps: pop in, then stay on the seal
  for (const st of fx?.stamps ?? []) {
    const s = byId.get(st.sectorId); if (!s) continue;
    const [a, b] = lane(project, s); const m = lerp(a, b, 0.5);
    const k = Math.min(1, Math.max(0, (o.time - st.born) / STAMP_POP_MS));
    ctx.save();
    ctx.translate(m[0] + 8, m[1] + 24); // below the X, clear of the city and pod labels ctx.rotate(-0.18); ctx.scale(2.2 - 1.2 * k, 2.2 - 1.2 * k);
    ctx.globalAlpha = 0.3 + 0.62 * k;
    ctx.font = "bold 12px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const tw = ctx.measureText("SEALED").width + 12;
    ctx.fillStyle = "rgba(26,13,13,0.85)"; ctx.fillRect(-tw / 2, -10, tw, 20);
    ctx.strokeStyle = COLORS.seal; ctx.lineWidth = 1.6; ctx.strokeRect(-tw / 2, -10, tw, 20);
    ctx.fillStyle = COLORS.seal; ctx.fillText("SEALED", 0, 1);
    ctx.restore();
  }

  // pods on top
  const pos = podPositions(obs, project, o.fx?.frac ?? 0);
  const order: Pod[] = [...obs.pods].sort((a, b) => rank(a.priority) - rank(b.priority));
  for (const p of order) {
    const xy = pos.get(p.id); if (!xy) continue;
    const dim = p.status === "holding" || (p.status === "waiting" && p.at >= 0);
    const r = p.priority === "medical" ? 4.6 : 3.4;
    if (p.ghost && o.fx?.rejected[p.id]) { // revealed Directorate fake: hollow dashed ring, no medical glow
      ctx.globalAlpha = dim ? 0.5 : 1;
      ctx.strokeStyle = COLORS.ghost; ctx.lineWidth = 1.6; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(xy[0], xy[1], r + 1, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = COLORS.ghost; ctx.font = "10px ui-monospace, Menlo, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(`${p.id} forged`, xy[0] + 9, xy[1] - 9);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = dim ? 0.38 : 1;
    if (p.priority === "medical" && !dim) {
      ctx.fillStyle = "rgba(255,90,82,0.22)"; ctx.beginPath(); ctx.arc(xy[0], xy[1], r + 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = PRIORITY_COLOR[p.priority];
    ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const blindAt = echo ? o.fx?.blind[p.id] : undefined;
    if (blindAt && p.status !== "moving" && p.path[p.at + 1] === blindAt) { // waiting blind at a dead zone
      ctx.fillStyle = COLORS.light; ctx.font = "bold 11px ui-monospace, Menlo, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", xy[0], xy[1] - r - 7);
    }
    const y = echo ? o.fx?.yields.find((q) => q.podId === p.id && o.time - q.born < YIELD_MS) : undefined;
    if (y) {
      const txt = `${p.id} yields to ${y.to}`;
      ctx.font = "bold 11px ui-monospace, Menlo, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const wt = ctx.measureText(txt).width + 10;
      ctx.globalAlpha = Math.min(1, (YIELD_MS - (o.time - y.born)) / 500);
      ctx.fillStyle = "#3a2c0c"; ctx.strokeStyle = "#e8b64a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(xy[0] + 8, xy[1] + 6, wt, 17, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f4cf7a"; ctx.fillText(txt, xy[0] + 13, xy[1] + 15);
      ctx.globalAlpha = 1;
    }
    if (p.id === nurse?.id && p.status !== "arrived") {
      ctx.fillStyle = "#ffd5d2"; ctx.font = "11px ui-monospace, Menlo, monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(p.label, xy[0] + 10, xy[1] + 15);
    }
  }

  // speech cards (Echo pane): above the pod, or above its destination once it has arrived
  if (echo && fx) {
    const live = new Map<string, Fx["speech"][number]>(); // the newest line already born, per pod
    for (const sp of fx.speech) if (o.time >= sp.born && o.time - sp.born <= SPEECH_MS) live.set(sp.podId, sp);
    for (const [podId, sp] of live) {
      const age = o.time - sp.born;
      const p = podById.get(podId); if (!p) continue;
      const city = obs.cities.find((c) => c.id === (p.status === "arrived" ? p.dest : p.origin)); // not on the map yet, or arrived
      const at = pos.get(podId) ?? (city ? project([city.x, city.y]) : undefined);
      if (!at) continue;
      ctx.font = "12px system-ui, -apple-system, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      const tw = ctx.measureText(sp.text).width + 16;
      const x = Math.min(Math.max(4, at[0] - 12), w - tw - 4), y = Math.max(4, at[1] - 44);
      ctx.globalAlpha = Math.min(1, (SPEECH_MS - age) / 600, age / 150);
      ctx.fillStyle = "#f4ece4"; ctx.strokeStyle = COLORS.medical; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(x, y, tw, 24, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(at[0] - 2, y + 24); ctx.lineTo(at[0] + 4, y + 24); ctx.lineTo(at[0], at[1] - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a1512"; ctx.fillText(sp.text, x + 8, y + 12.5);
      ctx.globalAlpha = 1;
    }
  }
}
const rank = (p: Priority) => (p === "medical" ? 2 : p === "supply" ? 1 : 0);

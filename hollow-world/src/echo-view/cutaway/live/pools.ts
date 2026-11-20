// Blackout: the pure picture rules behind the Descent's darkness. The Hollow is dark; a beacon is a battery lamp and radio, and its pool
// of light is its coverage. Pools of sections that hear each other (reach.ts) touch at their shared end and read as one lit region.
// Flood news ripples pool to pool (the engine's seal pulses) and fizzles where the light ends. A pod hears only inside the light.
// Pure: no DOM, no engine writes. Pinned by pools.test.ts.
import type { Pod, Pulse } from "../../../echo/types";
import type { Point, Track } from "../run";
import type { Graph } from "./reach";

export const WORLD_W = 1672, WORLD_H = 941;
/** Pool half-thickness and how far it sits above the rail (the floor band is above the rail), in world px. */
export const POOL_R = 74, POOL_LIFT = 34;

export interface Pool {
  id: string;
  /** The pool's spine, lifted off the rail, in world px. */
  x1: number; y1: number; x2: number; y2: number;
  r: number;
  cx: number; cy: number;
  /** Spine length and angle (degrees), for a rotated capsule. */
  len: number; deg: number;
}

/** A section's pool of light: a capsule along its rail, lifted into the tunnel above it, with round ends that meet its neighbours'. */
export function poolOf(t: Pick<Track, "a" | "b"> & { sectorId: string }, w = WORLD_W, h = WORLD_H): Pool {
  const x1 = t.a[0] * w, y1 = t.a[1] * h - POOL_LIFT, x2 = t.b[0] * w, y2 = t.b[1] * h - POOL_LIFT;
  return {
    id: t.sectorId, x1, y1, x2, y2, r: POOL_R,
    cx: (x1 + x2) / 2, cy: (y1 + y2) / 2,
    len: Math.hypot(x2 - x1, y2 - y1), deg: (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI,
  };
}

const same = (p: Point, q: Point) => p[0] === q[0] && p[1] === q[1];

/** The rail point two sections share (normalized), or null when they only hear each other through a city off the drawn rail. */
export function sharedEnd(s: Pick<Track, "a" | "b">, n: Pick<Track, "a" | "b">): Point | null {
  for (const p of [s.a, s.b]) if (same(p, n.a) || same(p, n.b)) return p;
  return null;
}

export interface Fizzle { from: string; to: string; at: Point; deg: number }

/**
 * Where this tick's news front dies: for every section the seal news reaches this tick, each neighbour it would hear if that neighbour
 * had a beacon, but has none. The ripple breaks at their shared end, facing into the dark. `live` is the set of live beacons only:
 * a beacon still being built does not relay yet.
 */
export function fizzles(tracks: ReadonlyMap<string, Pick<Track, "a" | "b">>, graph: Graph, live: ReadonlySet<string>, pulses: readonly Pulse[]): Fizzle[] {
  const out: Fizzle[] = [];
  const seen = new Set<string>();
  for (const p of pulses) {
    if (p.kind !== "seal") continue;
    const s = tracks.get(p.sectorId);
    if (!s) continue;
    for (const n of graph.get(p.sectorId) ?? []) {
      if (live.has(n)) continue;
      const t = tracks.get(n);
      const at = t && sharedEnd(s, t);
      if (!t || !at) continue;
      const key = n + "@" + at.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      const far = same(at, t.a) ? t.b : t.a; // point the broken ripple into the dark section
      out.push({ from: p.sectorId, to: n, at, deg: (Math.atan2((far[1] - at[1]) * WORLD_H, (far[0] - at[0]) * WORLD_W) * 180) / Math.PI });
    }
  }
  return out;
}

/**
 * Whether a pod is inside the light, so it would hear news (engine protocol.ts `hops`, simplified for the picture): its own section has a
 * live beacon, or it stands at a boundary (or its dock) next to one it is about to enter. Arrived pods are out of the picture.
 */
export function inSignal(p: Pick<Pod, "at" | "path" | "status">, lit: (id: string) => boolean): boolean {
  if (p.status === "arrived") return false;
  const here = p.at >= 0 ? p.path[p.at] : undefined;
  if (here && lit(here)) return true;
  if (p.status === "moving") return false;
  const next = p.path[p.at + 1];
  return !!next && lit(next);
}

/** The bounding box of a section's tunnel in world px, for the flood water to fill. */
export function waterBox(t: Pick<Track, "a" | "b">, w = WORLD_W, h = WORLD_H) {
  const xs = [t.a[0] * w, t.b[0] * w], ys = [t.a[1] * h, t.b[1] * h];
  const left = Math.min(...xs) - 24, right = Math.max(...xs) + 24;
  const bottom = Math.max(...ys) + 6, top = Math.min(...ys) - 128;
  return { left, top, width: right - left, height: bottom - top };
}

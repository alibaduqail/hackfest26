// The browser's animation timestamp can lag the clock sampled while setting up the scene.
export function frameProgress(now: number, start: number, duration: number): number {
  return duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
}

// ---- Pod motion: pods ride the track polyline instead of lerping in a straight line between tick poses.
import type { Pod } from "../../echo/types";
import { onTrack, podBerth, podDock, podPose, type Point, tracks } from "./run";

const same = (a: Point, b: Point) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** Which way a resting pod faces: the last non-vertical leg it travelled (or the connector into its berth). */
export function restFacing(pod: Pod): boolean {
  if (pod.status === "arrived") {
    const last = tracks.get(pod.path[pod.path.length - 1]);
    return !!last && podBerth(pod)[0] < last.b[0] - 1e-9;
  }
  for (let i = pod.at; i >= 0; i--) {
    const t = tracks.get(pod.path[i]);
    if (t && Math.abs(t.b[0] - t.a[0]) > 1e-9) return t.b[0] < t.a[0];
  }
  const first = tracks.get(pod.path[0]);
  return !!first && pod.at < 0 && podDock(pod)[0] > first.a[0] + 1e-9;
}

/** Appends the corner-by-corner walk from (path[from], p0) to (path[to], p1). Requires (from, p0) <= (to, p1). */
function walk(out: Point[], path: string[], from: number, p0: number, to: number, p1: number) {
  out.push(onTrack(tracks.get(path[from])!, p0));
  for (let j = from; j < to; j++) {
    const here = tracks.get(path[j])!, next = tracks.get(path[j + 1])!;
    out.push(onTrack(here, 1), here.b, onTrack(next, 0));
  }
  out.push(onTrack(tracks.get(path[to])!, p1));
}

/**
 * Polyline (normalised coordinates) a pod follows from its pose in the previous tick to its pose now. It starts at podPose(prev) and ends at
 * podPose(cur); every point in between lies on a track section or on the short dock/berth connector. Handles several sections per tick and
 * a path that changed (reroute): the pod backs along its old track to the junction shared with the new path, then follows the new one.
 */
export function buildRoute(prev: Pod, cur: Pod): Point[] {
  const start = podPose(prev), end = podPose(cur);
  if (same(start, end)) return [end];
  const straight: Point[] = [start, end];
  if (prev.status === "arrived" || cur.at < 0 || !cur.path.length) return straight;
  const out: Point[] = [start];
  const path = cur.path;
  let j = 0, p0 = 0; // where on the new path the pod starts
  if (prev.at < 0) {
    out.push(tracks.get(path[0])!.a); // dock connector, then the first section
  } else {
    const id = prev.path[prev.at];
    j = path.indexOf(id);
    p0 = prev.progress;
    if (j < 0) {
      // Reroute that dropped the pod's own section: back along the old path to the last section the new path still has.
      let k = prev.at - 1;
      while (k >= 0 && !path.includes(prev.path[k])) k--;
      if (k < 0) return straight;
      for (let i = prev.at; i > k; i--) out.push(tracks.get(prev.path[i])!.a);
      j = path.indexOf(prev.path[k]);
      p0 = 1;
    }
  }
  if (j > cur.at || (j === cur.at && p0 > cur.progress + 1e-9)) return straight;
  const last = cur.status === "arrived";
  walk(out, path, j, p0, last ? path.length - 1 : cur.at, last ? 1 : cur.progress);
  if (last) out.push(tracks.get(path[path.length - 1])!.b, end);
  else out.push(end);
  return out.filter((p, i) => !i || !same(p, out[i - 1]));
}

export interface Route {
  x: number[];
  y: number[];
  cum: number[]; // arc length at each point, in pixels
  left: boolean[]; // facing per segment
  total: number;
}
/** Precompute pixel arc lengths and per-segment facing once per tick; vertical legs keep the facing of the leg before. */
export function compileRoute(points: Point[], w: number, h: number, startLeft: boolean): Route {
  const x = points.map((p) => p[0] * w), y = points.map((p) => p[1] * h);
  const cum = [0], left: boolean[] = [];
  let face = startLeft;
  for (let i = 1; i < x.length; i++) {
    const dx = x[i] - x[i - 1];
    cum.push(cum[i - 1] + Math.hypot(dx, y[i] - y[i - 1]));
    if (dx < -.5) face = true;
    else if (dx > .5) face = false;
    left.push(face);
  }
  return { x, y, cum, left, total: cum[cum.length - 1] };
}
/** Position at fraction t of the route's arc length, written into `out` (no allocation). A one-point route is a pod at rest. */
export function sampleRoute(r: Route, t: number, out: { x: number; y: number; left: boolean }, restLeft: boolean) {
  const n = r.x.length;
  if (n < 2 || r.total <= 0) {
    out.x = r.x[n - 1];
    out.y = r.y[n - 1];
    out.left = n < 2 ? restLeft : r.left[r.left.length - 1];
    return out;
  }
  const d = Math.max(0, Math.min(1, t)) * r.total;
  let i = 1;
  while (i < n - 1 && r.cum[i] < d) i++;
  const len = r.cum[i] - r.cum[i - 1], f = len > 0 ? (d - r.cum[i - 1]) / len : 1;
  out.x = r.x[i - 1] + (r.x[i] - r.x[i - 1]) * f;
  out.y = r.y[i - 1] + (r.y[i] - r.y[i - 1]) * f;
  out.left = r.left[i - 1];
  return out;
}

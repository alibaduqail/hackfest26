// Track geometry for the live Descent levels 2 and 3 (level 1 is the painted default in run.ts). The scene, hit-testing and pod poses all read the
// shared `tracks` map, so a level swaps its layout by rewriting that map in place (LiveScreen calls applyLayout on mount and restores level 1 on unmount).
import { type Point, type Track, tracks } from "./run";

const base = new Map(tracks); // level 1, as run.ts built it
const floors = [.07, .247, .419, .61, .789, 1];
const levelAt = (y: number) => Math.max(1, floors.findIndex((f) => y < f)) as Track["level"]; // the band a segment sits in

function chain(out: Map<string, Track>, route: string, shaft: Track["shaft"], pts: Point[], start = 0) {
  for (let i = 0; i < pts.length - 1; i++) {
    out.set(route + i, { sectorId: route + i, level: levelAt((pts[i][1] + pts[i + 1][1]) / 2), shaft, order: start + i, a: pts[i], b: pts[i + 1] });
  }
}
const keep = (out: Map<string, Track>, prefix: string) => { for (const [id, t] of base) if (id.startsWith(prefix)) out.set(id, t); };

function level2(): Map<string, Track> {
  const m = new Map<string, Track>();
  chain(m, "ramp", "track", [[.326, .225], [.388, .225], [.45, .225], [.513, .225]]);
  chain(m, "link", "track", [[.513, .225], [.545, .30], [.575, .35], [.60, .40]], 3);
  chain(m, "mainA", "main", [[.60, .40], [.66, .47], [.66, .55], [.60, .62]]);
  chain(m, "bypA", "bypass", [[.60, .40], [.50, .45], [.46, .52], [.50, .58], [.60, .62]]);
  chain(m, "trunk", "main", [[.60, .62], [.70, .65], [.80, .70], [.72, .76]]);
  chain(m, "mainB", "main", [[.72, .76], [.78, .84], [.78, .90], [.71, .944]]);
  chain(m, "bypB", "bypass", [[.72, .76], [.60, .82], [.56, .88], [.60, .944], [.71, .944]]);
  return m;
}
function level3(): Map<string, Track> {
  const m = new Map<string, Track>();
  chain(m, "ramp", "track", [[.326, .225], [.513, .225], [.70, .407], [.827, .594]]);
  chain(m, "spur", "track", [[.575, .407], [.69, .407], [.79, .50], [.827, .594]], 3);
  chain(m, "paxline", "track", [[.975, .407], [.945, .50], [.902, .594], [.827, .594]], 3);
  for (const p of ["trunk", "main", "byp"]) keep(m, p); // the junction and the flooded shaft are level 1's, drawn the same
  return m;
}

const layouts: Record<string, () => Map<string, Track>> = { "descent-live-2": level2, "descent-live-3": level3 };
let current = "";

/** Point the shared `tracks` map at the layout for this mission id (unknown ids get level 1). Cheap to call every render. */
export function applyLayout(missionId: string) {
  const id = missionId in layouts ? missionId : "";
  if (id === current) return;
  current = id;
  tracks.clear();
  for (const [k, v] of (layouts[id]?.() ?? base)) tracks.set(k, v);
}

// Beacon layouts for budgeted missions, shared by the harness (tower-down.ts --all) and beacon-search.ts. Offline tools only.
import { sealsOf } from "../src/echo/engine";
import type { Mission } from "../src/echo/types";
import { findPath } from "../src/echo/world";

/** Beacon ids for a budget: sectors of every city's shortest path to Lagos (shortest first, then city id), then every pod's path; first N. */
export function heuristicBeacons(m: Mission, budget: number): Set<string> {
  // ponytail: naive greedy placement, only a yardstick for star thresholds; a real solver would score layouts by simulation
  const toLagos = m.world.cities.filter((c) => c.id !== "lagos").map((c) => ({ c: c.id, path: findPath(c.id, "lagos", new Set(), m.world)! }));
  toLagos.sort((a, b) => a.path.length - b.path.length || (a.c < b.c ? -1 : 1));
  return new Set([...new Set([...toLagos.flatMap((x) => x.path), ...m.pods.flatMap((p) => p.path)])].slice(0, budget));
}

/** Beacon ids: MED-1's post-seal detour and every Lagos-bound pod's path around all seals first, then sectors by how many pod paths use them. */
export function detourFirstBeacons(m: Mission, budget: number): Set<string> {
  const sealed = new Set(sealsOf(m).map((x) => x.sectorId));
  const lagos = m.pods.filter((p) => p.dest === "lagos").sort((a, b) => (a.id === "MED-1" ? -1 : b.id === "MED-1" ? 1 : 0));
  const first = lagos.flatMap((p) => findPath(p.origin, "lagos", sealed, m.world) ?? []);
  const freq = new Map<string, number>();
  for (const p of m.pods) for (const id of p.path) freq.set(id, (freq.get(id) ?? 0) + 1);
  const rest = [...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
  return new Set([...new Set([...first, ...rest])].slice(0, budget));
}

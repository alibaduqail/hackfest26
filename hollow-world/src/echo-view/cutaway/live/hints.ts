// One hint per Descent level, shown once when the pods first reach it (docs/research/PLAYABLE_DESCENT.md §3). Pure: the screen decides where to draw it.
import { DESCENT_LAYOUT } from "../../../echo/descent";
import type { Observation } from "../../../echo/types";

export const LEVEL_HINTS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "The tower still says it is working. It is not. Click a rail to bolt a beacon. Beacons are limited.",
  2: "News only travels through beacons. A dark section hears nothing.",
  3: "Medical goes first, then supply, then passengers. Waiting here is not a failure.",
  4: "The shaft is flooding. A pod that hears in time takes the bypass. A pod that does not will wait. A beacon on the flood does nothing if the next link is dark.",
  5: "Mara first, then the medicine. Both have a deadline.",
};

const levelOf = new Map(DESCENT_LAYOUT.sectors.map((s) => [s.sectorId, s.level]));

/** Deepest level any pod has reached so far (1 before anyone moves). */
export function deepestLevel(o: Pick<Observation, "pods">): 1 | 2 | 3 | 4 | 5 {
  let n = 1;
  for (const p of o.pods) if (p.at >= 0) n = Math.max(n, levelOf.get(p.path[p.at]) ?? 1);
  return n as 1 | 2 | 3 | 4 | 5;
}

/** The next unseen hint the pods have earned, or null. Add the returned level to `seen` once it has been shown. */
export function nextHint(o: Pick<Observation, "pods">, seen: ReadonlySet<number>): { level: 1 | 2 | 3 | 4 | 5; text: string } | null {
  const reached = deepestLevel(o);
  for (const level of [1, 2, 3, 4, 5] as const) if (level <= reached && !seen.has(level)) return { level, text: LEVEL_HINTS[level] };
  return null;
}

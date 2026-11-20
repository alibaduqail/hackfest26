// Hints for the Descent. The blackout picture (pools of light, warn-here outlines, red flood, the ripple that dies in the dark) teaches the beacon rule, so
// no toast explains it in prose. Two kinds survive: the intro card's one line per leg (LEVEL_HINTS), and the in-run toasts (TOAST_LEVELS),
// which only carry what the picture cannot: the order the pods are served in. Pure: the screen decides where to draw it.
import { DESCENT_LAYOUT } from "../../../echo/descent";
import type { Observation } from "../../../echo/types";

export const LEVEL_HINTS: Record<1 | 3 | 4, string> = {
  1: "The tower still says it is working. It is not. Click a rail to bolt a beacon. Beacons are limited.",
  3: "Medical goes first, then supply, then passengers. Waiting here is not a failure.",
  4: "The shaft is flooding. A pod that hears in time takes the bypass. A pod that does not will wait. A beacon on the flood does nothing if the next link is dark.",
};

/** Levels whose hint pops up as a toast once the pods first reach them. Level 1 is on the intro card; 2, 4 and 5 are taught by the picture and the deadlines panel. */
export const TOAST_LEVELS: readonly (1 | 2 | 3 | 4 | 5)[] = [3];

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
  for (const level of TOAST_LEVELS) if (level <= reached && !seen.has(level)) return { level, text: LEVEL_HINTS[level as 3] };
  return null;
}

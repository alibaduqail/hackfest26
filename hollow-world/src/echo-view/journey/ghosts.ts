// Counterfactual paths for the ending: the same three legs played without the player, so the trail shows what Echo changed.
// Pure (no DOM). Every number comes from the engine: playRun() per leg (src/echo/baseline.ts) and the player's own LegResults in the log.
import { playRun } from "../../echo/baseline";
import { DESCENT_LEVELS } from "../../echo/descent-levels";
import type { Mode } from "../../echo/types";
import { LEG_IDS, starsFromLog } from "./helpers";
import type { LogEntry } from "./props";

/** One path down the trail. reached = legs completed (0..3); minute = the sum of Mara's arrival minutes over the legs it completed (null unless all three);
 * stuckAt = the minute Mara showed up on the leg where it stopped, when she did arrive but with no star (late); null = never. */
export interface GhostPath { id: string; label: string; reached: number; minute: number | null; stuckAt: number | null; you?: boolean }
export interface GhostData { paths: GhostPath[]; claimed: number; actual: number }

/** The counterfactuals. A 4th entry (e.g. { id: "standby", label: "tower + backup", mode: "tower-standby" }) is all it takes to add a path. */
export const GHOST_MODES: { id: string; label: string; mode: Mode }[] = [
  { id: "tower", label: "tower only", mode: "tower" },
  { id: "none", label: "no beacons", mode: "echo" },
];

export function ghostData(seed: number, log: LogEntry[]): GhostData {
  let claimed = 0, actual = 0;
  const paths = GHOST_MODES.map(({ id, label, mode }): GhostPath => {
    let reached = 0, minute = 0, stuckAt: number | null = null;
    for (let i = 0; i < LEG_IDS.length; i++) {
      const run = playRun(DESCENT_LEVELS[i].build({ seed, attempt: 0 }), mode);
      if (mode === "tower") { claimed += run.claimed; actual += run.actual; }
      if (run.mara === null || run.stars === 0) { stuckAt = run.mara; break; } // the journey's own rule: no arrival or no star is a failed leg
      reached++; minute += run.mara;
    }
    return { id, label, reached, minute: reached === LEG_IDS.length ? minute : null, stuckAt: reached === LEG_IDS.length ? null : stuckAt };
  });
  const stars = starsFromLog(log);
  const wins = LEG_IDS.map((id, i) => stars[i] === null ? null : [...log].reverse().find((l) => l.kind === "leg" && l.legId === id && (l.result.stars > 0 || l.skipped))).map((l) => (l && l.kind === "leg" ? l.result.maraAt : null));
  const reached = wins.findIndex((m) => m === null);
  const done = reached === -1 ? LEG_IDS.length : reached;
  const you: GhostPath = { id: "you", label: "you", reached: done, minute: done === LEG_IDS.length ? wins.reduce<number>((n, m) => n + (m ?? 0), 0) : null, stuckAt: null, you: true };
  return { paths: [...paths, you], claimed, actual };
}

/** The column header: the label split over two short mono lines at its last space ("no beacons" -> no / beacons) so four columns fit side by side. */
export function ghostHead(g: GhostPath): string[] {
  const i = g.label.lastIndexOf(" ");
  return i < 0 ? [g.label] : [g.label.slice(0, i), g.label.slice(i + 1)];
}

/** The outcome at the foot of the column, one or two short lines: "never", "min 92" + "late" (Mara arrived, but without a star), "min 270", "stopped". */
export function ghostOutcome(g: GhostPath): string[] {
  if (g.reached === LEG_IDS.length) return [`min ${g.minute}`];
  if (g.you) return ["stopped"];
  return g.stuckAt !== null ? [`min ${g.stuckAt}`, "late"] : ["never"];
}

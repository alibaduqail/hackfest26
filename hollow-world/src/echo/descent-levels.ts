// The live Descent, as a level list for the UI to drive. Wraps level 1 (descent.ts, unchanged) alongside the two new
// live levels (descent2.ts, descent3.ts). See docs/specs/echo/DESCENT.md "Live play" for all three.
import { DESCENT_LIVE_GOALS, DESCENT_LIVE_SOLUTION, DESCENT_LIVE_CANDIDATES, descentLive, descentLiveCandidateIndex } from "./descent";
import type { Goals, LevelOpts } from "./descent";
import { DESCENT_LIVE_GOALS_2, DESCENT_LIVE_SOLUTION_2, descentLive2 } from "./descent2";
import { DESCENT_LIVE_GOALS_3, DESCENT_LIVE_SOLUTION_3, descentLive3 } from "./descent3";
import type { Command, Mission } from "./types";

export interface DescentLevel {
  id: string;
  title: string;
  lesson: string;
  /** `build()` is attempt 0 with the default reveal. `build(attempt)` or `build({ attempt, revealLead })` seeds the flood location and sets how many ticks before a seal its telegraph shows (0 = no advance reveal). */
  build: (opts?: number | LevelOpts) => Mission;
  /** Candidate 0 (what attempt 0 gets): star table and a 3-star run. For any other attempt use goalsFor / solutionFor. */
  goals: Goals;
  solution: Command[];
  goalsFor: (attempt?: number) => Goals;
  solutionFor: (attempt?: number) => Command[];
}

const level = (l: Omit<DescentLevel, "goalsFor" | "solutionFor" | "title"> & { goalsFor?: DescentLevel["goalsFor"]; solutionFor?: DescentLevel["solutionFor"] }): DescentLevel => ({
  ...l, title: l.build().title, goalsFor: l.goalsFor ?? (() => l.goals), solutionFor: l.solutionFor ?? (() => l.solution),
});

export const DESCENT_LEVELS: DescentLevel[] = [
  level({
    id: "descent-live",
    lesson: "The flood warning is the gate to any star: news only hops from a beaconed sealed sector, so a beacon on it (and every hop back toward the fork) is non-negotiable. The rest of the budget buys route speed. Where the flood lands changes between attempts: wait for the telegraph, then react.",
    build: descentLive, goals: DESCENT_LIVE_GOALS, solution: DESCENT_LIVE_SOLUTION,
    goalsFor: (a = 0) => DESCENT_LIVE_CANDIDATES[descentLiveCandidateIndex(a)].goals,
    solutionFor: (a = 0) => DESCENT_LIVE_CANDIDATES[descentLiveCandidateIndex(a)].solution,
  }),
  level({
    id: "descent-live-2",
    lesson: "Two floods, one budget. Warn the first flood early and keep budget in reserve, because a second seal will fire mid-run: react the moment its telegraph appears.",
    build: descentLive2, goals: DESCENT_LIVE_GOALS_2, solution: DESCENT_LIVE_SOLUTION_2,
  }),
  level({
    id: "descent-live-3",
    lesson: "Medical always outranks a forged pod or a passenger, but only among pods already announced in the same tick. A dark junction gates each pod behind its own blind clock, so whoever's clock clears first takes the slot regardless of rank. Light the junction and Mara's priority finally means something.",
    build: descentLive3, goals: DESCENT_LIVE_GOALS_3, solution: DESCENT_LIVE_SOLUTION_3,
  }),
];

// The live Descent, as a level list for the UI to drive. Wraps level 1 (descent.ts, unchanged) alongside the two new
// live levels (descent2.ts, descent3.ts). See docs/specs/echo/DESCENT.md "Live play" for all three.
import { DESCENT_LIVE_GOALS, DESCENT_LIVE_SOLUTION, DESCENT_LIVE_CANDIDATES, descentLive, descentLiveCandidateIndex } from "./descent";
import type { Goals, LevelOpts, LiveCandidate } from "./descent";
import { DESCENT_LIVE_CANDIDATES_2, DESCENT_LIVE_GOALS_2, DESCENT_LIVE_SOLUTION_2, descentLive2, descentLiveCandidateIndex2 } from "./descent2";
import { DESCENT_LIVE_CANDIDATES_3, DESCENT_LIVE_GOALS_3, DESCENT_LIVE_SOLUTION_3, descentLive3, descentLiveCandidateIndex3 } from "./descent3";
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
  /** Same, for the flood that `build(a)` picks: `a` is an attempt number or { seed, attempt }. */
  goalsFor: (a?: number | LevelOpts) => Goals;
  solutionFor: (a?: number | LevelOpts) => Command[];
  /** Every flood candidate of the level, in index order (the index floodCandidate returns). */
  candidates: LiveCandidate[];
  /** Index into `candidates` that `build(a)` uses. */
  candidateIndex: (a?: number | LevelOpts) => number;
}

/** The star table of the flood a built mission carries (matched on its seal sector, minute and further seals). Falls back to candidate 0 for a mission no candidate matches. */
export const goalsForMission = (m: Pick<Mission, "id" | "sealAt" | "sealSectorId" | "seals">): Goals | undefined => {
  const l = DESCENT_LEVELS.find((x) => x.id === m.id);
  if (!l) return undefined;
  const key = (a: number | null | undefined, s: string | null | undefined, r: unknown) => JSON.stringify([a, s, r ?? []]);
  return (l.candidates.find((c) => key(c.at, c.sectorId, c.seals) === key(m.sealAt, m.sealSectorId, m.seals)) ?? l.candidates[0]).goals;
};

/** Which flood candidate a level uses for { seed, attempt }: attempt 0 comes from the seed, later attempts never repeat the previous one. No seed means candidate 0 first. */
export const floodCandidate = (levelIndex: number, o: number | LevelOpts = {}): number => DESCENT_LEVELS[levelIndex].candidateIndex(o);

type LevelSpec = Pick<DescentLevel, "id" | "lesson" | "build" | "goals" | "solution" | "candidates" | "candidateIndex">;
const level = (l: LevelSpec): DescentLevel => ({
  ...l, title: l.build().title,
  goalsFor: (a) => l.candidates[l.candidateIndex(a)].goals,
  solutionFor: (a) => l.candidates[l.candidateIndex(a)].solution,
});

export const DESCENT_LEVELS: DescentLevel[] = [
  level({
    id: "descent-live",
    lesson: "The flood warning is the gate to any star: news only hops from a beaconed sealed sector, so a beacon on it (and every hop back toward the fork) is non-negotiable. The rest of the budget buys route speed. Where the flood lands changes between attempts: wait for the telegraph, then react.",
    build: descentLive, goals: DESCENT_LIVE_GOALS, solution: DESCENT_LIVE_SOLUTION,
    candidates: DESCENT_LIVE_CANDIDATES, candidateIndex: descentLiveCandidateIndex,
  }),
  level({
    id: "descent-live-2",
    lesson: "Two floods, one budget. Warn the first flood early and keep budget in reserve, because a second seal will fire mid-run: react the moment its telegraph appears.",
    build: descentLive2, goals: DESCENT_LIVE_GOALS_2, solution: DESCENT_LIVE_SOLUTION_2,
    candidates: DESCENT_LIVE_CANDIDATES_2, candidateIndex: descentLiveCandidateIndex2,
  }),
  level({
    id: "descent-live-3",
    lesson: "Medical always outranks a forged pod or a passenger, but only among pods already announced in the same tick. A dark junction gates each pod behind its own blind clock, so whoever's clock clears first takes the slot regardless of rank. Light the junction and Mara's priority finally means something.",
    build: descentLive3, goals: DESCENT_LIVE_GOALS_3, solution: DESCENT_LIVE_SOLUTION_3,
    candidates: DESCENT_LIVE_CANDIDATES_3, candidateIndex: descentLiveCandidateIndex3,
  }),
];

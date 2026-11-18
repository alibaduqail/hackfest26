// The live Descent, as a level list for the UI to drive. Wraps level 1 (descent.ts, unchanged) alongside the two new
// live levels (descent2.ts, descent3.ts). See docs/specs/echo/DESCENT.md "Live play" for all three.
import { DESCENT_LIVE_GOALS, DESCENT_LIVE_SOLUTION, descentLive } from "./descent";
import { DESCENT_LIVE_GOALS_2, DESCENT_LIVE_SOLUTION_2, descentLive2 } from "./descent2";
import { DESCENT_LIVE_GOALS_3, DESCENT_LIVE_SOLUTION_3, descentLive3 } from "./descent3";
import type { Command, Mission } from "./types";

export interface DescentLevel {
  id: string;
  title: string;
  lesson: string;
  build: () => Mission;
  goals: { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number; text: string }[];
  solution: Command[];
}

export const DESCENT_LEVELS: DescentLevel[] = [
  {
    id: "descent-live", title: descentLive().title,
    lesson: "The flood warning is the gate to any star: news only hops from a beaconed sealed sector, so a beacon on it (and one hop back toward the fork) is non-negotiable. The rest of the budget buys route speed.",
    build: descentLive, goals: DESCENT_LIVE_GOALS, solution: DESCENT_LIVE_SOLUTION,
  },
  {
    id: "descent-live-2", title: descentLive2().title,
    lesson: "Two floods, one budget. Each needs its own warning, and the earlier flood traps the pod before it ever reaches the second: warn flood A before flood B costs nothing, warn B first and you never get the chance.",
    build: descentLive2, goals: DESCENT_LIVE_GOALS_2, solution: DESCENT_LIVE_SOLUTION_2,
  },
  {
    id: "descent-live-3", title: descentLive3().title,
    lesson: "Medical always outranks a forged pod or a passenger, but only among pods already announced in the same tick. A dark junction gates each pod behind its own blind clock, so whoever's clock clears first takes the slot regardless of rank. Light the junction and Mara's priority finally means something.",
    build: descentLive3, goals: DESCENT_LIVE_GOALS_3, solution: DESCENT_LIVE_SOLUTION_3,
  },
];

// Sample journey states for the render test and the screenshot preview, produced by the real state machine (src/echo/journey.ts), not hand-written props.
import { campEvent, choose, completeLeg, ending, startJourney, type JourneyState, type LegId, type LegResult } from "../../echo/journey";
import { choiceNamesFor } from "./helpers";

const leg = (legId: LegId, stars: LegResult["stars"], ticks: number, placed: number): LegResult =>
  ({ legId, stars, maraAt: stars ? ticks : null, medicineAt: stars ? ticks + 5 : null, beaconsPlaced: placed, ticks });

export const start = startJourney();
export const names = choiceNamesFor(start.seed);

/** Outfitting, a won leg 1, camp 1 (tower lies), a failed then retried leg 2, camp 2, a won leg 3: the ending state. */
export function played(): { camp1: JourneyState; retryCamp: JourneyState; done: JourneyState } {
  let s = choose(start, "extra-beacons");
  s = completeLeg(s, leg("descent1", 3, 41, 4));
  const camp1 = s;
  s = choose(s, "verify-beacons");
  s = completeLeg(s, leg("descent2", 0, 33, 5));
  const retryCamp = s;
  s = choose(s, "retry");
  s = completeLeg(s, leg("descent2", 2, 52, 5));
  s = choose(s, "check-credential");
  s = completeLeg(s, leg("descent3", 3, 47, 6));
  return { camp1, retryCamp, done: s };
}
export const endingOf = ending;
export { campEvent };

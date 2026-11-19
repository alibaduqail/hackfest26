// Sample props, used by the render test and the screenshot preview (mirrors the #107 example events).
import type { CampEvent, Ending, LogEntry, Resources } from "./props";

export const LIMIT = 300;
export const res: Resources = { beacons: 11, clock: 82, doses: 5 };
export const camp1: CampEvent = {
  id: "camp1", title: "The tower says all clear",
  body: "The tower crackles through the static: \"ALL CLEAR on the lower shaft.\" The water marks on the wall say otherwise. Mara is watching you, not the radio.",
  choices: [
    { id: "trust", label: "Trust the tower", detail: "Save the walk back and go straight down.", effect: { clock: 10, nextRevealLead: 0 }, reveal: "The tower was wrong. The lower shaft is already flooding." },
    { id: "verify", label: "Verify through the beacons", detail: "Spend a beacon to read the shaft yourself.", effect: { beacons: -1 }, reveal: "Your beacon heard the water first. The tower never did." },
    { id: "scavenge", label: "Scavenge", detail: "Pick through the abandoned depot.", effect: { beacons: 2, clock: 25 }, reveal: "Two beacons, still warm, and twenty-five minutes gone." },
  ],
};
const leg = (legId: "descent1" | "descent2" | "descent3", attempt: number, stars: 0 | 1 | 2 | 3, ticks: number, placed: number): LogEntry =>
  ({ kind: "leg", legId, attempt, result: { legId, stars, maraAt: stars ? ticks : null, medicineAt: stars ? ticks : null, beaconsPlaced: placed, ticks } });
export const log: LogEntry[] = [
  { kind: "choice", eventId: "outfit", choiceId: "beacons" },
  leg("descent1", 1, 3, 41, 4),
  { kind: "choice", eventId: "camp1", choiceId: "verify" },
  leg("descent2", 1, 0, 33, 5),
  leg("descent2", 2, 2, 52, 5),
  { kind: "choice", eventId: "camp2", choiceId: "check" },
  leg("descent3", 1, 3, 47, 6),
];
export const choiceNames = { outfit: "Outfitting", "outfit/beacons": "Extra beacons", camp1: "The tower lies", "camp1/verify": "Verified through the beacons", camp2: "The forged claim", "camp2/check": "Checked the credential" };
export const saved: Ending = { kind: "saved", score: 692, title: "Mara reached the clinic", lines: ["The patient was waiting, and the medicine was still good.", "Without the beacons, Mara never leaves level 2."] };
export const late: Ending = { kind: "late", score: 214, title: "The clinic was quiet when she arrived", lines: ["The shaft held, but the clock did not.", "Without the beacons, Mara never leaves level 2."] };

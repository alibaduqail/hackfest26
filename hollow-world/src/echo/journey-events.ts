// The Journey's camp events and tuning numbers (data only; the state machine is journey.ts). Every choice states its cost.
// Effect sign convention: positive clock = minutes lost, negative clock = minutes saved. Beacons and doses are added as written.
import type { Choice, LegId } from "./journey";

/** Tuning, verified by journey.test.ts against the real engine. The patient has already waited 30 minutes when you set out (start.clock), which also lets "Leave now" (-15 min) actually save time.
 * The three 3-star arrivals sum to 272 minutes, so 30 + 272 + one failed leg (~86) is just under LIMIT. */
export const TUNING = {
  start: { beacons: 15, clock: 30, doses: 6 },
  limit: 390, // minutes on the patient's timer
  failPenalty: 15, // extra minutes on a failed leg, on top of the ticks played
  scavenge: { beacons: 2, clock: 25 },
  seed: 20261119,
};

/** Per leg: the beacon cap, the smallest winning set (the flood warning, 1 star: below this you are soft-locked, so Scavenge appears) and the on-time medicine tick (the 2-star medicine deadline). */
export const LEGS: { id: LegId; name: string; story: { title: string; body: string }; minWin: string[]; medicineBy: number }[] = [
  {
    id: "descent1", name: "Descent I", minWin: ["main1", "main0"], medicineBy: 91,
    story: { title: "Leg 1 · The Descent", body: "The tower is dark. Nurse Mara and the medicine leave the surface depot for the deep clinic. A flood is coming to the main shaft: warn it before it lands." },
  },
  {
    id: "descent2", name: "Descent II", minWin: ["mainA1", "mainA0", "mainB1", "mainB0"], medicineBy: 119,
    story: { title: "Leg 2 · Two Floods", body: "Two shafts flood, one after the other. Warn the first early, keep beacons in reserve, and react the moment the second seal appears." },
  },
  {
    id: "descent3", name: "Descent III", minWin: ["main1", "main0"], medicineBy: 123,
    story: { title: "Leg 3 · Forged Rush", body: "Forged medical pods and passengers clog the junction while the shaft floods below. Light the junction and Mara's priority finally means something." },
  },
];

const pick = <T>(seed: number, salt: number, xs: T[]): T => xs[(((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0) % xs.length + xs.length) % xs.length];

export const SCAVENGE: Choice = {
  id: "scavenge", label: "Scavenge", detail: `+${TUNING.scavenge.beacons} beacons, +${TUNING.scavenge.clock} min`,
  effect: { beacons: TUNING.scavenge.beacons, clock: TUNING.scavenge.clock }, reveal: "You strip beacons off a dead relay. It costs time you do not have.",
};

export function outfitting(): { title: string; body: string; choices: Choice[] } {
  return {
    title: "Outfitting the Relay",
    body: "The tower is dark and the Directorate will not answer. You have a crate of beacons and a patient waiting at the bottom. What do you pack?",
    choices: [
      { id: "extra-beacons", label: "Extra beacons", detail: "+4 beacons, −1 dose", effect: { beacons: 4, doses: -1 } },
      { id: "extra-medicine", label: "Extra medicine", detail: "+2 doses, −2 beacons", effect: { doses: 2, beacons: -2 } },
      { id: "leave-now", label: "Leave now", detail: "−15 min on the clock", effect: { clock: -15 } },
    ],
  };
}

export function towerLies(seed: number): { title: string; body: string; choices: Choice[] } {
  const line = pick(seed, 1, ["The tower crackles: \"ALL CLEAR on the lower shaft.\"", "The tower hums: \"Lower shaft nominal. Proceed.\"", "The tower chimes: \"No obstructions below. Carry on.\""]);
  return {
    title: "Camp 1 · The tower lies",
    body: `${line} Nothing in the Hollow has been cleared by it since it went dark.`,
    choices: [
      { id: "trust-tower", label: "Trust the tower", detail: "−10 min, but Leg 2 gives no advance flood reveal", effect: { clock: -10, nextRevealLead: 0 }, reveal: "The tower was wrong. The lower shaft is flooding and nobody told the pods. You get no early warning in Leg 2." },
      { id: "verify-beacons", label: "Verify through the beacons", detail: "−1 beacon, normal reveal", effect: { beacons: -1 }, reveal: "The beacons knew. The tower still says all clear; the news hopped from beacon to beacon and said otherwise." },
    ],
  };
}

export function forgedClaim(seed: number): { title: string; body: string; choices: Choice[] } {
  const pod = pick(seed, 2, ["CARGO-9", "FREIGHT-4", "COURIER-2"]);
  return {
    title: "Camp 2 · The forged medical claim",
    body: `A pod, ${pod}, broadcasts a medical priority. It carries no nurse credential.`,
    choices: [
      { id: "yield", label: "Yield", detail: "+20 min", effect: { clock: 20 }, reveal: "You waved a cargo pod through. It was never medical. Mara's priority is the only one that is real." },
      { id: "check-credential", label: "Check the credential", detail: "no cost", effect: {}, reveal: "Cargo pod jumping the queue. Only credentialed nurses file medical." },
    ],
  };
}

export function retry(legName: string): { title: string; body: string; choices: Choice[] } {
  return {
    title: `${legName} failed`,
    body: "The medicine spoiled, the beacons you placed are gone, and the clock kept running. Regroup and try the leg again.",
    choices: [{ id: "retry", label: "Retry the leg", detail: "the failed run's minutes, dose and beacons", effect: {} }],
  };
}

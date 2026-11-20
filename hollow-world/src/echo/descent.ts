// The Descent: a small vertical world, one protocol mechanism per level. The UI page is driven by this mission's observations.
// Deterministic, no randomness. Numbers and credentials are simulated (see docs/specs/echo/DESCENT.md). Not part of MISSIONS.
import { sign } from "./credential";
import type { City, Command, Mission, Pod, Sector, World } from "./types";
import { findPath } from "./world";

type Level = 1 | 2 | 3 | 4 | 5;

const cities: City[] = [
  { id: "depot", name: "Upper Depot", above: "Depot", x: 0.5, y: 0.1 },
  { id: "relay", name: "Relay Level", above: "Relay", x: 0.5, y: 0.3 },
  { id: "jun", name: "Junction", above: "Junction", x: 0.35, y: 0.5 },
  { id: "fork", name: "Shaft Fork", above: "Fork", x: 0.5, y: 0.56 },
  { id: "clinic", name: "Deep Clinic", above: "Clinic", x: 0.5, y: 0.9, outbreak: true },
];

// [routeId, from, to, minutes, shaft, level of each sector]. The bypass is one sector longer than the main shaft, so main is the default route.
const CHAINS: [string, string, string, number, "track" | "main" | "bypass", Level[]][] = [
  ["ramp", "depot", "relay", 3, "track", [1, 1, 2]],
  ["link", "relay", "jun", 3, "track", [2, 2, 3]],
  ["trunk", "jun", "fork", 3, "track", [3, 3, 3]],
  ["main", "fork", "clinic", 3, "main", [4, 4, 5]],
  ["byp", "fork", "clinic", 3, "bypass", [3, 5, 5, 5]],
];

const at = (id: string) => cities.find((c) => c.id === id)!;
const sectors: Sector[] = CHAINS.flatMap(([routeId, from, to, minutes, , lv]) => {
  const f = at(from);
  const t = at(to);
  const n = lv.length;
  return lv.map((_, i): Sector => ({
    id: `${routeId}${i}`, routeId, index: i, from, to, minutes, holder: null, sealed: false, // every sector has a beacon (beacon missing = true)
    a: [f.x + ((t.x - f.x) * i) / n, f.y + ((t.y - f.y) * i) / n],
    b: [f.x + ((t.x - f.x) * (i + 1)) / n, f.y + ((t.y - f.y) * (i + 1)) / n],
  }));
});

/** Geometry for the cutaway renderer. `order` runs along the shaft: "track" 0..8 (ramp, link, trunk), "main" 0..2, "bypass" 0..3. */
export const DESCENT_LAYOUT: {
  levels: { level: Level; name: string; cityIds: string[] }[];
  sectors: { sectorId: string; level: Level; shaft: "track" | "main" | "bypass"; order: number }[];
} = {
  levels: [
    { level: 1, name: "Upper depot", cityIds: ["depot"] },
    { level: 2, name: "Relay level", cityIds: ["relay"] },
    { level: 3, name: "Junction", cityIds: ["jun", "fork"] },
    { level: 4, name: "Flooded shaft", cityIds: [] },
    { level: 5, name: "Deep clinic", cityIds: ["clinic"] },
  ],
  sectors: (() => {
    const next = { track: 0, main: 0, bypass: 0 };
    return CHAINS.flatMap(([routeId, , , , shaft, lv]) => lv.map((level, i) => ({ sectorId: `${routeId}${i}`, level, shaft, order: next[shaft]++ })));
  })(),
};

const pod = (id: string, label: string, priority: Pod["priority"], origin: string, dest: string, departTick: number, w: World, o: Partial<Pod> = {}): Pod => ({
  id, label, priority, origin, dest, path: findPath(origin, dest, new Set(), w)!, at: -1, progress: 0, status: "scheduled",
  rerouted: false, waitedMin: 0, departTick, arriveTick: null, credentialOk: false, ...o,
});

// Beat ticks, tuned against the engine run. PAX-1 departs the tick MED-1 reaches the junction so both announce trunk0 together;
// the seal lands while MED-1 is still before the fork, so the news reaches it in time to take the bypass.
const T = { towerDown: 6, med1: 10, sup3: 12, pax1: 34, ghost: 37, seal: 41, end: 72 };

/** One entry per rule beat, in order. Ticks come from the echo-mode run; descent.test.ts asserts they match the log. */
export const DESCENT_BEATS: { beat: number; tick: number; rule: string; caption: string }[] = [
  { beat: 1, tick: 6, rule: "Claimed vs actual", caption: "The tower goes dark. Its banner still claims flights nobody is clearing." },
  { beat: 2, tick: 11, rule: "Dispatch", caption: "Nurse Mara Vale's medical pod leaves the depot on its own clearance." },
  { beat: 3, tick: 34, rule: "Priority yield", caption: "At the junction a passenger pod yields the shaft to the medical pod." },
  { beat: 4, tick: 37, rule: "Credential check", caption: "A forged medical pod fails the beacon's signature check and queues as a passenger." },
  { beat: 5, tick: 41, rule: "Seal and reroute", caption: "The flooded shaft is sealed. The news hops beacon to beacon and the nurse takes the bypass." },
  { beat: 6, tick: 62, rule: "Arrival", caption: "The nurse reaches the deep clinic. In tower mode she never leaves the depot." },
  { beat: 7, tick: 67, rule: "Rule 2 · supply after medical", caption: "Medicine delivered to the deep clinic" },
];

export function descent(): Mission {
  const world: World = structuredClone({ cities, sectors });
  const pods: Pod[] = [
    // cleared by the tower before it dies: the tower's "claimed" count grows
    pod("SUP-1", "SUP-1 · water", "supply", "depot", "relay", 1, world, { cargo: "water" }),
    pod("SUP-2", "SUP-2 · food", "supply", "depot", "relay", 2, world, { cargo: "food" }),
    // medicine for the deep clinic: trails MED-1 so the junction sees MED-1, then SUP-3, then PAX-1 (all three priority levels in order)
    pod("SUP-3", "SUP-3 · medicine", "supply", "depot", "clinic", T.sup3, world, { cargo: "medicine" }),
    pod("MED-1", "MED-1 · Nurse Mara Vale", "medical", "depot", "clinic", T.med1, world, { nurse: true, sig: sign("MED-1"), credentialOk: true }),
    pod("PAX-1", "PAX-1 · Passenger", "passenger", "jun", "clinic", T.pax1, world),
    pod("GHOST-1", "GHOST-1 · Medical courier", "medical", "relay", "clinic", T.ghost, world, { ghost: true, nurse: false, sig: "forged" }),
  ];
  return {
    id: "descent", title: "The Descent", seed: 20261119, world, endTick: T.end,
    towerDownAt: T.towerDown, towerRatePerHour: 30, towerInflation: 14,
    sealAt: T.seal, sealSectorId: "main0", pods,
  };
}

// ---- Live play: the Relay places beacons during the run (placeBeacon commands). See DESCENT.md "Live play". ----

/** Options every live level builder accepts. `seed` and `attempt` pick the flood location (see pickFlood); `revealLead` is how many ticks before a
 * seal its telegraph (sector and minute) becomes visible (default DEFAULT_REVEAL_LEAD; 0 = no advance reveal, the seal is first visible when it fires). */
export interface LevelOpts {
  seed?: number;
  attempt?: number;
  revealLead?: number;
}
export const DEFAULT_REVEAL_LEAD = 8;
export const BEACON_BUILD_TICKS = 2; // a placed beacon goes live this many ticks after the command
/** A builder argument is either an attempt number or an options object. `seed` stays undefined when not given (that means "candidate 0 first"). */
export const levelOpts = (a: number | LevelOpts = {}): { seed: number | undefined; attempt: number; revealLead: number } => {
  const o = typeof a === "number" ? { attempt: a } : a;
  return { seed: o.seed, attempt: Math.max(0, Math.floor(o.attempt ?? 0)), revealLead: Math.max(0, Math.floor(o.revealLead ?? DEFAULT_REVEAL_LEAD)) };
};
/** Seeded PRNG (mulberry32): deterministic, no Math.random. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Which of `n` flood candidates a level uses. Attempt 0 is drawn from the seed; every later attempt is drawn from the other candidates, so two
 * consecutive attempts never get the same flood. With no seed, attempt 0 is candidate 0 (the original flood) and the chain continues from seed 0. */
export function pickFlood(levelIndex: number, n: number, o: { seed?: number; attempt?: number } = {}): number {
  if (n <= 1) return 0;
  const rng = mulberry32(Math.imul((o.seed ?? 0) | 0, 0x9e3779b1) ^ Math.imul(levelIndex + 1, 0x85ebca6b));
  const first = rng();
  let c = o.seed === undefined ? 0 : Math.floor(first * n);
  for (let i = 1; i <= Math.max(0, Math.floor(o.attempt ?? 0)); i++) {
    const r = Math.floor(rng() * (n - 1));
    c = r >= c ? r + 1 : r;
  }
  return c;
}
/** Older deterministic pick from the attempt number alone; kept for callers that predate seeds. */
export const pickCandidate = (attempt: number, n: number): number => (attempt === 0 ? 0 : (Math.imul(attempt, 2654435761) >>> 16) % n);

export type Goals = { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number; text: string }[];
export interface LiveCandidate {
  id: string;
  sectorId: string; // where the flood seals
  at: number; // and when
  goals: Goals; // star table, calibrated for this candidate by scenarios/live-search.ts
  solution: Command[]; // a replayable 3-star run; it reacts to the flood telegraph (a placement at or after sealAt - DEFAULT_REVEAL_LEAD)
  seals?: { at: number; sectorId: string }[]; // further floods after the first (level 2's flood B); each telegraphs on its own
}

const LIVE_START = ["ramp0", "ramp1", "ramp2"]; // the L1 depot ramp and the first relay sector
// News reaches pods at the fork only over beacons on the sealed sector and every sector between it and the fork. A pod that does not know
// goes into main0 and is trapped at the seal for good: the engine never backs a pod out. main0 itself needs no news (a pod at the fork sees it).

/** Candidates for descentLive(attempt). Star tables come from the exhaustive search in scenarios/live-search.ts. Ladders were chosen so that no
 * single placement set earns stars on every candidate (placing everything at t0 averages at most 1 star across them): a set that warns for one
 * flood leaves the others untouched, and the speed beacons of one are wasted on the others. */
export const DESCENT_LIVE_CANDIDATES: LiveCandidate[] = [
  {
    // main1 at t41: the warning is the gate (main1 and main0); the other three beacons buy route speed. Best: Mara t83, medicine t88.
    id: "main1", sectorId: "main1", at: 41,
    goals: [
      { stars: 1, maraBy: 92, text: "Warn the shaft: Nurse Mara reaches the deep clinic by minute 92." },
      { stars: 2, maraBy: 86, medicineBy: 91, text: "Mara by minute 86 and the medicine by minute 91." },
      { stars: 3, maraBy: 83, medicineBy: 88, text: "Mara by minute 83 and the medicine by minute 88." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "link0", atTick: 16 },
      { type: "placeBeacon", sectorId: "link1", atTick: 20 },
      { type: "placeBeacon", sectorId: "link2", atTick: 24 },
      { type: "placeBeacon", sectorId: "main1", atTick: 33 }, // the flood telegraph appears at t33 (8 ticks before the seal)
      { type: "placeBeacon", sectorId: "main0", atTick: 34 },
    ],
  },
  {
    // main2 at t44: the news must hop main2, main1, main0 to reach the fork (3 beacons, no route speed left to spare), or round the long way:
    // main2 then the whole bypass, which is also the road Mara reroutes onto. Only that chain beats minute 86, so the two upper stars share one run: Mara t80, medicine t85.
    id: "main2", sectorId: "main2", at: 44,
    goals: [
      { stars: 1, maraBy: 92, text: "Warn the shaft all the way down: Nurse Mara reaches the deep clinic by minute 92." },
      { stars: 2, maraBy: 80, medicineBy: 90, text: "Mara by minute 80 and the medicine by minute 90." },
      { stars: 3, maraBy: 80, medicineBy: 85, text: "Mara by minute 80 and the medicine by minute 85." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "main2", atTick: 36 }, // the telegraph appears at t36
      { type: "placeBeacon", sectorId: "byp3", atTick: 37 },
      { type: "placeBeacon", sectorId: "byp2", atTick: 38 },
      { type: "placeBeacon", sectorId: "byp1", atTick: 39 },
      { type: "placeBeacon", sectorId: "byp0", atTick: 40 },
    ],
  },
  {
    // main0 at t38: the seal is right at the fork mouth, so Mara sees it and reroutes with no news at all. No warning is needed; the whole budget
    // is route speed, and only the full set of five reaches a star (the two upper stars share one run): Mara t77, medicine t82.
    id: "main0", sectorId: "main0", at: 38,
    goals: [
      { stars: 1, maraBy: 88, text: "Speed her down: Nurse Mara reaches the deep clinic by minute 88." },
      { stars: 2, maraBy: 77, medicineBy: 84, text: "Mara by minute 77 and the medicine by minute 84." },
      { stars: 3, maraBy: 77, medicineBy: 82, text: "Mara by minute 77 and the medicine by minute 82." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "link0", atTick: 16 },
      { type: "placeBeacon", sectorId: "link1", atTick: 20 },
      { type: "placeBeacon", sectorId: "link2", atTick: 24 },
      { type: "placeBeacon", sectorId: "trunk0", atTick: 30 }, // the telegraph appears at t30
      { type: "placeBeacon", sectorId: "trunk1", atTick: 33 },
    ],
  },
];

/** Candidate 0 (main1 at t41), the flood every first attempt gets: its star table and its 3-star run. Kept for callers that predate the candidates. */
export const DESCENT_LIVE_GOALS: Goals = DESCENT_LIVE_CANDIDATES[0].goals;
export const DESCENT_LIVE_SOLUTION: Command[] = DESCENT_LIVE_CANDIDATES[0].solution;
/** The 3-star run of every candidate, by candidate id. */
export const DESCENT_LIVE_SOLUTIONS: Record<string, Command[]> = Object.fromEntries(DESCENT_LIVE_CANDIDATES.map((c) => [c.id, c.solution]));

/** Candidate index of descentLive(a): `a` is an attempt number or { seed, attempt }. */
export function descentLiveCandidateIndex(a: number | LevelOpts = 0): number {
  const { attempt } = levelOpts(a);
  // Leg 1 teaches the rule, so it ignores the seed: attempt 0 is always candidate 0 (main1, won by a beacon on the flood plus the shaft above).
  // Later attempts (free-play retries) still rotate through the other floods without repeating the previous one.
  return pickFlood(0, DESCENT_LIVE_CANDIDATES.length, { attempt });
}

/** Same world and pods as descent(), but only LIVE_START has a beacon. Every other sector is a dead zone: a pod waits 3 minutes blind before
 * entering it. The flood seals one of DESCENT_LIVE_CANDIDATES, picked from the attempt number; its sector and minute show in the observation
 * only `revealLead` ticks before the seal (before that: "flood risk: main shaft"). Beacons take BEACON_BUILD_TICKS to go live and the run ends
 * as soon as it is decided (observation.endReason). Run is longer than descent() so slow, unbeaconed runs can still arrive late and score. */
export const DESCENT_LIVE_REVEAL_LEAD = 20; // leg 1 teaches the rule, so its flood shows 20 min ahead (later legs: DEFAULT_REVEAL_LEAD)
export function descentLive(a: number | LevelOpts = 0): Mission {
  const o = typeof a === "number" ? { attempt: a } : a;
  const { revealLead } = levelOpts({ ...o, revealLead: o.revealLead ?? DESCENT_LIVE_REVEAL_LEAD });
  const c = DESCENT_LIVE_CANDIDATES[descentLiveCandidateIndex(a)];
  const m = descent();
  for (const s of m.world.sectors) s.beacon = LIVE_START.includes(s.id);
  return {
    ...m, id: "descent-live", title: "The Descent (live)", endTick: 120, sealAt: c.at, sealSectorId: c.sectorId, beaconBudget: 5,
    floodReveal: { lead: revealLead, risk: ["flood risk: main shaft"] }, beaconBuildTicks: BEACON_BUILD_TICKS, earlyEnd: true,
  };
}

/** Stars earned by a finished run: the highest goal whose deadlines were all met (each star includes the one below). */
export function starsFor(goals: Goals, pods: Pick<Pod, "id" | "arriveTick">[]): 0 | 1 | 2 | 3 {
  const by = (id: string, t = Infinity) => (pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
  return goals.reduce<0 | 1 | 2 | 3>((n, g) => (by("MED-1", g.maraBy) && (g.medicineBy === undefined || by("SUP-3", g.medicineBy)) ? g.stars : n), 0);
}

/** Stars of a finished live run of `descentLive(a)` (same `a`: attempt number or { seed, attempt }). */
export const descentLiveStars = (pods: Pick<Pod, "id" | "arriveTick">[], a: number | LevelOpts = 0): 0 | 1 | 2 | 3 =>
  starsFor(DESCENT_LIVE_CANDIDATES[descentLiveCandidateIndex(a)].goals, pods);

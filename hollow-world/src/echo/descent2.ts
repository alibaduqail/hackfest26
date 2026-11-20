// The Descent II: Two Floods — live play, same engine rules as level 1 (docs/specs/echo/DESCENT.md "Live play"), doubled.
// A new world: two independent seals on two shafts in sequence. Each needs its own two-beacon warning chain (the sealed
// sector, then the one before it) placed before its own fork. Warning the second flood is wasted if the first one traps
// the pod first, so the budget must be split between both warnings, and placement order (which flood gets lit, and when)
// decides whether either pod ever reaches the second fork at all. descent() and descentLive() (level 1) are untouched.
//
// Live-play mechanics (descent.ts LevelOpts): each flood's sector and minute show in the observation only `revealLead` ticks
// before its seal (default 8; before that "flood risk: shaft A/B"), beacons take 2 ticks to go live, and the run ends as soon as
// it is decided. With revealLead 0 flood B is a pure mid-run surprise: the first sign is the "seal" log event itself.
import { sign } from "./credential";
import { BEACON_BUILD_TICKS, levelOpts, pickFlood, starsFor } from "./descent";
import type { Goals, LevelOpts, LiveCandidate } from "./descent";
import type { City, Command, Mission, Pod, Sector, World } from "./types";
import { findPath } from "./world";

const cities: City[] = [
  { id: "depot2", name: "Upper Depot", above: "Depot", x: 0.5, y: 0.08 },
  { id: "relay2", name: "Relay Level", above: "Relay", x: 0.5, y: 0.22 },
  { id: "forkA", name: "First Fork", above: "Fork A", x: 0.5, y: 0.38 },
  { id: "mid2", name: "Mid Shaft", above: "Mid Shaft", x: 0.5, y: 0.56 },
  { id: "forkB", name: "Second Fork", above: "Fork B", x: 0.5, y: 0.74 },
  { id: "clinic2", name: "Deep Clinic", above: "Clinic", x: 0.5, y: 0.94, outbreak: true },
];

// [routeId, from, to, minutes, sectorCount]. mainA/mainB are the sealed shafts (sealed sector is the middle one, index 1,
// same convention as level 1's main1); bypA/bypB are one sector longer, so the main shaft is the default (faster) route.
// Every chain keeps 3-6 sectors (world.ts's validateWorld rule, unconditional regardless of world size).
const CHAINS: [string, string, string, number, number][] = [
  ["ramp", "depot2", "relay2", 3, 3],
  ["link", "relay2", "forkA", 3, 3],
  ["mainA", "forkA", "mid2", 3, 3],
  ["bypA", "forkA", "mid2", 3, 4],
  ["trunk", "mid2", "forkB", 3, 3],
  ["mainB", "forkB", "clinic2", 3, 3],
  ["bypB", "forkB", "clinic2", 3, 4],
];

const at = (id: string) => cities.find((c) => c.id === id)!;
const sectors: Sector[] = CHAINS.flatMap(([routeId, from, to, minutes, n]) => {
  const f = at(from);
  const t = at(to);
  return Array.from({ length: n }, (_, i): Sector => ({
    id: `${routeId}${i}`, routeId, index: i, from, to, minutes, holder: null, sealed: false,
    a: [f.x + ((t.x - f.x) * i) / n, f.y + ((t.y - f.y) * i) / n],
    b: [f.x + ((t.x - f.x) * (i + 1)) / n, f.y + ((t.y - f.y) * (i + 1)) / n],
  }));
});

const pod = (id: string, label: string, priority: Pod["priority"], origin: string, dest: string, departTick: number, w: World, o: Partial<Pod> = {}): Pod => ({
  id, label, priority, origin, dest, path: findPath(origin, dest, new Set(), w)!, at: -1, progress: 0, status: "scheduled",
  rerouted: false, waitedMin: 0, departTick, arriveTick: null, credentialOk: false, ...o,
});

// Tick schedule, tuned against the echo-mode run (scenarios/live-search2.ts). Both seals land well before the fastest
// possible (fully-lit) commit tick to their own shaft (t34 into mainA0; t62 into mainB0 once flood A has already forced
// the bypass detour), so no amount of route speed can out-run either flood: only a beacon on its warning chain can.
const T2 = { towerDown: 6, med1: 10, sup3: 12, sealA: 30, sealB: 55, end: 220 };

const LIVE_START_2 = ["ramp0", "ramp1", "ramp2"]; // the depot ramp, same free starting layout as level 1

/** The Descent II mission: Nurse Mara and the medicine run through two sealed shafts in sequence. Only LIVE_START_2 has
 * a beacon; everywhere else is a dead zone (3-minute blind wait before a pod enters it, same as level 1). */
export function descentLive2(a: number | LevelOpts = 0): Mission {
  const { revealLead } = levelOpts(a);
  const c = DESCENT_LIVE_CANDIDATES_2[descentLiveCandidateIndex2(a)];
  const world: World = structuredClone({ cities, sectors });
  for (const s of world.sectors) s.beacon = LIVE_START_2.includes(s.id);
  const pods: Pod[] = [
    pod("SUP-3", "SUP-3 · medicine", "supply", "depot2", "clinic2", T2.sup3, world, { cargo: "medicine" }),
    pod("MED-1", "MED-1 · Nurse Mara Vale", "medical", "depot2", "clinic2", T2.med1, world, { nurse: true, sig: sign("MED-1"), credentialOk: true }),
  ];
  return {
    id: "descent-live-2", title: "The Descent (live) II: Two Floods", seed: 20261119, world, endTick: T2.end,
    towerDownAt: T2.towerDown, towerRatePerHour: 30, towerInflation: 14,
    sealAt: c.at, sealSectorId: c.sectorId, seals: c.seals,
    beaconBudget: 7, pods,
    floodReveal: { lead: revealLead, risk: ["flood risk: shaft A", "flood risk: shaft B"] }, beaconBuildTicks: BEACON_BUILD_TICKS, earlyEnd: true,
  };
}

/** Star table, calibrated by exhaustive search over every placement set within budget (scenarios/live-search2.ts).
 * A beacon on the sealed sector itself (mainA1, mainB1) is mandatory for its flood: with no beacon on it the news has
 * nothing to seed from, so the pod always finds out only by standing at the boundary — too late to route around it — and
 * holds there for good. No set lacking either sealed-sector beacon reaches any star (checked across the whole search).
 * The rest of the 7-beacon budget buys the one-hop relay to each fork (mainA0, mainB0) and route speed; which of the
 * remaining 3 sectors get the speed beacons does not matter, only that they sit on the path the pod actually takes (the
 * bypass after each warning, not the sealed shaft). No warning: 0 stars. Warning only (4 beacons, no speed): Mara 120 /
 * medicine 125. Plus 1 route beacon: still 1 star. Plus 2 good route beacons: 114/119 (2 stars). Full budget, the best of
 * 364 tied 7-beacon layouts: 111/116 (3 stars) — the ceiling confirmed by exhaustively searching every placement. */
export const DESCENT_LIVE_GOALS_2: Goals = [
  { stars: 1, maraBy: 120, text: "Warn both floods: Nurse Mara reaches the deep clinic by minute 120." },
  { stars: 2, maraBy: 114, medicineBy: 119, text: "Mara by minute 114 and the medicine by minute 119." },
  { stars: 3, maraBy: 111, medicineBy: 116, text: "Mara by minute 111 and the medicine by minute 116." },
];

/** A replayable run worth 3 stars (Mara t111, medicine t116): all three link beacons ahead of Mara on the ramp-to-fork
 * run, then the one-hop relay for flood A (mainA0, mainA1) before the first seal — the one flood the player can
 * legitimately plan for in advance (the same convention as level 1). Flood B's relay (mainB0, mainB1) goes in
 * reactively, at t47-48, the tick its telegraph appears: the flood is not known before then, and reacting to it still reaches the
 * same 3-star ceiling as a layout that somehow knew in advance (also verified at t55-59, after the seal itself). Verified by scenarios/live-search2.ts (one of 364 7-beacon layouts tied for
 * best; also verified reactive at t55-59 inclusive, not just this exact pair of ticks). */
export const DESCENT_LIVE_SOLUTION_2: Command[] = [
  { type: "placeBeacon", sectorId: "link0", atTick: 12 },
  { type: "placeBeacon", sectorId: "link1", atTick: 16 },
  { type: "placeBeacon", sectorId: "link2", atTick: 20 },
  { type: "placeBeacon", sectorId: "mainA1", atTick: 24 },
  { type: "placeBeacon", sectorId: "mainA0", atTick: 26 },
  { type: "placeBeacon", sectorId: "mainB0", atTick: 47 }, // flood B's telegraph appears at t47 (8 ticks before its seal)
  { type: "placeBeacon", sectorId: "mainB1", atTick: 48 },
];

// Flood candidates (seeded by descentLive2 options). Each is a pair of floods, A then B; B is always a mid-run surprise (its telegraph shows
// only `revealLead` ticks ahead, and not at all with revealLead 0). Calibrated by scenarios/live-search2.ts over every placement set within
// budget. Where the sealed sector is the third one of a shaft the news must hop three sectors (or round the long way, along the whole bypass,
// which is also the road the pod reroutes onto): only that one bespoke 7-beacon run beats minute 109, so its two upper stars share a run.
// Ladders were chosen so that no placement set earns stars on every candidate (blind play at t0 averages at most 1 star).
const B_AT = 55;
export const DESCENT_LIVE_CANDIDATES_2: LiveCandidate[] = [
  { id: "A1B1", sectorId: "mainA1", at: T2.sealA, seals: [{ at: B_AT, sectorId: "mainB1" }], goals: DESCENT_LIVE_GOALS_2, solution: DESCENT_LIVE_SOLUTION_2 },
  {
    // flood A at the third sector of its shaft: lay the warning along mainA2 and the whole bypass. Mara t108, medicine t113.
    id: "A2B1", sectorId: "mainA2", at: T2.sealA, seals: [{ at: B_AT, sectorId: "mainB1" }],
    goals: [
      { stars: 1, maraBy: 120, text: "Warn both floods: Nurse Mara reaches the deep clinic by minute 120." },
      { stars: 2, maraBy: 108, medicineBy: 118, text: "Mara by minute 108 and the medicine by minute 118." },
      { stars: 3, maraBy: 108, medicineBy: 113, text: "Mara by minute 108 and the medicine by minute 113." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "mainA2", atTick: 22 }, // flood A's telegraph appears at t22
      { type: "placeBeacon", sectorId: "bypA0", atTick: 23 },
      { type: "placeBeacon", sectorId: "bypA1", atTick: 24 },
      { type: "placeBeacon", sectorId: "bypA2", atTick: 25 },
      { type: "placeBeacon", sectorId: "bypA3", atTick: 26 },
      { type: "placeBeacon", sectorId: "mainB0", atTick: 47 }, // flood B's telegraph appears at t47
      { type: "placeBeacon", sectorId: "mainB1", atTick: 48 },
    ],
  },
  {
    // flood B at the third sector of its shaft: the mirror image. Mara t108, medicine t113.
    id: "A1B2", sectorId: "mainA1", at: T2.sealA, seals: [{ at: B_AT, sectorId: "mainB2" }],
    goals: [
      { stars: 1, maraBy: 120, text: "Warn both floods: Nurse Mara reaches the deep clinic by minute 120." },
      { stars: 2, maraBy: 108, medicineBy: 118, text: "Mara by minute 108 and the medicine by minute 118." },
      { stars: 3, maraBy: 108, medicineBy: 113, text: "Mara by minute 108 and the medicine by minute 113." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "mainA0", atTick: 22 }, // flood A's telegraph appears at t22
      { type: "placeBeacon", sectorId: "mainA1", atTick: 23 },
      { type: "placeBeacon", sectorId: "mainB2", atTick: 47 }, // flood B's telegraph appears at t47
      { type: "placeBeacon", sectorId: "bypB0", atTick: 48 },
      { type: "placeBeacon", sectorId: "bypB1", atTick: 49 },
      { type: "placeBeacon", sectorId: "bypB2", atTick: 50 },
      { type: "placeBeacon", sectorId: "bypB3", atTick: 51 },
    ],
  },
];
export const DESCENT_LIVE_SOLUTIONS_2: Record<string, Command[]> = Object.fromEntries(DESCENT_LIVE_CANDIDATES_2.map((c) => [c.id, c.solution]));

/** Candidate index of descentLive2(a): `a` is an attempt number or { seed, attempt }. */
export function descentLiveCandidateIndex2(a: number | LevelOpts = 0): number {
  const { seed, attempt } = levelOpts(a);
  return pickFlood(1, DESCENT_LIVE_CANDIDATES_2.length, { seed, attempt });
}

/** Stars of a finished run of `descentLive2(a)`. */
export const descentLiveStars2 = (pods: Pick<Pod, "id" | "arriveTick">[], a: number | LevelOpts = 0): 0 | 1 | 2 | 3 => starsFor(DESCENT_LIVE_CANDIDATES_2[descentLiveCandidateIndex2(a)].goals, pods);

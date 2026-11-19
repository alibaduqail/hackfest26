// The Descent II: Two Floods — live play, same engine rules as level 1 (docs/specs/echo/DESCENT.md "Live play"), doubled.
// A new world: two independent seals on two shafts in sequence. Each needs its own two-beacon warning chain (the sealed
// sector, then the one before it) placed before its own fork. Warning the second flood is wasted if the first one traps
// the pod first, so the budget must be split between both warnings, and placement order (which flood gets lit, and when)
// decides whether either pod ever reaches the second fork at all. descent() and descentLive() (level 1) are untouched.
//
// Flood B is a mid-run surprise, not a plan made at t0: nothing in an Observation before T2.sealB (the "seal" log event
// itself, and the only point `sectors[].sealed` flips for mainB1) distinguishes this mission from one with a single
// flood — see descent-levels.test.ts and live2.test.ts's "flood B is not telegraphed early" test. The 3-star solution
// below places flood B's relay (mainB0, mainB1) reactively, right as that log event fires, and still reaches the same
// ceiling as placing it earlier: there is no mechanical reward for pre-committing to flood B before seeing it happen.
import { sign } from "./credential";
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
export function descentLive2(): Mission {
  const world: World = structuredClone({ cities, sectors });
  for (const s of world.sectors) s.beacon = LIVE_START_2.includes(s.id);
  const pods: Pod[] = [
    pod("SUP-3", "SUP-3 · medicine", "supply", "depot2", "clinic2", T2.sup3, world, { cargo: "medicine" }),
    pod("MED-1", "MED-1 · Nurse Mara Vale", "medical", "depot2", "clinic2", T2.med1, world, { nurse: true, sig: sign("MED-1"), credentialOk: true }),
  ];
  return {
    id: "descent-live-2", title: "The Descent (live) II: Two Floods", seed: 20261119, world, endTick: T2.end,
    towerDownAt: T2.towerDown, towerRatePerHour: 30, towerInflation: 14,
    sealAt: T2.sealA, sealSectorId: "mainA1", seals: [{ at: T2.sealB, sectorId: "mainB1" }],
    beaconBudget: 7, pods,
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
export const DESCENT_LIVE_GOALS_2: { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number; text: string }[] = [
  { stars: 1, maraBy: 120, text: "Warn both floods: Nurse Mara reaches the deep clinic by minute 120." },
  { stars: 2, maraBy: 114, medicineBy: 119, text: "Mara by minute 114 and the medicine by minute 119." },
  { stars: 3, maraBy: 111, medicineBy: 116, text: "Mara by minute 111 and the medicine by minute 116." },
];

export function descentLiveStars2(pods: Pick<Pod, "id" | "arriveTick">[]): 0 | 1 | 2 | 3 {
  const by = (id: string, t = Infinity) => (pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
  return DESCENT_LIVE_GOALS_2.reduce<0 | 1 | 2 | 3>((n, g) => (by("MED-1", g.maraBy) && (g.medicineBy === undefined || by("SUP-3", g.medicineBy)) ? g.stars : n), 0);
}

/** A replayable run worth 3 stars (Mara t111, medicine t116): all three link beacons ahead of Mara on the ramp-to-fork
 * run, then the one-hop relay for flood A (mainA0, mainA1) before the first seal — the one flood the player can
 * legitimately plan for in advance (the same convention as level 1). Flood B's relay (mainB0, mainB1) goes in
 * reactively, at and just after T2.sealB (55), the tick its own "seal" log event fires: that event is the only place a
 * player (or this solution) can learn flood B exists at all, and reacting to it still reaches the same 3-star ceiling
 * as a layout that somehow knew in advance. Verified by scenarios/live-search2.ts (one of 364 7-beacon layouts tied for
 * best; also verified reactive at t55-59 inclusive, not just this exact pair of ticks). */
export const DESCENT_LIVE_SOLUTION_2: Command[] = [
  { type: "placeBeacon", sectorId: "link0", atTick: 12 },
  { type: "placeBeacon", sectorId: "link1", atTick: 16 },
  { type: "placeBeacon", sectorId: "link2", atTick: 20 },
  { type: "placeBeacon", sectorId: "mainA1", atTick: 24 },
  { type: "placeBeacon", sectorId: "mainA0", atTick: 26 },
  { type: "placeBeacon", sectorId: "mainB0", atTick: 55 },
  { type: "placeBeacon", sectorId: "mainB1", atTick: 56 },
];

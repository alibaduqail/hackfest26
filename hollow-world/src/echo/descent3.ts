// The Descent III: Forged Rush — live play, same engine rules as levels 1-2 (docs/specs/echo/DESCENT.md "Live play").
// A new world: two forged medical pods and passenger traffic converge on a single-lane junction from a different
// approach than Mara's, right as a flood is coming downstream. Medical always outranks them (protocol.ts's `rank`), but
// rank only decides who wins among pods already announced in the SAME tick; a dark junction makes Mara wait out her own
// blind 3-tick clock while the others — who started waiting first — each already claimed and cleared the junction ahead
// of her. Lighting the junction removes that asymmetric head start so her priority actually keeps her moving; the flood
// warning is still required to arrive at all. descent(), descentLive() and descentLive2() are untouched.
import { sign } from "./credential";
import { BEACON_BUILD_TICKS, levelOpts, pickFlood, starsFor } from "./descent";
import type { Goals, LevelOpts, LiveCandidate } from "./descent";
import type { City, Command, Mission, Pod, Sector, World } from "./types";
import { findPath } from "./world";

const cities: City[] = [
  { id: "depot3", name: "Upper Depot", above: "Depot", x: 0.4, y: 0.08 },
  { id: "ghostSrc", name: "Relay Spur", above: "Relay Spur", x: 0.65, y: 0.08 },
  { id: "paxSrc", name: "Transit Hub", above: "Transit Hub", x: 0.8, y: 0.2 },
  { id: "jun3", name: "Junction", above: "Junction", x: 0.5, y: 0.4 },
  { id: "fork3", name: "Shaft Fork", above: "Fork", x: 0.5, y: 0.58 },
  { id: "clinic3", name: "Deep Clinic", above: "Clinic", x: 0.5, y: 0.92, outbreak: true },
];

// [routeId, from, to, minutes, sectorCount]. trunk0 (first of "trunk") is the single-lane junction every approach feeds
// into. main is the sealed shaft (sealed sector is the middle one, main1); byp is one sector longer (same convention as
// levels 1-2). Every chain keeps 3-6 sectors (world.ts's validateWorld rule, unconditional regardless of world size).
const CHAINS: [string, string, string, number, number][] = [
  ["ramp", "depot3", "jun3", 3, 3], // Mara and the medicine
  ["spur", "ghostSrc", "jun3", 3, 3], // the two forged pods
  ["paxline", "paxSrc", "jun3", 3, 3], // passenger traffic
  ["trunk", "jun3", "fork3", 3, 3], // the junction bottleneck: trunk0 is single-lane
  ["main", "fork3", "clinic3", 3, 3],
  ["byp", "fork3", "clinic3", 3, 4],
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
// trunk0 is the single-lane junction itself (every approach funnels through it before the trunk fans back out to one
// lane). GHOST-1 is already inside it, disguised as routine traffic, when the run begins, so it holds the junction for
// a long first stretch regardless of any beacon; the length is tuned so its release lands between PAX-1's and Mara's
// own blind-clock expiry (see T3 below), the exact overlap that makes the junction's beacon decide the race.
sectors.find((s) => s.id === "trunk0")!.minutes = 22;

const pod = (id: string, label: string, priority: Pod["priority"], origin: string, dest: string, departTick: number, w: World, o: Partial<Pod> = {}): Pod => ({
  id, label, priority, origin, dest, path: findPath(origin, dest, new Set(), w)!, at: -1, progress: 0, status: "scheduled",
  rerouted: false, waitedMin: 0, departTick, arriveTick: null, credentialOk: false, ...o,
});

// Tick schedule, tuned against the echo-mode run (scenarios/live-search3.ts). GHOST-1 starts the run already inside
// the junction (see below) and releases it at t22. PAX-1 reaches the junction boundary well before then; Mara reaches
// it only shortly before t22. A dark junction gates each pod's turn behind its own blind clock, started the tick it
// first waits there: PAX-1's clock clears long before t22, Mara's does not, so PAX-1 — despite outranking nobody —
// takes the slot the instant it opens. A lit junction has no clock to gate on: both are "waiting" from the moment they
// arrive, so when the slot opens at t22 priority (medical over passenger) correctly puts Mara through first. The seal
// lands well before the fastest possible (fully-lit) commit tick into main0, so no amount of route speed out-runs the
// flood either.
const T3 = { towerDown: 6, med1: 10, sup3: 13, ghost2: 25, pax1: 3, pax2: 28, seal: 48, end: 200 };

// The depot ramp, the forged pods' spur and the passengers' line are always lit (same free-layout convention as levels
// 1-2): their own travel time is fixed and predictable, so trunk0 — the junction itself — is the only dark sector whose
// beacon decides who wins the race for it.
const LIVE_START_3 = ["ramp0", "ramp1", "ramp2", "spur0", "spur1", "spur2", "paxline0", "paxline1", "paxline2"];

/** The Descent III mission: a forged medical pod is already clogging the single-lane junction (trunk0) when the run
 * begins; a second forged pod and two passengers add more traffic behind it, right as the shaft floods downstream.
 * Only LIVE_START_3 has a beacon. */
export function descentLive3(a: number | LevelOpts = 0): Mission {
  const { revealLead } = levelOpts(a);
  const c = DESCENT_LIVE_CANDIDATES_3[descentLiveCandidateIndex3(a)];
  const world: World = structuredClone({ cities, sectors });
  for (const s of world.sectors) s.beacon = LIVE_START_3.includes(s.id);
  const ghost1: Pod = { ...pod("GHOST-1", "GHOST-1 · Medical courier", "medical", "ghostSrc", "clinic3", 0, world, { ghost: true, nurse: false, sig: "forged" }), status: "moving" };
  ghost1.at = ghost1.path.indexOf("trunk0");
  world.sectors.find((s) => s.id === "trunk0")!.holder = ghost1.id;
  const pods: Pod[] = [
    ghost1,
    pod("SUP-3", "SUP-3 · medicine", "supply", "depot3", "clinic3", T3.sup3, world, { cargo: "medicine" }),
    pod("MED-1", "MED-1 · Nurse Mara Vale", "medical", "depot3", "clinic3", T3.med1, world, { nurse: true, sig: sign("MED-1"), credentialOk: true }),
    pod("GHOST-2", "GHOST-2 · Medical courier", "medical", "ghostSrc", "clinic3", T3.ghost2, world, { ghost: true, nurse: false, sig: "forged" }),
    pod("PAX-1", "PAX-1 · Passenger", "passenger", "paxSrc", "clinic3", T3.pax1, world),
    pod("PAX-2", "PAX-2 · Passenger", "passenger", "paxSrc", "clinic3", T3.pax2, world),
  ];
  return {
    id: "descent-live-3", title: "The Descent (live) III: Forged Rush", seed: 20261120, world, endTick: T3.end,
    towerDownAt: T3.towerDown, towerRatePerHour: 30, towerInflation: 14,
    sealAt: c.at, sealSectorId: c.sectorId, beaconBudget: 6, pods,
    floodReveal: { lead: revealLead, risk: ["flood risk: main shaft"] }, beaconBuildTicks: BEACON_BUILD_TICKS, earlyEnd: true,
  };
}

/** Star table, calibrated by exhaustive search over every placement set within budget (scenarios/live-search3.ts). The
 * flood warning (main1, main0) is the gate to any star, same as levels 1-2: no set lacking it reaches a star. Within
 * that, the junction (trunk0) is the gate to the top tier: the best any set without a junction beacon reaches is 2
 * stars (99/123, by routing speed alone), however the rest of the budget is spent — see `descentLive3()`'s doc comment
 * for why a dark junction costs Mara the race regardless of her priority. Warning only, no speed: 111/135 (1 star).
 * Full budget without the junction, best routing: 99/123 (2 stars). Full budget with the junction but no bypass speed:
 * 81/105 (2 stars — the junction alone is not enough either). Full budget with both: 78/102, the best of 20 tied
 * 6-beacon layouts (3 stars). */
export const DESCENT_LIVE_GOALS_3: Goals = [
  { stars: 1, maraBy: 111, text: "Warn the flood: Nurse Mara reaches the deep clinic by minute 111." },
  { stars: 2, maraBy: 99, medicineBy: 123, text: "Mara by minute 99 and the medicine by minute 123." },
  { stars: 3, maraBy: 78, medicineBy: 102, text: "Mara by minute 78 and the medicine by minute 102." },
];

/** A replayable run worth 3 stars (Mara t78, medicine t102): light the whole junction trunk early (so Mara wins the
 * race the instant GHOST-1 vacates it), then the flood warning (main1, main0), then one bypass beacon ahead of Mara on
 * the route she reroutes to. Verified by scenarios/live-search3.ts (one of 20 6-beacon layouts tied for best). */
export const DESCENT_LIVE_SOLUTION_3: Command[] = [
  { type: "placeBeacon", sectorId: "trunk0", atTick: 5 },
  { type: "placeBeacon", sectorId: "trunk1", atTick: 18 },
  { type: "placeBeacon", sectorId: "trunk2", atTick: 22 },
  { type: "placeBeacon", sectorId: "main1", atTick: 40 }, // the flood telegraph appears at t40 (8 ticks before the seal)
  { type: "placeBeacon", sectorId: "main0", atTick: 41 },
  { type: "placeBeacon", sectorId: "byp0", atTick: 42 },
];

// Flood candidates (seeded by descentLive3 options). Calibrated by scenarios/live-search3.ts over every placement set within budget. The junction
// beacons are common to every flood, so ladders were chosen so that no placement set earns stars on every candidate (blind play at t0 averages
// at most 1 star). Two of them are single-run levels: main2 (the news must hop three sectors, or round the whole bypass) and main0 (the seal is at
// the fork mouth, so Mara sees it with no news and the whole budget is speed). Their upper stars share one run.
export const DESCENT_LIVE_CANDIDATES_3: LiveCandidate[] = [
  { id: "main1", sectorId: "main1", at: T3.seal, goals: DESCENT_LIVE_GOALS_3, solution: DESCENT_LIVE_SOLUTION_3 },
  {
    // main2 at t50: junction, the whole bypass lit, and main2 to seed the news. Mara t75, medicine t99.
    id: "main2", sectorId: "main2", at: 50,
    goals: [
      { stars: 1, maraBy: 99, text: "Warn the flood: Nurse Mara reaches the deep clinic by minute 99." },
      { stars: 2, maraBy: 75, medicineBy: 104, text: "Mara by minute 75 and the medicine by minute 104." },
      { stars: 3, maraBy: 75, medicineBy: 99, text: "Mara by minute 75 and the medicine by minute 99." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "trunk0", atTick: 5 },
      { type: "placeBeacon", sectorId: "main2", atTick: 42 }, // the telegraph appears at t42 (8 ticks before the seal)
      { type: "placeBeacon", sectorId: "byp3", atTick: 43 },
      { type: "placeBeacon", sectorId: "byp2", atTick: 44 },
      { type: "placeBeacon", sectorId: "byp1", atTick: 45 },
      { type: "placeBeacon", sectorId: "byp0", atTick: 46 },
    ],
  },
  {
    // main0 at t46: the seal is at the fork mouth; no warning, all speed: light the junction and the bypass. Mara t72, medicine t96.
    id: "main0", sectorId: "main0", at: 46,
    goals: [
      { stars: 1, maraBy: 107, text: "Speed her down: Nurse Mara reaches the deep clinic by minute 107." },
      { stars: 2, maraBy: 72, medicineBy: 101, text: "Mara by minute 72 and the medicine by minute 101." },
      { stars: 3, maraBy: 72, medicineBy: 96, text: "Mara by minute 72 and the medicine by minute 96." },
    ],
    solution: [
      { type: "placeBeacon", sectorId: "trunk0", atTick: 5 },
      { type: "placeBeacon", sectorId: "trunk1", atTick: 18 },
      { type: "placeBeacon", sectorId: "trunk2", atTick: 22 },
      { type: "placeBeacon", sectorId: "byp0", atTick: 38 }, // the telegraph appears at t38
      { type: "placeBeacon", sectorId: "byp1", atTick: 39 },
      { type: "placeBeacon", sectorId: "byp2", atTick: 40 },
    ],
  },
];
export const DESCENT_LIVE_SOLUTIONS_3: Record<string, Command[]> = Object.fromEntries(DESCENT_LIVE_CANDIDATES_3.map((c) => [c.id, c.solution]));

/** Candidate index of descentLive3(a): `a` is an attempt number or { seed, attempt }. */
export function descentLiveCandidateIndex3(a: number | LevelOpts = 0): number {
  const { seed, attempt } = levelOpts(a);
  return pickFlood(2, DESCENT_LIVE_CANDIDATES_3.length, { seed, attempt });
}

/** Stars of a finished run of `descentLive3(a)`. */
export const descentLiveStars3 = (pods: Pick<Pod, "id" | "arriveTick">[], a: number | LevelOpts = 0): 0 | 1 | 2 | 3 => starsFor(DESCENT_LIVE_CANDIDATES_3[descentLiveCandidateIndex3(a)].goals, pods);

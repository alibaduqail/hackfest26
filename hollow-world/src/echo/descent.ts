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

const LIVE_START = ["ramp0", "ramp1", "ramp2"]; // the L1 depot ramp and the first relay sector
// The flood seals main1, not main0. A pod that does not know goes into main0 and is trapped at main1 for good: the engine never
// backs a pod out. News reaches pods at the fork only over beacons on main1 (the seal) and main0, so the warning is worth two beacons.
const LIVE_SEAL = "main1";

/** Same world, pods and seal as descent(), but only LIVE_START has a beacon. Every other sector is a dead zone: a pod waits 3 minutes
 * blind before entering it. Run is longer than descent() so slow, unbeaconed runs can still arrive late and score. */
export function descentLive(): Mission {
  const m = descent();
  for (const s of m.world.sectors) s.beacon = LIVE_START.includes(s.id);
  return { ...m, id: "descent-live", title: "The Descent (live)", endTick: 120, sealSectorId: LIVE_SEAL, beaconBudget: 5 };
}

/** Star table, calibrated by exhaustive search over every placement set (scripts: scenarios/live-search.ts). Unwarned pods are trapped at
 * the flooded main1 and never arrive, so the warning (beacons on main1 and main0, 2 of the 5) is the gate to any star; route beacons
 * (3 minutes each) decide how many. No warning: 0 stars. Warning only: Mara t92, medicine t97. Warning + 2 route: t86 / t91.
 * Warning + 3 route, the best possible: t83 / t88. Deadlines are arrive-by ticks. */
export const DESCENT_LIVE_GOALS: { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number; text: string }[] = [
  { stars: 1, maraBy: 92, text: "Warn the shaft: Nurse Mara reaches the deep clinic by minute 92." },
  { stars: 2, maraBy: 86, medicineBy: 91, text: "Mara by minute 86 and the medicine by minute 91." },
  { stars: 3, maraBy: 83, medicineBy: 88, text: "Mara by minute 83 and the medicine by minute 88." },
];

/** Stars earned by a finished live run: the highest goal whose deadlines were all met (each star includes the one below). */
export function descentLiveStars(pods: Pick<Pod, "id" | "arriveTick">[]): 0 | 1 | 2 | 3 {
  const by = (id: string, t = Infinity) => (pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
  return DESCENT_LIVE_GOALS.reduce<0 | 1 | 2 | 3>((n, g) => (by("MED-1", g.maraBy) && (g.medicineBy === undefined || by("SUP-3", g.medicineBy)) ? g.stars : n), 0);
}

/** A replayable run worth 3 stars (Mara t83, medicine t88): three route beacons just ahead of Mara, then the flood warning (main1, main0) before the seal lands at t41. */
export const DESCENT_LIVE_SOLUTION: Command[] = [
  { type: "placeBeacon", sectorId: "link0", atTick: 16 },
  { type: "placeBeacon", sectorId: "link1", atTick: 20 },
  { type: "placeBeacon", sectorId: "link2", atTick: 24 },
  { type: "placeBeacon", sectorId: "main1", atTick: 30 },
  { type: "placeBeacon", sectorId: "main0", atTick: 34 },
];

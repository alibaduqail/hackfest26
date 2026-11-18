// The Descent: a small vertical world, one protocol mechanism per level. The UI page is driven by this mission's observations.
// Deterministic, no randomness. Numbers and credentials are simulated (see docs/specs/echo/DESCENT.md). Not part of MISSIONS.
import { sign } from "./credential";
import type { City, Mission, Pod, Sector, World } from "./types";
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
const T = { towerDown: 6, med1: 10, pax1: 34, ghost: 37, seal: 41, end: 72 };

/** One entry per rule beat, in order. Ticks come from the echo-mode run; descent.test.ts asserts they match the log. */
export const DESCENT_BEATS: { beat: number; tick: number; rule: string; caption: string }[] = [
  { beat: 1, tick: 6, rule: "Claimed vs actual", caption: "The tower goes dark. Its banner still claims flights nobody is clearing." },
  { beat: 2, tick: 11, rule: "Dispatch", caption: "Nurse Mara Vale's medical pod leaves the depot on its own clearance." },
  { beat: 3, tick: 34, rule: "Priority yield", caption: "At the junction a passenger pod yields the shaft to the medical pod." },
  { beat: 4, tick: 37, rule: "Credential check", caption: "A forged medical pod fails the beacon's signature check and queues as a passenger." },
  { beat: 5, tick: 41, rule: "Seal and reroute", caption: "The flooded shaft is sealed. The news hops beacon to beacon and the nurse takes the bypass." },
  { beat: 6, tick: 62, rule: "Arrival", caption: "The nurse reaches the deep clinic. In tower mode she never leaves the depot." },
];

export function descent(): Mission {
  const world: World = structuredClone({ cities, sectors });
  const pods: Pod[] = [
    // cleared by the tower before it dies: the tower's "claimed" count grows
    pod("SUP-1", "SUP-1 · water", "supply", "depot", "relay", 1, world, { cargo: "water" }),
    pod("SUP-2", "SUP-2 · food", "supply", "depot", "relay", 2, world, { cargo: "food" }),
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

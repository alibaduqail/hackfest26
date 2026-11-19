// Tower Down: the tower clears 6 flights, goes dark at minute 20, and the Directorate seals the direct
// Sector 07 -> Lagos tunnel at minute 30. Pods are generated from the mission seed (mulberry32), never Math.random.
import { sign } from "./credential";
import type { Mission, Pod } from "./types";
import { cloneWorld, findPath, validateWorld, world } from "./world";

export const SEAL_SECTOR = "s07-lagos-f0";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

const NURSES = ["Mara Vale", "Idris Okafor", "Lena Voss", "Tomas Reyes", "Ayo Bello", "Hana Sato", "Pavel Orlov", "Ines Duarte"];
// [origin, dest] for MED-1..8: six go to the outbreak city
const MED: [string, string][] = [["s07", "lagos"], ["ny", "lagos"], ["lon", "lagos"], ["sao", "lagos"], ["cairo", "lagos"], ["mow", "lagos"], ["bei", "mum"], ["syd", "jak"]];
// [cargo, origin, dest] for SUP-1..10: 4 medicine, 3 water, 3 food
const SUP: [Pod["cargo"], string, string][] = [
  ["medicine", "ny", "lagos"], ["medicine", "lon", "lagos"], ["medicine", "mum", "jak"], ["medicine", "tok", "syd"],
  ["water", "cairo", "lagos"], ["water", "bei", "mum"], ["water", "sao", "s07"],
  ["food", "lon", "lagos"], ["food", "mum", "jak"], ["food", "tok", "syd"],
];

const base = (id: string, label: string, priority: Pod["priority"], origin: string, dest: string): Pod => ({
  id, label, priority, origin, dest, path: findPath(origin, dest)!, at: -1, progress: 0, status: "scheduled",
  rerouted: false, waitedMin: 0, departTick: 0, arriveTick: null, credentialOk: false,
});
const nurse = (n: number, name: string, o: string, d: string): Pod => {
  const p = base(`MED-${n}`, `MED-${n} · Nurse ${name}`, "medical", o, d);
  p.nurse = true;
  p.sig = sign(p.id);
  p.credentialOk = true;
  return p;
};
const supply = (n: number, cargo: Pod["cargo"], o: string, d: string): Pod => ({ ...base(`SUP-${n}`, `SUP-${n} · ${cargo}`, "supply", o, d), cargo });
const passengers = (rnd: () => number, from: number, count: number): Pod[] => {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  const ids = world.cities.map((c) => c.id);
  return Array.from({ length: count }, (_, i) => {
    const o = pick(ids);
    const d = pick(ids.filter((c) => c !== o));
    return base(`PAX-${from + i}`, `PAX-${from + i} · Passenger`, "passenger", o, d);
  });
};

function makePods(seed: number): Pod[] {
  const rnd = mulberry32(seed);
  const pods: Pod[] = [
    ...MED.map(([o, d], i) => nurse(i + 1, NURSES[i], o, d)),
    ...SUP.map(([cargo, o, d], i) => supply(i + 1, cargo, o, d)),
    ...passengers(rnd, 1, 22),
  ];
  // MED-1 and PAX-1 are staged for the demo beat; everyone else is placed by the seed.
  const staged = new Set(["MED-1", "PAX-1"]);
  const free = pods.filter((p) => !staged.has(p.id));
  // Nothing is in transit at tick 0, so only tower grants put pods in sectors: realFlights stays <= grantsEver (6) in tower mode.
  // Depart over the first two hours; the first 8 leave before the tower dies so it can spend its 6 grants.
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]]; // seeded shuffle: the tower's 6 real flights are a mix, not all nurses
  }
  free.forEach((p, i) => {
    p.departTick = i < 8 ? 1 + i : 20 + Math.floor(rnd() * 40); // ticks 1-8: always a waiting pod when the tower has a grant to give
  });
  // MED-1 and PAX-1 both leave Sector 07 at t31, right after the seal: they announce the same sector (MED-1 re-planned via São Paulo) in the same tick, so PAX-1 must yield.
  const med1 = pods[0];
  med1.departTick = 31;
  const pax1 = pods.find((p) => p.id === "PAX-1")!;
  Object.assign(pax1, { origin: "s07", dest: "sao", path: findPath("s07", "sao")!, label: "PAX-1 · Passenger", departTick: 31 });
  return pods;
}

export function towerDown(): Mission {
  const w = cloneWorld();
  const pods = makePods(20261117);
  for (const p of pods) if (p.status === "moving") w.sectors.find((s) => s.id === p.path[p.at])!.holder = p.id;
  return {
    id: "tower-down",
    title: "Tower Down",
    seed: 20261117,
    world: w,
    endTick: 360,
    towerDownAt: 20,
    towerRatePerHour: 18, // 6 grants before minute 20
    towerInflation: 14, // 6 x 14 = "84 pod runs authorized"
    sealAt: 30,
    sealSectorId: SEAL_SECTOR,
    pods,
  };
}

/** Dead Zones: Tower Down's world, pods and seal, but no beacon is placed. The player bolts in up to 40 before the run. */
export function deadZones(): Mission {
  const m = towerDown();
  for (const s of m.world.sectors) s.beacon = false;
  return { ...m, id: "dead-zones", title: "Dead Zones", beaconBudget: 40 };
}

// The Grounding's second wave: [origin] for MED-9..13 (all to Lagos), [cargo, origin] for SUP-11..15 (all to Lagos)
const WAVE_MED: [string, string][] = [["Kofi Mensah", "ny"], ["Rosa Lindqvist", "lon"], ["Yusuf Haddad", "cairo"], ["Mei Chen", "sao"], ["Nadia Petrova", "mow"]];
const WAVE_SUP: [Pod["cargo"], string][] = [["medicine", "cairo"], ["medicine", "s07"], ["water", "lon"], ["food", "mow"], ["water", "sao"]];

/** The Grounding: a full day. Tower Down's pods, then a second wave from t200 to t700, and the Directorate keeps sealing Lagos's tunnels. */
export function grounding(): Mission {
  const seed = 20261118;
  const m = towerDown();
  const rnd = mulberry32(seed);
  const wave = [
    ...WAVE_MED.map(([name, o], i) => nurse(MED.length + 1 + i, name, o, "lagos")),
    ...WAVE_SUP.map(([cargo, o], i) => supply(SUP.length + 1 + i, cargo, o, "lagos")),
    ...passengers(rnd, 23, 10),
  ];
  for (const p of wave) p.departTick = 200 + Math.floor(rnd() * 501); // t200..t700
  for (const s of m.world.sectors) s.beacon = false;
  return {
    ...m,
    id: "grounding",
    title: "The Grounding",
    seed,
    endTick: 1440,
    seals: [
      { at: 300, sectorId: "lagos-cairo-b0" }, // Cairo -> Lagos
      { at: 700, sectorId: "lon-lagos-f0" }, // London -> Lagos
    ],
    beaconBudget: 50,
    pods: [...m.pods, ...wave],
  };
}

/** Ghost Flight: Tower Down plus a Directorate fake that claims to be medical, with a forged signature. */
export function ghostFlight(): Mission {
  const m = towerDown();
  const ghost: Pod = { ...base("GHOST-1", "GHOST-1 · Medical courier", "medical", "s07", "lagos"), ghost: true, nurse: false, sig: "forged", credentialOk: false, departTick: 31 };
  return { ...m, id: "ghost-flight", title: "Ghost Flight", pods: [...m.pods, ghost] };
}

/** The campaign, in order. */
export const MISSIONS: { id: string; build: () => Mission }[] = [
  { id: "tower-down", build: towerDown },
  { id: "dead-zones", build: deadZones },
  { id: "grounding", build: grounding },
  { id: "ghost-flight", build: ghostFlight },
];

/** Data check for a mission. Empty array = valid. */
export function validateMission(m: Mission): string[] {
  const errs = validateWorld(m.world);
  const sec = new Map(m.world.sectors.map((s) => [s.id, s]));
  const held = new Map<string, string>();
  if (m.sealSectorId && !sec.has(m.sealSectorId)) errs.push(`unknown seal sector ${m.sealSectorId}`);
  for (const x of m.seals ?? []) if (!sec.has(x.sectorId)) errs.push(`unknown seal sector ${x.sectorId}`);
  if (new Set(m.pods.map((p) => p.id)).size !== m.pods.length) errs.push("duplicate pod id");
  for (const p of m.pods) {
    if (p.path.length === 0) errs.push(`${p.id}: empty path`);
    p.path.forEach((id, i) => {
      const s = sec.get(id);
      if (!s) return errs.push(`${p.id}: unknown sector ${id}`);
      if (i === 0 && s.from !== p.origin) errs.push(`${p.id}: path starts at ${s.from}, origin ${p.origin}`);
      const prev = sec.get(p.path[i - 1]);
      const sameChain = prev && prev.routeId === s.routeId && s.index === prev.index + 1;
      const chainEnd = prev && s.index === 0 && prev.index === m.world.sectors.filter((x) => x.routeId === prev.routeId).length - 1 && prev.to === s.from;
      if (prev && !sameChain && !chainEnd) errs.push(`${p.id}: gap before ${id}`);
      if (i === p.path.length - 1 && s.to !== p.dest) errs.push(`${p.id}: path ends at ${s.to}, dest ${p.dest}`);
    });
    if (p.status === "moving") {
      const id = p.path[p.at];
      if (sec.get(id)?.holder !== p.id) errs.push(`${p.id}: in transit but ${id} is not held by it`);
      if (held.has(id)) errs.push(`${id}: held by ${held.get(id)} and ${p.id}`);
      held.set(id, p.id);
    }
  }
  return errs;
}

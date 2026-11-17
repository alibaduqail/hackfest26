// EchoEngine: headless, deterministic, no DOM. One tick = one sim minute.
// step() order (PLAN §3.3): commands (act) -> tower -> movement -> Echo claims -> score -> tick++.
import { verify } from "./credential";
import { echoPhase } from "./protocol";
import { towerPhase } from "./tower";
import { CONTRACT_VERSION } from "./types";
import type { CreateEngine, Command, EchoEngineApi, LogEvent, Mission, Mode, Observation, Pod, Pulse, Score, Sector } from "./types";

/** Per-pod engine state that is not part of the contract. */
export interface Rt {
  granted: boolean; // tower cleared this flight
  knows: boolean; // heard the seal news (or saw it)
  stuck: boolean; // sealed ahead and no way around: holds at the next boundary
  claim: string | null; // sector this pod won and will enter next tick
  claimTick: number;
}

/** Sector wiring derived from the data. Sector.from/to are route ends, so a sector only touches a city at the chain's ends. */
export interface Topo {
  start: Map<string, string | null>; // city where the sector begins, if any
  end: Map<string, string | null>;
  succ: Map<string, string | null>; // next sector in the same chain
  pred: Map<string, string | null>;
  startingAt: Map<string, string[]>; // city -> sector ids that begin there, sorted
  touching: Map<string, string[]>; // city -> sectors that begin or end there
  dist: Map<string, number>; // beacon hops from the sealed sector
}

export interface Sim {
  m: Mission;
  mode: Mode;
  tick: number;
  towerUp: boolean;
  sectors: Sector[];
  sec: Map<string, Sector>;
  pods: Pod[];
  rt: Map<string, Rt>;
  topo: Topo;
  log: LogEvent[];
  pulses: Pulse[];
  tokens: number; // tower grant bucket, in 1/60 grants
  grantsEver: number;
  entries: number; // sectors entered so far
  hist: number[]; // hist[t] = entries after tick t
  released: Map<string, number>; // sector -> tick it was last released (free from the next tick)
  flown: Set<string>; // pods that occupied a sector at or after tower-down
  yielded: Set<string>; // "pod|sector" yields already logged
  announced: Set<string>;
  score: Score;
}

function buildTopo(sectors: Sector[], sealId: string | null): Topo {
  const chains = new Map<string, Sector[]>();
  for (const s of sectors) (chains.get(s.routeId) ?? chains.set(s.routeId, []).get(s.routeId)!).push(s);
  const t: Topo = { start: new Map(), end: new Map(), succ: new Map(), pred: new Map(), startingAt: new Map(), touching: new Map(), dist: new Map() };
  const add = (m: Map<string, string[]>, k: string, v: string) => (m.get(k) ?? m.set(k, []).get(k)!).push(v);
  for (const ch of chains.values()) {
    ch.sort((a, b) => a.index - b.index);
    ch.forEach((s, i) => {
      const prev = ch[i - 1];
      const next = ch[i + 1];
      t.pred.set(s.id, prev?.id ?? null);
      t.succ.set(s.id, next?.id ?? null);
      // a chain's ends touch cities; so does a join where one sector's `to` is the next one's `from`
      t.start.set(s.id, !prev || prev.to === s.from ? s.from : null);
      t.end.set(s.id, !next || next.from === s.to ? s.to : null);
    });
  }
  for (const s of sectors) {
    const a = t.start.get(s.id);
    const b = t.end.get(s.id);
    if (a) {
      add(t.startingAt, a, s.id);
      add(t.touching, a, s.id);
    }
    if (b) add(t.touching, b, s.id);
  }
  for (const l of [...t.startingAt.values(), ...t.touching.values()]) l.sort();
  if (sealId) {
    // beacon graph: chain neighbours, plus every sector touching the same city
    const adj = (id: string): string[] => {
      const out = [t.pred.get(id), t.succ.get(id)].filter((x): x is string => !!x);
      for (const c of [t.start.get(id), t.end.get(id)]) if (c) out.push(...t.touching.get(c)!);
      return out.sort();
    };
    t.dist.set(sealId, 0);
    const q = [sealId];
    while (q.length) {
      const id = q.shift()!;
      for (const n of adj(id)) if (!t.dist.has(n)) (t.dist.set(n, t.dist.get(id)! + 1), q.push(n));
    }
  }
  return t;
}

export function makeSim(m: Mission, mode: Mode): Sim {
  const sectors = structuredClone(m.world.sectors);
  const pods = structuredClone(m.pods);
  const rt = new Map<string, Rt>();
  for (const p of pods) {
    if (p.priority === "medical") p.credentialOk = verify(p); // the engine derives credentialOk from the simulated signature
    rt.set(p.id, { granted: p.at >= 0, knows: false, stuck: false, claim: null, claimTick: -1 });
  }
  return {
    m, mode, tick: 0, towerUp: true, sectors, sec: new Map(sectors.map((s) => [s.id, s])), pods, rt,
    topo: buildTopo(sectors, mode === "normal" ? null : m.sealSectorId),
    log: [], pulses: [], tokens: 0, grantsEver: 0, entries: 0, hist: [], released: new Map(),
    flown: new Set(), yielded: new Set(), announced: new Set(),
    score: { nursesArrived: 0, nursesTotal: pods.filter((p) => p.nurse).length, suppliesDelivered: 0, suppliesTotal: pods.filter((p) => p.cargo).length, passengerDelayMin: 0, capacityPct: 100, realFlights: 0, towerClaimed: 0 },
  };
}

export function say(s: Sim, kind: LogEvent["kind"], text: string, podId?: string, sectorId?: string) {
  const e: LogEvent = { tick: s.tick, kind, text };
  if (podId) e.podId = podId;
  if (sectorId) e.sectorId = sectorId;
  s.log.push(e);
  if (s.log.length > 60) s.log.shift();
}

export const isOver = (s: Sim) => s.tick >= s.m.endTick;

// the normal-day run of the same mission, cached per mission object: capacity is measured against it
const refCache = new WeakMap<Mission, number[]>();
function reference(m: Mission): number[] {
  let h = refCache.get(m);
  if (!h) {
    const r = makeSim(m, "normal");
    while (!isOver(r)) stepSim(r);
    refCache.set(m, (h = r.hist));
  }
  return h;
}

function movement(s: Sim) {
  for (const p of s.pods) {
    if (p.status !== "moving") continue;
    const sec = s.sec.get(p.path[p.at])!;
    p.progress = Math.min(1, p.progress + 1 / sec.minutes);
    if (p.progress < 1 - 1e-9) continue;
    p.progress = 1;
    sec.holder = null;
    s.released.set(sec.id, s.tick);
    say(s, "release", `${p.label} leaves ${sec.id}`, p.id, sec.id);
    if (s.mode === "echo" && !s.towerUp) s.pulses.push({ sectorId: sec.id, kind: "release", age: 0 });
    if (p.at === p.path.length - 1) {
      p.status = "arrived";
      p.arriveTick = s.tick;
      say(s, "arrive", `${p.label} arrives`, p.id);
    } else if ((s.mode === "tower" && !s.towerUp) || s.rt.get(p.id)!.stuck) {
      p.status = "holding";
      say(s, "hold", `${p.label} holds at the boundary`, p.id);
    } else p.status = "waiting";
  }
  for (const p of s.pods) if (p.status === "waiting" || p.status === "holding") p.waitedMin++;
}

function score(s: Sim) {
  const sc = s.score;
  if (s.tick >= s.m.towerDownAt) for (const p of s.pods) if (p.status === "moving") s.flown.add(p.id);
  sc.nursesArrived = s.pods.filter((p) => p.nurse && p.status === "arrived").length;
  sc.suppliesDelivered = s.pods.filter((p) => p.cargo && p.status === "arrived").length;
  sc.passengerDelayMin = s.pods.filter((p) => p.priority === "passenger").reduce((a, p) => a + p.waitedMin, 0);
  sc.realFlights = s.flown.size;
  sc.towerClaimed = Math.round(s.grantsEver * s.m.towerInflation);
  s.hist[s.tick] = s.entries;
  if (s.mode === "normal") return void (sc.capacityPct = 100);
  const ref = reference(s.m);
  const t = Math.min(s.tick, ref.length - 1, lastChange(ref)); // compare up to the moment the normal day finished its work
  sc.capacityPct = ref[t] === 0 ? 100 : Math.min(100, Math.round((100 * (s.hist[t] ?? 0)) / ref[t]));
}
function lastChange(h: number[]): number {
  let i = h.length - 1;
  while (i > 0 && h[i] === h[i - 1]) i--;
  return i;
}

export function stepSim(s: Sim) {
  s.pulses = [];
  towerPhase(s);
  movement(s);
  if (s.mode === "echo") echoPhase(s);
  score(s);
  s.tick++;
}

export const createEngine: CreateEngine = (m, mode): EchoEngineApi => {
  const s = makeSim(m, mode);
  return {
    step(n = 1) {
      for (let i = 0; i < n && !isOver(s); i++) stepSim(s);
    },
    observe(): Observation {
      return structuredClone({
        contract: CONTRACT_VERSION,
        tick: s.tick,
        endTick: s.m.endTick,
        mode: s.mode,
        towerUp: s.towerUp,
        towerDownAt: s.m.towerDownAt,
        cities: s.m.world.cities,
        sectors: s.sectors,
        pods: s.pods,
        log: s.log,
        pulses: s.pulses,
        score: s.score,
        over: isOver(s),
      });
    },
    act(c: Command) {
      const p = s.pods.find((x) => x.id === (c as Command).podId);
      if (c.type !== "dispatchMedical" || !p) return { ok: false, reason: "unknown pod" };
      if (p.priority !== "medical") return { ok: false, reason: "not a medical pod" };
      if (p.status !== "scheduled") return { ok: false, reason: "already departed" };
      if (c.atTick < s.tick) return { ok: false, reason: "atTick is in the past" };
      p.departTick = c.atTick;
      return { ok: true };
    },
  };
};

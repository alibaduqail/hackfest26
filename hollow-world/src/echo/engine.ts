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
  knows: Set<number>; // indexes into Topo.seals this pod has heard (or seen)
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
  seals: SealNews[]; // every seal of the mission (none in normal mode), in list order
}

/** One seal and how far its news has to travel: beacon hops from the sealed sector, beaconed sectors only. */
export interface SealNews {
  at: number;
  sectorId: string;
  dist: Map<string, number>;
}

/** Every seal of a mission: sealAt/sealSectorId first, then Mission.seals. */
export const sealsOf = (m: Mission): { at: number; sectorId: string }[] => [
  ...(m.sealAt !== null && m.sealSectorId ? [{ at: m.sealAt, sectorId: m.sealSectorId }] : []),
  ...(m.seals ?? []),
];

export const hasBeacon = (s: Sector) => s.beacon !== false; // v2: missing = true

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
  blind: Map<string, number>; // "pod|sector" -> tick the pod started waiting blind at that unbeaconed sector
  beaconAt: Map<string, number>; // beaconed sector -> tick its beacon went live (-Infinity: from the start)
  pending: { atTick: number; sectorId: string }[]; // accepted placeBeacon commands not yet applied
  placed: number; // live placements applied so far
  score: Score;
}

/** Beacon graph: chain neighbours plus every sector touching the same city; an unbeaconed sector neither hears nor relays. */
function adjacent(t: Topo, on: Map<string, number>, id: string): string[] {
  const out = [t.pred.get(id), t.succ.get(id)].filter((x): x is string => !!x);
  for (const c of [t.start.get(id), t.end.get(id)]) if (c) out.push(...t.touching.get(c)!);
  return out.filter((n) => on.has(n)).sort();
}

/** News reach per seal: hops from the sealed sector, one per tick, through beaconed sectors. A beacon that went live at tick T
 * (`on`) can only relay from T on, so a sector hears at max(T, neighbour's tick + 1). With every beacon live from the start this is plain BFS. */
function refreshNews(t: Topo, on: Map<string, number>) {
  for (const n of t.seals) {
    // ponytail: news starts only from a beaconed sealed sector; an unbeaconed seal is learned by standing at it
    const dist = new Map<string, number>();
    const best = new Map<string, { t: number; seq: number }>();
    const open = new Set<string>();
    let seq = 0;
    const offer = (id: string, tick: number) => {
      const b = best.get(id);
      if (dist.has(id) || (b && b.t <= tick)) return;
      best.set(id, { t: tick, seq: b?.seq ?? seq++ });
      open.add(id);
    };
    if (on.has(n.sectorId)) offer(n.sectorId, Math.max(n.at, on.get(n.sectorId)!));
    while (open.size) {
      let id = "";
      for (const o of open) if (!id || best.get(o)!.t < best.get(id)!.t || (best.get(o)!.t === best.get(id)!.t && best.get(o)!.seq < best.get(id)!.seq)) id = o;
      open.delete(id);
      const tick = best.get(id)!.t;
      dist.set(id, tick - n.at);
      for (const nb of adjacent(t, on, id)) offer(nb, Math.max(on.get(nb)!, tick + 1));
    }
    n.dist = dist;
  }
}

function buildTopo(sectors: Sector[], seals: { at: number; sectorId: string }[]): Topo {
  const chains = new Map<string, Sector[]>();
  for (const s of sectors) (chains.get(s.routeId) ?? chains.set(s.routeId, []).get(s.routeId)!).push(s);
  const t: Topo = { start: new Map(), end: new Map(), succ: new Map(), pred: new Map(), startingAt: new Map(), touching: new Map(), seals: [] };
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
  for (const { at, sectorId } of seals) t.seals.push({ at, sectorId, dist: new Map() });
  refreshNews(t, new Map(sectors.filter(hasBeacon).map((s) => [s.id, -Infinity])));
  return t;
}

export function makeSim(m: Mission, mode: Mode): Sim {
  const sectors = structuredClone(m.world.sectors);
  const pods = structuredClone(m.pods);
  const rt = new Map<string, Rt>();
  for (const p of pods) {
    if (p.priority === "medical") p.credentialOk = verify(p); // the engine derives credentialOk from the simulated signature
    rt.set(p.id, { granted: p.at >= 0, knows: new Set(), stuck: false, claim: null, claimTick: -1 });
  }
  return {
    m, mode, tick: 0, towerUp: true, sectors, sec: new Map(sectors.map((s) => [s.id, s])), pods, rt,
    topo: buildTopo(sectors, mode === "normal" ? [] : sealsOf(m)),
    log: [], pulses: [], tokens: 0, grantsEver: 0, entries: 0, hist: [], released: new Map(),
    flown: new Set(), yielded: new Set(), announced: new Set(), blind: new Map(),
    beaconAt: new Map(sectors.filter(hasBeacon).map((x) => [x.id, -Infinity])), pending: [], placed: 0,
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
  // capacity: sector entries delivered so far vs the normal day, averaged over the busy period (up to the tick the normal day finished)
  const ref = reference(s.m);
  const t = Math.min(s.tick, lastChange(ref));
  const sum = (h: number[]) => h.slice(0, t + 1).reduce((a, b) => a + b, 0);
  const n = sum(ref);
  sc.capacityPct = n === 0 ? 100 : Math.min(100, Math.round((100 * sum(s.hist)) / n));
}
function lastChange(h: number[]): number {
  let i = h.length - 1;
  while (i > 0 && h[i] === h[i - 1]) i--;
  return i;
}

/** Live beacons due this tick go in first, in (atTick, sectorId) order, so the protocol below already hears them. */
function placeBeacons(s: Sim) {
  const due = s.pending.filter((c) => c.atTick <= s.tick).sort((a, b) => a.atTick - b.atTick || (a.sectorId < b.sectorId ? -1 : 1));
  if (!due.length) return;
  s.pending = s.pending.filter((c) => c.atTick > s.tick);
  for (const c of due) {
    const sec = s.sec.get(c.sectorId)!;
    if (hasBeacon(sec)) continue; // act() already refuses these; kept so the engine never double-counts
    sec.beacon = true;
    s.beaconAt.set(sec.id, s.tick);
    s.placed++;
    say(s, "beacon-placed", `Relay places a beacon at ${sec.id}`, undefined, sec.id);
  }
  refreshNews(s.topo, s.beaconAt); // news can hop through the new beacons from this tick on
}

export function stepSim(s: Sim) {
  s.pulses = [];
  placeBeacons(s);
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
      if (c.type === "placeBeacon") {
        const sec = s.sec.get(c.sectorId);
        if (s.mode !== "echo") return { ok: false, reason: "only echo mode has beacons" };
        if (!sec) return { ok: false, reason: "unknown sector" };
        if (c.atTick < s.tick) return { ok: false, reason: "atTick is in the past" };
        if (c.atTick >= s.m.endTick) return { ok: false, reason: "atTick is past the end of the run" };
        if (hasBeacon(sec) || s.pending.some((x) => x.sectorId === c.sectorId)) return { ok: false, reason: "sector already has a beacon" };
        // ponytail: the budget caps live placements (applied + queued); beacons already in the mission data are the free starting layout
        if (typeof s.m.beaconBudget === "number" && s.placed + s.pending.length >= s.m.beaconBudget) return { ok: false, reason: "no beacons left" };
        s.pending.push({ atTick: c.atTick, sectorId: c.sectorId });
        return { ok: true };
      }
      const p = s.pods.find((x) => x.id === (c as { podId?: string }).podId);
      if (c.type !== "dispatchMedical" || !p) return { ok: false, reason: "unknown pod" };
      if (p.priority !== "medical") return { ok: false, reason: "not a medical pod" };
      if (p.status !== "scheduled") return { ok: false, reason: "already departed" };
      if (c.atTick < s.tick) return { ok: false, reason: "atTick is in the past" };
      p.departTick = c.atTick;
      return { ok: true };
    },
  };
};

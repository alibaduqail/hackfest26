// 12 scripted Observation frames (echo mode) so the view lane can build without the engine.
// Story: tower up, 6 grants, tower down, hold, seal at minute 30, MED-1 hears it and reroutes via Sao Paulo,
// PAX-1 yields to her, MED-1 crosses and arrives. Frames are hand-placed, not simulated; numbers are illustrative.
import { CONTRACT_VERSION } from "./types";
import type { LogEvent, Observation, Pod, Pulse, Score } from "./types";
import { SEAL_SECTOR, towerDown } from "./missions";
import { findPath } from "./world";

type PodPatch = Partial<Pick<Pod, "at" | "progress" | "status" | "rerouted" | "waitedMin" | "arriveTick">> & { path?: string[] };
interface Frame {
  tick: number;
  patches?: Record<string, PodPatch>;
  log?: LogEvent[]; // events new in this frame; earlier ones accumulate
  pulses?: Pulse[];
  score?: Partial<Score>;
}

const REROUTE = findPath("s07", "lagos", new Set([SEAL_SECTOR]))!; // via Sao Paulo
const L = (tick: number, kind: LogEvent["kind"], text: string, podId?: string, sectorId?: string): LogEvent => ({ tick, kind, text, podId, sectorId });

const FRAMES: Frame[] = [
  { tick: 0 },
  { tick: 6, patches: { "MED-2": { at: 0, progress: 0.5, status: "moving" }, "SUP-1": { at: 0, progress: 0.2, status: "moving" } }, log: [L(2, "grant", "Tower grants MED-2", "MED-2"), L(5, "grant", "Tower grants SUP-1", "SUP-1")], score: { towerClaimed: 28 } },
  { tick: 19, patches: { "MED-2": { at: 2, progress: 0.3, status: "moving" }, "SUP-1": { at: 1, progress: 0.6, status: "moving" }, "MED-3": { at: 0, progress: 0.4, status: "moving" }, "MED-4": { at: 0, progress: 0.1, status: "moving" } }, log: [L(12, "grant", "Tower grants MED-3", "MED-3"), L(19, "grant", "Tower grants MED-4", "MED-4")], score: { towerClaimed: 84, realFlights: 0 } },
  { tick: 20, log: [L(20, "tower-down", "Directorate tower offline. Banner: 84 flights authorized")], score: { towerClaimed: 84 } },
  { tick: 24, patches: { "MED-2": { at: 2, progress: 1, status: "holding" }, "SUP-1": { at: 1, progress: 1, status: "holding" }, "MED-3": { at: 0, progress: 1, status: "holding" }, "MED-4": { at: 0, progress: 1, status: "holding" } }, log: [L(21, "hold", "MED-5 holds at boundary: no clearance", "MED-5")], pulses: [{ sectorId: "lon-lagos-f1", kind: "announce", age: 0 }], score: { realFlights: 6 } },
  { tick: 30, log: [L(30, "seal", "Directorate seals tunnel s07-lagos-f0", undefined, SEAL_SECTOR)], pulses: [{ sectorId: SEAL_SECTOR, kind: "seal", age: 0 }] },
  {
    tick: 32,
    patches: { "MED-1": { path: REROUTE, rerouted: true, status: "waiting", waitedMin: 1 } },
    log: [L(32, "seal-heard", "MED-1 hears the seal from a beacon", "MED-1", SEAL_SECTOR), L(32, "reroute", "MED-1 reroutes via São Paulo Deep", "MED-1")],
    pulses: [{ sectorId: "s07-sao-f0", kind: "seal", age: 1 }],
  },
  {
    tick: 33,
    patches: { "MED-1": { status: "waiting", waitedMin: 2 }, "PAX-1": { status: "waiting" } },
    log: [L(33, "announce", "MED-1 announces s07-sao-f0", "MED-1", "s07-sao-f0"), L(33, "announce", "PAX-1 announces s07-sao-f0", "PAX-1", "s07-sao-f0")],
    pulses: [{ sectorId: "s07-sao-f0", kind: "announce", age: 0 }],
  },
  {
    tick: 34,
    patches: { "MED-1": { at: 0, progress: 0.1, status: "moving" }, "PAX-1": { status: "waiting", waitedMin: 1 } },
    log: [L(34, "claim", "MED-1 claims s07-sao-f0", "MED-1", "s07-sao-f0"), L(34, "yield", "PAX-1 yields to MED-1", "PAX-1", "s07-sao-f0"), L(34, "enter", "MED-1 enters s07-sao-f0", "MED-1", "s07-sao-f0")],
  },
  {
    tick: 60,
    patches: {
      "MED-1": { at: 7, progress: 0.4, status: "moving" },
      "PAX-1": { at: 0, progress: 0.7, status: "moving", waitedMin: 3 },
      "MED-2": { at: 4, progress: 0.5, status: "moving" }, "MED-3": { at: 2, progress: 0.8, status: "moving" },
    },
    log: [L(45, "release", "MED-1 releases s07-sao-f5", "MED-1", "s07-sao-f5")],
    pulses: [{ sectorId: "sao-lagos-f1", kind: "release", age: 0 }],
    score: { realFlights: 14 },
  },
  { tick: 90, patches: { "MED-1": { at: REROUTE.length - 1, progress: 0.6, status: "moving" } }, score: { realFlights: 19, suppliesDelivered: 1 } },
  {
    tick: 120,
    patches: { "MED-1": { at: REROUTE.length - 1, progress: 1, status: "arrived", arriveTick: 118 }, "MED-2": { at: 7, status: "arrived", progress: 1, arriveTick: 101 }, "MED-3": { at: 7, status: "arrived", progress: 1, arriveTick: 109 } },
    log: [L(118, "arrive", "MED-1 arrives at Lagos Deep", "MED-1")],
    score: { nursesArrived: 3, suppliesDelivered: 2, passengerDelayMin: 140, capacityPct: 62, realFlights: 22 },
  },
];

const ZERO: Score = { nursesArrived: 0, nursesTotal: 8, suppliesDelivered: 0, suppliesTotal: 10, passengerDelayMin: 0, capacityPct: 100, realFlights: 0, towerClaimed: 0 };

function build(): Observation[] {
  const m = towerDown();
  const log: LogEvent[] = [];
  let score = ZERO;
  let patched: Record<string, PodPatch> = {};
  return FRAMES.map((f) => {
    log.push(...(f.log ?? []));
    score = { ...score, ...f.score };
    for (const [id, q] of Object.entries(f.patches ?? {})) patched[id] = { ...patched[id], ...q };
    const w = structuredClone(m.world);
    const pods: Pod[] = structuredClone(m.pods).map((p) => {
      const q = { ...p, ...patched[p.id] };
      if (!patched[p.id] && p.status === "scheduled" && p.departTick <= f.tick) q.status = "waiting";
      return q;
    });
    for (const p of pods) {
      const s = p.status === "moving" ? w.sectors.find((x) => x.id === p.path[p.at]) : undefined;
      if (s && !s.holder) s.holder = p.id;
    }
    const sealed = f.tick >= (m.sealAt ?? Infinity);
    if (sealed) w.sectors.find((s) => s.id === SEAL_SECTOR)!.sealed = true;
    return {
      contract: CONTRACT_VERSION,
      tick: f.tick,
      endTick: m.endTick,
      mode: "echo",
      towerUp: f.tick < m.towerDownAt,
      towerDownAt: m.towerDownAt,
      cities: w.cities,
      sectors: w.sectors,
      pods,
      log: log.slice(-60),
      pulses: f.pulses ?? [],
      score: { ...score },
      over: f.tick >= m.endTick,
    };
  });
}

export const mock: Observation[] = build();

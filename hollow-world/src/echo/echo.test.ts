// Echo acceptance tests, AC-1..AC-10, AC-13..AC-15 (docs/specs/echo/PLAN.md §4). Written before the engine.
// engine.ts / credential.ts / missions.ts are loaded lazily: until they land, the tests that need them are
// skipped (loudly, with a reason) so `npm test` and `tsc` stay green on main. Once they land, nothing to edit.
import test from "node:test";
import assert from "node:assert/strict";
import type { CreateEngine, Mission, Mode, Observation, LogEvent, Pod, Priority, Sector, World } from "./types";

async function load<T>(path: string): Promise<T | null> {
  try {
    return (await import(path)) as T;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    // only "this module is missing" counts as not-landed; anything else (syntax error, a missing nested import) must fail the run
    const missing = /Cannot find module '([^']+)'/.exec(err.message ?? "")?.[1] ?? "";
    if (err.code === "ERR_MODULE_NOT_FOUND" && /^(\.\/|.*[\\/])/.test(missing) && missing.replace(/\.(ts|js)$/, "").endsWith(path.replace("./", "/"))) return null;
    throw e;
  }
}
const engineMod = await load<{ createEngine: CreateEngine }>("./engine");
const credMod = await load<{ sign: (id: string) => string }>("./credential");
const missionsMod = await load<Record<string, unknown>>("./missions");
const createEngine = engineMod?.createEngine;
const sign = credMod?.sign ?? ((id: string) => `unsigned-${id}`); // only used to build medical pods
const ready = !!createEngine && !!credMod;
const t = (name: string, fn: () => void | Promise<void>) =>
  test(name, { skip: ready ? false : "engine.ts / credential.ts not landed yet" }, fn);

// ---------- tiny worlds, independent of world.ts / missions.ts ----------
type SecDef = { id: string; from: string; to: string; minutes: number };
function mkWorld(defs: SecDef[]): World {
  const names = [...new Set(defs.flatMap((d) => [d.from, d.to]))];
  const pos = (c: string): [number, number] => [(names.indexOf(c) + 1) / (names.length + 1), 0.5];
  return {
    cities: names.map((id) => ({ id, name: id, above: id, x: pos(id)[0], y: 0.5 })),
    sectors: defs.map((d, i): Sector => ({
      id: d.id, routeId: d.id.replace(/\d+$/, ""), index: i, from: d.from, to: d.to,
      a: pos(d.from), b: pos(d.to), minutes: d.minutes, holder: null, sealed: false,
    })),
  };
}
function mkPods(world: World) {
  const byId = new Map(world.sectors.map((s) => [s.id, s]));
  return (id: string, priority: Priority, path: string[], o: Partial<Pod> = {}): Pod => ({
    id, label: id.toUpperCase(), priority,
    sig: priority === "medical" ? sign(id) : undefined,
    credentialOk: true,
    origin: byId.get(path[0])!.from, dest: byId.get(path[path.length - 1])!.to,
    path, at: -1, progress: 0, status: "scheduled", rerouted: false, waitedMin: 0,
    departTick: 0, arriveTick: null, ...(priority === "medical" ? { nurse: true } : {}), ...o,
  });
}
function mkMission(world: World, pods: Pod[], o: Partial<Mission> = {}): Mission {
  return {
    id: "tower-down", title: "test", seed: 1, world, endTick: 120, towerDownAt: 1,
    towerRatePerHour: 60, towerInflation: 14, sealAt: null, sealSectorId: null, pods, ...o,
  };
}

// straight chain C0 -s0-> C1 -s1-> C2 -s2-> C3 -s3-> C4, everyone contends for s0
const CHAIN = mkWorld([0, 1, 2, 3].map((i) => ({ id: `s${i}`, from: `C${i}`, to: `C${i + 1}`, minutes: 3 })));
const chainPath = ["s0", "s1", "s2", "s3"];
function chainMission(o: Partial<Mission> = {}, podOverrides?: Pod[]): Mission {
  const p = mkPods(CHAIN);
  const pods = podOverrides ?? [
    p("med1", "medical", chainPath, { departTick: 0 }),
    p("sup1", "supply", chainPath, { departTick: 0, cargo: "water" }),
    p("sup2", "supply", chainPath, { departTick: 3, cargo: "food" }),
    p("pax1", "passenger", chainPath, { departTick: 1 }),
    p("pax2", "passenger", chainPath, { departTick: 2 }),
    p("pax3", "passenger", chainPath, { departTick: 8 }),
    p("pax4", "passenger", chainPath, { departTick: 15 }),
  ];
  return mkMission(CHAIN, pods, { towerDownAt: 20, endTick: 200, ...o });
}

// ---------- helpers ----------
const clone = <T>(x: T): T => structuredClone(x);
interface Run { obs: Observation[]; events: LogEvent[]; final: Observation }
/** Steps one tick at a time to endTick (or `until`). obs[0] is tick 0. events = every log line ever, in order. */
function run(m: Mission, mode: Mode, opts: { until?: number; before?: (tick: number, e: ReturnType<CreateEngine>) => void } = {}): Run {
  const e = createEngine!(m, mode);
  const obs: Observation[] = [clone(e.observe())];
  const events: LogEvent[] = [];
  let prevLog: LogEvent[] = obs[0].log;
  events.push(...prevLog);
  const stop = opts.until ?? m.endTick;
  while (e.observe().tick < stop && !e.observe().over) {
    opts.before?.(e.observe().tick, e);
    e.step(1);
    const o = clone(e.observe());
    obs.push(o);
    // log is a sliding window (max 60): take only what's new
    let k = Math.min(prevLog.length, o.log.length);
    while (k > 0 && JSON.stringify(prevLog.slice(prevLog.length - k)) !== JSON.stringify(o.log.slice(0, k))) k--;
    events.push(...o.log.slice(k));
    prevLog = o.log;
  }
  return { obs, events, final: obs[obs.length - 1] };
}
const kinds = (r: Run, kind: LogEvent["kind"], filter: Partial<LogEvent> = {}) =>
  r.events.filter((x) => x.kind === kind && Object.entries(filter).every(([k, v]) => (x as unknown as Record<string, unknown>)[k] === v));
const noMode = (o: Observation) => ({ ...o, mode: "x" as Mode });

/** AC-5 invariant on one observation. */
function assertExclusive(o: Observation, where: string) {
  const holders = o.sectors.filter((s) => s.holder !== null).map((s) => s.holder!);
  assert.equal(new Set(holders).size, holders.length, `a pod holds two sectors ${where}`);
  for (const s of o.sectors) {
    if (s.holder === null) continue;
    const pod = o.pods.find((x) => x.id === s.holder);
    assert.ok(pod, `sector ${s.id} held by unknown pod ${s.holder} ${where}`);
    assert.equal(pod!.path[pod!.at], s.id, `holder ${pod!.id} of ${s.id} is not inside it ${where}`);
  }
  const moving = new Map<string, string>();
  for (const p of o.pods) {
    if (p.status !== "moving") continue;
    const sid = p.path[p.at];
    assert.ok(!moving.has(sid), `${p.id} and ${moving.get(sid)} both moving in ${sid} ${where}`);
    moving.set(sid, p.id);
  }
}

// ======================= AC-1 =======================
t("AC-1 deterministic: two runs deep-equal, mission is not mutated", () => {
  for (const mode of ["tower", "echo", "normal"] as Mode[]) {
    const m = chainMission({ sealAt: 30, sealSectorId: "s2" });
    const before = clone(m);
    const a = run(m, mode);
    const b = run(m, mode);
    assert.deepEqual(a.obs, b.obs, `mode ${mode}`);
    assert.deepEqual(m, before, "engine mutated the mission");
  }
});

// ======================= AC-2 =======================
t("AC-2 echo == tower before down", () => {
  const m = chainMission({ sealAt: 30, sealSectorId: "s2" });
  const tw = run(m, "tower", { until: m.towerDownAt });
  const ec = run(m, "echo", { until: m.towerDownAt });
  assert.equal(tw.obs.length, ec.obs.length);
  assert.ok(tw.obs.length > 5);
  tw.obs.forEach((o, i) => assert.deepEqual(noMode(o), noMode(ec.obs[i]), `tick ${o.tick}`));
});

// ======================= AC-3 =======================
t("AC-3 failed tower grants nothing; pods hold at the next boundary", () => {
  const m = chainMission();
  const r = run(m, "tower");
  const down = kinds(r, "tower-down");
  assert.equal(down.length, 1);
  const downIdx = r.events.indexOf(down[0]);
  const grantsAfter = r.events.slice(downIdx).filter((x) => x.kind === "grant");
  assert.equal(grantsAfter.length, 0, "grant after tower-down");
  assert.ok(kinds(r, "grant").length > 0, "scenario should grant before down");
  // nothing is moving once every in-flight pod has finished its sector (minutes = 3)
  const settled = r.obs.filter((o) => o.tick >= m.towerDownAt + 4);
  assert.ok(settled.length > 10);
  for (const o of settled) {
    assert.ok(!o.towerUp);
    assert.deepEqual(o.pods.filter((p) => p.status === "moving").map((p) => p.id), [], `tick ${o.tick}`);
  }
  // every stuck pod that had started is "holding"; each one logged "hold" exactly once
  const holding = r.final.pods.filter((p) => p.status === "holding");
  for (const p of holding) assert.equal(kinds(r, "hold", { podId: p.id }).length, 1, `hold log for ${p.id}`);
});

// ======================= AC-4 =======================
t("AC-4 tower lies, log tells truth", () => {
  const m = chainMission();
  const r = run(m, "tower");
  const grants = kinds(r, "grant").length;
  assert.ok(grants > 0);
  assert.equal(r.final.score.towerClaimed, Math.round(grants * m.towerInflation));
  assert.ok(r.final.score.realFlights > 0);
  assert.ok(r.final.score.realFlights < r.final.score.towerClaimed, "banner should overstate");
  assert.ok(r.final.score.realFlights <= grants);
  // the claim never goes up after the tower is down
  const afterDown = r.obs.filter((o) => !o.towerUp).map((o) => o.score.towerClaimed);
  assert.ok(afterDown.every((c) => c === afterDown[0]));
});

// ======================= AC-5 =======================
t("AC-5 sector exclusivity invariant, every tick, every mode", () => {
  for (const mode of ["tower", "echo", "normal"] as Mode[]) {
    const r = run(chainMission({ sealAt: 40, sealSectorId: "s3" }), mode);
    r.obs.forEach((o) => assertExclusive(o, `(${mode}, tick ${o.tick})`));
  }
});

// ======================= AC-6 =======================
// all pods depart after tower-down (towerDownAt=1, departTick>=2), so the protocol decides who goes first
const enterOrder = (r: Run, sector: string) => kinds(r, "enter", { sectorId: sector }).map((x) => x.podId);
t("AC-6 priority and yield log: medical > supply > passenger", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 3 }]);
  const p = mkPods(w);
  const m = mkMission(w, [
    p("pax", "passenger", ["a0"], { departTick: 2 }),
    p("sup", "supply", ["a0"], { departTick: 2, cargo: "food" }),
    p("med", "medical", ["a0"], { departTick: 2 }),
  ]);
  const r = run(m, "echo");
  assert.deepEqual(enterOrder(r, "a0"), ["med", "sup", "pax"]);
  assert.equal(kinds(r, "yield", { podId: "med" }).length, 0);
  assert.equal(kinds(r, "yield", { podId: "sup", sectorId: "a0" }).length, 1, "supply yields once");
  assert.equal(kinds(r, "yield", { podId: "pax", sectorId: "a0" }).length, 1, "passenger yields once, not per tick");
});
t("AC-6 priority and yield log: longer waited wins, then lower id", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 6 }]);
  const p = mkPods(w);
  // blocker holds a0 while both contenders wait; early has waited longer
  const m = mkMission(w, [
    p("blocker", "medical", ["a0"], { departTick: 2 }),
    p("early", "passenger", ["a0"], { departTick: 3 }),
    p("late", "passenger", ["a0"], { departTick: 5 }),
  ]);
  assert.deepEqual(enterOrder(run(m, "echo"), "a0"), ["blocker", "early", "late"]);
  // same wait, same priority: lower id first (b registered before a on purpose)
  const m2 = mkMission(w, [
    p("blocker", "medical", ["a0"], { departTick: 2 }),
    p("pb", "passenger", ["a0"], { departTick: 3 }),
    p("pa", "passenger", ["a0"], { departTick: 3 }),
  ]);
  assert.deepEqual(enterOrder(run(m2, "echo"), "a0"), ["blocker", "pa", "pb"]);
});

// ======================= AC-7 =======================
t("AC-7 no preemption: medical waits for an occupied sector", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 8 }]);
  const p = mkPods(w);
  const m = mkMission(w, [
    p("pax", "passenger", ["a0"], { departTick: 2 }),
    p("med", "medical", ["a0"], { departTick: 5 }),
  ]);
  const r = run(m, "echo");
  assert.deepEqual(enterOrder(r, "a0"), ["pax", "med"]);
  const paxEnter = r.events.indexOf(kinds(r, "enter", { podId: "pax" })[0]);
  const paxRelease = r.events.indexOf(kinds(r, "release", { podId: "pax" })[0]);
  const medEnter = r.events.indexOf(kinds(r, "enter", { podId: "med" })[0]);
  assert.ok(paxEnter < paxRelease && paxRelease < medEnter, "medical entered before the passenger released");
  for (const o of r.obs) {
    const pax = o.pods.find((x) => x.id === "pax")!;
    if (pax.status === "moving") assert.equal(o.sectors[0].holder, "pax", `tick ${o.tick}: holder changed mid-sector`);
  }
});

// ======================= AC-8 =======================
t("AC-8 credential reject: forged medical competes as a passenger", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 6 }]);
  const p = mkPods(w);
  const m = mkMission(w, [
    p("blocker", "supply", ["a0"], { departTick: 2, cargo: "water" }),
    p("pax", "passenger", ["a0"], { departTick: 3 }),
    p("forged", "medical", ["a0"], { departTick: 5, sig: "forged", credentialOk: false }),
    p("good", "medical", ["a0"], { departTick: 6 }),
  ]);
  const r = run(m, "echo");
  // good medical jumps the queue; forged medical queues behind the passenger who waited longer
  assert.deepEqual(enterOrder(r, "a0"), ["blocker", "good", "pax", "forged"]);
  assert.ok(kinds(r, "credential-reject", { podId: "forged" }).length >= 1);
  assert.equal(kinds(r, "credential-reject", { podId: "good" }).length, 0);
});

// ======================= AC-9 =======================
function findTowerDown(): Mission | null {
  const fn = missionsMod?.towerDown;
  return typeof fn === "function" ? (fn as () => Mission)() : null;
}
test("AC-9 tower-down shape: echo beats failed tower, capacity below a normal day",
  { skip: ready && findTowerDown() ? false : "engine / missions.ts not landed yet" }, () => {
  const m = findTowerDown()!;
  const tw = run(m, "tower").final.score;
  const ec = run(m, "echo").final.score;
  const nm = run(m, "normal").final.score;
  assert.ok(ec.nursesArrived > tw.nursesArrived, `nurses echo ${ec.nursesArrived} vs tower ${tw.nursesArrived}`);
  assert.ok(ec.suppliesDelivered > tw.suppliesDelivered, `supplies echo ${ec.suppliesDelivered} vs tower ${tw.suppliesDelivered}`);
  assert.equal(nm.nursesArrived, nm.nursesTotal);
  assert.equal(nm.suppliesDelivered, nm.suppliesTotal);
  assert.equal(nm.capacityPct, 100);
  assert.ok(ec.capacityPct < 100 && ec.capacityPct > 0, `echo capacity ${ec.capacityPct}`);
  assert.ok(ec.passengerDelayMin > nm.passengerDelayMin, "echo should cost passengers time");
});

// ======================= AC-10 =======================
t("AC-10 no deadlock: heavy contention drains to arrival", () => {
  const p = mkPods(CHAIN);
  const pods: Pod[] = [];
  for (let i = 0; i < 14; i++) {
    const pr: Priority = i % 5 === 0 ? "medical" : i % 2 ? "supply" : "passenger";
    pods.push(p(`p${String(i).padStart(2, "0")}`, pr, chainPath, { departTick: 2 + (i % 4), ...(pr === "supply" ? { cargo: "food" as const } : {}) }));
  }
  const r = run(chainMission({ towerDownAt: 1, endTick: 400 }, pods), "echo");
  const stuck = r.final.pods.filter((x) => x.status !== "arrived").map((x) => x.id);
  assert.deepEqual(stuck, [], "pods never arrived");
});
test("AC-10 no deadlock: no pod waits on a free, unsealed sector for 3 ticks (real mission)",
  { skip: ready && findTowerDown() ? false : "engine / missions.ts not landed yet" }, () => {
  const m = findTowerDown()!;
  const r = run(m, "echo");
  assert.ok(r.final.over, "mission did not reach endTick");
  const streak = new Map<string, number>();
  for (const o of r.obs) {
    for (const pod of o.pods) {
      const next = pod.status === "waiting" ? o.sectors.find((s) => s.id === pod.path[pod.at + 1]) : undefined;
      // while the tower is up, waiting for a grant is normal; the protocol only has to drain once it is down
      const stuck = !o.towerUp && next && next.holder === null && !next.sealed;
      streak.set(pod.id, stuck ? (streak.get(pod.id) ?? 0) + 1 : 0);
      assert.ok((streak.get(pod.id) ?? 0) < 3, `${pod.id} stuck waiting for free ${next?.id} at tick ${o.tick}`);
    }
  }
});

// ======================= AC-13 =======================
t("AC-13 act applies at atTick, same tick on every engine", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 3 }, { id: "a1", from: "B", to: "C", minutes: 3 }]);
  const p = mkPods(w);
  const m = mkMission(w, [p("nurse", "medical", ["a0", "a1"], { departTick: 9999 })], { towerDownAt: 60, endTick: 120 });
  const engines = (["tower", "echo"] as Mode[]).map((mode) => createEngine!(m, mode));
  for (const e of engines) assert.deepEqual(e.act({ type: "dispatchMedical", podId: "nurse", atTick: 10 }), { ok: true });
  assert.equal(engines[0].act({ type: "dispatchMedical", podId: "nobody", atTick: 10 }).ok, false);
  for (let tick = 0; tick < 30; tick++) {
    const [a, b] = engines.map((e) => e.observe().pods[0]);
    assert.equal(a.status === "scheduled", tick <= 10, `tower tick ${tick}: ${a.status}`);
    assert.equal(a.status, b.status, `engines out of lockstep at tick ${tick}`);
    engines.forEach((e) => e.step(1));
  }
  assert.equal(engines[0].observe().pods[0].arriveTick !== null, true, "dispatched nurse never arrived");
  assert.equal(engines[0].observe().pods[0].arriveTick, engines[1].observe().pods[0].arriveTick);
});

// ======================= AC-14 =======================
// diamond: O -d0-> M -d1-> D is the direct route; M -r0-> R -r1-> D is the way around
const DIAMOND = (withAlt: boolean) =>
  mkWorld([
    { id: "d0", from: "O", to: "M", minutes: 10 },
    { id: "d1", from: "M", to: "D", minutes: 4 },
    ...(withAlt ? [{ id: "r0", from: "M", to: "R", minutes: 4 }, { id: "r1", from: "R", to: "D", minutes: 4 }] : []),
  ]);
const diamondMission = (withAlt: boolean) => {
  const w = DIAMOND(withAlt);
  const p = mkPods(w);
  return mkMission(w, [p("med", "medical", ["d0", "d1"], { departTick: 2 })], { towerDownAt: 1, endTick: 150, sealAt: 8, sealSectorId: "d1" });
};
t("AC-14 seal reroute: pod hears of a seal ahead and goes around", () => {
  const r = run(diamondMission(true), "echo");
  const sealTick = kinds(r, "seal")[0].tick;
  const heard = kinds(r, "seal-heard", { podId: "med" })[0];
  const reroute = kinds(r, "reroute", { podId: "med" })[0];
  assert.ok(heard && reroute, "no seal-heard / reroute logged");
  assert.ok(r.events.indexOf(heard) < r.events.indexOf(reroute));
  assert.ok(heard.tick > sealTick, "heard before the news could travel");
  const med = r.final.pods[0];
  assert.deepEqual(med.path, ["d0", "r0", "r1"]);
  assert.equal(med.rerouted, true);
  assert.equal(med.status, "arrived");
  for (const o of r.obs) if (o.tick > sealTick) assert.ok(!o.sectors.find((s) => s.id === "d1")!.holder, `entered sealed d1 at ${o.tick}`);
});
t("AC-14 seal hold: no way around means holding, never entering", () => {
  const r = run(diamondMission(false), "echo");
  const med = r.final.pods[0];
  assert.equal(med.status, "holding");
  assert.equal(med.arriveTick, null);
  assert.equal(kinds(r, "reroute", { podId: "med" }).length, 0);
  assert.ok(kinds(r, "hold", { podId: "med" }).length >= 1);
  assert.equal(kinds(r, "enter", { sectorId: "d1" }).length, 0, "entered a sealed sector");
});
t("AC-14 seal applies in tower mode too: nobody enters a sealed sector", () => {
  const r = run(diamondMission(true), "tower");
  assert.equal(kinds(r, "enter", { sectorId: "d1" }).length, 0);
});

// ======================= AC-15 =======================
t("AC-15 news latency: one beacon hop per tick, pods hear in distance order", () => {
  // slow chain so pods barely move: seal s5, pod A sits in s4 (1 hop away), pod B in s2 (3 hops away)
  const w = mkWorld([0, 1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, from: `C${i}`, to: `C${i + 1}`, minutes: 300 })));
  const p = mkPods(w);
  const m = mkMission(w, [
    p("A", "passenger", ["s4", "s5"], { departTick: 2 }),
    p("B", "passenger", ["s2", "s3", "s4", "s5"], { departTick: 2 }),
  ], { towerDownAt: 1, endTick: 80, sealAt: 30, sealSectorId: "s5" });
  const r = run(m, "echo");
  const seal = kinds(r, "seal")[0];
  const hearA = kinds(r, "seal-heard", { podId: "A" })[0];
  const hearB = kinds(r, "seal-heard", { podId: "B" })[0];
  assert.ok(seal && hearA && hearB, "missing seal / seal-heard");
  assert.ok(hearA.tick - seal.tick >= 1, "A heard in the same tick as the seal");
  assert.ok(hearB.tick - seal.tick >= 3, "B heard faster than one hop per tick");
  assert.equal(hearB.tick - hearA.tick, 2, "B is two hops further than A");
  // no pulse before the seal, pulses present after
  assert.ok(r.obs.filter((o) => o.tick <= seal.tick - 1).every((o) => !o.pulses.some((x) => x.kind === "seal")));
  assert.ok(r.obs.some((o) => o.pulses.some((x) => x.kind === "seal")));
});

// ======================= v2: beacons, blind wait, multiple seals, ghosts, missions =======================
const unbeacon = (m: Mission, ...ids: string[]) => {
  for (const s of m.world.sectors) if (ids.includes(s.id)) s.beacon = false;
  return m;
};
t("v2 beacons: seal news does not cross an unbeaconed sector", () => {
  // AC-15's slow chain with s3 dark: A (in s4) still hears, B (in s2) is cut off behind s3
  const w = mkWorld([0, 1, 2, 3, 4, 5].map((i) => ({ id: `s${i}`, from: `C${i}`, to: `C${i + 1}`, minutes: 300 })));
  const p = mkPods(w);
  const m = unbeacon(mkMission(w, [
    p("A", "passenger", ["s4", "s5"], { departTick: 2 }),
    p("B", "passenger", ["s2", "s3", "s4", "s5"], { departTick: 2 }),
  ], { towerDownAt: 1, endTick: 80, sealAt: 30, sealSectorId: "s5" }), "s3");
  const r = run(m, "echo");
  assert.equal(kinds(r, "seal-heard", { podId: "A" }).length, 1, "A should hear");
  assert.equal(kinds(r, "seal-heard", { podId: "B" }).length, 0, "news crossed the dead sector s3");
  const pulsed = new Set(r.obs.flatMap((o) => o.pulses.filter((x) => x.kind === "seal").map((x) => x.sectorId)));
  assert.ok(!pulsed.has("s3") && !pulsed.has("s2"), `seal pulse beyond the dead zone: ${[...pulsed]}`);
});
t("v2 beacons: an unbeaconed seal is still seen at its boundary", () => {
  const m = unbeacon(diamondMission(true), "d1");
  const r = run(m, "echo");
  const release = kinds(r, "release", { podId: "med", sectorId: "d0" })[0];
  const heard = kinds(r, "seal-heard", { podId: "med" })[0];
  assert.ok(release && heard, "missing release / seal-heard");
  assert.equal(heard.tick, release.tick, "should learn only on reaching the sealed boundary");
  assert.deepEqual(r.final.pods[0].path, ["d0", "r0", "r1"]);
  assert.equal(r.final.pods[0].status, "arrived");
});
t("v2 beacons: a pod at a city after a dark sector hears news from the city's other beaconed sectors", () => {
  // reviewer case: O -a0(dark)-> M, then M -b0-> N -b1-> D or M -c0-> D. b1 is sealed while the pod is inside a0.
  // At M the pod must hear via b0/c0 and take c0; deaf at M it would enter b0, hear too late and hold forever at N.
  const w = mkWorld([
    { id: "a0", from: "O", to: "M", minutes: 10 },
    { id: "b0", from: "M", to: "N", minutes: 4 },
    { id: "b1", from: "N", to: "D", minutes: 4 },
    { id: "c0", from: "M", to: "D", minutes: 6 },
  ]);
  const p = mkPods(w);
  const m = unbeacon(mkMission(w, [p("med", "medical", ["a0", "b0", "b1"], { departTick: 2 })], { towerDownAt: 1, endTick: 80, sealAt: 6, sealSectorId: "b1" }), "a0");
  const r = run(m, "echo");
  const release = kinds(r, "release", { podId: "med", sectorId: "a0" })[0];
  const heard = kinds(r, "seal-heard", { podId: "med" })[0];
  assert.ok(release && heard, "missing release / seal-heard");
  assert.equal(heard.tick, release.tick, "should hear at M, the tick it comes out of the dark sector");
  assert.equal(kinds(r, "enter", { podId: "med", sectorId: "b0" }).length, 0, "entered b0 deaf");
  assert.deepEqual(r.final.pods[0].path, ["a0", "c0"]);
  assert.equal(r.final.pods[0].status, "arrived");
});
t("v2 blind wait: logs 'blind' once and enters 3 ticks later than with a beacon", () => {
  const mk = () => {
    const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 6 }]);
    const p = mkPods(w);
    return mkMission(w, [p("x", "passenger", ["a0"], { departTick: 2 }), p("y", "passenger", ["a0"], { departTick: 2 })]);
  };
  const lit = run(mk(), "echo");
  const dark = run(unbeacon(mk(), "a0"), "echo");
  for (const id of ["x", "y"]) {
    const a = kinds(lit, "enter", { podId: id })[0].tick;
    const b = kinds(dark, "enter", { podId: id })[0].tick;
    assert.equal(kinds(dark, "blind", { podId: id, sectorId: "a0" }).length, 1, `${id}: blind logged once`);
    assert.equal(kinds(lit, "blind").length, 0);
    if (id === "x") assert.equal(b - a, 3, "first entry is 3 ticks late");
    else assert.ok(b >= a + 3, "second pod is not faster in the dark");
  }
  const announcePulses = (r: Run) => r.obs.flatMap((o) => o.pulses.filter((x) => x.kind === "announce"));
  assert.ok(announcePulses(lit).length > 0, "lit sector should pulse on announce");
  assert.deepEqual(announcePulses(dark), [], "a dark sector has no radio to pulse");
  // the tower ignores beacons: a normal day is identical either way
  const strip = (r: Run) => r.events;
  assert.deepEqual(strip(run(unbeacon(mk(), "a0"), "normal")), strip(run(mk(), "normal")));
});
t("v2 multiple seals: both seal and the pod reroutes around each", () => {
  // O -d0-> M, then M -d1-> D (direct), M -r0-> R -r1-> D, or M -q0-> Q -q1-> X -q2-> D (longest)
  const w = mkWorld([
    { id: "d0", from: "O", to: "M", minutes: 10 },
    { id: "d1", from: "M", to: "D", minutes: 4 },
    { id: "r0", from: "M", to: "R", minutes: 4 },
    { id: "r1", from: "R", to: "D", minutes: 4 },
    { id: "q0", from: "M", to: "Q", minutes: 4 },
    { id: "q1", from: "Q", to: "X", minutes: 4 },
    { id: "q2", from: "X", to: "D", minutes: 4 },
  ]);
  const p = mkPods(w);
  const m = mkMission(w, [p("med", "medical", ["d0", "d1"], { departTick: 2 })], {
    towerDownAt: 1, endTick: 150, sealAt: 5, sealSectorId: "d1", seals: [{ at: 8, sectorId: "r0" }],
  });
  const r = run(m, "echo");
  assert.deepEqual(kinds(r, "seal").map((x) => x.sectorId), ["d1", "r0"]);
  assert.deepEqual(kinds(r, "seal-heard", { podId: "med" }).map((x) => x.sectorId), ["d1", "r0"]);
  assert.equal(kinds(r, "reroute", { podId: "med" }).length, 2);
  const med = r.final.pods[0];
  assert.deepEqual(med.path, ["d0", "q0", "q1", "q2"]);
  assert.equal(med.status, "arrived");
  assert.equal(kinds(r, "enter", { sectorId: "d1" }).length + kinds(r, "enter", { sectorId: "r0" }).length, 0, "entered a sealed sector");
  assert.deepEqual(run(m, "echo").obs, r.obs, "multi-seal run is not deterministic");
});
t("v2 ghost pod: forged medical ghost ranks as passenger and is rejected", () => {
  const w = mkWorld([{ id: "a0", from: "A", to: "B", minutes: 6 }]);
  const p = mkPods(w);
  const m = mkMission(w, [
    p("blocker", "supply", ["a0"], { departTick: 2, cargo: "water" }),
    p("pax", "passenger", ["a0"], { departTick: 3 }),
    p("ghost", "medical", ["a0"], { departTick: 5, ghost: true, nurse: false, sig: "forged", credentialOk: true }), // engine re-derives credentialOk
  ]);
  const r = run(m, "echo");
  assert.deepEqual(enterOrder(r, "a0"), ["blocker", "pax", "ghost"]);
  assert.ok(kinds(r, "credential-reject", { podId: "ghost" }).length >= 1);
  assert.equal(r.final.pods.find((x) => x.id === "ghost")!.credentialOk, false);
});

type MissionsMod = { MISSIONS: { id: string; build: () => Mission }[]; validateMission: (m: Mission) => string[] };
const mm = missionsMod as unknown as MissionsMod | null;
const tm = (name: string, fn: () => void) => test(name, { skip: ready && mm?.MISSIONS ? false : "missions.ts MISSIONS not landed yet" }, fn);
tm("v2 missions: every campaign mission validates, in campaign order", () => {
  assert.deepEqual(mm!.MISSIONS.map((x) => x.id), ["tower-down", "dead-zones", "grounding", "ghost-flight"]);
  for (const { id, build } of mm!.MISSIONS) {
    const m = build();
    assert.equal(m.id, id);
    assert.deepEqual(mm!.validateMission(m), [], id);
  }
  const dz = mm!.MISSIONS[1].build();
  assert.equal(dz.beaconBudget, 40);
  assert.ok(dz.world.sectors.every((s) => s.beacon === false), "dead zones should start with no beacons");
  const ghost = run(mm!.MISSIONS[3].build(), "echo");
  assert.ok(kinds(ghost, "credential-reject", { podId: "GHOST-1" }).length >= 1, "ghost not rejected");
  assert.ok(ghost.final.pods.find((x) => x.id === "MED-1")!.arriveTick !== null, "Mara did not arrive in Ghost Flight");
});
tm("v2 grounding: deterministic, three seals, second wave", () => {
  const m = mm!.MISSIONS[2].build();
  const before = clone(m);
  assert.equal(m.endTick, 1440);
  const wave = m.pods.filter((p) => p.departTick >= 200);
  assert.ok(wave.length >= 20 && wave.every((p) => p.departTick <= 700), "second wave t200..t700");
  assert.ok(wave.filter((p) => p.nurse && p.dest === "lagos").length >= 4);
  assert.ok(wave.filter((p) => p.cargo).length >= 4);
  const [a, b] = [createEngine!(m, "echo"), createEngine!(m, "echo")];
  for (let tick = 0; tick < m.endTick; tick += 60) {
    a.step(60);
    b.step(60);
    assert.deepEqual(a.observe(), b.observe(), `diverged by tick ${tick + 60}`);
  }
  assert.ok(a.observe().over);
  assert.deepEqual(m, before, "engine mutated the mission");
  const tw = createEngine!(m, "tower");
  tw.step(m.endTick);
  assert.equal(tw.observe().sectors.filter((s) => s.sealed).length, 3, "three seals in tower mode");
});

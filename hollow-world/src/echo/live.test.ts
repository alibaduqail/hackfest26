// Live play: placeBeacon commands, the beacon-derived structures they rebuild, and The Descent (live) star goals.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DESCENT_LIVE_GOALS, DESCENT_LIVE_SOLUTION, descent, descentLive, descentLiveStars } from "./descent";
import { validateMission } from "./missions";
import type { Command, LogEvent, Mission, Mode, Observation } from "./types";

const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });

/** Runs to the end, applying `cmds` up front (stable order is the engine's job). Checks sector exclusivity every tick. */
function run(cmds: Command[], o: { mode?: Mode; mission?: Mission; onTick?: (o: Observation) => void } = {}) {
  const e = createEngine(o.mission ?? descentLive(), o.mode ?? "echo");
  const acts = cmds.map((c) => e.act(c));
  const log: LogEvent[] = [];
  const seen = new Set<string>();
  let obs: Observation;
  do {
    e.step();
    obs = e.observe();
    const held = obs.pods.filter((p) => p.status === "moving").map((p) => p.path[p.at]);
    assert.equal(new Set(held).size, held.length, `two pods share a sector at t${obs.tick}`);
    for (const l of obs.log) if (!seen.has(JSON.stringify(l))) (seen.add(JSON.stringify(l)), log.push(l));
    o.onTick?.(obs);
  } while (!obs.over);
  return { log, obs, acts, engine: e };
}
const arrive = (obs: Observation, id: string) => obs.pods.find((p) => p.id === id)!.arriveTick;
const placed = (log: LogEvent[]) => log.filter((l) => l.kind === "beacon-placed");
const firstTick = (log: LogEvent[], f: (l: LogEvent) => boolean) => log.find(f)?.tick;

test("placeBeacon: same mission and commands give an identical log, whatever order they were issued in", () => {
  const a = run(DESCENT_LIVE_SOLUTION);
  const b = run(DESCENT_LIVE_SOLUTION);
  const c = run([...DESCENT_LIVE_SOLUTION].reverse());
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(a.obs, b.obs);
  assert.deepEqual(a.log, c.log, "queued commands apply in (atTick, sectorId) order");
  assert.deepEqual(placed(a.log).map((l) => [l.tick, l.sectorId]), DESCENT_LIVE_SOLUTION.map((x) => [(x as { atTick: number }).atTick, (x as { sectorId: string }).sectorId]));
});

test("placeBeacon: applies at the start of its tick, before the protocol, and sets sector.beacon", () => {
  const e = createEngine(descentLive(), "echo");
  assert.deepEqual(e.act(place("link0", 3)), { ok: true });
  e.step(3);
  assert.ok(e.observe().sectors.find((s) => s.id === "link0")!.beacon !== true, "not yet at tick 3 (steps 0..2 done)");
  e.step();
  const o = e.observe();
  assert.equal(o.sectors.find((s) => s.id === "link0")!.beacon, true);
  const ev = o.log.find((l) => l.kind === "beacon-placed")!;
  assert.deepEqual([ev.tick, ev.sectorId, ev.podId], [3, "link0", undefined]);
  // the mission data is never mutated
  assert.equal(descentLive().world.sectors.find((s) => s.id === "link0")!.beacon, false);
});

test("placeBeacon: no-ops never throw and never log or spend budget", () => {
  const e = createEngine(descentLive(), "echo");
  e.step(5);
  const bad: [Command, string][] = [
    [place("nope", 9), "unknown sector"],
    [place("ramp0", 9), "already beaconed from the start"],
    [place("link0", 4), "in the past"],
    [place("link0", 120), "at the end of the run"],
    [place("link0", 500), "past the end of the run"],
  ];
  for (const [c] of bad) assert.equal(e.act(c).ok, false);
  assert.equal(e.act(place("link0", 9)).ok, true);
  assert.equal(e.act(place("link0", 20)).ok, false, "already queued");
  assert.equal(e.act(place("link0", 6)).ok, false, "already queued, even for an earlier tick");
  e.step(200);
  assert.deepEqual(e.observe().sectors.filter((s) => s.beacon).map((s) => s.id), ["ramp0", "ramp1", "ramp2", "link0"], "only the one valid placement took effect");
  assert.equal(e.act(place("link1", 130)).ok, false, "after the run");
  assert.equal(e.observe().over, true);
  // a command naming a sector that already has a beacon at its tick changes nothing
  const r = run([place("ramp1", 3)]);
  assert.deepEqual(r.log, run([]).log);
});

test("placeBeacon: tower and normal modes ignore it", () => {
  for (const mode of ["tower", "normal"] as const) {
    const plain = run([], { mode });
    const r = run([place("link0", 3)], { mode });
    assert.equal(r.acts[0].ok, false);
    assert.deepEqual(r.log, plain.log);
    assert.equal(r.obs.sectors.find((s) => s.id === "link0")!.beacon, false);
  }
});

test("beacon budget: caps live placements, rejects extras with no log line, and counts queued ones", () => {
  const m = descentLive();
  assert.equal(m.beaconBudget, 5);
  const ids = ["link0", "link1", "link2", "trunk0", "trunk1", "trunk2", "byp0"];
  const r = run(ids.map((id, i) => place(id, 10 + i)));
  assert.deepEqual(r.acts.map((a) => a.ok), [true, true, true, true, true, false, false]);
  assert.equal(r.acts[5].reason, "no beacons left");
  assert.equal(placed(r.log).length, 5);
  assert.deepEqual(r.log, run(ids.slice(0, 5).map((id, i) => place(id, 10 + i))).log, "rejected extras leave no trace");
  // a mission without a budget has no cap
  const free = descentLive();
  free.beaconBudget = null;
  assert.equal(run(ids.map((id, i) => place(id, 10 + i)), { mission: free }).acts.every((a) => a.ok), true);
});

test("a live beacon removes a blind wait", () => {
  const dark = run([]);
  const blind = dark.log.find((l) => l.kind === "blind" && l.podId === "MED-1" && l.sectorId === "link0")!;
  const enterDark = firstTick(dark.log, (l) => l.kind === "enter" && l.podId === "MED-1" && l.sectorId === "link0")!;
  assert.ok(enterDark - blind.tick >= 3, "dark: MED-1 waits at least 3 minutes before entering");
  const lit = run([place("link0", blind.tick + 1)]);
  const enterLit = firstTick(lit.log, (l) => l.kind === "enter" && l.podId === "MED-1" && l.sectorId === "link0")!;
  assert.ok(enterLit < enterDark, "beacon lands mid-wait: MED-1 goes in at once");
  assert.ok(enterLit <= blind.tick + 2);
  // placed before it gets there: no blind wait is ever logged for that sector
  const early = run([place("link0", 0)]);
  assert.ok(!early.log.some((l) => l.kind === "blind" && l.podId === "MED-1" && l.sectorId === "link0"));
});

test("a live beacon lets seal news arrive, and only hops through it from the tick it goes live", () => {
  // main1 is sealed at t41. Dark: nobody hears it, and a pod that goes into main0 is trapped at main1 for good.
  const dark = run([]);
  const lit = run([place("main1", 0), place("main0", 0)]);
  const heard = (r: ReturnType<typeof run>, id: string) => firstTick(r.log, (l) => l.kind === "seal-heard" && l.podId === id);
  assert.ok(heard(dark, "MED-1")! > 60, "no beacons: MED-1 only learns it by standing at the sealed sector, long after");
  assert.ok(heard(lit, "MED-1")! < heard(dark, "MED-1")!, "over the live chain MED-1 hears it at the fork and reroutes in time");
  assert.equal(arrive(dark.obs, "MED-1"), null);
  assert.ok(arrive(lit.obs, "MED-1") !== null);
  // news that arrives earlier because a beacon sits on its way: trunk2 in the chain lets MED-1 hear while it is still inside trunk2
  const early = run([place("main1", 0), place("main0", 0), place("trunk2", 0)]);
  assert.ok(heard(early, "MED-1")! <= heard(lit, "MED-1")!);
  // pulses show the news front one hop per tick; trunk2 goes live late, so the front waits for it
  const front = (cmds: Command[]) => {
    const hits = new Map<string, number>();
    run(cmds, { mission: { ...descentLive(), beaconBudget: null }, onTick: (o) => o.pulses.filter((p) => p.kind === "seal").forEach((p) => hits.set(p.sectorId, o.tick - 1)) });
    return hits;
  };
  const eager = front([place("main1", 0), place("main0", 0), place("trunk2", 0)]);
  assert.deepEqual([eager.get("main1"), eager.get("main0"), eager.get("trunk2")], [41, 42, 43]);
  const late = front([place("main1", 0), place("main0", 0), place("trunk2", 60)]);
  assert.deepEqual([late.get("main1"), late.get("main0"), late.get("trunk2")], [41, 42, 60], "trunk2 hears at the tick its beacon goes live");
  // a beacon on the sealed sector placed after the seal starts the news then
  assert.equal(front([place("main1", 50), place("main0", 0)]).get("main0"), 51);
});

test("stars: no live beacons 0, a decent play 2, the stored solution 3, all within budget", () => {
  const zero = run([]);
  assert.equal(descentLiveStars(zero.obs.pods), 0);
  assert.deepEqual([arrive(zero.obs, "MED-1"), arrive(zero.obs, "SUP-3")], [null, null], "unwarned pods are trapped at the flood");
  const warn = [place("main1", 0), place("main0", 0)];
  assert.equal(descentLiveStars(run(warn).obs.pods), 0, "warning alone is too slow");
  assert.equal(descentLiveStars(run([...warn, place("link0", 0)]).obs.pods), 1);
  const decent = run([...warn, place("link0", 16), place("trunk0", 28)]);
  assert.equal(descentLiveStars(decent.obs.pods), 2);
  const sol = run(DESCENT_LIVE_SOLUTION);
  assert.ok(sol.acts.every((a) => a.ok));
  assert.equal(descentLiveStars(sol.obs.pods), 3);
  assert.deepEqual([arrive(sol.obs, "MED-1"), arrive(sol.obs, "SUP-3")], [83, 88]);
  assert.equal(DESCENT_LIVE_SOLUTION.length, descentLive().beaconBudget);
  assert.deepEqual(DESCENT_LIVE_GOALS.map((g) => g.stars), [1, 2, 3]);
  // tower mode never gets anyone there, whatever the Relay does
  assert.equal(descentLiveStars(run(DESCENT_LIVE_SOLUTION, { mode: "tower" }).obs.pods), 0);
});

test("the flood warning matters: route-only play never beats 0 stars, and the best play needs the warning placed before the seal", () => {
  const sealAt = descentLive().sealAt!;
  // (a) all five beacons on Mara's path (the fastest route-only set) still trap her at main1
  const routeOnly = run(["link0", "link1", "link2", "trunk0", "trunk1"].map((id, i) => place(id, 12 + 4 * i)));
  assert.equal(arrive(routeOnly.obs, "MED-1"), null);
  assert.equal(descentLiveStars(routeOnly.obs.pods), 0);
  assert.ok(descentLiveStars(routeOnly.obs.pods) <= 2);
  // (b) the 3-star solution places the warning before the seal, and dropping either half of it loses everything
  const sealed = (DESCENT_LIVE_SOLUTION as { sectorId: string; atTick: number }[]).filter((c) => ["main0", "main1"].includes(c.sectorId));
  assert.equal(sealed.length, 2);
  assert.ok(sealed.every((c) => c.atTick < sealAt), "warning goes in before the seal tick");
  for (const drop of ["main0", "main1"]) {
    const r = run(DESCENT_LIVE_SOLUTION.filter((c) => (c as { sectorId: string }).sectorId !== drop));
    assert.equal(descentLiveStars(r.obs.pods), 0, `no ${drop} beacon: no stars`);
  }
  // another 3-star layout: the bypass route beacons instead of link2
  const alt = run([place("link0", 16), place("link1", 20), place("trunk0", 24), place("main1", 30), place("main0", 34)]);
  assert.equal(descentLiveStars(alt.obs.pods), 3);
});

test("descentLive: valid, descent() untouched", () => {
  assert.deepEqual(validateMission(descentLive()), []);
  const live = descentLive();
  assert.deepEqual(live.world.sectors.filter((s) => s.beacon).map((s) => s.id), ["ramp0", "ramp1", "ramp2"]);
  assert.equal(live.sealSectorId, "main1");
  assert.equal(descent().sealSectorId, "main0");
  assert.ok(descent().world.sectors.every((s) => s.beacon === undefined && s.beacon !== false), "descent() keeps every sector beaconed");
  assert.equal(descent().endTick, 72);
  assert.equal(descent().beaconBudget, undefined);
});

test("no two pods ever share a sector, whichever sector gets a beacon and whenever it lands", () => {
  const dark = descentLive().world.sectors.filter((s) => !s.beacon).map((s) => s.id);
  for (const id of dark) for (const t of [0, 15, 30, 41, 55, 90]) run([place(id, t)]); // run() asserts exclusivity every tick
  for (const mode of ["echo"] as const) run(DESCENT_LIVE_SOLUTION.map((c) => ({ ...c, atTick: (c as { atTick: number }).atTick + 7 })), { mode });
});

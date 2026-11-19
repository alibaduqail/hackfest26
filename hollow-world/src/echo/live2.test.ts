// Live play, level 2: The Descent (live) II — Two Floods. Mirrors live.test.ts's patterns for the new mission.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DESCENT_LIVE_GOALS_2, DESCENT_LIVE_SOLUTION_2, descentLive2, descentLiveStars2 } from "./descent2";
import { descent, descentLive } from "./descent";
import { validateMission } from "./missions";
import type { Command, LogEvent, Mode, Observation } from "./types";

const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });

/** Runs to the end, applying `cmds` up front. Checks sector exclusivity every tick. */
function run(cmds: Command[], mode: Mode = "echo") {
  const e = createEngine(descentLive2(), mode);
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
  } while (!obs.over);
  return { log, obs, acts };
}
const arrive = (obs: Observation, id: string) => obs.pods.find((p) => p.id === id)!.arriveTick;

test("descentLive2: valid mission; descent() and descentLive() (level 1) are untouched", () => {
  assert.deepEqual(validateMission(descentLive2()), []);
  const m = descentLive2();
  assert.deepEqual(m.world.sectors.filter((s) => s.beacon).map((s) => s.id), ["ramp0", "ramp1", "ramp2"]);
  assert.equal(m.sealSectorId, "mainA1");
  assert.deepEqual(m.seals, [{ at: 55, sectorId: "mainB1" }]);
  assert.equal(m.beaconBudget, 7);
  // level 1 is byte-for-byte unaffected by level 2 existing
  assert.deepEqual(validateMission(descentLive()), []);
  assert.equal(descentLive().sealSectorId, "main1");
  assert.equal(descent().endTick, 72);
});

test("determinism: same commands replay to an identical log and observation, whatever order they were issued in", () => {
  const a = run(DESCENT_LIVE_SOLUTION_2);
  const b = run(DESCENT_LIVE_SOLUTION_2);
  const c = run([...DESCENT_LIVE_SOLUTION_2].reverse());
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(a.obs, b.obs);
  assert.deepEqual(a.log, c.log, "queued commands apply in (atTick, sectorId) order, not issue order");
});

test("stars: no beacons is 0, the stored solution is 3, both within budget", () => {
  const zero = run([]);
  assert.equal(descentLiveStars2(zero.obs.pods), 0);
  assert.deepEqual([arrive(zero.obs, "MED-1"), arrive(zero.obs, "SUP-3")], [null, null], "unwarned pods are trapped at the first flood");
  const sol = run(DESCENT_LIVE_SOLUTION_2);
  assert.ok(sol.acts.every((a) => a.ok));
  assert.equal(descentLiveStars2(sol.obs.pods), 3);
  assert.deepEqual([arrive(sol.obs, "MED-1"), arrive(sol.obs, "SUP-3")], [111, 116]);
  assert.ok(DESCENT_LIVE_SOLUTION_2.length <= descentLive2().beaconBudget!);
  assert.deepEqual(DESCENT_LIVE_GOALS_2.map((g) => g.stars), [1, 2, 3]);
  // tower mode never gets anyone there, whatever the Relay does
  assert.equal(descentLiveStars2(run(DESCENT_LIVE_SOLUTION_2, "tower").obs.pods), 0);
});

test("both warnings are required: dropping either one traps its flood's pod and caps the run at 0 stars", () => {
  const sealed = DESCENT_LIVE_SOLUTION_2.filter((c) => ["mainA1", "mainA0", "mainB0", "mainB1"].includes((c as { sectorId: string }).sectorId));
  for (const drop of ["mainA1", "mainB1"]) {
    const r = run(DESCENT_LIVE_SOLUTION_2.filter((c) => (c as { sectorId: string }).sectorId !== drop));
    assert.equal(descentLiveStars2(r.obs.pods), 0, `no ${drop} beacon: no stars`);
    assert.equal(arrive(r.obs, "MED-1"), null, `no ${drop} beacon: Mara never arrives`);
  }
  assert.ok(sealed.length >= 2, "the solution actually places beacons on the sealed sectors");
});

test("naive play (warning only, or warning plus too little speed) caps below 3 stars", () => {
  const warnOnly = run([place("mainA1", 0), place("mainA0", 0), place("mainB0", 0), place("mainB1", 0)]);
  assert.equal(descentLiveStars2(warnOnly.obs.pods), 1);
  assert.deepEqual([arrive(warnOnly.obs, "MED-1"), arrive(warnOnly.obs, "SUP-3")], [120, 125]);
  const decent = run([place("mainA1", 0), place("mainA0", 0), place("mainB0", 0), place("mainB1", 0), place("link0", 0), place("link1", 0)]);
  assert.equal(descentLiveStars2(decent.obs.pods), 2);
  assert.deepEqual([arrive(decent.obs, "MED-1"), arrive(decent.obs, "SUP-3")], [114, 119]);
});

test("route-only play (all 7 beacons, no warning) never beats 0 stars: speed cannot out-run either flood", () => {
  const routeOnly = run(["link0", "link1", "link2", "trunk0", "trunk1", "trunk2", "bypB0"].map((id) => place(id, 0)));
  assert.equal(arrive(routeOnly.obs, "MED-1"), null);
  assert.equal(descentLiveStars2(routeOnly.obs.pods), 0);
});

test("flood B is not telegraphed early: nothing before its own seal event reveals it", () => {
  const m = descentLive2();
  const sealB = m.seals![0];
  assert.equal(sealB.sectorId, "mainB1");
  const e = createEngine(m, "echo");
  for (let tick = 0; tick < sealB.at; tick++) {
    e.step();
    const o = e.observe();
    assert.equal(o.sectors.find((s) => s.id === "mainB1")!.sealed, false, `t${tick}: mainB1 shows sealed before its own seal tick`);
    assert.ok(!o.log.some((l) => l.sectorId === "mainB1"), `t${tick}: a log entry already mentions mainB1`);
    assert.ok(!o.pulses.some((p) => p.sectorId === "mainB1"), `t${tick}: a pulse already mentions mainB1`);
  }
  const after = e.observe();
  e.step();
  assert.ok(e.observe().log.some((l) => l.kind === "seal" && l.sectorId === "mainB1"), "the seal event itself is the first and only signal");
  assert.equal(after.sectors.find((s) => s.id === "mainB1")!.sealed, false, "still unsealed the tick right before it fires");
});

test("flood B needs no advance knowledge: reacting to its seal log event, not pre-committing, still reaches 3 stars", () => {
  const warnAAndSpeed: Command[] = [place("link0", 12), place("link1", 16), place("link2", 20), place("mainA1", 24), place("mainA0", 26)];
  for (const reactAt of [55, 56, 58, 59]) {
    const r = run([...warnAAndSpeed, place("mainB0", reactAt), place("mainB1", reactAt + 1)]);
    assert.equal(descentLiveStars2(r.obs.pods), 3, `reacting at t${reactAt} should still 3-star the run`);
  }
});

test("beacon budget caps live placements at 7", () => {
  const ids = ["link0", "link1", "link2", "mainA0", "mainA1", "mainB0", "mainB1", "bypB0"];
  const r = run(ids.map((id, i) => place(id, i)));
  assert.deepEqual(r.acts.map((a) => a.ok), [true, true, true, true, true, true, true, false]);
  assert.equal(r.acts[7].reason, "no beacons left");
});

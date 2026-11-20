// Live play, level 3: The Descent (live) III — Forged Rush. Mirrors live.test.ts's patterns for the new mission.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DESCENT_LIVE_GOALS_3, DESCENT_LIVE_SOLUTION_3, descentLive3, descentLiveStars3 } from "./descent3";
import { descent, descentLive } from "./descent";
import { descentLive2 } from "./descent2";
import { validateMission } from "./missions";
import type { Command, LogEvent, Mode, Observation } from "./types";

const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });

/** Runs to the end, applying `cmds` up front. Checks sector exclusivity every tick. */
function run(cmds: Command[], mode: Mode = "echo") {
  const e = createEngine(descentLive3(), mode);
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

test("descentLive3: valid mission; GHOST-1 starts inside the junction, holding it", () => {
  const m = descentLive3();
  assert.deepEqual(validateMission(m), []);
  assert.deepEqual(m.world.sectors.filter((s) => s.beacon).map((s) => s.id).sort(), ["paxline0", "paxline1", "paxline2", "ramp0", "ramp1", "ramp2", "spur0", "spur1", "spur2"]);
  assert.equal(m.sealSectorId, "main1");
  assert.equal(m.beaconBudget, 6);
  const ghost1 = m.pods.find((p) => p.id === "GHOST-1")!;
  assert.equal(ghost1.status, "moving");
  assert.equal(ghost1.path[ghost1.at], "trunk0");
  assert.equal(m.world.sectors.find((s) => s.id === "trunk0")!.holder, "GHOST-1");
  // levels 1 and 2 are byte-for-byte unaffected by level 3 existing
  assert.deepEqual(validateMission(descentLive()), []);
  assert.deepEqual(validateMission(descentLive2()), []);
  assert.equal(descent().endTick, 72);
});

test("determinism: same commands replay to an identical log and observation, whatever order they were issued in", () => {
  const a = run(DESCENT_LIVE_SOLUTION_3);
  const b = run(DESCENT_LIVE_SOLUTION_3);
  const c = run([...DESCENT_LIVE_SOLUTION_3].reverse());
  assert.deepEqual(a.log, b.log);
  assert.deepEqual(a.obs, b.obs);
  assert.deepEqual(a.log, c.log, "queued commands apply in (atTick, sectorId) order, not issue order");
});

test("stars: no beacons is 0, the stored solution is 3, both within budget", () => {
  const zero = run([]);
  assert.equal(descentLiveStars3(zero.obs.pods), 0);
  assert.equal(arrive(zero.obs, "MED-1"), null, "unwarned: Mara is trapped at the flood");
  const sol = run(DESCENT_LIVE_SOLUTION_3);
  assert.ok(sol.acts.every((a) => a.ok));
  assert.equal(descentLiveStars3(sol.obs.pods), 3);
  assert.deepEqual([arrive(sol.obs, "MED-1"), arrive(sol.obs, "SUP-3")], [78, 102]);
  assert.ok(DESCENT_LIVE_SOLUTION_3.length <= descentLive3().beaconBudget!);
  assert.deepEqual(DESCENT_LIVE_GOALS_3.map((g) => g.stars), [1, 2, 3]);
  assert.equal(descentLiveStars3(run(DESCENT_LIVE_SOLUTION_3, "tower").obs.pods), 0);
});

test("the flood warning is required: no beacon on main1/main0 caps the run at 0 stars however the junction is lit", () => {
  const noWarn = run(["trunk0", "trunk1", "trunk2", "byp0", "byp1", "byp2"].map((id) => place(id, 0)));
  assert.equal(arrive(noWarn.obs, "MED-1"), null);
  assert.equal(descentLiveStars3(noWarn.obs.pods), 0);
});

test("the junction beacon is required to reach 3 stars: the best any set skipping it can do is 2 stars", () => {
  const noJunction = run(["trunk1", "trunk2", "main0", "main1", "byp0", "byp1"].map((id) => place(id, 0)));
  assert.deepEqual([arrive(noJunction.obs, "MED-1"), arrive(noJunction.obs, "SUP-3")], [99, 123]);
  assert.equal(descentLiveStars3(noJunction.obs.pods), 2);
  // the junction alone, without good route speed afterwards, is not enough for 3 stars either
  const junctionOnly = run(["trunk0", "trunk1", "trunk2", "main0", "main1", "main2"].map((id) => place(id, 0)));
  assert.deepEqual([arrive(junctionOnly.obs, "MED-1"), arrive(junctionOnly.obs, "SUP-3")], [81, 105]);
  assert.equal(descentLiveStars3(junctionOnly.obs.pods), 2);
  // both together: the stored solution's tier
  const sol = run(DESCENT_LIVE_SOLUTION_3);
  assert.equal(descentLiveStars3(sol.obs.pods), 3);
});

test("a dark junction costs Mara the race to a lower-priority pod despite her rank; a lit one does not", () => {
  const warn = [place("main1", 0), place("main0", 0)];
  const dark = run(warn);
  const lit = run([...warn, place("trunk0", 0)]);
  const enter = (r: typeof dark, id: string) => r.log.find((l) => l.kind === "enter" && l.podId === id && l.sectorId === "trunk0")!.tick;
  assert.ok(enter(dark, "PAX-1") < enter(dark, "MED-1"), "dark junction: the passenger gets in first");
  assert.ok(enter(lit, "MED-1") < enter(lit, "PAX-1"), "lit junction: priority puts Mara through first");
  assert.ok(arrive(lit.obs, "MED-1")! < arrive(dark.obs, "MED-1")!);
});

test("beacon budget caps live placements at 6", () => {
  const ids = ["trunk0", "trunk1", "trunk2", "main0", "main1", "main2", "byp0"];
  const r = run(ids.map((id, i) => place(id, i)));
  assert.deepEqual(r.acts.map((a) => a.ok), [true, true, true, true, true, true, false]);
  assert.equal(r.acts[6].reason, "no beacons left");
});

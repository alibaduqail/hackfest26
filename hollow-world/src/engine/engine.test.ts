import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HollowEngine } from "./engine";
import type { Scenario, Command } from "./types";
import { validateSave, validateScenario } from "./validation";
const scenario = () =>
  JSON.parse(
    readFileSync(
      new URL("../../public/scenario.json", import.meta.url),
      "utf8",
    ),
  ) as Scenario;
const command = (e: HollowEngine, extra: Partial<Command> = {}): Command => ({
  commandId: "c1",
  actorId: "district-operator",
  expectedRunId: e.state.runId,
  requestedAtTick: e.state.tick,
  type: "assignBackup",
  targetId: "d2-f5",
  value: "pump",
  ...extra,
});
test("the reference world has connected authored geometry and persistent population", () => {
  const e = new HollowEngine(scenario());
  assert.equal(e.state.rooms.length, 30);
  assert.equal(e.state.people.length, 180);
  assert.equal(e.state.households.length, 60);
  assert.ok(e.router.route("d0-f0", "d2-f7", e.state));
});
test("residents autonomously travel, work and complete daily tasks", () => {
  const e = new HollowEngine(scenario());
  e.step(1200);
  assert.ok(e.state.people.some((p) => p.completed > 0));
  assert.ok(
    e.state.people.some(
      (p) => p.task === "Working" && p.taskState === "active",
    ),
  );
  assert.ok(e.state.rooms.some((r) => r.output > 0));
});
test("lower flood isolates twelve households while the clinic stays powered", () => {
  const e = new HollowEngine(scenario());
  e.incident("blackout");
  e.step(300);
  assert.equal(e.roomState.get("d0-f1")!.powered, true);
  assert.ok(e.state.closedLinks.includes("stairs-2-5"));
  assert.equal(e.state.households.filter((h) => h.accessClosed).length, 12);
  const cutoff = e.state.households.reduce((n, h) => n + h.cutoffSeconds, 0);
  e.step(300);
  assert.equal(
    e.state.households.reduce((n, h) => n + h.cutoffSeconds, 0) - cutoff,
    12 * 300,
  );
});
test("pump action drains water and uses limited battery power", () => {
  const e = new HollowEngine(scenario());
  e.incident("blackout");
  e.step(300);
  assert.equal(e.act(command(e)).ok, true);
  const battery = e.state.batteryMilliWh;
  e.step(301);
  assert.ok(e.state.waterL < 1);
  assert.ok(e.state.batteryMilliWh < battery);
  assert.equal(e.state.households.filter((h) => h.accessClosed).length, 0);
});
test("depot deliveries commit cargo once, preserving inventory conservation", () => {
  const e = new HollowEngine(scenario());
  const initial = e.totals();
  e.step(3600);
  assert.ok(e.state.cart.delivered > 0);
  const total = e.totals();
  for (const item of ["food", "water", "medicine", "parts", "waste"] as const)
    assert.ok(
      Math.abs(
        total[item] -
          (initial[item] +
            e.state.ledger.produced[item] -
            e.state.ledger.consumed[item]),
      ) < 0.05,
      `${item} balance`,
    );
});
test("the cut retains sample timestamps while actual water continues rising", () => {
  const e = new HollowEngine(scenario());
  e.step(40);
  const observed = e.observe().reports.find((r) => r.subjectId === "d2-f5")!;
  e.incident("comms");
  e.incident("blackout");
  e.step(120);
  const later = e.observe().reports.find((r) => r.subjectId === "d2-f5")!;
  assert.equal(later.sampledAtTick, observed.sampledAtTick);
  assert.equal(later.status, "stale");
  assert.ok(e.state.waterL > 0);
  assert.equal(e.act(command(e)).ok, false);
});
test("never delivered reports are unknown and not hidden truth", () => {
  const e = new HollowEngine(scenario());
  assert.equal(e.observe().reports[0].status, "unknown");
  assert.equal(e.observe().reports[0].values, null);
});
test("snapshot round trip resumes people, cargo, reports and deficits identically", () => {
  const a = new HollowEngine(scenario());
  a.step(320);
  a.incident("blackout");
  a.step(290);
  const b = new HollowEngine(scenario(), structuredClone(a.state));
  a.step(800);
  b.step(800);
  assert.deepEqual(a.state, b.state);
});
test("render-independent tick batching is deterministic", () => {
  const a = new HollowEngine(scenario()),
    b = new HollowEngine(scenario());
  a.step(500);
  for (let i = 0; i < 50; i++) b.step(10);
  assert.deepEqual(a.state, b.state);
});
test("invalid scenario/save rejected without altering the active engine", () => {
  const e = new HollowEngine(scenario());
  const before = JSON.stringify(e.state);
  const bad = scenario();
  bad.links[0].a = "missing";
  assert.throws(() => validateScenario(bad));
  const saved = structuredClone(e.state);
  saved.people[0].roomId = "missing";
  assert.throws(() => validateSave(scenario(), saved));
  assert.equal(JSON.stringify(e.state), before);
});
test("old run, bad targets, unauthorized actors, power caps and duplicate actions", () => {
  const e = new HollowEngine(scenario());
  assert.equal(e.act(command(e, { expectedRunId: "old" })).ok, false);
  assert.equal(e.act(command(e, { actorId: "viewer" })).ok, false);
  assert.equal(e.act(command(e, { targetId: "missing" })).ok, false);
  const r = e.act(command(e));
  assert.equal(r.ok, true);
  assert.deepEqual(e.act(command(e)), r);
  assert.equal(e.state.commands.length, 1);
  assert.equal(e.act(command(e, { commandId: "c2" })).ok, false);
  const s = scenario();
  s.settings.batteryMaxW = 100;
  const limited = new HollowEngine(s);
  assert.equal(limited.act(command(limited)).ok, false);
});
test("closing a route never teleports people or loses cargo", () => {
  const e = new HollowEngine(scenario());
  e.step(100);
  const p = e.state.people.find((p) => p.edgeId)!;
  const before = { edge: p.edgeId, progress: p.edgeProgress, room: p.roomId };
  e.state.closedLinks.push(p.edgeId!);
  e.step();
  assert.equal(p.edgeId, before.edge);
  assert.equal(p.roomId, before.room);
  assert.equal(p.edgeProgress, before.progress);
  assert.equal(p.taskState, "blocked");
});

test("five-minute isolation is exactly 60 household-minutes with matching interval evidence", () => {
  const e = new HollowEngine(scenario());
  e.incident("blackout");
  e.step(300);
  const before = e.state.households.reduce((n, h) => n + h.cutoffSeconds, 0);
  e.step(300);
  assert.equal(
    (e.state.households.reduce((n, h) => n + h.cutoffSeconds, 0) - before) / 60,
    60,
  );
  assert.ok(e.state.deficits.every((d) => e.state.tick - d.start === 300));
});
test("day-scale fractional production and household carrying preserve stocks", () => {
  const e = new HollowEngine(scenario());
  const initial = e.totals();
  e.step(86400);
  const total = e.totals();
  for (const k of Object.keys(total) as (keyof typeof total)[])
    assert.ok(
      Math.abs(
        total[k] -
          (initial[k] +
            e.state.ledger.produced[k] -
            e.state.ledger.consumed[k]),
      ) < 0.1,
      `${k} daily balance`,
    );
});
test("a permitted alternate route remains available when one connector closes", () => {
  const e = new HollowEngine(scenario());
  const path = e.router.route("d0-f0", "d1-f2", e.state)!;
  assert.ok(path.length);
  e.state.closedLinks.push(path[0]);
  e.state.topology++;
  const alternative = e.router.route("d0-f0", "d1-f2", e.state);
  assert.ok(alternative);
  assert.ok(!alternative.includes(path[0]));
});
test("room edits move the route geometry source and invalid utility links reject import", () => {
  const s = scenario();
  s.rooms[0].x += 100;
  const e = new HollowEngine(s);
  assert.equal(e.scenario.rooms[0].x, s.rooms[0].x);
  const bad = scenario();
  bad.airZones[0].fanId = "missing";
  assert.throws(() => validateScenario(bad));
  const saved = structuredClone(e.state);
  (saved.rooms[0].temperature as unknown) = "bad";
  assert.throws(() => validateSave(s, saved));
});
test('backup requests power the exact selected fan rather than another fan of the same type',()=>{const e=new HollowEngine(scenario());e.incident('blackout');assert.equal(e.act(command(e,{targetId:'d1-f5',value:'fan'})).ok,true);e.step();assert.equal(e.roomState.get('d1-f5')!.powered,true);assert.equal(e.roomState.get('d2-f1')!.powered,false);});

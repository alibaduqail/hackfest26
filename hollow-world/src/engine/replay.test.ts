import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HollowEngine } from "./engine";
import { replayWorld } from "./replay";
import type { Scenario } from "./types";
test("event and accepted-command replay reproduces a coupled incident exactly", () => {
  const s = JSON.parse(
    readFileSync(
      new URL("../../public/scenario.json", import.meta.url),
      "utf8",
    ),
  ) as Scenario;
  const a = new HollowEngine(s);
  a.step(100);
  a.incident("blackout");
  a.step(400);
  a.act({
    commandId: "switch",
    actorId: "district-operator",
    expectedRunId: a.state.runId,
    requestedAtTick: a.state.tick,
    type: "assignBackup",
    targetId: "d2-f5",
    value: "pump",
  });
  a.step(500);
  const b = replayWorld({
    format: "hollow-replay-v1",
    scenario: s,
    finalTick: a.state.tick,
    actions: a.state.actions,
    commands: a.state.commandLog,
  });
  assert.deepEqual(a.state, b.state);
});
test("same-tick operator request then communications cut replays in original order", () => {
  const s = JSON.parse(
    readFileSync(
      new URL("../../public/scenario.json", import.meta.url),
      "utf8",
    ),
  ) as Scenario;
  const a = new HollowEngine(s);
  a.incident("blackout");
  a.act({
    commandId: "switch",
    actorId: "district-operator",
    expectedRunId: a.state.runId,
    requestedAtTick: 0,
    type: "assignBackup",
    targetId: "d2-f5",
    value: "pump",
  });
  a.incident("comms");
  a.step(400);
  const b = replayWorld({
    format: "hollow-replay-v1",
    scenario: s,
    finalTick: a.state.tick,
    actions: a.state.actions,
    commands: a.state.commandLog,
  });
  assert.deepEqual(a.state, b.state);
});

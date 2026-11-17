import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HollowEngine } from "../engine/engine";
import type { Scenario } from "../engine/types";
import { movementTransition, pumpOperating, waterDepth } from "./visual-state";

test("pump and flood cues follow real blackout and backup state", () => {
  const scenario: Scenario = JSON.parse(readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"));
  const engine = new HollowEngine(scenario);
  const pump = () => engine.state.rooms.find((r) => r.id === "d2-f5")!;
  assert.equal(pumpOperating(pump()), true);
  engine.incident("blackout");
  engine.step(300);
  assert.equal(pumpOperating(pump()), false);
  assert.equal(waterDepth(engine.state, scenario), engine.state.waterL / (scenario.settings.tunnelAreaM2 * 1000));
  assert.ok(waterDepth(engine.state, scenario) >= scenario.settings.closeDepthM);
  const receipt = engine.act({ commandId: "visual-test", actorId: "district-operator", expectedRunId: engine.state.runId,
    requestedAtTick: engine.state.tick, type: "assignBackup", targetId: "d2-f5", value: "pump" });
  assert.equal(receipt.ok, true);
  engine.step(301);
  assert.equal(pumpOperating(pump()), true);
  assert.ok(waterDepth(engine.state, scenario) < scenario.settings.closeDepthM);
});

test("movement snaps on a new traversal or backwards progress", () => {
  const start = { key: "run-a:edge-1:room-a:room-b", progress: 0.2 };
  assert.equal(movementTransition(undefined, start).snap, true);
  assert.equal(movementTransition(start, { ...start, progress: 0.5 }).snap, false);
  assert.equal(movementTransition(start, { ...start, progress: 0.1 }).snap, true);
  assert.equal(movementTransition(start, { ...start, key: "run-a:edge-2:room-b:room-c" }).snap, true);
  assert.equal(movementTransition(start, { ...start, key: "run-b:edge-1:room-a:room-b" }).snap, true);
});

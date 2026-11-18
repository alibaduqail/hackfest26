import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../../../echo/engine";
import { DESCENT_LIVE_SOLUTION, descentLiveStars } from "../../../echo/descent";
import { createLive } from "./useLive";

function finish(run: ReturnType<typeof createLive>) {
  while (!run.getSnapshot().observation.over) run.step();
}

test("accepted same-tick placements replay to the identical final observation", () => {
  const run = createLive();
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.place("link0").ok, true);
  assert.equal(run.place("main1").ok, true);
  assert.deepEqual([...run.getSnapshot().queued], ["link0", "main1"]);
  assert.equal(run.getSnapshot().remaining, 3);
  run.step();
  assert.equal(run.getSnapshot().previous.tick, 0);
  assert.equal(run.getSnapshot().observation.tick, 1);
  assert.equal(run.getSnapshot().queued.size, 0);
  for (let i = 0; i < 9; i++) run.step();
  assert.equal(run.place("main0").ok, true);
  finish(run);
  const state = run.getSnapshot();
  const replay = createEngine(state.mission, "echo");
  for (const command of state.commands) assert.equal(replay.act(command).ok, true);
  replay.step(state.mission.endTick);
  assert.deepEqual(state.observation, replay.observe());
  assert.equal(state.playing, false);
});

test("refused placements leave the command log and budget intact, retry resets the run", () => {
  const run = createLive();
  assert.deepEqual(run.place("unknown"), { ok: false, reason: "unknown sector" });
  assert.equal(run.getSnapshot().feedback, "unknown sector");
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.place("link0").ok, true);
  const duplicate = run.place("link0");
  assert.equal(duplicate.ok, false);
  assert.equal(run.getSnapshot().feedback, duplicate.reason);
  assert.equal(run.getSnapshot().commands.length, 1);
  assert.equal(run.getSnapshot().remaining, 4);
  run.retry();
  const state = run.getSnapshot();
  assert.equal(state.observation.tick, 0);
  assert.equal(state.playing, false);
  assert.equal(state.remaining, 5);
  assert.equal(state.queued.size, 0);
  assert.equal(state.feedback, null);
  assert.equal(state.commands.length, 0);
});

test("solution queues only due placements, rejects edits, and reaches three stars", () => {
  const run = createLive();
  run.watchSolution();
  assert.equal(run.getSnapshot().solution, true);
  assert.equal(run.getSnapshot().playing, true);
  assert.equal(run.getSnapshot().queued.size, 0);
  assert.equal(run.place("trunk0").ok, false);
  for (let i = 0; i < 16; i++) run.step();
  assert.equal(run.getSnapshot().commands.length, 0);
  run.step();
  assert.equal(run.getSnapshot().commands.length, 1);
  assert.equal(run.getSnapshot().queued.size, 0);
  finish(run);
  const state = run.getSnapshot();
  assert.deepEqual(state.commands, DESCENT_LIVE_SOLUTION);
  assert.equal(descentLiveStars(state.observation.pods), 3);
  const replay = createEngine(state.mission, "echo");
  for (const command of DESCENT_LIVE_SOLUTION) assert.equal(replay.act(command).ok, true);
  replay.step(state.mission.endTick);
  assert.deepEqual(state.observation, replay.observe());
});

test("pause, speed, and slow override control the advertised cadence", () => {
  const run = createLive();
  run.togglePause();
  run.setSpeed(2);
  assert.equal(run.getSnapshot().stepMs, 300);
  while (run.getSnapshot().observation.tick < 31) run.step();
  assert.equal(run.getSnapshot().slow, true);
  assert.equal(run.getSnapshot().stepMs, 300 / 0.35);
  run.togglePause();
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.getSnapshot().slow, false);
  assert.equal(run.getSnapshot().stepMs, 300);
});

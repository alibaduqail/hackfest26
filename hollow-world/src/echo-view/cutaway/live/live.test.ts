import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../../../echo/engine";
import { DESCENT_LIVE_SOLUTION, descentLive, descentLiveStars } from "../../../echo/descent";
import { createLive } from "./useLive";

function finish(run: ReturnType<typeof createLive>) {
  while (!run.getSnapshot().ended && !run.getSnapshot().observation.over) run.step();
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
  replay.step(state.observation.tick);
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
  replay.step(state.observation.tick);
  assert.deepEqual(state.observation, replay.observe());
});

test("pause, speed, and slow override control the advertised cadence", () => {
  const run = createLive();
  run.togglePause();
  run.setSpeed(2);
  assert.equal(run.getSnapshot().stepMs, 300);
  while (run.getSnapshot().observation.tick < 33) run.step(); // the telegraph (t33 for the first flood) starts the slow-motion window
  assert.equal(run.getSnapshot().slow, true);
  assert.equal(run.getSnapshot().stepMs, 300 / 0.35);
  run.togglePause();
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.getSnapshot().slow, false);
  assert.equal(run.getSnapshot().stepMs, 300);
});

test("the no-beacon attempt ends once both clinic deliveries are trapped", () => {
  const run = createLive();
  run.togglePause();
  finish(run);
  const result = run.getSnapshot();
  assert.ok(result.observation.tick < result.mission.endTick);
  assert.equal(result.playing, false);
  assert.equal(descentLiveStars(result.observation.pods), 0);
  assert.equal(result.observation.pods.find((p) => p.nurse)?.status, "holding");
  assert.ok(
    result.events.some((event) => event.kind === "blind" && event.podId === "MED-1" && event.sectorId === "link0"),
  );
  assert.equal(run.place("main1").ok, false);
});

test("slow motion is capped and reserves time for the flood telegraph", () => {
  const run = createLive();
  const { sealAt, floodReveal } = run.getSnapshot().mission;
  const reveal = sealAt! - floodReveal!.lead; // 11 slow ticks are reserved from the moment the flood is named
  let slowTicks = 0;
  while (!run.getSnapshot().ended && !run.getSnapshot().observation.over) {
    const state = run.getSnapshot();
    if (state.slow) slowTicks++;
    if (state.observation.tick >= reveal && state.observation.tick < reveal + 11) assert.equal(state.slow, true);
    run.step();
  }
  assert.ok(slowTicks > 0 && slowTicks <= 16);
});

test("a retry replays the same flood (free play, like a journey leg): the mission and its star table do not change", () => {
  const spec = { build: (a: number) => descentLive({ seed: 12345, attempt: a }), solution: () => DESCENT_LIVE_SOLUTION };
  const run = createLive(spec);
  const first = run.getSnapshot().mission;
  for (let i = 0; i < 3; i++) { run.retry(); assert.deepEqual(run.getSnapshot().mission, first); assert.equal(run.getSnapshot().attempt, 0); }
});

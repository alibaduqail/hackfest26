import assert from "node:assert/strict";
import { test } from "node:test";
import { descentLive } from "../../../echo/descent";
import { descentLive2 } from "../../../echo/descent2";
import { createLive, FLOOD_HOLD_LEAD } from "./useLive";
import { warnChain } from "./track-light";

const level2 = { build: () => descentLive2(), solution: () => [] };

/** Drives a run the way useLive's timer does: a tick only while playing. Resumes every self-pause and returns the ticks it paused at. */
function play(run: ReturnType<typeof createLive>, onHold?: () => void) {
  const holds: number[] = [];
  for (let guard = 0; guard < 400 && !run.getSnapshot().ended; guard++) {
    if (!run.getSnapshot().playing) {
      holds.push(run.getSnapshot().observation.tick);
      onHold?.();
      run.togglePause();
    }
    run.step();
  }
  return holds;
}

test("planning: the intro leaves the clock stopped at t+0; placing does not start it; Run does", () => {
  const run = createLive();
  assert.equal(run.getSnapshot().planning, true);
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.place("link0").ok, true);
  assert.equal(run.place("link1").ok, true);
  const s = run.getSnapshot();
  assert.deepEqual([s.playing, s.planning, s.observation.tick], [false, true, 0]);
  run.togglePause(); // Space or Run
  assert.deepEqual([run.getSnapshot().playing, run.getSnapshot().planning], [true, false]);
  run.togglePause(); // the next press pauses
  assert.equal(run.getSnapshot().playing, false);
  assert.equal(run.getSnapshot().planning, false);
  run.retry();
  assert.equal(run.getSnapshot().planning, true);
});

test("the flood announcement pauses the run once, after the slow-motion lead-in", () => {
  const run = createLive();
  const { sealAt, floodReveal } = run.getSnapshot().mission;
  const reveal = sealAt! - floodReveal!.lead;
  run.togglePause();
  const holds = play(run);
  assert.deepEqual(holds, [reveal + FLOOD_HOLD_LEAD]);
});

test("reduced motion pauses on the announcement tick itself", () => {
  const run = createLive();
  run.setReducedMotion(true);
  const { sealAt, floodReveal } = run.getSnapshot().mission;
  run.togglePause();
  assert.deepEqual(play(run), [sealAt! - floodReveal!.lead]);
});

test("two floods, two holds: once each, never again on resume", () => {
  const run = createLive(level2);
  run.togglePause();
  const holds = play(run);
  assert.equal(holds.length, 2);
  assert.ok(holds[0] < holds[1]);
});

test("resume continues normally: lighting the warn-here chain at the hold saves Mara", () => {
  const run = createLive({ build: (a) => descentLive({ attempt: a }), solution: () => [] });
  run.togglePause();
  play(run, () => {
    const s = run.getSnapshot();
    const mara = s.observation.pods.find((p) => p.nurse)!;
    assert.equal(s.floodHold, s.mission.sealSectorId);
    for (const id of warnChain(s.mission.world.sectors, s.floodHold!, mara.path, mara.at)!) assert.equal(run.place(id).ok, true);
  });
  const end = run.getSnapshot();
  assert.notEqual(end.observation.pods.find((p) => p.nurse)!.arriveTick, null);
  assert.equal(end.floodHold, null);
});

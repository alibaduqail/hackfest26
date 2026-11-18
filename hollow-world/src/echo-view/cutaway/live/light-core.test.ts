import test from "node:test";
import assert from "node:assert/strict";
import { clampDarkness, DARKNESS_HARD_MAX, DARKNESS_SOFT_MAX, LightCore } from "./light-core";

const SECTORS = ["link0", "link1", "main0", "main1"];

test("alpha clamps into [0, 0.55] and never exceeds the 0.65 hard cap", () => {
  assert.equal(clampDarkness(0.3), 0.3);
  assert.equal(clampDarkness(-5), 0);
  assert.equal(clampDarkness(0.9), DARKNESS_SOFT_MAX);
  assert.equal(clampDarkness(10), DARKNESS_SOFT_MAX);
  assert.ok(clampDarkness(10) <= DARKNESS_HARD_MAX);

  const core = new LightCore({ sectorIds: SECTORS, darknessAlpha: 50, flickerHz: 8 });
  for (let now = 0; now < 2000; now += 17) {
    assert.ok(core.effectiveAlpha(now) <= DARKNESS_HARD_MAX);
  }
});

test("the dark canvas redraws only on a beacon-set change, a fade in progress, or a flicker tick", () => {
  const core = new LightCore({ sectorIds: SECTORS, flickerHz: 8, fadeInMs: 150 });
  assert.equal(core.needsRedraw(0), true); // initial state is always dirty
  core.syncSectors(SECTORS.map((id) => ({ id, beacon: false })), 0);
  core.markRedrawn(0);
  assert.equal(core.needsRedraw(1), false);
  assert.equal(core.needsRedraw(10), false); // well inside the same ~125ms flicker step

  core.syncSectors([{ id: "link0", beacon: true }], 20);
  assert.equal(core.needsRedraw(21), true); // beacon landed: dirty
  core.markRedrawn(21);
  assert.equal(core.needsRedraw(30), true); // still inside its 150ms fade window
  core.markRedrawn(30);
  assert.equal(core.needsRedraw(140), true); // fade still running at +120ms
  core.markRedrawn(140);
  assert.equal(core.needsRedraw(175), false); // fade finished (+155ms) and no flicker step boundary
  assert.equal(core.needsRedraw(260), true); // crossed into the next ~125ms flicker step
});

test("unchanged sectors never redraw when flicker is disabled", () => {
  const core = new LightCore({ sectorIds: SECTORS, flickerHz: 0 });
  core.syncSectors(SECTORS.map((id) => ({ id, beacon: false })), 0);
  core.markRedrawn(0);
  for (let now = 0; now < 5000; now += 250) {
    assert.equal(core.needsRedraw(now), false);
  }
});

test("reduced motion suppresses the flicker redraw cadence and pulse travel", () => {
  const core = new LightCore({ sectorIds: SECTORS, flickerHz: 8, reducedMotion: true });
  core.syncSectors(SECTORS.map((id) => ({ id, beacon: false })), 0);
  core.markRedrawn(0);
  for (let now = 0; now < 5000; now += 50) {
    assert.equal(core.needsRedraw(now), false, `unexpected redraw at ${now}ms under reduced motion`);
  }

  core.syncPulses([{ id: "p1", kind: "seal", from: [0, 0], to: [100, 100] }]);
  const slot = core.getPulseSlots().find((s) => s.active)!;
  const out: [number, number] = [0, 0];
  core.pulsePosition(slot, 0.5, out);
  assert.deepEqual(out, [100, 100]); // static at destination, no travel, even mid-tween

  core.setReducedMotion(false);
  core.pulsePosition(slot, 0.5, out);
  assert.deepEqual(out, [50, 50]); // travel resumes once reduced motion is off
});

test("the pulse pool never grows across many frames of varying pulse counts", () => {
  const core = new LightCore({ sectorIds: SECTORS, pulseSlots: 6 });
  const pool = core.getPulseSlots();
  assert.equal(pool.length, 6);
  for (let frame = 0; frame < 500; frame++) {
    const count = frame % 9; // sometimes exceeds the pool size, exercising the overflow guard too
    const pulses = Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      kind: "announce" as const,
      from: null,
      to: [i, i] as [number, number],
    }));
    core.syncPulses(pulses);
    core.syncSectors(SECTORS.map((id) => ({ id, beacon: frame % 2 === 0 })), frame);
    core.needsRedraw(frame);
    core.markRedrawn(frame);
  }
  const poolAfter = core.getPulseSlots();
  assert.equal(poolAfter, pool); // same array reference: never reallocated
  assert.equal(poolAfter.length, 6);
});

test("setReducedMotion forces an immediate redraw only when the value actually changes", () => {
  const core = new LightCore({ sectorIds: SECTORS, flickerHz: 8 });
  core.syncSectors(SECTORS.map((id) => ({ id, beacon: false })), 0);
  core.markRedrawn(0);
  assert.equal(core.needsRedraw(5), false);

  core.setReducedMotion(true); // false -> true: must force a redraw right away
  assert.equal(core.needsRedraw(5), true);
  core.markRedrawn(5);
  assert.equal(core.needsRedraw(6), false);

  core.setReducedMotion(true); // no change: should not re-dirty
  assert.equal(core.needsRedraw(7), false);

  core.setReducedMotion(false); // true -> false: forces a redraw again
  assert.equal(core.needsRedraw(8), true);
});

test("fadeProgress eases from 0 to 1 across the configured window and holds at 1 afterwards", () => {
  const core = new LightCore({ sectorIds: SECTORS, fadeInMs: 150 });
  core.syncSectors([{ id: "link0", beacon: true }], 0);
  assert.equal(core.fadeProgress("link0", 0), 0);
  const mid = core.fadeProgress("link0", 75);
  assert.ok(mid > 0 && mid < 1);
  assert.equal(core.fadeProgress("link0", 150), 1);
  assert.equal(core.fadeProgress("link0", 10_000), 1);
  assert.equal(core.fadeProgress("main0", 0), 1); // never lit: no fade pending, treated as settled
});

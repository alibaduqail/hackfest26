import assert from "node:assert/strict";
import { test } from "node:test";
import { createEngine } from "../../../echo/engine";
import { descentLive } from "../../../echo/descent";
import { LEVEL_HINTS, TOAST_LEVELS, deepestLevel, nextHint } from "./hints";

test("the only in-run toast is the priority order, shown once when pods reach level 3", () => {
  const e = createEngine(descentLive(), "echo");
  const seen = new Set<number>();
  const shown: number[] = [];
  for (let t = 0; t <= 120; t++) {
    for (let h = nextHint(e.observe(), seen); h; h = nextHint(e.observe(), seen)) (seen.add(h.level), shown.push(h.level));
    e.step();
  }
  assert.deepEqual(shown, [3]);
  assert.equal(nextHint(e.observe(), new Set([3])), null);
});

test("no toast explains the beacon rule in prose; the intro card keeps its lines", () => {
  const o = createEngine(descentLive(), "echo").observe();
  assert.equal(deepestLevel(o), 1);
  assert.equal(nextHint(o, new Set([1])), null);
  for (const level of TOAST_LEVELS) assert.doesNotMatch(LEVEL_HINTS[level as 3], /beacon|dark|hears/i);
  assert.deepEqual(TOAST_LEVELS, [3]);
  assert.match(LEVEL_HINTS[4], /next link is dark/); // the leg II intro card, not a toast
});

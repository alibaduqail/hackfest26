import assert from "node:assert/strict";
import { test } from "node:test";
import { createEngine } from "../../../echo/engine";
import { descentLive } from "../../../echo/descent";
import { LEVEL_HINTS, deepestLevel, nextHint } from "./hints";

test("each level's hint shows once, in order, as pods descend", () => {
  const e = createEngine(descentLive(), "echo");
  const seen = new Set<number>();
  const shown: number[] = [];
  for (let t = 0; t <= 120; t++) {
    for (let h = nextHint(e.observe(), seen); h; h = nextHint(e.observe(), seen)) (seen.add(h.level), shown.push(h.level));
    e.step();
  }
  assert.deepEqual(shown, [1, 2, 3, 4, 5].slice(0, shown.length));
  assert.ok(shown.length >= 4);
  assert.equal(nextHint(e.observe(), new Set([1, 2, 3, 4, 5])), null);
});

test("level 1 before anyone moves; the flood hint carries the dark-link rule", () => {
  const o = createEngine(descentLive(), "echo").observe();
  assert.equal(deepestLevel(o), 1);
  assert.equal(nextHint(o, new Set())!.text, LEVEL_HINTS[1]);
  assert.match(LEVEL_HINTS[4], /next link is dark/);
});

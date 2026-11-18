import assert from "node:assert/strict";
import test from "node:test";
import { frameProgress } from "./motion";

test("an animation frame timestamp can precede the scene start", () => {
  assert.equal(frameProgress(950, 1000, 410), 0);
  assert.equal(frameProgress(1050, 1000, 100), 0.5);
  assert.equal(frameProgress(1150, 1000, 100), 1);
  assert.equal(frameProgress(950, 1000, 0), 1);
});

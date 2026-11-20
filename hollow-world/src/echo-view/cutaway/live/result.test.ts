import assert from "node:assert/strict";
import test from "node:test";
import { blindWindows, deadlineMargin } from "./result";

test("debrief margins reflect actual arrivals and never invent a late arrival", () => {
  assert.equal(deadlineMargin(92, 83), "9 min late for ★★★");
  assert.equal(deadlineMargin(83, 83), "Met the ★★★ deadline");
  assert.equal(deadlineMargin(88, 91), "3 min ahead of ★★★");
  assert.equal(deadlineMargin(null, 88), "Target minute 88 · did not arrive");
});

test("a placement during a blind window shortens the reported wait", () => {
  assert.deepEqual(
    blindWindows("MED-1", [
      { tick: 15, kind: "blind", podId: "MED-1", sectorId: "link0", text: "" },
      { tick: 16, kind: "beacon-placed", sectorId: "link0", text: "" },
      { tick: 30, kind: "blind", podId: "MED-1", sectorId: "link1", text: "" },
      { tick: 80, kind: "claim", podId: "MED-1", sectorId: "link1", text: "" },
    ], 81),
    [{ sectorId: "link0", minutes: 1 }, { sectorId: "link1", minutes: 3 }],
  );
});

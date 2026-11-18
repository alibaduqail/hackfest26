import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DESCENT_LEVELS } from "./descent-levels";
import { validateMission } from "./missions";

test("DESCENT_LEVELS: three levels, each a valid mission whose stored solution is worth 3 stars within budget", () => {
  assert.equal(DESCENT_LEVELS.length, 3);
  assert.deepEqual(DESCENT_LEVELS.map((l) => l.id), ["descent-live", "descent-live-2", "descent-live-3"]);
  assert.equal(new Set(DESCENT_LEVELS.map((l) => l.id)).size, 3, "unique ids");
  for (const level of DESCENT_LEVELS) {
    const m = level.build();
    assert.deepEqual(validateMission(m), [], `${level.id}: invalid mission`);
    assert.ok(level.lesson.length > 0, `${level.id}: lesson text`);
    assert.deepEqual(level.goals.map((g) => g.stars), [1, 2, 3], `${level.id}: goals in order`);
    assert.ok(level.solution.length <= m.beaconBudget!, `${level.id}: solution fits its budget`);
    const e = createEngine(m, "echo");
    const acts = level.solution.map((c) => e.act(c));
    assert.ok(acts.every((a) => a.ok), `${level.id}: solution commands are all accepted`);
    e.step(m.endTick);
    const pods = e.observe().pods;
    const by = (id: string, t: number) => (pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
    const top = level.goals[level.goals.length - 1];
    assert.ok(by("MED-1", top.maraBy), `${level.id}: solution meets the top Mara deadline`);
    if (top.medicineBy !== undefined) assert.ok(by("SUP-3", top.medicineBy), `${level.id}: solution meets the top medicine deadline`);
  }
});

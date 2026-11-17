import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../../echo/engine";
import { towerDown } from "../../echo/missions";
import { lane, makeProjection, sectorAt } from "../map";
import { CAMPAIGN, objective, starsFor, staticObs, verdict } from "./campaign";
import { hasSeen, isUnlocked, loadProgress, markSeen, saveStars } from "./progress";

test("Tower Down earns its stars from a real run", () => {
  const m = towerDown();
  const [echo, normal] = (["echo", "normal"] as const).map((mode) => { const e = createEngine(m, mode); e.step(m.endTick); return e.observe(); });
  assert.equal(starsFor(CAMPAIGN[0], echo, normal), 3, "Echo earns all three Tower Down stars");
  assert.equal(objective({ all: [{ what: "mara", by: 100 }] }).met(echo, normal), false, "a deadline before Mara's arrival misses");
  const tower = createEngine(m, "tower"); tower.step(m.endTick);
  assert.equal(starsFor(CAMPAIGN[0], tower.observe(), normal), 0, "the Directorate alone earns nothing");
});

test("progress works with storage missing, keeps the best, unlocks in order", () => {
  const ids = CAMPAIGN.map((c) => c.id);
  assert.equal(isUnlocked(ids, 0, loadProgress()), true);
  assert.equal(isUnlocked(ids, 1, loadProgress()), false);
  saveStars("tower-down", 2);
  saveStars("tower-down", 1); // a worse retry does not lower it
  assert.equal(loadProgress()["tower-down"], 2);
  assert.equal(isUnlocked(ids, 1, loadProgress()), true);
  assert.equal(isUnlocked(ids, 2, loadProgress()), false);
  assert.equal(hasSeen(loadProgress(), "prologue"), false);
  markSeen("prologue");
  assert.equal(hasSeen(loadProgress(), "prologue"), true, "the prologue shows once");
});

test("sectorAt picks the lane under the cursor, per direction", () => {
  const obs = staticObs(towerDown());
  const project = makeProjection(obs, 1200, 800);
  for (const s of obs.sectors.slice(0, 20)) {
    const [a, b] = lane(project, s);
    assert.equal(sectorAt(obs, 1200, 800, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), s.id);
  }
  assert.equal(sectorAt(obs, 1200, 800, -50, -50), null);
});

test("a late Mara earns 0 stars and the debrief says when she arrived, never 'never'", () => {
  const m = towerDown();
  const [echo, normal] = (["echo", "normal"] as const).map((mode) => { const e = createEngine(m, mode); e.step(m.endTick); return e.observe(); });
  const late = { ...echo, pods: echo.pods.map((p) => (p.id === "MED-1" ? { ...p, status: "arrived" as const, arriveTick: 167 } : p)) };
  const dz = CAMPAIGN[1];
  assert.equal(starsFor(dz, late, normal), 0, "t+167 misses the minute-160 deadline");
  assert.match(verdict(late, normal), /^Mara arrived at minute 167\./);
  assert.doesNotMatch(`${dz.verdicts?.[0]} ${verdict(late, normal)}`, /never/i);
  const lost = { ...echo, pods: echo.pods.map((p) => (p.id === "MED-1" ? { ...p, status: "lost" as never, arriveTick: null } : p)) };
  assert.match(verdict(lost, normal), /^Mara never arrived\./);
});

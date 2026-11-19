import assert from "node:assert/strict";
import { test } from "node:test";
import { playRun, runBaseline } from "./baseline";
import { DESCENT_LEVELS } from "./descent-levels";
import { createEngine } from "./engine";
import { MISSIONS } from "./missions";
import { STANDBY_AFTER } from "./tower";
import { CARGO_LABEL, themeLabel } from "./theme-labels";

const mission = (i: number) => DESCENT_LEVELS[i].build();

test("standby: the tower fails, then a backup comes online STANDBY_AFTER minutes later, once", () => {
  const m = mission(0);
  const e = createEngine(m, "standby");
  const up: boolean[] = [];
  for (let t = 0; t < m.towerDownAt + STANDBY_AFTER + 10; t++) (e.step(), up.push(e.observe().towerUp));
  assert.equal(up[m.towerDownAt - 1], true); // before the primary fails (observed after the step of that tick)
  assert.equal(up[m.towerDownAt + 1], false); // primary down
  assert.equal(up[m.towerDownAt + STANDBY_AFTER + 2], true); // backup up
  const flips = up.filter((v, i) => i > 0 && v !== up[i - 1]).length;
  assert.equal(flips, 2); // up -> down -> up: the primary does not fail a second time
  assert.equal(e.observe().log.filter((l) => l.kind === "tower-down").length <= 1, true);
});

test("standby on every Descent level: central, so the nurse is cleared into the sealed shaft and never arrives", () => {
  for (const [i, l] of DESCENT_LEVELS.entries()) {
    const b = runBaseline(l.build(), l.solution);
    assert.equal(b.standby.mara, null, `${l.id} mara`);
    assert.equal(b.standby.medicine, null, `${l.id} medicine`);
    assert.equal(b.standby.atSeal, true, `${l.id} waits at the seal`);
    assert.equal(b.standby.stars, 0);
    assert.equal(b.you.stars, 3, `${l.id} you`); // the same run with beacons succeeds
    assert.match(b.standbySays, new RegExp(`Backup tower: back at minute ${mission(i).towerDownAt + STANDBY_AFTER}, but it is still central and cannot carry the flood news\\. Mara was cleared into the sealed shaft and never arrives\\.`));
  }
});

test("standby is deterministic and refuses beacons (central towers have none)", () => {
  const m = mission(1);
  assert.deepEqual(playRun(m, "standby"), playRun(m, "standby"));
  const e = createEngine(m, "standby");
  assert.equal(e.act({ type: "placeBeacon", sectorId: "link0", atTick: 0 }).ok, false);
});

test("the backup tower really clears flights again: it grants after it returns", () => {
  const m = mission(0);
  const o = playRun(m, "standby");
  const grants = o.log.filter((l) => l.kind === "grant");
  assert.ok(grants.some((g) => g.tick >= m.towerDownAt + STANDBY_AFTER), "no grant after the backup came online");
  assert.ok(grants.every((g) => g.tick < m.towerDownAt || g.tick >= m.towerDownAt + STANDBY_AFTER), "a grant while both towers were down");
});

test("tower mode is still deterministic on the original missions (the observation-hash comparison against main is done by script, see the PR)", () => {
  for (const mk of MISSIONS) {
    const m = mk.build();
    const t = playRun(m, "tower");
    const u = playRun(m, "tower");
    assert.deepEqual(t, u);
  }
});

test("theme labels: cargo gets Hollow words, everything else is unchanged", () => {
  assert.equal(themeLabel({ label: "SUP-1 · water", cargo: "water" }), "SUP-1 · Recycled water");
  assert.equal(themeLabel({ label: "SUP-8 · food", cargo: "food" }), "SUP-8 · Lamp-farm harvest");
  assert.equal(themeLabel({ label: "SUP-3 · medicine", cargo: "medicine" }), "SUP-3 · Lung-sickness medicine");
  assert.equal(themeLabel({ label: "MED-1 · Nurse Mara Vale" }), "MED-1 · Nurse Mara Vale");
  assert.equal(themeLabel({ label: "PAX-1 · Passenger" }), "PAX-1 · Passenger");
  assert.equal(themeLabel({ label: "SUP-9 · custom", cargo: "water" }), "SUP-9 · custom"); // only the plain cargo word is replaced
  for (const k of Object.keys(CARGO_LABEL)) assert.ok(CARGO_LABEL[k as keyof typeof CARGO_LABEL].length < 28);
});

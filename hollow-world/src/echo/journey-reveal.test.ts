// The journey hands the engine the leg's reveal and attempt: trusting the tower on camp 1 means leg 2 shows no flood sector before it seals.
import test from "node:test";
import assert from "node:assert/strict";
import { floodCandidate } from "./descent-levels";
import { createEngine } from "./engine";
import { choose, completeLeg, currentLeg, startJourney, type JourneyState, type LegResult } from "./journey";

const SEEDS = [34, 7, 1234, 20261119, 987654321];
const win = (legId: LegResult["legId"]): LegResult => ({ legId, stars: 3, maraAt: 80, medicineAt: 85, beaconsPlaced: 4, ticks: 85 });
const atCamp1 = (seed: number): JourneyState => completeLeg(choose(startJourney(seed), "leave-now"), win("descent1"));
const atLeg3 = (seed: number): JourneyState => choose(completeLeg(choose(atCamp1(seed), "verify-beacons"), win("descent2")), "check-credential");

/** Every tick of the first-flood approach: which sectors the observation names as flooding, and whether it is already sealed. */
function named(s: JourneyState) {
  const m = currentLeg(s).mission;
  const e = createEngine(m, "echo");
  const first = m.sealAt!;
  const seen: { tick: number; sectors: string[]; sealed: boolean }[] = [];
  for (let t = 0; t <= first + 1; t++) {
    const o = e.observe();
    seen.push({ tick: o.tick, sectors: (o.floodWarnings ?? []).flatMap((w) => (w.sectorId ? [w.sectorId] : [])), sealed: o.sectors.some((x) => x.sealed && x.id === m.sealSectorId) });
    e.step();
  }
  return { m, seen, first };
}

test("trust the tower: leg 2 has no advance reveal, and no seal sector shows before the seal tick (any seed)", () => {
  for (const seed of SEEDS) {
    const trust = choose(atCamp1(seed), "trust-tower");
    assert.equal(trust.pending.revealLead, 0);
    const { m, seen, first } = named(trust);
    assert.equal(m.floodReveal?.lead, 0);
    for (const row of seen.filter((r) => r.tick <= first)) assert.deepEqual(row.sectors, [], `seed ${seed}: nothing named at t${row.tick}`);
    assert.equal(seen[seen.length - 1].sealed, true, "the seal itself is the first sign");
    assert.equal(seen.find((r) => r.tick < first)?.sealed, false);
  }
});

test("verify through the beacons: leg 2 telegraphs its first flood 8 ticks ahead (any seed)", () => {
  for (const seed of SEEDS) {
    const { m, seen, first } = named(choose(atCamp1(seed), "verify-beacons"));
    assert.equal(m.floodReveal?.lead, 8);
    assert.deepEqual(seen.find((r) => r.tick === first - 9)?.sectors, [], `seed ${seed}`);
    assert.deepEqual(seen.find((r) => r.tick === first - 8)?.sectors, [m.sealSectorId], `seed ${seed}`);
  }
});

test("leg 3 telegraphs 8 ticks ahead on every seeded candidate", () => {
  for (const seed of SEEDS) {
    const { m, seen, first } = named(atLeg3(seed));
    assert.deepEqual(seen.find((r) => r.tick === first - 9)?.sectors, [], `seed ${seed}`);
    assert.deepEqual(seen.find((r) => r.tick === first - 8)?.sectors, [m.sealSectorId], `seed ${seed}`);
  }
});

test("leg 1 is always the teaching flood; later legs draw theirs from the seed; a retry faces the same one (star deadlines never shift)", () => {
  assert.deepEqual([...new Set(SEEDS.map((seed) => floodCandidate(0, { seed, attempt: 0 })))], [0], "leg 1 ignores the seed");
  assert.ok(new Set(SEEDS.map((seed) => floodCandidate(1, { seed, attempt: 0 }))).size > 1, "different seeds draw different leg 2 floods");
  for (const seed of SEEDS) {
    const failed = completeLeg(choose(startJourney(seed), "leave-now"), { legId: "descent1", stars: 0, maraAt: null, medicineAt: null, beaconsPlaced: 0, ticks: 70 });
    const first = currentLeg(choose(startJourney(seed), "leave-now")).mission;
    const again = currentLeg(choose(failed, "retry")).mission;
    assert.equal(again.sealSectorId, first.sealSectorId, `seed ${seed}: the retry's flood is the same`);
  }
});

// The journey hands the engine the leg's reveal and attempt: trusting the tower on camp 1 means leg 2 shows no flood sector before it seals.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { choose, completeLeg, currentLeg, startJourney, type JourneyState, type LegResult } from "./journey";

const win = (legId: LegResult["legId"]): LegResult => ({ legId, stars: 3, maraAt: 80, medicineAt: 85, beaconsPlaced: 4, ticks: 85 });
const atCamp1 = (): JourneyState => completeLeg(choose(startJourney(), "leave-now"), win("descent1"));

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

test("trust the tower: leg 2 has no advance reveal, and no seal sector shows before the seal tick", () => {
  const trust = choose(atCamp1(), "trust-tower");
  assert.equal(trust.pending.revealLead, 0);
  const { m, seen, first } = named(trust);
  assert.equal(m.floodReveal?.lead, 0);
  for (const row of seen.filter((r) => r.tick <= first)) assert.deepEqual(row.sectors, [], `nothing named at t${row.tick}`);
  assert.equal(seen[seen.length - 1].sealed, true, "the seal itself is the first sign");
  assert.equal(seen.find((r) => r.tick < first)?.sealed, false);
});

test("verify through the beacons: leg 2 telegraphs its first flood 8 ticks ahead", () => {
  const { m, seen, first } = named(choose(atCamp1(), "verify-beacons"));
  assert.equal(m.floodReveal?.lead, 8);
  assert.deepEqual(seen.find((r) => r.tick === first - 9)?.sectors, []);
  assert.deepEqual(seen.find((r) => r.tick === first - 8)?.sectors, [m.sealSectorId]);
});

test("a retried leg 1 draws its flood from the attempt (candidate 0 first)", () => {
  const first = currentLeg(choose(startJourney(), "leave-now")).mission;
  const failed = completeLeg(choose(startJourney(), "leave-now"), { legId: "descent1", stars: 0, maraAt: null, medicineAt: null, beaconsPlaced: 0, ticks: 70 });
  const again = currentLeg(choose(failed, "retry")).mission;
  assert.equal(first.sealSectorId, "main1");
  assert.ok(["main0", "main1", "main2"].includes(again.sealSectorId!));
});

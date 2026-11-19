// Seeded flood candidates for all three live levels (#117): the pick, the stars, the blind average and the reaction after the telegraph.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DEFAULT_REVEAL_LEAD, DESCENT_LIVE_CANDIDATES, descentLive, descentLiveStars, levelOpts, mulberry32, pickFlood, starsFor } from "./descent";
import { DESCENT_LEVELS, floodCandidate } from "./descent-levels";
import { DESCENT_LIVE_CANDIDATES_2, DESCENT_LIVE_SOLUTION_2, DESCENT_LIVE_SOLUTIONS_2, descentLive2, descentLiveStars2 } from "./descent2";
import { DESCENT_LIVE_CANDIDATES_3, DESCENT_LIVE_SOLUTIONS_3, descentLive3, descentLiveStars3 } from "./descent3";
import type { Command, Mission, Observation } from "./types";

const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });
const play = (m: Mission, cmds: Command[], until = m.endTick): Observation => {
  const e = createEngine(m, "echo");
  for (const c of cmds) assert.ok(e.act(c).ok, JSON.stringify(c));
  e.step(until);
  return e.observe();
};

test("mulberry32 is deterministic and in [0, 1)", () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 50; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test("pickFlood: deterministic, consecutive attempts never repeat, every candidate comes up, seeds differ", () => {
  for (const n of [2, 3]) {
    for (const seed of [1, 7, 20261119, 123456789, -5]) {
      const seq = [...Array(60).keys()].map((attempt) => pickFlood(0, n, { seed, attempt }));
      assert.deepEqual(seq, [...Array(60).keys()].map((attempt) => pickFlood(0, n, { seed, attempt })));
      seq.slice(1).forEach((c, i) => assert.notEqual(c, seq[i], `n=${n} seed=${seed} attempts ${i} and ${i + 1} picked the same flood`));
      assert.equal(new Set(seq).size, n);
      assert.ok(seq.every((c) => c >= 0 && c < n));
    }
  }
  const firsts = new Set([...Array(40).keys()].map((seed) => pickFlood(0, 3, { seed: seed * 7919, attempt: 0 })));
  assert.equal(firsts.size, 3, "attempt 0 depends on the seed");
  const level = (l: number) => [...Array(12).keys()].map((a) => pickFlood(l, 3, { seed: 99, attempt: a }));
  assert.notDeepEqual(level(0), level(1), "levels draw independently");
});

test("no seed means candidate 0 first (back-compat), and the chain still never repeats", () => {
  assert.equal(pickFlood(0, 3), 0);
  assert.equal(pickFlood(0, 3, { attempt: 0 }), 0);
  assert.equal(levelOpts(0).seed, undefined);
  for (const l of DESCENT_LEVELS.keys()) {
    assert.equal(floodCandidate(l), 0);
    const seq = [...Array(30).keys()].map((attempt) => floodCandidate(l, { attempt }));
    seq.slice(1).forEach((c, i) => assert.notEqual(c, seq[i]));
    assert.equal(new Set(seq).size, DESCENT_LEVELS[l].candidates.length);
  }
  assert.equal(descentLive().sealSectorId, DESCENT_LIVE_CANDIDATES[0].sectorId);
  assert.equal(DESCENT_LEVELS[0].solutionFor(), DESCENT_LIVE_CANDIDATES[0].solution);
  assert.equal(DESCENT_LEVELS[1].solution, DESCENT_LIVE_SOLUTION_2);
});

test("builders, goalsFor, solutionFor and the stars helpers all resolve { seed, attempt } the same way", () => {
  const builders = [descentLive, descentLive2, descentLive3];
  const starsOf = [descentLiveStars, descentLiveStars2, descentLiveStars3];
  DESCENT_LEVELS.forEach((lv, li) => {
    for (const seed of [3, 11, 20261119])
      for (let attempt = 0; attempt < 6; attempt++) {
        const o = { seed, attempt };
        const ci = floodCandidate(li, o);
        const c = lv.candidates[ci];
        const m = builders[li](o);
        assert.equal(m.sealSectorId, c.sectorId);
        assert.equal(m.sealAt, c.at);
        assert.deepEqual(m.seals, c.seals);
        assert.equal(lv.goalsFor(o), c.goals);
        assert.equal(lv.solutionFor(o), c.solution);
        const done = play(m, c.solution);
        assert.equal(starsOf[li](done.pods, o), 3);
        assert.equal(starsFor(c.goals, done.pods), 3);
      }
  });
  // the old numeric attempt still works
  assert.equal(descentLive(4).sealSectorId, DESCENT_LIVE_CANDIDATES[floodCandidate(0, 4)].sectorId);
});

for (const [li, name, cands, solutions] of [
  [1, "Descent II", DESCENT_LIVE_CANDIDATES_2, DESCENT_LIVE_SOLUTIONS_2],
  [2, "Descent III", DESCENT_LIVE_CANDIDATES_3, DESCENT_LIVE_SOLUTIONS_3],
] as const) {
  const lv = DESCENT_LEVELS[li];
  const attemptOf = (ci: number) => [...Array(200).keys()].find((attempt) => floodCandidate(li, { attempt }) === ci)!;
  const run = (ci: number, cmds: Command[]) => starsFor(cands[ci].goals, play(lv.build(attemptOf(ci)), cmds).pods);

  test(`${name}: 2-3 candidates, candidate 0 is the original flood, ids map to stored runs`, () => {
    assert.ok(cands.length >= 2 && cands.length <= 3);
    assert.equal(cands[0].goals, lv.goals);
    assert.equal(cands[0].solution, lv.solution);
    assert.deepEqual(Object.keys(solutions), cands.map((c) => c.id));
    assert.equal(new Set(cands.map((c) => JSON.stringify([c.sectorId, c.seals]))).size, cands.length, "candidates differ");
  });

  test(`${name}: every candidate's stored run is 3 stars within budget and places at least one beacon after a telegraph`, () => {
    cands.forEach((c, ci) => {
      const m = lv.build(attemptOf(ci));
      assert.equal(run(ci, c.solution), 3, c.id);
      assert.ok(c.solution.length <= m.beaconBudget!);
      const floods = [{ at: c.at }, ...(c.seals ?? [])];
      const late = c.solution.filter((x) => floods.some((f) => (x as { atTick: number }).atTick >= f.at - DEFAULT_REVEAL_LEAD));
      assert.ok(late.length >= 1, `${c.id}: reacts after a telegraph`);
    });
  });

  test(`${name}: placing everything at t0 averages at most 1 star across the candidates`, () => {
    let total = 0;
    for (const mine of cands) {
      const t0 = mine.solution.map((x) => place((x as { sectorId: string }).sectorId, 0));
      cands.forEach((_, j) => (total += run(j, t0)));
    }
    assert.ok(total / (cands.length * cands.length) <= 1, `memorised-run average ${total / (cands.length * cands.length)}`);
    // lighting every main-shaft sector blind (and the junction/links) is no better
    const dark = lv.build().world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
    const mains = dark.filter((id) => /^main/.test(id));
    for (const extra of [[], ["trunk0"], ["link0", "link1"], dark.filter((id) => /^byp/.test(id)).slice(0, 2)]) {
      const set = [...mains, ...extra.filter((id) => dark.includes(id))].slice(0, lv.build().beaconBudget!);
      const avg = cands.reduce((n, _, j) => n + run(j, set.map((id) => place(id, 0))), 0) / cands.length;
      assert.ok(avg <= 1, `blanket ${set.join(" ")}: ${avg}`);
    }
    // and no stored run earns anything against a different flood
    cands.forEach((mine, i) => cands.forEach((_, j) => i !== j && assert.equal(run(j, mine.solution.map((x) => place((x as { sectorId: string }).sectorId, 0))), 0, `${mine.id} on ${cands[j].id}`)));
  });

  test(`${name}: revealLead 0 hides every telegraph for every candidate; the default shows each flood ${DEFAULT_REVEAL_LEAD} ticks ahead`, () => {
    cands.forEach((c, ci) => {
      const seals = [{ sectorId: c.sectorId, at: c.at }, ...(c.seals ?? [])];
      const hidden = lv.build({ attempt: attemptOf(ci), revealLead: 0 });
      const shown = lv.build({ attempt: attemptOf(ci) });
      const hid = createEngine(hidden, "echo");
      const sho = createEngine(shown, "echo");
      for (const t of c.solution.filter((x) => (x as { atTick: number }).atTick < 20)) { hid.act(t); sho.act(t); } // early beacons keep the run alive
      for (let tick = 1; tick <= seals[seals.length - 1].at; tick++) {
        hid.step();
        sho.step();
        for (const w of hid.observe().floodWarnings!) assert.ok(w.sectorId === undefined && w.at === undefined, `${c.id} t${tick}: revealLead 0 leaked ${JSON.stringify(w)}`);
      }
      for (const s of seals) {
        const e = createEngine(shown, "echo");
        for (const t of c.solution) e.act(t);
        e.step(s.at - DEFAULT_REVEAL_LEAD - 1);
        assert.ok(!e.observe().floodWarnings!.some((w) => w.sectorId === s.sectorId), `${c.id}: ${s.sectorId} hidden before its window`);
        e.step();
        assert.ok(e.observe().floodWarnings!.some((w) => w.sectorId === s.sectorId && w.at === s.at), `${c.id}: ${s.sectorId} named at t${s.at - DEFAULT_REVEAL_LEAD}`);
      }
    });
  });
}

test("Descent II: flood B stays a mid-run surprise in every candidate (first shown revealLead ticks before its seal, not at all with 0)", () => {
  DESCENT_LIVE_CANDIDATES_2.forEach((c, ci) => {
    const m = descentLive2({ attempt: [...Array(200).keys()].find((a) => floodCandidate(1, { attempt: a }) === ci)!, revealLead: 0 });
    assert.equal(m.seals![0].at, 55);
    const e = createEngine(m, "echo");
    for (const t of c.solution.filter((x) => (x as { atTick: number }).atTick < 30)) e.act(t);
    e.step(54);
    const o = e.observe();
    assert.ok(!o.floodWarnings!.some((w) => w.sectorId === m.seals![0].sectorId));
    assert.equal(o.sectors.find((s) => s.id === m.seals![0].sectorId)!.sealed, false);
  });
});

test("50 consecutive attempts across several seeds never repeat a flood, on every level, and no candidate dominates", () => {
  DESCENT_LEVELS.forEach((lv, li) => {
    for (const seed of [1, 2, 3, 99, 20261119, 4242424242]) {
      const seq = [...Array(50).keys()].map((attempt) => floodCandidate(li, { seed, attempt }));
      seq.slice(1).forEach((c, i) => assert.notEqual(c, seq[i], `level ${li} seed ${seed}: attempts ${i} and ${i + 1} share candidate ${c}`));
      const counts = lv.candidates.map((_, c) => seq.filter((x) => x === c).length);
      assert.ok(Math.min(...counts) >= 8, `level ${li} seed ${seed}: ${counts}`);
    }
  });
});

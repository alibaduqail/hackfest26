import assert from "node:assert/strict";
import { test } from "node:test";
import { playRun } from "./baseline";
import { DESCENT_LEVELS } from "./descent-levels";
import { campEvent, choose, completeLeg, currentLeg, ending, lastReveal, LIMIT, startJourney, type JourneyState, type LegResult } from "./journey";
import { LEGS } from "./journey-events";
import type { Command } from "./types";

const place = (ids: string[], atTick = 0): Command[] => ids.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick }));
const idx = (s: JourneyState) => s.legIndex;

/** Play the current leg on the real engine with up to `budget` commands, and report it the way the screen will. */
function play(s: JourneyState, cmds: Command[]): LegResult {
  const { legId, mission } = currentLeg(s);
  const goals = DESCENT_LEVELS[idx(s)].goals;
  const placed = cmds.slice(0, mission.beaconBudget ?? 0);
  const o = playRun(mission, "echo", placed);
  const hold = o.log.find((l) => l.kind === "hold" && l.podId === "MED-1")?.tick;
  const stars = goals.reduce<0 | 1 | 2 | 3>((n, g) => (o.mara !== null && o.mara <= g.maraBy && (g.medicineBy === undefined || (o.medicine !== null && o.medicine <= g.medicineBy)) ? g.stars : n), 0);
  return { legId, stars, maraAt: o.mara, medicineAt: o.medicine, beaconsPlaced: placed.length, ticks: o.mara ?? hold ?? mission.endTick };
}
const solution = (s: JourneyState) => DESCENT_LEVELS[idx(s)].solution;
const warn = (s: JourneyState) => place(LEGS[idx(s)].minWin);

/** A scripted journey: choice per camp (by event order) + a command policy per attempt. */
function run(choices: string[], cmds: (s: JourneyState, attempt: number) => Command[]): JourneyState {
  let s = startJourney();
  const picks = [...choices];
  for (let guard = 0; guard < 30 && s.phase !== "ending"; guard++) {
    if (s.phase === "camp") s = choose(s, picks.shift() ?? "retry");
    else s = completeLeg(s, play(s, cmds(s, s.attempt)));
  }
  return s;
}

test("the engine agrees with the minimum winning sets: the warning chain is worth a star, one beacon less is not", () => {
  const s0 = startJourney();
  for (let i = 0; i < 3; i++) {
    const s = { ...s0, legIndex: i, phase: "leg" as const };
    assert.ok(play(s, warn(s)).stars >= 1, `leg ${i} warning only`);
    assert.equal(play(s, warn(s).slice(1)).stars, 0, `leg ${i} missing a warning beacon`);
  }
});

test("a decent journey (outfit beacons, the known solutions, verify, check the credential) is Saved at 272 minutes", () => {
  const s = run(["extra-beacons", "verify-beacons", "check-credential"], solution);
  const e = ending(s);
  assert.equal(s.res.clock, 83 + 111 + 78);
  assert.equal(s.res.beacons, 0); // 15 + 4 - (5 + 1 + 7 + 6): exactly enough, so every beacon matters
  assert.equal(e.kind, "saved");
  assert.equal(e.title, "The clinic is supplied");
  assert.ok(e.score > 900, String(e.score));
  assert.ok(e.lines.some((l) => /Descent I: ★★★ · Mara at minute 83 · 0 retries/.test(l)));
  assert.ok(e.lines.some((l) => /^Without the beacons, Mara never leaves level \d\./.test(l)));
});

test("a mediocre journey (warning beacons only, 1 star each) still gets Saved, with a lower score", () => {
  const s = run(["leave-now", "verify-beacons", "check-credential"], warn);
  assert.equal(ending(s).kind, "saved");
  assert.ok(ending(s).score < ending(run(["extra-beacons", "verify-beacons", "check-credential"], solution)).score);
});

test("a careless journey (two failures, then trusting the tower) ends Too late", () => {
  const s = run(["leave-now", "retry", "retry", "trust-tower", "yield"], (st, attempt) => (st.legIndex === 0 && attempt < 2 ? [] : solution(st)));
  assert.equal(ending(s).kind, "late");
  assert.ok(s.res.clock > LIMIT);
  assert.ok(s.log.filter((e) => e.kind === "leg" && e.result.stars === 0).length >= 2); // and the lost beacons make the later legs harder: the careless run spirals
});

test("failure cost: clock += ticks + 15, placed beacons lost, -1 dose, retry the same leg from a retry camp", () => {
  let s = choose(startJourney(), "extra-medicine"); // 13 beacons, 8 doses
  const before = s.res;
  const r = play(s, place(["link0", "link1", "link2"])); // 3 route beacons, no warning: Mara is trapped
  assert.equal(r.stars, 0);
  s = completeLeg(s, r);
  assert.deepEqual(s.res, { beacons: before.beacons - 3, clock: before.clock + r.ticks + 15, doses: before.doses - 1 });
  assert.equal(s.phase, "camp");
  assert.equal(s.attempt, 1);
  assert.equal(s.legIndex, 0);
  assert.equal(campEvent(s).id, "retry-descent1");
  s = choose(s, "retry");
  assert.equal(s.phase, "leg");
  assert.equal(currentLeg(s).legId, "descent1");
});

test("soft-lock guard: Scavenge appears below the smallest winning set, stays in camp, and repeats until you can win", () => {
  let s: JourneyState = { ...startJourney(), legIndex: 1, phase: "camp", res: { beacons: 1, clock: 100, doses: 3 } }; // leg 2 needs 4
  assert.ok(campEvent(s).choices.some((c) => c.id === "scavenge"));
  s = choose(s, "scavenge");
  assert.deepEqual([s.phase, s.res.beacons, s.res.clock], ["camp", 3, 125]);
  assert.ok(campEvent(s).choices.some((c) => c.id === "scavenge")); // 3 < 4: still stuck
  s = choose(s, "scavenge");
  assert.equal(s.res.beacons, 5);
  assert.ok(!campEvent(s).choices.some((c) => c.id === "scavenge"));
  assert.equal(choose(s, "verify-beacons").phase, "leg");
  // and a retry camp offers it too
  const failed = completeLeg({ ...startJourney(), phase: "leg", res: { beacons: 1, clock: 0, doses: 6 } }, { legId: "descent1", stars: 0, maraAt: null, medicineAt: null, beaconsPlaced: 1, ticks: 70 });
  assert.ok(campEvent(failed).choices.some((c) => c.id === "scavenge"));
});

test("tower lie: Trust sets revealLead 0 for leg 2 only; Verify leaves the normal reveal", () => {
  const base = (id: string) => {
    let s = choose(startJourney(), "leave-now");
    s = completeLeg(s, play(s, solution(s)));
    assert.equal(campEvent(s).id, "tower-lies");
    return choose(s, id);
  };
  let s = base("trust-tower");
  assert.equal(currentLeg(s).mods.revealLead, 0);
  assert.match(lastReveal(s)!, /tower was wrong/);
  s = completeLeg(s, play(s, solution(s)));
  s = choose(s, "check-credential");
  assert.equal(currentLeg(s).mods.revealLead, undefined); // leg 3 is normal again
  const v = base("verify-beacons");
  assert.equal(currentLeg(v).mods.revealLead, undefined);
  assert.match(lastReveal(v)!, /beacons knew/);
});

test("leg budget is min(leg cap, beacons carried) and goes into the mission", () => {
  const s = choose(startJourney(), "leave-now");
  assert.deepEqual([currentLeg(s).mods.budget, currentLeg(s).mission.beaconBudget], [5, 5]);
  const poor = { ...s, res: { ...s.res, beacons: 3 } };
  assert.deepEqual([currentLeg(poor).mods.budget, currentLeg(poor).mission.beaconBudget], [3, 3]);
});

test("deterministic: the same seed and choices replay to the same state; pure functions do not mutate", () => {
  const a = run(["extra-beacons", "verify-beacons", "check-credential"], solution);
  const b = run(["extra-beacons", "verify-beacons", "check-credential"], solution);
  assert.deepEqual(a, b);
  const s0 = startJourney();
  const snap = JSON.stringify(s0);
  choose(s0, "extra-beacons");
  assert.equal(JSON.stringify(s0), snap);
  assert.deepEqual(campEvent(startJourney(7)), campEvent(startJourney(7)));
  assert.equal(choose(s0, "no-such-choice"), s0);
});

test("both endings are reachable, including running out of doses", () => {
  assert.equal(ending(run(["extra-beacons", "verify-beacons", "check-credential"], solution)).kind, "saved");
  assert.equal(ending(run(["leave-now", "retry", "retry", "retry", "retry", "retry", "retry", "trust-tower", "yield"], (st, a) => (st.legIndex === 0 && a < 6 ? [] : solution(st)))).kind, "late");
  const noDoses = { ...run(["extra-beacons", "verify-beacons", "check-credential"], solution) };
  noDoses.res = { ...noDoses.res, doses: 0 };
  assert.equal(ending(noDoses).kind, "late");
  assert.equal(ending(noDoses).title, "The medicine ran out");
});

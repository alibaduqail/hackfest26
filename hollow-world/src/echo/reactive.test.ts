// The reactive live Descent: late flood reveal, seeded flood location, beacon build delay, early end (#101).
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import {
  BEACON_BUILD_TICKS, DEFAULT_REVEAL_LEAD, DESCENT_LIVE_CANDIDATES as C, DESCENT_LIVE_GOALS, DESCENT_LIVE_SOLUTION, DESCENT_LIVE_SOLUTIONS,
  descentLive, descentLiveCandidateIndex, descentLiveStars, starsFor,
} from "./descent";
import { DESCENT_LEVELS } from "./descent-levels";
import { descentLive2 } from "./descent2";
import { descentLive3 } from "./descent3";
import { MISSIONS } from "./missions";
import type { Command, Mission, Observation } from "./types";

const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });
const attemptOf = (ci: number) => [...Array(500).keys()].find((a) => descentLiveCandidateIndex(a) === ci)!;
const play = (m: Mission, cmds: Command[], until = m.endTick) => {
  const e = createEngine(m, "echo");
  for (const c of cmds) assert.ok(e.act(c).ok, JSON.stringify(c));
  e.step(until);
  return e.observe();
};
const arrive = (o: Observation, id: string) => o.pods.find((p) => p.id === id)!.arriveTick;
const warnings = (m: Mission, cmds: Command[], tick: number) => play(m, cmds, tick).floodWarnings;

test("reveal timing: only the risk before the window, the sector and minute inside it", () => {
  const m = descentLive(); // main1 at t41, default lead 8
  assert.equal(m.floodReveal!.lead, DEFAULT_REVEAL_LEAD);
  assert.deepEqual(warnings(m, [], 0), [{ risk: "flood risk: main shaft" }]);
  assert.deepEqual(warnings(m, [], 32), [{ risk: "flood risk: main shaft" }], "t32: still hidden (the window opens 8 ticks before t41)");
  assert.deepEqual(warnings(m, [], 33), [{ risk: "flood risk: main shaft", sectorId: "main1", at: 41 }], "t33: sector and minute appear");
  assert.deepEqual(warnings(m, [], 40), [{ risk: "flood risk: main shaft", sectorId: "main1", at: 41 }]);
  assert.deepEqual(warnings(m, [], 41), [{ risk: "flood risk: main shaft", sectorId: "main1", at: 41 }], "the seal fires in the step of tick 41: the observation at tick 41 is still unsealed");
  assert.equal(play(m, [], 41).sectors.find((s) => s.id === "main1")!.sealed, false);
  assert.deepEqual(warnings(m, [], 42), [], "once sealed, sector.sealed and the log carry it");
  assert.equal(play(m, [], 42).sectors.find((s) => s.id === "main1")!.sealed, true);
});

test("revealLead: default 8, a custom lead moves the window, 0 never reveals before the seal", () => {
  const at = (opts: Parameters<typeof descentLive>[0], tick: number) => warnings(descentLive(opts), [], tick)![0];
  assert.equal(at({ revealLead: 3 }, 37)?.sectorId, undefined);
  assert.equal(at({ revealLead: 3 }, 38)?.sectorId, "main1");
  assert.equal(at({ revealLead: 12 }, 29)?.sectorId, "main1");
  for (let t = 0; t <= 41; t++) assert.deepEqual(at({ revealLead: 0 }, t), { risk: "flood risk: main shaft" }, `t${t}: revealLead 0 shows only the risk`);
  const m0 = descentLive({ revealLead: 0 });
  assert.equal(m0.floodReveal!.lead, 0);
  assert.deepEqual(warnings(m0, [], 42), [], "the seal itself is first visible when it fires");
  // a bare number is the attempt, defaults to 0 and keeps the default reveal
  assert.deepEqual(descentLive(0).floodReveal, descentLive().floodReveal);
  assert.equal(descentLive({ attempt: 0 }).sealSectorId, descentLive().sealSectorId);
});

test("revealLead applies to levels 2 and 3 too (and every DESCENT_LEVELS builder)", () => {
  assert.equal(descentLive2().floodReveal!.lead, 8);
  assert.equal(descentLive3({ revealLead: 0 }).floodReveal!.lead, 0);
  for (const l of DESCENT_LEVELS) {
    assert.equal(l.build().floodReveal!.lead, DEFAULT_REVEAL_LEAD, l.id);
    assert.equal(l.build({ revealLead: 0 }).floodReveal!.lead, 0, l.id);
    assert.equal(l.build({ revealLead: 5 }).beaconBuildTicks, BEACON_BUILD_TICKS, l.id);
    assert.equal(l.build().earlyEnd, true, l.id);
  }
  // level 3: telegraph names main1 at t40 (seal t48)
  assert.deepEqual(warnings(descentLive3(), [], 39), [{ risk: "flood risk: main shaft" }]);
  assert.equal(warnings(descentLive3(), [], 40)![0].sectorId, "main1");
});

test("build delay: a placed beacon is 'building' for 2 ticks, then live; the budget counts it throughout", () => {
  const m = descentLive();
  const e = createEngine(m, "echo");
  assert.deepEqual(e.act(place("link0", 6)), { ok: true });
  e.step(5);
  assert.deepEqual(e.observe().building, [], "ordered for a later tick: not building yet");
  e.step(); // observation at tick 6: the command is in force
  let o = e.observe();
  assert.deepEqual(o.building, [{ sectorId: "link0", readyAt: 6 + BEACON_BUILD_TICKS }]);
  assert.notEqual(o.sectors.find((s) => s.id === "link0")!.beacon, true);
  assert.equal(e.act(place("link0", 9)).ok, false, "still counts as ordered");
  e.step(BEACON_BUILD_TICKS); // observation at tick 8: still building, goes live in the step of tick 8
  o = e.observe();
  assert.deepEqual(o.building, [{ sectorId: "link0", readyAt: 8 }]);
  assert.equal(o.sectors.find((s) => s.id === "link0")!.beacon, false);
  e.step();
  o = e.observe();
  assert.deepEqual(o.building, []);
  assert.equal(o.sectors.find((s) => s.id === "link0")!.beacon, true);
  assert.equal(o.log.find((l) => l.kind === "beacon-placed")!.tick, 6 + BEACON_BUILD_TICKS);
});

test("build delay: a beacon ordered when Mara starts her blind wait does not spare her any of it", () => {
  const t = play(descentLive(), [], 30).log.find((l) => l.kind === "blind" && l.podId === "MED-1" && l.sectorId === "link0")!.tick;
  const enter = (o: Observation) => o.log.find((l) => l.kind === "enter" && l.podId === "MED-1" && l.sectorId === "link0")!.tick;
  const dark = enter(play(descentLive(), [], 40));
  assert.equal(dark, t + 4, "dark: the 3-minute wait, then the claim");
  assert.equal(enter(play(descentLive(), [place("link0", t - 2)], 40)), t + 1, "ordered two ticks before the wait: live as it starts, no blind wait at all");
  assert.equal(enter(play(descentLive(), [place("link0", t)], 40)), t + 3, "ordered when the wait starts: live at t+2, saves one minute, not the whole wait");
  assert.equal(enter(play(descentLive(), [place("link0", t + 1)], 40)), t + 4, "ordered a tick later: too late to help");
});

test("early end: both pods arrived ends the run at once, with the reason", () => {
  const o = play(descentLive(), DESCENT_LIVE_SOLUTION);
  assert.equal(o.over, true);
  assert.equal(o.endReason, "Mara and the medicine have both arrived");
  assert.equal(o.tick, arrive(o, "SUP-3")! + 1, "no idling after the last arrival");
  assert.ok(o.tick < descentLive().endTick - 25);
});

test("early end: Mara provably trapped ends the run the tick she is stuck, not at t120", () => {
  const o = play(descentLive(), []);
  assert.equal(o.over, true);
  assert.match(o.endReason!, /Mara is trapped/);
  assert.equal(o.tick, 72);
  assert.equal(arrive(o, "MED-1"), null);
});

test("early end: Mara in, medicine trapped, ends with its own reason; time running out is reported too", () => {
  // a mission where only the medicine pod is left behind: the nurse arrives, SUP-3 is stuck
  const m = descentLive();
  const med = m.pods.find((p) => p.id === "SUP-3")!;
  med.departTick = 30; // enters the main shaft behind the seal news? it still never hears: held at the seal while Mara (warned) reroutes
  const o = play(m, [place("main1", 33), place("main0", 34)]);
  assert.equal(o.over, true);
  assert.ok(o.endReason === "Mara and the medicine have both arrived" || /medicine is trapped/.test(o.endReason!), String(o.endReason));
  const short = play({ ...descentLive(), endTick: 20 }, []);
  assert.deepEqual([short.over, short.endReason], [true, "Time ran out"]);
});

test("early end is opt-in: a mission without it runs to endTick and has none of the new observation keys", () => {
  for (const { build } of MISSIONS) {
    const o = play(build(), [], 20);
    for (const k of ["floodWarnings", "building", "endReason"]) assert.ok(!(k in o), `${build().id}: ${k}`);
  }
  const plain = { ...descentLive(), earlyEnd: undefined, floodReveal: undefined, beaconBuildTicks: undefined };
  const o = play(plain, DESCENT_LIVE_SOLUTION);
  assert.equal(o.tick, plain.endTick);
  assert.ok(!("endReason" in o) && !("floodWarnings" in o) && !("building" in o));
});

test("seeded flood: attempt 0 is candidate 0, picks are deterministic, every candidate comes up", () => {
  assert.equal(descentLiveCandidateIndex(0), 0);
  assert.equal(descentLiveCandidateIndex(), 0);
  assert.deepEqual([...Array(24).keys()].map(descentLiveCandidateIndex), [...Array(24).keys()].map(descentLiveCandidateIndex));
  assert.deepEqual(new Set([...Array(30).keys()].map(descentLiveCandidateIndex)), new Set(C.map((_, i) => i)));
  for (const [i, c] of C.entries()) {
    const m = descentLive(attemptOf(i));
    assert.deepEqual([m.sealSectorId, m.sealAt], [c.sectorId, c.at]);
    assert.ok(c.at >= 38 && c.at <= 44, "seals land t38-44");
  }
  assert.ok(C.length >= 2 && C.length <= 3);
  assert.equal(DESCENT_LIVE_GOALS, C[0].goals);
  assert.equal(DESCENT_LIVE_SOLUTION, C[0].solution);
  assert.deepEqual(Object.keys(DESCENT_LIVE_SOLUTIONS), C.map((c) => c.id));
  assert.equal(DESCENT_LEVELS[0].solutionFor!(attemptOf(1)), C[1].solution);
  assert.equal(DESCENT_LEVELS[0].goalsFor!(attemptOf(2)), C[2].goals);
});

test("each candidate: its stored run is 3 stars within budget and reacts to the telegraph; the others' runs do not work on it", () => {
  C.forEach((c, i) => {
    const m = descentLive(attemptOf(i));
    const o = play(m, c.solution);
    assert.equal(starsFor(c.goals, o.pods), 3, c.id);
    assert.equal(descentLiveStars(o.pods, attemptOf(i)), 3);
    assert.ok(c.solution.length <= m.beaconBudget!);
    assert.ok(c.solution.some((x) => (x as { atTick: number }).atTick >= c.at - DEFAULT_REVEAL_LEAD), `${c.id}: a placement at or after the telegraph (t${c.at - DEFAULT_REVEAL_LEAD})`);
    assert.ok(c.solution.filter((x) => (x as { atTick: number }).atTick >= c.at - DEFAULT_REVEAL_LEAD).length >= (c.id === "main0" ? 2 : 1), `${c.id}: reacts after the telegraph`);
  });
});

test("placing everything at t0 averages at most 1 star across the candidates (memorise one run, replay it blind)", () => {
  let total = 0;
  for (const mine of C) {
    const t0 = mine.solution.map((x) => place((x as { sectorId: string }).sectorId, 0));
    for (const [j, theirs] of C.entries()) total += starsFor(theirs.goals, play(descentLive(attemptOf(j)), t0).pods);
  }
  assert.ok(total / (C.length * C.length) <= 1, `average ${total / (C.length * C.length)}`);
  // and nothing is gained by lighting the whole main shaft blind either
  const blanket = ["main0", "main1", "main2", "link0", "trunk0"].map((s) => place(s, 0));
  const avg = C.reduce((n, _, j) => n + starsFor(C[j].goals, play(descentLive(attemptOf(j)), blanket).pods), 0) / C.length;
  assert.ok(avg <= 1, `blanket average ${avg}`);
});

test("a stored run is not just memorised: each one is useless against a different flood", () => {
  for (const [i, mine] of C.entries())
    for (const [j, theirs] of C.entries()) {
      if (i === j) continue;
      const o = play(descentLive(attemptOf(j)), mine.solution);
      assert.equal(starsFor(theirs.goals, o.pods), 0, `${mine.id}'s run on the ${theirs.id} flood`);
    }
});

test("deterministic: same attempt, same commands, identical observations", () => {
  for (let a = 0; a < 6; a++) assert.deepEqual(play(descentLive(a), DESCENT_LIVE_SOLUTION), play(descentLive(a), DESCENT_LIVE_SOLUTION));
});

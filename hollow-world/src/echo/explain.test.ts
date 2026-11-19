import assert from "node:assert/strict";
import { test } from "node:test";
import { runBaseline, playRun } from "./baseline";
import { DESCENT_LIVE_SOLUTION, descentLive } from "./descent";
import { explainRun } from "./explain";
import type { Command } from "./types";

const place = (ids: string[], atTick = 0): Command[] => ids.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick }));
const explain = (cmds: Command[]) => explainRun(playRun(descentLive(), "echo", cmds).log, descentLive());

test("0 beacons: both pods trapped, cause names the missing warning beacons", () => {
  const l = explain([]);
  assert.match(l[0], /No warning reached Mara Vale/);
  assert.match(l[1], /main1 and main0 had no beacon/);
  assert.match(l[2], /medicine was trapped/);
  assert.ok(l.length <= 4);
});

test("route-only: lit route still dies at the flood, same cause, different wording from the solution", () => {
  const l = explain(place(["link0", "link1", "link2", "trunk0", "trunk1"]));
  assert.match(l[0], /No warning reached/);
  assert.match(l[1], /main1 and main0 had no beacon/);
});

test("flood beacon without the next link: names the dark link", () => {
  const l = explain(place(["main1"]));
  assert.match(l[1], /main1 had a beacon but main0 did not/);
  assert.match(l[1], /next link is dark/);
  assert.match(explain(place(["main0"]))[1], /main0 was lit but main1 was dark/);
});

test("warn-only: re-routes, arrives at 92 and the margin to the next star is exact", () => {
  const out = playRun(descentLive(), "echo", place(["main1", "main0"]));
  assert.deepEqual([out.mara, out.medicine, out.stars], [92, 97, 1]);
  const l = explainRun(out.log, descentLive());
  assert.match(l[0], /re-routed at minute \d+ and reached the clinic at minute 92/);
  assert.match(l[1], /blind at \d+ dark sectors?/);
  assert.match(l[2], /Next star \(★★\): Mara Vale by 86 \(arrived 92, 6 late\); medicine by 91 \(arrived 97, 6 late\)/);
});

test("late warning: beacons went in after Mara passed the fork", () => {
  const l = explain(place(["main1", "main0"], 68)); // live at t70, after Mara has passed the fork
  assert.match(l[1], /went in too late/);
});

test("the 3-star solution: best possible, two blind-wait sectors fewer than warn-only", () => {
  const out = playRun(descentLive(), "echo", DESCENT_LIVE_SOLUTION);
  assert.deepEqual([out.mara, out.medicine, out.stars], [83, 88, 3]);
  const l = explainRun(out.log, descentLive());
  assert.match(l[0], /reached the clinic at minute 83/);
  assert.equal(l[l.length - 1], "Best possible run.");
});

test("the four runs explain differently", () => {
  const runs = [[], place(["link0", "link1", "link2", "trunk0", "trunk1"]), place(["main1", "main0"]), DESCENT_LIVE_SOLUTION].map((c) => explain(c).join("|"));
  assert.equal(new Set(runs).size, 4);
});

test("runBaseline: tower and no-beacon never deliver, you do; tower claim vs reality is stated", () => {
  const b = runBaseline(descentLive(), DESCENT_LIVE_SOLUTION);
  assert.equal(b.tower.mara, null);
  assert.equal(b.none.mara, null);
  assert.equal(b.you.mara, 83);
  assert.equal(b.you.stars, 3);
  assert.equal(b.none.stars, 0);
  assert.ok(b.tower.claimed > b.tower.actual);
  assert.match(b.towerSays, /Tower says: \d+ pod runs authorized; actual: \d+ ran\. Mara never arrives\./);
});

test("deterministic: same placements, same baseline", () => {
  assert.deepEqual(runBaseline(descentLive(), DESCENT_LIVE_SOLUTION), runBaseline(descentLive(), DESCENT_LIVE_SOLUTION));
});

test("the full log keeps events the 60-event observe().log has dropped", () => {
  const out = playRun(descentLive(), "echo", DESCENT_LIVE_SOLUTION);
  assert.ok(out.log.length > 60);
  assert.ok(out.log.some((l) => l.kind === "beacon-placed" && l.tick === 18)); // command at t16, live two ticks later;
});

test("never says Mara cleared the shaft when she did not arrive and was not held at a flood", () => {
  // end the run after the seal (t41) but before Mara hears or reaches it: she is still on the way, so the sentence must not claim she cleared anything
  const m = descentLive();
  const log = playRun({ ...m, endTick: 50 }, "echo", []).log;
  const l = explainRun(log, m);
  assert.ok(log.some((e) => e.kind === "seal") && !log.some((e) => e.kind === "seal-heard"));
  assert.ok(!l.some((x) => /cleared the shaft/.test(x)));
  assert.match(l[0], /Mara Vale did not reach the clinic\./);
});

// Levels 2 and 3 (reviewer follow-ups on #105): the flood that decided the run, margins from the level's own star table, stars in the baseline.
import { DESCENT_LEVELS } from "./descent-levels";
const lvl = (i: number, cmds: Command[]) => {
  const m = DESCENT_LEVELS[i].build();
  const o = playRun(m, "echo", cmds);
  return { o, l: explainRun(o.log, m) };
};

test("level 2: a trapped Mara is explained by the flood that trapped her, not the first one", () => {
  const { o, l } = lvl(1, place(["mainA1", "mainA0"])); // flood A warned, flood B not
  assert.equal(o.mara, null);
  assert.match(l[0], /The flood sealed mainB1 at minute 55\. No warning reached Mara Vale/);
  assert.match(l[1], /mainB1 and mainB0 had no beacon/);
  assert.match(lvl(1, []).l[1], /mainA1 and mainA0 had no beacon/);
});

test("level 2: both floods warned re-routes twice; margins come from the level's star table", () => {
  const { o, l } = lvl(1, place(["mainA1", "mainA0", "mainB1", "mainB0"]));
  assert.equal(o.stars, 1);
  assert.match(l[0], /The floods sealed mainA1 at minute 30 and mainB1 at minute 55\..*re-routed at minutes \d+ and \d+ and reached the clinic at minute 120/);
  assert.match(l[2], /Next star \(★★\): Mara Vale by 114 \(arrived 120, 6 late\); medicine by 119 \(arrived 125, 6 late\)/);
  assert.equal(lvl(1, DESCENT_LEVELS[1].solution).l.at(-1), "Best possible run.");
});

test("level 3: margin line and star count work, baseline stars are not null", () => {
  const { l } = lvl(2, place(["main1", "main0"]));
  assert.match(l.at(-1)!, /Next star \(★★\): Mara Vale by 99 \(arrived 111, 12 late\); medicine by 123 \(arrived 135, 12 late\)/);
  for (const [i, want] of [[0, 3], [1, 3], [2, 3]] as const) {
    const b = runBaseline(DESCENT_LEVELS[i].build(), DESCENT_LEVELS[i].solution);
    assert.equal(b.you.stars, want);
    assert.equal(b.none.stars, 0);
    assert.match(b.towerSays, /Mara never arrives\./);
  }
});

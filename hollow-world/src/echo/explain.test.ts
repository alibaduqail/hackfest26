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
  const l = explain(place(["main1", "main0"], 70));
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
  assert.match(b.towerSays, /Tower says: \d+ flights authorized; actual: \d+ flew\. Mara never arrives\./);
});

test("deterministic: same placements, same baseline", () => {
  assert.deepEqual(runBaseline(descentLive(), DESCENT_LIVE_SOLUTION), runBaseline(descentLive(), DESCENT_LIVE_SOLUTION));
});

test("the full log keeps events the 60-event observe().log has dropped", () => {
  const out = playRun(descentLive(), "echo", DESCENT_LIVE_SOLUTION);
  assert.ok(out.log.length > 60);
  assert.ok(out.log.some((l) => l.kind === "beacon-placed" && l.tick === 16));
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

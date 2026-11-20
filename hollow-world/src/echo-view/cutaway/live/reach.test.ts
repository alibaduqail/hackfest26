import assert from "node:assert/strict";
import { test } from "node:test";
import { descentLive } from "../../../echo/descent";
import { playRun } from "../../../echo/baseline";
import type { Command } from "../../../echo/types";
import { analyzeRun } from "./cause";
import { liveLinks, previewReach, sectorGraph, uncovered } from "./reach";

const mission = descentLive();
const graph = sectorGraph(mission.world.sectors);
const place = (ids: string[]): Command[] => ids.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick: 0 }));

test("a beacon hears its chain neighbours and every sector touching the same city", () => {
  assert.deepEqual(graph.get("main1"), ["main0", "main2"]);
  assert.deepEqual(graph.get("main0"), ["byp0", "main1", "trunk2"]); // main0 starts at the fork: so do byp0 and trunk2's end
  assert.ok(graph.get("link2")!.includes("trunk0")); // both touch the junction
  assert.ok(!graph.get("main1")!.includes("main1"));
});

test("links join only beaconed neighbours; a dark sector neither hears nor relays", () => {
  assert.deepEqual(liveLinks(graph, new Set(["ramp2", "link0", "main1"])), [["link0", "ramp2"]]);
  assert.deepEqual(liveLinks(graph, new Set(["main1", "main0"])), [["main0", "main1"]]);
  assert.deepEqual(previewReach(graph, new Set(["main0"]), "main1"), { linked: ["main0"], dark: ["main2"] });
  assert.deepEqual(uncovered(["a", "b", "c"], new Set(["b"])), ["a", "c"]);
});

test("the engine agrees: main1 alone leaves Mara stuck, main1 linked to main0 gets the news to the fork", () => {
  assert.equal(playRun(mission, "echo", place(["main1"])).mara, null);
  assert.notEqual(playRun(mission, "echo", place(["main1", "main0"])).mara, null);
});

test("fail cause: names the missing chain, never 'Deadline missed', and marks it on the map", () => {
  const none = analyzeRun(mission, [], 0).verdict;
  assert.equal(none.headline, "Mara never arrived");
  assert.match(none.cause!, /^The flood warning never reached Mara: the middle main shaft and the upper main shaft had no beacon\.$/);
  assert.deepEqual(none.marks, ["main1", "main0"]);
  const half = analyzeRun(mission, place(["main1"]), 0).verdict;
  assert.match(half.cause!, /the upper main shaft had no beacon/);
  assert.deepEqual(half.marks, ["main0"]);
});

test("late arrival says how late; a win has no cause", () => {
  const late = analyzeRun(descentLive(1), [], 0).verdict;
  assert.match(late.headline, /^Arrived \d+ min late$/);
  assert.equal(analyzeRun(mission, place(["main1", "main0"]), 1).verdict.cause, null);
});

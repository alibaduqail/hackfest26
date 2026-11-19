// Journey screens: pure helpers plus a server-side render of each screen (no DOM needed). Lives here, not in journey/, so `npm test`'s existing glob runs it.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { applyEffect, formatEffect, starsFromLog, trailModel, trailRows } from "./journey/helpers";
import { camp1, choiceNames, late, log, res, saved, LIMIT } from "./journey/sample";
import { CampScreen } from "./journey/CampScreen";
import { EndingScreen } from "./journey/EndingScreen";
import { TitleScreen } from "./journey/TitleScreen";
import { TrailMap } from "./journey/TrailMap";

test("costs read in plain words with a tone", () => {
  assert.deepEqual(formatEffect({ beacons: 4, doses: -1 }), [{ text: "+4 beacons", tone: "good" }, { text: "−1 dose", tone: "bad" }]);
  assert.deepEqual(formatEffect({ clock: 15 }), [{ text: "15 min lost", tone: "bad" }]);
  assert.equal(formatEffect({ nextRevealLead: 0 })[0].tone, "bad");
  assert.equal(formatEffect({})[0].text, "no cost");
  assert.deepEqual(applyEffect({ beacons: 1, clock: 5, doses: 0 }, { beacons: -3, clock: 10 }), { beacons: 0, clock: 15, doses: 0 });
});

test("trail map: legs done, next, ahead, and where Mara is", () => {
  const at = (n: number) => trailModel(n, []);
  assert.equal(at(0).hereLevel, 0);
  assert.deepEqual(at(0).nodes.map((n) => n.state), ["current", "current", "ahead", "ahead", "ahead"]);
  assert.equal(at(1).hereLevel, 2);
  assert.deepEqual(at(2).nodes.map((n) => n.state), ["done", "done", "done", "done", "current"]);
  assert.equal(at(3).hereLevel, 5);
  assert.ok(at(3).nodes.every((n) => n.state === "done"));
  assert.deepEqual(starsFromLog(log), [3, 2, 3], "a retried leg keeps its winning stars");
  assert.deepEqual(starsFromLog(log.slice(0, 4)), [3, null, null], "a failed attempt is not a win");
});

test("trail log lists every attempt and choice in order", () => {
  const rows = trailRows(log, choiceNames);
  assert.equal(rows.length, log.length);
  assert.equal(rows[0].detail, "Extra beacons");
  assert.equal(rows[3].failed, true);
  assert.equal(rows[4].title, "Descent II, retry 1");
});

test("screens render their content from props", () => {
  const noop = () => {};
  const title = html(h(TitleScreen, { onBegin: noop, onTowerDown: noop, onStrata: noop, onFreePlay: noop }));
  for (const s of ["ECHO", "The Descent", "Begin the descent", "Tower Down split", "Strata city", "Free play"]) assert.ok(title.includes(s), s);

  const camp = html(h(CampScreen, { event: camp1, res, limit: LIMIT, legIndex: 1, attempt: 1, log, onContinue: noop }));
  for (const s of ["The tower says all clear", "Trust the tower", "beacon", "10 min lost", "no flood warning", "Continue down", "Trail map", "Camp 1"]) assert.ok(camp.includes(s) || camp.includes(s.replace("1 beacon", "−1 beacon")), s);
  assert.ok(camp.includes("disabled"), "Continue is disabled until a choice is made");

  const end = html(h(EndingScreen, { ending: saved, res, limit: LIMIT, log, choiceNames, onAgain: noop }));
  for (const s of ["Saved", "692", "Trail log", "Descent II, retry 1", "Verified through the beacons", "Begin again", "Without the beacons"]) assert.ok(end.includes(s), s);
  assert.ok(html(h(EndingScreen, { ending: late, res, limit: LIMIT, log, onAgain: noop })).includes("Too late"));

  assert.ok(html(h(TrailMap, { legIndex: 0, log: [] })).includes("Mara is here"));
});

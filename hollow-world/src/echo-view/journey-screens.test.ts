// Journey screens: pure helpers plus a server-side render of each screen (no DOM needed). Lives here, not in journey/, so `npm test`'s existing glob runs it.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { applyEffect, formatEffect, retriesOf, starsFromLog, trailModel, trailRows } from "./journey/helpers";
import { campEvent, choose, completeLeg, ending, LIMIT, startJourney } from "../echo/journey";
import { names, played, start } from "./journey/sample";
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

const { camp1, retryCamp, done } = played();
const log = done.log;
const noop = () => {};
const camp = (st: typeof start) => html(h(CampScreen, { event: campEvent(st), res: st.res, legIndex: st.legIndex, attempt: st.attempt, log: st.log, onContinue: noop }));

test("trail map: legs done, next, ahead, and where Mara is", () => {
  const at = (n: number) => trailModel(n, []);
  assert.equal(at(0).hereLevel, 0);
  assert.deepEqual(at(0).nodes.map((n) => n.state), ["current", "current", "ahead", "ahead", "ahead"]);
  assert.equal(at(1).hereLevel, 2);
  assert.deepEqual(at(2).nodes.map((n) => n.state), ["done", "done", "done", "done", "current"]);
  assert.equal(at(3).hereLevel, 5);
  assert.deepEqual(starsFromLog(log), [3, 2, 3], "a retried leg keeps its winning stars");
  assert.deepEqual(starsFromLog(log.slice(0, 4)), [3, null, null], "a failed attempt is not a win");
});

test("trail log lists every attempt and choice in order; attempt is 0-based", () => {
  const rows = trailRows(log, names);
  assert.equal(rows.length, log.length);
  assert.equal(rows[0].title, "Outfitting the Relay");
  assert.equal(rows[0].detail, "Extra beacons");
  const failed = rows.findIndex((r) => r.failed);
  assert.equal(rows[failed].title, "Descent II", "the first try carries no retry suffix");
  assert.ok(rows.some((r) => r.title === "Descent II, retry 1"));
  assert.equal(retriesOf(log), 1);
});

test("screens render real journey state", () => {
  const title = html(h(TitleScreen, { onBegin: noop, onTowerDown: noop, onStrata: noop, onFreePlay: noop }));
  for (const s of ["ECHO", "The Descent", "Begin the descent", "Tower Down split", "Strata city", "Free play"]) assert.ok(title.includes(s), s);

  const first = camp(start);
  for (const s of ["Outfitting the Relay", "Extra beacons", "+4 beacons", "\u22121 dose", "Leave now", "Before the first leg", `/ ${LIMIT} min`]) assert.ok(first.includes(s), s);
  assert.ok(first.includes("disabled"), "Continue is disabled until a choice is made");
  assert.ok(camp(camp1).includes("Trust the tower") && camp(camp1).includes("After Descent I"));

  const end = html(h(EndingScreen, { ending: ending(done), res: done.res, log, choiceNames: names, onAgain: noop }));
  for (const s of ["Trail log", "Descent II, retry 1", "Verify through the beacons", "Begin again", "Without the beacons", "1 retry"]) assert.ok(end.includes(s), s);
  assert.ok(end.includes(ending(done).kind === "saved" ? "Saved" : "Too late"));
  assert.ok(html(h(TrailMap, { legIndex: 0, log: [] })).includes("Mara is here"));
});

test("Scavenge keeps the camp: it re-renders with the new supplies, and the screen resets on the log length", () => {
  const low = { ...start, res: { beacons: 1, clock: 40, doses: 4 } };
  assert.ok(campEvent(low).choices.some((c) => c.id === "scavenge"), "low beacons offer Scavenge");
  const after = choose(low, "scavenge");
  assert.equal(after.phase, "camp", "Scavenge stays in camp");
  assert.deepEqual(after.res, { beacons: 3, clock: 65, doses: 4 });
  assert.equal(after.log.length, low.log.length + 1, "the log grows, which is what resets the card");
  const html1 = camp(after);
  assert.ok(html1.includes("<b>3</b>") && html1.includes("65"), "the bar shows the scavenged supplies");
});

test("a failed leg shows its retry in the camp and the ending", () => {
  assert.equal(retryCamp.attempt, 1);
  const c = camp(retryCamp);
  assert.ok(c.includes("Descent II, retry 1"), "attempt is 0-based: the first failure is retry 1");
  assert.ok(c.includes("Retry the leg"));
  assert.equal(campEvent(retryCamp).id, "retry-descent2");
  assert.equal(done.attempt, 0, "a win resets attempt");
  assert.equal(retriesOf(log), 1);
});

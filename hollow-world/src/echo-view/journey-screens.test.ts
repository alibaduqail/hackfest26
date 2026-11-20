// Journey screens: pure helpers plus a server-side render of each screen (no DOM needed). Lives here, not in journey/, so `npm test`'s existing glob runs it.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToStaticMarkup as html } from "react-dom/server";
import { applyEffect, consequenceOf, formatEffect, retriesOf, starsFromLog, stoppedAt, trailModel, trailRows } from "./journey/helpers";
import { campEvent, choose, completeLeg, ending, LIMIT, startJourney } from "../echo/journey";
import { ghostData, ghostHead, ghostOutcome } from "./journey/ghosts";
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
  for (const s of ["ECHO", "Begin", "Tower Down", "The city Echo keeps alive", "Descent"]) assert.ok(title.includes(s), s);

  const first = camp(start);
  for (const s of ["Outfitting the Relay", "Extra beacons", "+4 beacons", "\u22121 dose", "Leave now", "Before the first leg", `/ ${LIMIT} min`]) assert.ok(first.includes(s), s);
  assert.ok(first.includes("disabled"), "Continue is disabled until a choice is made");
  assert.ok(camp(camp1).includes("Trust the tower") && camp(camp1).includes("After Descent I"));

  const end = html(h(EndingScreen, { ending: ending(done), res: done.res, log, choiceNames: names, onAgain: noop }));
  for (const s of ["Trail log", "Descent II, retry 1", "Verify through the beacons", "Begin again", "1 retry"]) assert.ok(end.includes(s), s);
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

test("the ending's counterfactual paths come from the engine, and the player's path from the log", () => {
  const g = ghostData(done.seed, log);
  assert.deepEqual(g.paths.map((p) => p.id), ["tower", "none", "standby", "you"]);
  assert.equal(g.paths[0].reached, 0, "the dark tower never gets Mara through leg 1");
  assert.ok(g.claimed > g.actual, "the tower claims more pod runs than ran");
  assert.equal(g.paths[2].reached, 0, "a backup tower is still central: it cannot carry the flood news");
  const you = g.paths[3];
  assert.equal(you.reached, 3);
  assert.equal(you.minute, log.flatMap((l) => (l.kind === "leg" && l.result.maraAt !== null && l.result.stars > 0 ? [l.result.maraAt] : [])).reduce((a, b) => a + b, 0));
  assert.deepEqual(ghostOutcome(g.paths[0]), ["never"]);
  assert.deepEqual(ghostHead({ ...g.paths[0], label: "tower + backup" }), ["tower", "+ backup"]);
  assert.deepEqual(ghostOutcome({ ...g.paths[0], stuckAt: 92 }), ["min 92", "late"]);
  const end = html(h(EndingScreen, { ending: ending(done), res: done.res, log, choiceNames: names, ghosts: g, onAgain: noop }));
  assert.ok(end.includes("tower claimed"));
});

test("only choices with a reveal get a consequence on the fork, tone from their effect", () => {
  const tower = campEvent(camp1).choices;
  assert.deepEqual(consequenceOf(tower.find((c) => c.id === "trust-tower")!), { tone: "bad", tag: "flood · unannounced" });
  assert.equal(consequenceOf(tower.find((c) => c.id === "verify-beacons")!)?.tone, "good");
  assert.equal(consequenceOf(campEvent(startJourney(1)).choices[0]), null, "outfitting has no reveal");
});

test("the ending's stop point comes from the legs actually won, not the last level finished", () => {
  const res = (legId: "descent1" | "descent2" | "descent3", stars: 0 | 1 | 2 | 3) => ({ kind: "leg" as const, legId, attempt: 0, result: { legId, stars, maraAt: stars ? 80 : null, medicineAt: stars ? 85 : null, beaconsPlaced: 2, ticks: 60 } });
  assert.equal(stoppedAt([res("descent1", 2), res("descent2", 0), res("descent3", 2)]), "Flooded shaft"); // leg II never won, a later leg did
  assert.equal(stoppedAt([res("descent1", 0)]), "Relay level");
  assert.equal(stoppedAt([res("descent1", 3), res("descent2", 3), res("descent3", 1)]), null); // all won: she reached the clinic
});

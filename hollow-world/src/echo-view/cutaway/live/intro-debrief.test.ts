import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DESCENT_LIVE_SOLUTION, descentLive } from "../../../echo/descent";
import type { Command } from "../../../echo/types";
import { LiveDebrief } from "./LiveDebrief";
import { LiveIntro } from "./LiveIntro";

const noop = () => {};
const place = (ids: string[]): Command[] => ids.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick: 0 }));
const debrief = (commands: Command[], stars: 0 | 1 | 2 | 3, extra = {}) =>
  renderToStaticMarkup(h(LiveDebrief, { mission: descentLive(), commands, stars, onRetry: noop, ...extra }));

test("intro: who, where, deadline, the rule, the hint, a Start button", () => {
  const html = renderToStaticMarkup(h(LiveIntro, { mission: descentLive(), onStart: noop }));
  assert.match(html, /Mara Vale leaves Upper Depot for Deep Clinic/);
  assert.match(html, /The tower is dark\.<\/strong> News only hops beacon to beacon\./);
  assert.match(html, /You have 5 beacons/);
  assert.match(html, /minute 92/);
  assert.match(html, /Click a rail to bolt a beacon/); // level 1 hint
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, />Start <kbd>Space</);
  assert.doesNotMatch(renderToStaticMarkup(h(LiveIntro, { mission: descentLive(), hint: null, onStart: noop })), /live-intro-hint/);
});

test("debrief, no beacons: 0 stars, readable cause, tower / none / you all never arrive", () => {
  const html = debrief([], 0);
  assert.match(html, /Deadline missed/);
  assert.match(html, /0 of 3 stars/);
  assert.match(html, /No warning reached Mara Vale/);
  assert.match(html, /had no beacon/);
  assert.match(html, /Tower<\/th><th[^>]*>Tower \+\u00a0backup<\/th><th[^>]*>No beacons<\/th><th[^>]*>You/);
  assert.equal((html.match(/<td class="[^"]*never"/g) ?? []).length, 8); // 4 columns x (Mara, medicine)
  assert.match(html, /Tower says: \d+ pod runs authorized; actual: \d+ ran\. Mara never arrives\./);
  assert.match(html, /Next star:<\/strong> Light the middle main shaft, the upper relay track/);
  assert.doesNotMatch(html, /main[01]\b/); // sector ids are shown by name
});

test("debrief, warn only: 1 star, margin and hint", () => {
  const html = debrief(place(["main1", "main0"]), 1, { onWatchSolution: noop, onNext: noop });
  assert.match(html, /1 of 3 stars/);
  assert.match(html, /minute 92/);
  assert.match(html, /Next star \(★★\): Mara Vale by 86 \(arrived 92, 6 late\)/);
  assert.match(html, /Next star:<\/strong> Light the upper relay track/);
  assert.match(html, /Next level/);
  assert.match(html, /Watch the solution/);
});

test("debrief, the solution: 3 stars, best possible, you beat the tower and no-beacon runs", () => {
  const html = debrief(DESCENT_LIVE_SOLUTION, 3);
  assert.match(html, /3 of 3 stars/);
  assert.match(html, /Clinic supplied/);
  assert.match(html, /Best possible run\./);
  assert.match(html, /minute 83/);
  assert.match(html, /minute 88/);
  assert.doesNotMatch(html, /Next star:/);
  assert.doesNotMatch(html, /Next level|Watch the solution/); // optional buttons stay hidden without their callbacks
});

test("debrief headline agrees with the result: a 0-star run that reached the clinic is not 'Deadline missed'; Continue anyway only when asked", () => {
  const html = renderToStaticMarkup(h(LiveDebrief, { mission: descentLive(1), commands: place(["link0", "link1"]), stars: 0, onRetry: noop, onContinue: noop })); // the main0 flood: Mara reaches the clinic, just not fast enough
  assert.doesNotMatch(html, /Deadline missed/);
  assert.match(html, /Not fast enough/);
  assert.match(html, /Continue anyway/);
  assert.doesNotMatch(debrief([], 0), /Continue anyway/);
});

test("debrief, solution replay: labelled, no stars, no next level, no credit hints", () => {
  const html = debrief(DESCENT_LIVE_SOLUTION, 3, { replay: true, onNext: noop, onContinue: noop, onWatchSolution: noop, retryLabel: "Play yourself" });
  assert.match(html, /Solution replay<\/p>/);
  assert.doesNotMatch(html, /of 3 stars|★|Next level|Continue anyway|Best possible|Next star/);
  assert.match(html, /Play yourself/);
});

// The Descent: engine-driven vertical mission. Beat ticks in DESCENT_BEATS must match the real echo-mode log.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine";
import { DESCENT_BEATS, DESCENT_LAYOUT, descent } from "./descent";
import { MISSIONS, validateMission } from "./missions";
import type { LogEvent, Mode, Observation } from "./types";

/** Runs the mission to the end; returns every log event (the observation log is capped at 60) and the final observation. Checks sector exclusivity every tick. */
function run(mode: Mode) {
  const e = createEngine(descent(), mode);
  const log: LogEvent[] = [];
  const seen = new Set<string>();
  let o: Observation;
  do {
    e.step();
    o = e.observe();
    const held = o.pods.filter((p) => p.status === "moving").map((p) => p.path[p.at]);
    assert.equal(new Set(held).size, held.length, `two pods share a sector at t${o.tick}`);
    for (const l of o.log) if (!seen.has(JSON.stringify(l))) (seen.add(JSON.stringify(l)), log.push(l));
  } while (!o.over);
  return { log, o };
}
const first = (log: LogEvent[], f: (l: LogEvent) => boolean) => log.find(f);

test("descent: mission is valid and not part of the campaign", () => {
  assert.deepEqual(validateMission(descent()), []);
  assert.ok(!MISSIONS.some((m) => m.id === "descent"));
});

test("descent echo: beats a-f occur in order, with gaps, on the tick DESCENT_BEATS says", () => {
  const { log, o } = run("echo");
  const beats = [
    first(log, (l) => l.kind === "tower-down"),
    first(log, (l) => l.kind === "enter" && l.podId === "MED-1"),
    first(log, (l) => l.kind === "yield" && l.podId === "PAX-1" && l.text.includes("MED-1")),
    first(log, (l) => l.kind === "credential-reject" && l.podId === "GHOST-1"),
    first(log, (l) => l.kind === "seal"),
    first(log, (l) => l.kind === "arrive" && l.podId === "MED-1"),
  ];
  assert.ok(beats.every(Boolean), "every beat has a log event");
  const ticks = beats.map((l) => l!.tick);
  assert.deepEqual(ticks, DESCENT_BEATS.map((b) => b.tick));
  assert.deepEqual(DESCENT_BEATS.map((b) => b.beat), [1, 2, 3, 4, 5, 6]);
  ticks.slice(1).forEach((t, i) => assert.ok(t - ticks[i] >= 3, `beats ${i + 1} and ${i + 2} are at least 3 ticks apart`));
  // news hops: MED-1 hears the seal after it lands, re-plans onto the bypass, then arrives
  const heard = first(log, (l) => l.kind === "seal-heard" && l.podId === "MED-1")!;
  const reroute = first(log, (l) => l.kind === "reroute" && l.podId === "MED-1")!;
  assert.ok(heard.tick > ticks[4] && reroute.tick >= heard.tick && reroute.tick < ticks[5]);
  assert.ok(log.some((l) => l.kind === "seal-heard" && l.podId !== "MED-1"), "the news reaches other pods too");
  const med = o.pods.find((p) => p.id === "MED-1")!;
  assert.ok(med.rerouted && med.path.includes("byp0") && !med.path.includes("main0"));
  assert.ok(!log.some((l) => l.kind === "enter" && l.podId === "MED-1" && l.sectorId?.startsWith("main")), "MED-1 never enters the main shaft");
  assert.ok(o.pods.find((p) => p.id === "GHOST-1")!.ghost);
  assert.ok(o.score.towerClaimed > 0 && o.score.towerClaimed > o.score.realFlights, "tower claims more than it flies");
  assert.ok(o.tick <= 100);
});

test("descent tower mode: MED-1 never arrives", () => {
  const { o } = run("tower");
  assert.notEqual(o.pods.find((p) => p.id === "MED-1")!.status, "arrived");
  assert.equal(o.score.nursesArrived, 0);
});

test("DESCENT_LAYOUT covers every sector once, on a known level, and every level city", () => {
  const w = descent().world;
  const ids = DESCENT_LAYOUT.sectors.map((s) => s.sectorId).sort();
  assert.deepEqual(ids, w.sectors.map((s) => s.id).sort());
  assert.deepEqual(DESCENT_LAYOUT.levels.map((l) => l.level), [1, 2, 3, 4, 5]);
  assert.deepEqual(DESCENT_LAYOUT.levels.flatMap((l) => l.cityIds).sort(), w.cities.map((c) => c.id).sort());
  const slot = new Set(DESCENT_LAYOUT.sectors.map((s) => `${s.shaft}${s.order}`));
  assert.equal(slot.size, ids.length, "order is unique within a shaft");
  assert.ok(DESCENT_LAYOUT.sectors.some((s) => s.level === 4 && s.shaft === "main"));
  assert.ok(DESCENT_LAYOUT.sectors.filter((s) => s.shaft === "bypass").every((s) => s.level !== 4), "the bypass avoids L4");
});

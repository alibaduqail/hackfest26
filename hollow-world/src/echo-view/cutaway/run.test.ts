import assert from "node:assert/strict";
import test from "node:test";
import { DESCENT_LAYOUT } from "../../echo/descent";
import { beatAt, beats, beatTick, createRun, podPose, tracks } from "./run";

test("every track has geometry and every observed pod can be located in either mode", () => {
  assert.equal(tracks.size, DESCENT_LAYOUT.sectors.length);
  for (const track of tracks.values()) assert.ok([...track.a, ...track.b].every(Number.isFinite));
  for (const mode of ["echo", "tower"] as const) {
    const sample = createRun(mode);
    for (let t = 0; t <= sample(0).obs.endTick; t++) {
      for (const p of sample(t).obs.pods) assert.ok(podPose(p).every(Number.isFinite));
    }
  }
});

test("seeking and rewinding preserve the observed rejection, departures and separate clinic arrivals", () => {
  const echo = createRun("echo"), tower = createRun("tower");
  const end = echo(0).obs.endTick;
  for (const b of beats) {
    for (const reduced of [false, true]) assert.equal(beatAt(beatTick(b.beat, reduced, end)), b.beat);
  }
  const finish = echo(end);
  assert.equal(finish.rejected.size, 1);
  assert.equal(finish.rejected.get("GHOST-1")?.sectorId, "link0");
  assert.equal(echo(37).rejected.size, 0);
  assert.equal(echo(62).arrived.has("MED-1"), false);
  assert.equal(echo(63).arrived.has("MED-1"), true);
  assert.equal(echo(67).arrived.has("SUP-3"), false);
  assert.equal(echo(68).arrived.has("SUP-3"), true);
  assert.equal(tower(68).arrived.has("MED-1"), false);
  assert.equal(tower(68).arrived.has("SUP-3"), false);
  const medicineAt = (mode: typeof echo) => mode(68).obs.pods.find((p) => p.cargo === "medicine")!.at;
  assert.ok(medicineAt(echo) >= 0);
  assert.equal(medicineAt(tower), -1);
});

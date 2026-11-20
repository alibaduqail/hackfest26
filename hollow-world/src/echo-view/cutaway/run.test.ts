import assert from "node:assert/strict";
import test from "node:test";
import { DESCENT_LAYOUT } from "../../echo/descent";
import { beatAt, beats, captureStops, createRun, displayLocations, podPose, tracks } from "./run";

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
  const stops = captureStops(echo);
  for (const [i, b] of beats.entries()) {
    assert.equal(beatAt(stops[i].cue), b.beat);
    assert.equal(beatAt(stops[i].settled), b.beat);
  }
  const cue = stops[4].cue;
  assert.equal(echo(cue - 1).obs.pods.find((p) => p.nurse)?.rerouted, false);
  assert.equal(echo(cue).obs.pods.find((p) => p.nurse)?.rerouted, true);
  assert.equal(tower(cue).obs.pods.find((p) => p.nurse)?.rerouted, false);
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

test("ticker and location descriptions use track names without changing engine IDs", () => {
  assert.equal(displayLocations("Directorate seals main0"), "Directorate seals main shaft section 1");
  for (const id of tracks.keys()) assert.notEqual(displayLocations(id), id);
  assert.equal(displayLocations("MED-1"), "MED-1");
});

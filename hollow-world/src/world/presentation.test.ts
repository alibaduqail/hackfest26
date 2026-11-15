import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HollowEngine, emptyStock } from "../engine/engine";
import type { Scenario } from "../engine/types";
import {
  appearance,
  cargoUnits,
  fixtureSpot,
  importantEvent,
  residentPose,
  subjectRoom,
} from "./presentation";
const scenario: Scenario = JSON.parse(
  readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"),
);

test("clothing follows a resident's role; poses follow their actual task and bag", () => {
  const engine = new HollowEngine(scenario),
    person = structuredClone(engine.state.people[0]),
    def = scenario.residents[0],
    room = scenario.rooms.find((r) => r.id === def.homeId)!;
  assert.equal(appearance(def).medical, true);
  assert.equal(appearance({ ...def, role: "Grower" }).grower, true);
  person.task = "Working";
  person.taskState = "active";
  assert.equal(residentPose(def, person, room), "work");
  assert.equal(residentPose({ ...def, role: "Grower" }, person, room), "bend");
  person.bag.water = 1;
  assert.equal(residentPose(def, person, room), "carry");
  person.edgeId = "lift-0";
  assert.equal(residentPose(def, person, room), "walk");
  person.edgeId = null;
  person.bag = emptyStock();
  person.task = "Sleeping";
  person.taskState = "resting";
  assert.equal(residentPose(def, person, room), "sleep");
});

test("fixture spots stay on each room floor and a gathering uses depth and varied facing", () => {
  for (const room of scenario.rooms)
    for (const pose of ["stand", "work", "bend", "sit", "sleep"] as const)
      for (let i = 0; i < 18; i++) {
        const spot = fixtureSpot(room, pose, i);
        assert.ok(spot.x >= 0 && spot.x <= room.w, `${room.id} ${pose} ${i}`);
        assert.ok(spot.z >= 0 && spot.z <= 150);
      }
  const spots = Array.from({ length: 8 }, (_, i) =>
    fixtureSpot(scenario.rooms[0], "stand", i),
  );
  assert.ok(new Set(spots.map((p) => p.z)).size > 3);
  assert.equal(new Set(spots.map((p) => p.facing)).size, 2);
});

test("cart totals expose an empty deck and retain real stock during a blocked trip", () => {
  const engine = new HollowEngine(scenario);
  assert.equal(cargoUnits(engine.state.cart.cargo), 0);
  engine.step(60);
  const cargo = structuredClone(engine.state.cart.cargo);
  assert.ok(cargoUnits(cargo) > 0);
  engine.incident("blackout");
  engine.step(900);
  assert.equal(engine.state.cart.phase, "waiting");
  assert.deepEqual(engine.state.cart.cargo, cargo);
});

test("following changes district at a crossing and history keeps outages above routine arrivals", () => {
  const engine = new HollowEngine(scenario),
    p = engine.state.people[0];
  p.roomId = "d1-f1";
  p.fromId = "d1-f1";
  p.toId = "d0-f1";
  p.edgeId = "cross-0-1";
  p.edgeProgress = 0.4;
  assert.equal(subjectRoom(scenario, engine.state, p.id)?.district, 1);
  p.edgeProgress = 0.6;
  assert.equal(subjectRoom(scenario, engine.state, p.id)?.district, 0);
  engine.incident("blackout");
  assert.ok(engine.state.events.some(importantEvent));
  assert.equal(
    importantEvent({
      id: "arrival",
      tick: 1,
      text: "Mara arrived for the shift.",
      kind: "arrival",
      subjectId: p.id,
      causeIds: [],
    }),
    false,
  );
});

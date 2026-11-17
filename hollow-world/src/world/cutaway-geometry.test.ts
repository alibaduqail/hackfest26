import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Scenario } from "../engine/types";
import { roomBounds, roomFloor, pathPoints, traversalPoint, containsRoom, alongPath, LIFT_BOARD, LIFT_ALIGHT, cutawaySpot } from "./cutaway-geometry";

const scenario: Scenario = JSON.parse(readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"));

test("room bounds follow authored geometry and contain their visible interior", () => {
  for (const room of scenario.rooms) {
    assert.deepEqual(roomBounds(room), { x: room.x, y: room.y, width: room.w, height: room.h });
    assert.equal(containsRoom(room, { x: room.x + room.w / 2, y: room.y + room.h / 2 }), true);
    assert.equal(containsRoom(room, { x: room.x - 1, y: room.y }), false);
  }
  const moved = { ...scenario.rooms[0], x: 127, y: 83, w: 260 };
  assert.deepEqual(roomBounds(moved), { x: 127, y: 83, width: 260, height: moved.h });
});

test("routes meet authored floors and reverse without shifting", () => {
  const rooms = new Map(scenario.rooms.map((room) => [room.id, room]));
  for (const link of scenario.links) {
    const a = rooms.get(link.a)!, b = rooms.get(link.b)!;
    const path = pathPoints(a, b, link.kind);
    assert.deepEqual(path[0], roomFloor(a));
    assert.deepEqual(path.at(-1), roomFloor(b));
    for (const p of [0, 0.1, 0.22, 0.5, 0.78, 0.9, 1]) {
      const f = traversalPoint(a, b, link.kind, p), r = traversalPoint(b, a, link.kind, 1 - p);
      assert.ok(Math.hypot(f.x - r.x, f.y - r.y) < 1e-7, link.id);
    }
    if (link.kind === "lift" && a.y !== b.y) {
      const board = traversalPoint(a, b, link.kind, LIFT_BOARD);
      const alight = traversalPoint(a, b, link.kind, LIFT_ALIGHT);
      assert.equal(board.x, alight.x);
      assert.equal(board.y, roomFloor(a).y);
      assert.equal(alight.y, roomFloor(b).y);
    }
  }
  assert.deepEqual(alongPath([{ x: 1, y: 2 }, { x: 1, y: 2 }], 0.5), { x: 1, y: 2 });
  const a = { ...scenario.rooms[0], x: 0, y: 50, w: 260 };
  const b = { ...scenario.rooms[1], x: 80, y: 410, w: 490 };
  const board = traversalPoint(a, b, "lift", LIFT_BOARD);
  const reverse = traversalPoint(b, a, "lift", LIFT_ALIGHT);
  assert.deepEqual(board, reverse);
  assert.deepEqual(pathPoints(a, b, "lift").at(-1), roomFloor(b));
});

test("a lift between narrow aligned rooms boards inside both rooms without reversing", () => {
  const a = { ...scenario.rooms[0], x: 0, y: 0, w: 30, h: 30 };
  const b = { ...scenario.rooms[1], x: 0, y: 100, w: 30, h: 30 };
  const path = pathPoints(a, b, "lift");
  assert.ok(path.every((p) => p.x >= 0 && p.x <= 30));
  const approach = path.slice(0, 3).map((p) => p.x);
  assert.ok(approach.every((x) => x >= Math.min(approach[0], approach[2]) && x <= Math.max(approach[0], approach[2])));
});

test("a lift between horizontally separated rooms uses a shaft in the gap", () => {
  const a = { ...scenario.rooms[0], x: 20, y: 50, w: 30 };
  const b = { ...scenario.rooms[1], x: 150, y: 300, w: 30 };
  const shaft = traversalPoint(a, b, "lift", LIFT_BOARD);
  assert.ok(shaft.x >= a.x + a.w && shaft.x <= b.x);
  assert.deepEqual(shaft, traversalPoint(b, a, "lift", LIFT_ALIGHT));
  assert.deepEqual(traversalPoint(a, b, "lift", -1), roomFloor(a));
  assert.deepEqual(traversalPoint(a, b, "lift", 2), roomFloor(b));
});

test("a crowded room keeps each occupant at a distinct position on its floor", () => {
  for (const width of [30, 260, 490]) {
    const room = { ...scenario.rooms[0], x: 71, y: 100, w: width, h: 140 };
    const positions = Array.from({ length: 200 }, (_, slot) => cutawaySpot(room, slot, 200));
    assert.equal(new Set(positions.map((point) => point.x)).size, positions.length);
    assert.ok(positions.every((point) => point.x >= room.x && point.x <= room.x + room.w));
    assert.ok(positions.every((point) => point.y === roomFloor(room).y));
    assert.deepEqual(cutawaySpot(room, 0, 1), roomFloor(room));
  }
});

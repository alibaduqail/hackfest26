import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Scenario } from "../engine/types";
import {
  alongPath,
  contains,
  pathPoints,
  project,
  ROOM_DEPTH,
  roomOutline,
} from "./projection";

const scenario: Scenario = JSON.parse(
  readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"),
);

test("every authored room can be selected on its projected floor and back wall", () => {
  for (const r of scenario.rooms) {
    const outline = roomOutline(r);
    assert.ok(
      contains(outline, project(r.x + r.w / 2, r.y + r.h - 15, ROOM_DEPTH / 2)),
      r.id,
    );
    assert.ok(
      contains(outline, project(r.x + r.w / 2, r.y + r.h - 15, ROOM_DEPTH, 40)),
      r.id,
    );
    assert.equal(contains(outline, { x: -10000, y: -10000 }), false);
  }
});

test("walking paths meet the projected room entrances in both directions", () => {
  const rooms = new Map(scenario.rooms.map((r) => [r.id, r]));
  for (const link of scenario.links) {
    const a = rooms.get(link.a)!,
      b = rooms.get(link.b)!;
    const forward = pathPoints(a, b, link.kind),
      reverse = pathPoints(b, a, link.kind);
    assert.deepEqual(
      alongPath(forward, 0),
      project(a.x + a.w / 2, a.y + a.h - 15, 18),
    );
    assert.deepEqual(
      alongPath(forward, 1),
      project(b.x + b.w / 2, b.y + b.h - 15, 18),
    );
    assert.deepEqual(alongPath(reverse, 0), alongPath(forward, 1));
    const mid = alongPath(forward, 0.3),
      mirrored = alongPath(reverse, 0.7);
    assert.ok(
      Math.abs(mid.x - mirrored.x) < 1e-8 &&
        Math.abs(mid.y - mirrored.y) < 1e-8,
      link.id,
    );
  }
  assert.deepEqual(
    alongPath(
      [
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ],
      0.5,
    ),
    { x: 1, y: 2 },
  );
  const narrow = { ...scenario.rooms[0], w: 260 };
  const wide = scenario.rooms[1];
  const forward = alongPath(pathPoints(narrow, wide, "lift"), 0.25);
  const reverse = alongPath(pathPoints(wide, narrow, "lift"), 0.75);
  assert.ok(
    Math.abs(forward.x - reverse.x) < 1e-8 &&
      Math.abs(forward.y - reverse.y) < 1e-8,
  );
});

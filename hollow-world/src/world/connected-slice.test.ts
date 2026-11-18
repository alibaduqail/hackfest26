import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Scenario } from "../engine/types";
import { project } from "./projection";
import { connectedSlice } from "./connected-slice";

const scenario: Scenario = JSON.parse(readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"));

test("the corridor slice meets the authored room entrances", () => {
  const slice = connectedSlice(scenario)!;
  assert.equal(slice.left.id, "d0-f1");
  assert.equal(slice.right.id, "d1-f1");
  assert.deepEqual(slice.start, project(slice.left.x + slice.left.w, slice.left.y + slice.left.h - 15, 18));
  assert.deepEqual(slice.end, project(slice.right.x, slice.right.y + slice.right.h - 15, 18));
});

test("the corridor slice is omitted when the rooms cannot share a floor", () => {
  const moved = structuredClone(scenario);
  moved.rooms.find((room) => room.id === "d1-f1")!.y += 1;
  assert.equal(connectedSlice(moved), undefined);
  moved.links = moved.links.filter((link) => link.id !== "cross-0-1");
  assert.equal(connectedSlice(moved), undefined);
});

import assert from "node:assert/strict";
import test from "node:test";
import { along, tracks } from "../run";
import { hitSector } from "./hit";

test("each rail's midpoint selects its own section", () => {
  for (const track of tracks.values()) {
    const [x, y] = along(track, 0.5);
    assert.equal(hitSector(x, y, tracks), track.sectorId);
  }
  assert.equal(hitSector(0.02, 0.98, tracks), null);
});

test("the nearest rail must be close and available", () => {
  const [x, y] = along(tracks.get("main1")!, 0.5);
  assert.equal(hitSector(x, y - 20 / 941, tracks), "main1");
  assert.equal(hitSector(x, y - 40 / 941, tracks), null);
  assert.equal(hitSector(x, y, tracks, (id) => id !== "main1"), null);
});

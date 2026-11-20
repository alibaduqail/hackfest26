import assert from "node:assert/strict";
import { test } from "node:test";
import { descentLive } from "../../../echo/descent";
import { createEngine } from "../../../echo/engine";
import { applyLayout } from "../layouts";
import { tracks } from "../run";
import { createDarkness } from "./darkness";
import { fizzles, inSignal, poolOf, POOL_R, waterBox } from "./pools";
import { sectorGraph } from "./reach";
import { warnChain } from "./track-light";

applyLayout("descent-live");
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ends = (id: string) => { const p = poolOf(tracks.get(id)!); return [[p.x1, p.y1], [p.x2, p.y2]] as [number, number][]; };

test("pools: neighbours' pools meet at their shared end, so touching beacons read as one lit region", () => {
  const g = sectorGraph(descentLive(0).world.sectors);
  for (const [id, ns] of g) {
    if (!tracks.has(id)) continue;
    for (const n of ns) {
      if (!tracks.has(n)) continue;
      const touch = Math.min(...ends(id).flatMap((a) => ends(n).map((b) => dist(a, b))));
      if (touch === 0) assert.ok(true);
      else assert.ok(touch > 2 * POOL_R, `${id} and ${n} hear each other through a city off the rail: their pools stay apart`);
    }
  }
  const p = poolOf(tracks.get("link0")!);
  assert.ok(p.cy < tracks.get("link0")!.a[1] * 941, "the pool sits in the tunnel above the rail");
});

test("fizzles: the news front breaks toward each dark neighbour at the end they share, facing into the dark", () => {
  const m = descentLive(0);
  const g = sectorGraph(m.world.sectors);
  const out = fizzles(tracks, g, new Set(["main1"]), [{ sectorId: "main1", kind: "seal", age: 0 }]);
  const toMain0 = out.find((f) => f.to === "main0")!;
  assert.deepEqual(toMain0.at, tracks.get("main1")!.a); // the main0/main1 joint
  assert.ok(toMain0.deg < -90 || toMain0.deg > 90, "main0 runs up and left from the joint");
  assert.equal(fizzles(tracks, g, new Set(["main1", "main0"]), [{ sectorId: "main1", kind: "seal", age: 0 }]).some((f) => f.to === "main0"), false);
  assert.deepEqual(fizzles(tracks, g, new Set(), [{ sectorId: "main1", kind: "announce", age: 0 }]), []);
});

test("in signal: a pod hears inside a lit section, or waiting at the edge of one it is about to enter; never in the dark", () => {
  const lit = (id: string) => id === "main0";
  assert.equal(inSignal({ at: 0, path: ["main0", "main1"], status: "moving" }, lit), true);
  assert.equal(inSignal({ at: 0, path: ["trunk2", "main0"], status: "moving" }, lit), false);
  assert.equal(inSignal({ at: 0, path: ["trunk2", "main0"], status: "waiting" }, lit), true);
  assert.equal(inSignal({ at: -1, path: ["main0"], status: "scheduled" }, lit), true);
  assert.equal(inSignal({ at: 1, path: ["trunk2", "main0"], status: "arrived" }, lit), false);
});

test("the picture agrees with the engine: Mara hears once her warn-here chain is lit and she reaches its edge", () => {
  const m = descentLive(0);
  const nurse = m.pods.find((p) => p.nurse)!;
  const chain = warnChain(m.world.sectors, m.sealSectorId!, nurse.path, -1)!;
  const e = createEngine(m, "echo");
  for (const id of chain) e.act({ type: "placeBeacon", sectorId: id, atTick: 0 });
  for (let t = 0; t < m.endTick; t++) {
    e.step();
    const o = e.observe();
    const heard = o.log.find((l) => l.kind === "seal-heard" && l.podId === nurse.id && l.tick === o.tick - 1);
    if (!heard) continue;
    const mara = o.pods.find((p) => p.id === nurse.id)!;
    const lit = (id: string) => o.sectors.find((s) => s.id === id)?.beacon !== false;
    assert.equal(inSignal({ ...mara, path: nurse.path, status: "waiting" }, lit) || lit(mara.path[mara.at]), true);
    return;
  }
  assert.fail("Mara never heard");
});

test("water fills the flooded section's tunnel, rail to ceiling", () => {
  const b = waterBox(tracks.get("main1")!);
  assert.ok(b.width > 0 && b.height > 100);
  assert.ok(b.top + b.height >= tracks.get("main1")!.a[1] * 941);
});

test("the darkness layer fails soft without a 2D context", () => {
  const layer = createDarkness({ getContext: () => null } as unknown as HTMLCanvasElement);
  assert.doesNotThrow(() => layer.set([], false));
  assert.doesNotThrow(() => layer.dispose());
});

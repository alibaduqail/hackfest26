import assert from "node:assert/strict";
import { test } from "node:test";
import { descentLive } from "../../../echo/descent";
import { descentLive2 } from "../../../echo/descent2";
import { playRun } from "../../../echo/baseline";
import { createEngine } from "../../../echo/engine";
import type { Command, Mission } from "../../../echo/types";
import { sectorGraph } from "./reach";
import { chevrons, litEnds, litRuns, pulseEntry, warnChain } from "./track-light";

const place = (ids: string[], atTick = 0): Command[] => ids.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick }));
const nurse = (m: Mission) => m.pods.find((p) => p.nurse)!;
const chainOf = (m: Mission, seal = m.sealSectorId!) => warnChain(m.world.sectors, seal, nurse(m).path, -1);
const seals = (m: Mission) => [{ at: m.sealAt!, sectorId: m.sealSectorId! }, ...(m.seals ?? [])];

test("warn-here chain: the sealed section and every link back to Mara's fork", () => {
  assert.deepEqual(chainOf(descentLive(0)), ["main1", "main0"]); // main1 floods at t41
  assert.deepEqual(chainOf(descentLive(2)), ["main2", "main1", "main0"]); // main2 at t44
  assert.deepEqual(chainOf(descentLive(1)), []); // main0 is the fork mouth: Mara sees it from the fork
  assert.equal(warnChain(descentLive(0).world.sectors, "byp1", nurse(descentLive(0)).path, -1), null); // not on her path
  const m2 = descentLive2();
  assert.deepEqual(seals(m2).map((s) => chainOf(m2, s.sectorId)), [["mainA1", "mainA0"], ["mainB1", "mainB0"]]);
});

test("each chain is one connected line over the beacon graph", () => {
  for (const m of [descentLive(0), descentLive(2), descentLive2()]) {
    const g = sectorGraph(m.world.sectors);
    for (const s of seals(m)) {
      const chain = chainOf(m, s.sectorId)!;
      for (let i = 1; i < chain.length; i++) assert.ok(g.get(chain[i])!.includes(chain[i - 1]), `${chain[i - 1]} hears ${chain[i]}`);
      assert.equal(litRuns(g, new Set(chain)).length, 1);
    }
  }
});

test("the engine agrees: the whole chain saves Mara, any missing link loses her", () => {
  for (const attempt of [0, 2]) {
    const m = descentLive(attempt);
    const chain = chainOf(m)!;
    assert.notEqual(playRun(m, "echo", place(chain)).mara, null, `${chain} lit`);
    for (const gap of chain) assert.equal(playRun(m, "echo", place(chain.filter((id) => id !== gap))).mara, null, `${gap} dark`);
  }
  const m2 = descentLive2(); // two floods: both chains lit
  const both = seals(m2).flatMap((s) => chainOf(m2, s.sectorId)!);
  assert.notEqual(playRun(m2, "echo", place(both)).mara, null);
  for (const gap of both) assert.equal(playRun(m2, "echo", place(both.filter((id) => id !== gap))).mara, null, `${gap} dark`);
  const fork = descentLive(1); // empty chain: she reroutes with no beacons at all
  assert.ok(playRun(fork, "echo").log.some((e) => e.kind === "reroute" && e.podId === nurse(fork).id));
});

test("the engine's news front walks the chain one section per tick, then Mara hears", () => {
  const m = descentLive(0);
  const chain = chainOf(m)!;
  const e = createEngine(m, "echo");
  for (const c of place(chain)) e.act(c);
  const front: string[][] = [];
  let heard = -1;
  for (let t = 0; t < m.endTick && heard < 0; t++) {
    e.step();
    const o = e.observe();
    const hop = o.pulses.filter((p) => p.kind === "seal").map((p) => p.sectorId);
    if (hop.length) front.push(hop);
    if (o.log.some((l) => l.kind === "seal-heard" && l.podId === nurse(m).id)) heard = o.tick;
  }
  assert.deepEqual(front.slice(0, chain.length), chain.map((id) => [id]));
  assert.ok(heard > 0);
});

test("lit ends: touching lit sections join, a lone one is cut off at both ends", () => {
  const m = descentLive(0);
  const g = sectorGraph(m.world.sectors);
  const tracks = new Map([
    ["link0", { a: [0, 0] as const, b: [1, 0] as const }],
    ["link1", { a: [1, 0] as const, b: [2, 0] as const }],
    ["main1", { a: [5, 5] as const, b: [6, 5] as const }],
  ]);
  const ends = litEnds(tracks, g, new Set(["link0", "link1", "main1"]));
  assert.deepEqual(ends.get("link0"), { a: false, b: true });
  assert.deepEqual(ends.get("link1"), { a: true, b: false });
  assert.deepEqual(ends.get("main1"), { a: false, b: false });
  assert.deepEqual(litRuns(g, new Set(["link0", "link1", "main1"])), [["link0", "link1"], ["main1"]]);
});

test("a pulse enters at the end shared with last tick's front; chevrons point down the section", () => {
  assert.equal(pulseEntry({ a: [0, 0], b: [1, 0] }, [{ a: [1, 0], b: [2, 0] }]), "b");
  assert.equal(pulseEntry({ a: [0, 0], b: [1, 0] }, []), null);
  const marks = chevrons({ a: [0, 0], b: [0, 1] }, 100, 200, 50);
  assert.equal(marks.length, 4);
  assert.equal(marks[0].deg, 90);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createLive } from "../cutaway/live/useLive";
import type { LogEvent, Observation, Pod } from "../../echo/types";
import { enqueue, holdMs, LINES, type Line, newLines } from "./lines";

const pod = (id: string, over: Partial<Pod> = {}) => ({ id, arriveTick: null, ...over }) as Pod;
function obs(tick: number, extra: Partial<Observation> = {}): Observation {
  return { tick, log: [], pods: [pod("MED-1")], sectors: [], floodWarnings: [{ risk: "flood" }], ...extra } as unknown as Observation;
}
const ev = (tick: number, kind: LogEvent["kind"], podId?: string): LogEvent => ({ tick, kind, podId, text: "" });
const ctx = { ended: false, stars: 0 };
const step = (kind: LogEvent["kind"], podId?: string, extra: Partial<Observation> = {}) => newLines(obs(4), obs(5, { log: [ev(4, kind, podId)], ...extra }), new Set(), ctx);
const only = (lines: Line[]) => (assert.equal(lines.length, 1), lines[0]);

test("run start: Director, once", () => {
  const first = newLines(obs(0), obs(1), new Set(), ctx);
  assert.deepEqual(first.map((l) => [l.id, l.who, l.text]), [["start", "director", LINES.start.text]]);
  assert.deepEqual(newLines(obs(0), obs(1), new Set(["start"]), ctx), []);
  assert.deepEqual(newLines(obs(3), obs(4), new Set(), ctx), []); // only the first step
});

test("no new tick, no lines (a placement republishes the same observation)", () => {
  assert.deepEqual(newLines(obs(2), obs(2, { log: [ev(2, "blind")] }), new Set(), ctx), []);
});

test("first beacon: Mara", () => {
  const l = only(step("beacon-placed"));
  assert.deepEqual([l.id, l.who, l.text], ["beacon", "mara", LINES.beacon.text]);
});

test("first blind wait: Director", () => {
  const l = only(step("blind", "MED-1"));
  assert.deepEqual([l.who, l.text], ["director", LINES.blind.text]);
});

test("flood telegraph: Director names the section and minutes, then Mara says where to bolt beacons, once", () => {
  const warn = { floodWarnings: [{ risk: "flood", sectorId: "main1", at: 18 }] };
  const [d, m, ...rest] = newLines(obs(9), obs(10, warn), new Set(), { ...ctx, coach: true });
  assert.deepEqual([d.who, d.text], ["director", "The middle main shaft floods in 8 min. I didn't warn anyone. Did you?"]);
  assert.deepEqual([m.who, m.text], ["mara", "Bolt a beacon on the middle main shaft and the shaft above. The news hops to me."]);
  assert.equal(rest.length, 0);
  assert.deepEqual(newLines(obs(10, warn), obs(11, warn), new Set(), ctx), []); // already on screen
  assert.deepEqual(newLines(obs(9), obs(10, warn), new Set(["flood", "floodMara"]), { ...ctx, coach: true }), []);
  // no coaching outside leg 1, or for any other flood
  assert.deepEqual(newLines(obs(9), obs(10, warn), new Set(), ctx).map((l) => l.id), ["flood"]);
  const other = { floodWarnings: [{ risk: "flood", sectorId: "main2", at: 18 }] };
  assert.deepEqual(newLines(obs(9), obs(10, other), new Set(), { ...ctx, coach: true }).map((l) => l.id), ["flood"]);
});

test("reroute: Mara, then the Director queued right after; other pods do not trigger", () => {
  const lines = step("reroute", "MED-1");
  assert.deepEqual(lines.map((l) => [l.who, l.text]), [["mara", LINES.reroute.text], ["director", LINES.rerouteDirector.text]]);
  assert.deepEqual(step("reroute", "SUP-3"), []);
});

test("forged credential refused: Mara", () => {
  const l = only(step("credential-reject", "GHOST-1"));
  assert.deepEqual([l.who, l.text], ["mara", LINES.forged.text]);
});

test("Mara held at the seal: Director; a tower-down hold before any seal stays silent", () => {
  const l = only(step("hold", "MED-1", { sectors: [{ sealed: true }] } as never));
  assert.deepEqual([l.who, l.text], ["director", LINES.held.text]);
  assert.deepEqual(step("hold", "MED-1"), []);
  assert.deepEqual(step("hold", "SUP-3", { sectors: [{ sealed: true }] } as never), []);
});

test("win: Mara arrived with a star; fail otherwise", () => {
  const arrived = { pods: [pod("MED-1", { arriveTick: 40 })] };
  const win = only(newLines(obs(40), obs(41, arrived), new Set(), { ended: true, stars: 1 }));
  assert.deepEqual([win.id, win.who, win.text], ["win", "director", LINES.win.text]);
  const late = only(newLines(obs(40), obs(41, arrived), new Set(), { ended: true, stars: 0 }));
  assert.equal(late.id, "fail");
  const fail = only(newLines(obs(40), obs(41), new Set(), { ended: true, stars: 0 }));
  assert.deepEqual([fail.id, fail.who, fail.text], ["fail", "director", LINES.fail.text]);
  assert.deepEqual(newLines(obs(40), obs(41, arrived), new Set(), { ended: false, stars: 1 }), []);
});

test("queue keeps only the newest two; hold time scales with length", () => {
  const mk = (id: string): Line => ({ id, who: "mara", text: id });
  assert.deepEqual(enqueue([mk("a"), mk("b")], [mk("c")]).map((l) => l.id), ["b", "c"]);
  assert.deepEqual(enqueue([], [mk("a"), mk("b"), mk("c")]).map((l) => l.id), ["b", "c"]);
  assert.deepEqual(enqueue([mk("a")], [mk("b")]).map((l) => l.id), ["a", "b"]);
  assert.equal(holdMs("short"), 3500);
  assert.equal(holdMs("x".repeat(200)), 4500);
  assert.ok(holdMs("x".repeat(60)) > 3500 && holdMs("x".repeat(60)) < 4500);
});

test("real run: no beacons fails once; solution replay speaks start, beacon, flood, reroute, win in order", () => {
  const seen = (solution: boolean) => {
    const run = createLive();
    if (solution) run.watchSolution();
    else run.start();
    const fired = new Set<string>(), said: string[] = [];
    for (let i = 0; i < 200; i++) {
      const s = run.getSnapshot();
      if (s.ended) break;
      run.step();
      const n = run.getSnapshot();
      const mara = n.observation.pods.find((p) => p.id === "MED-1")!;
      const stars = mara.arriveTick === null ? 0 : 1;
      for (const l of newLines(n.previous, n.observation, fired, { ended: n.ended, stars, coach: true })) { fired.add(l.id); said.push(l.id); }
    }
    return said;
  };
  const noBeacons = seen(false);
  assert.equal(noBeacons[0], "start");
  assert.ok(noBeacons.includes("blind"));
  assert.equal(new Set(noBeacons).size, noBeacons.length);
  assert.equal(noBeacons.at(-1), "fail");
  const solved = seen(true);
  for (const id of ["start", "beacon", "flood", "floodMara", "reroute", "rerouteDirector"]) assert.ok(solved.includes(id), id);
  assert.equal(solved.at(-1), "win");
  assert.ok(solved.indexOf("flood") < solved.indexOf("reroute"));
});

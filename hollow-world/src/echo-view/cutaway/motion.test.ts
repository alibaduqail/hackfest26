import assert from "node:assert/strict";
import test from "node:test";
import { frameProgress } from "./motion";

test("an animation frame timestamp can precede the scene start", () => {
  assert.equal(frameProgress(950, 1000, 410), 0);
  assert.equal(frameProgress(1050, 1000, 100), 0.5);
  assert.equal(frameProgress(1150, 1000, 100), 1);
  assert.equal(frameProgress(950, 1000, 0), 1);
});

// ---- Pod routes: pods ride the track, never cut across the map.
import { createEngine } from "../../echo/engine";
import { descentLive2, DESCENT_LIVE_SOLUTION_2 } from "../../echo/descent2";
import { descentLive3, DESCENT_LIVE_SOLUTION_3 } from "../../echo/descent3";
import type { Observation, Pod } from "../../echo/types";
import { buildRoute, compileRoute, restFacing, sampleRoute } from "./motion";
import { applyLayout } from "./layouts";
import { createRun, podBerth, podDock, podPose, type Point, tracks } from "./run";

function onSegment(p: Point, a: Point, b: Point, eps = 1e-6) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const u = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  return Math.hypot(a[0] + dx * u - p[0], a[1] + dy * u - p[1]) < eps;
}
/** Every leg of the route lies on a track section or on the pod's own dock/berth connector. */
function assertRidesTrack(route: Point[], pod: Pod, label: string) {
  const first = tracks.get(pod.path[0]), last = tracks.get(pod.path[pod.path.length - 1]);
  const lines: [Point, Point][] = [...tracks.values()].map((t) => [t.a, t.b]);
  if (first) lines.push([podDock(pod), first.a]);
  if (last) lines.push([last.b, podBerth(pod)]);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    const ok = lines.some(([p, q]) => onSegment(a, p, q) && onSegment(b, p, q));
    assert.ok(ok, `${label}: leg ${a} -> ${b} leaves the track`);
  }
}
function checkRun(obsAt: (t: number) => Observation, end: number, label: string) {
  let legs = 0;
  for (let t = 1; t <= end; t++) {
    const now = obsAt(t), before = obsAt(t - 1);
    for (const p of now.pods) {
      const old = before.pods.find((q) => q.id === p.id)!;
      const route = buildRoute(old, p);
      const a = podPose(old), b = podPose(p);
      assert.deepEqual(route[0], route.length > 1 ? a : b);
      assert.deepEqual(route[route.length - 1], b);
      assertRidesTrack(route, p, label + " t" + t + " " + p.id);
      legs += route.length - 1;
    }
  }
  assert.ok(legs > 0);
}
function runOf(mission: ReturnType<typeof descentLive2>, solution: Parameters<ReturnType<typeof createEngine>["act"]>[0][]) {
  const engine = createEngine(mission, "echo");
  for (const c of solution) engine.act(c);
  const frames: Observation[] = [engine.observe()];
  while (!frames.at(-1)!.over) {
    engine.step();
    frames.push(engine.observe());
  }
  return frames;
}

test("level 1: every tick's pod route rides the track in both modes, including the reroute", () => {
  for (const mode of ["echo", "tower"] as const) {
    const sample = createRun(mode);
    checkRun((t) => sample(t).obs, sample(0).obs.endTick, "L1 " + mode);
  }
});
test("levels 2 and 3 routes ride their own layout", () => {
  try {
    for (const [id, mission, solution] of [["descent-live-2", descentLive2(), DESCENT_LIVE_SOLUTION_2], ["descent-live-3", descentLive3(), DESCENT_LIVE_SOLUTION_3]] as const) {
      applyLayout(id);
      const frames = runOf(mission, solution as never);
      checkRun((t) => frames[Math.min(t, frames.length - 1)], frames.length - 1, id);
    }
  } finally {
    applyLayout("");
  }
});

// Real pod, re-posed at any (section, progress) of its own path.
function podAt(base: Pod, at: number, progress: number, extra: Partial<Pod> = {}): Pod {
  return { ...base, at, progress, status: "moving", ...extra };
}
const med = () => createRun("echo")(0).obs.pods.find((p) => p.id === "MED-1")!;

test("a corner transition follows the corner instead of cutting through rock", () => {
  const m = med(); // ramp1 runs along the floor, ramp2 drops down the shaft
  const [before, after] = [podAt(m, 1, .9), podAt(m, 2, .1)];
  const route = buildRoute(before, after);
  const corner = tracks.get(m.path[1])!.b;
  assert.ok(route.some((p) => p[0] === corner[0] && p[1] === corner[1]), "passes through the shared corner");
  assertRidesTrack(route, m, "corner");
  assert.equal(route.length, 3); // old pose, corner, new pose
  const [p, q] = [podPose(before), podPose(after)], mid: Point = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  assert.ok(![...tracks.values()].some((t) => onSegment(mid, t.a, t.b)), "the old straight lerp cut through rock here");
});
test("a multi-section jump in one tick passes through every intermediate corner", () => {
  const m = med();
  const route = buildRoute(podAt(m, 0, .5), podAt(m, 4, .25));
  for (const i of [0, 1, 2, 3]) {
    const b = tracks.get(m.path[i])!.b;
    assert.ok(route.some((p) => p[0] === b[0] && p[1] === b[1]), "corner " + i);
  }
  assertRidesTrack(route, m, "jump");
});
test("the junction inset still rides the junction line", () => {
  const m = med();
  const i = m.path.indexOf("trunk0");
  const route = buildRoute(podAt(m, i - 1, .8), podAt(m, i + 1, .3));
  assertRidesTrack(route, m, "inset");
  assert.deepEqual(route.at(-1), podPose(podAt(m, i + 1, .3)));
});
test("docks and berths are reached along a connector on the line, never by a jump", () => {
  const m = med();
  const leave = buildRoute(podAt(m, -1, 0, { status: "waiting" }), podAt(m, 0, .2));
  assert.deepEqual(leave[0], podDock(m));
  assert.deepEqual(leave[1], tracks.get(m.path[0])!.a);
  assertRidesTrack(leave, m, "dock");
  const last = m.path.length - 1;
  const arrive = buildRoute(podAt(m, last, .8), podAt(m, last, 1, { status: "arrived" }));
  assert.deepEqual(arrive.at(-1), podBerth(m));
  assert.deepEqual(arrive.at(-2), tracks.get(m.path[last])!.b);
  assertRidesTrack(arrive, m, "berth");
  assert.equal(buildRoute(podAt(m, last, 1, { status: "arrived" }), podAt(m, last, 1, { status: "arrived" })).length, 1);
});
test("a reroute backs along the old track to the shared junction, then follows the new route", () => {
  const m = med();
  const j = m.path.indexOf("trunk2");
  const bypass = [...m.path.slice(0, j + 1), "byp0", "byp1"];
  // Old pose on main0 (not on the new path) -> new pose one section further on the bypass.
  const old = podAt(m, j + 1, .5), cur = podAt({ ...m, path: bypass, rerouted: true }, j + 1, .4);
  const route = buildRoute(old, cur);
  const junction = tracks.get("trunk2")!.b;
  assert.ok(route.some((p) => p[0] === junction[0] && p[1] === junction[1]), "goes back to the junction");
  assertRidesTrack(route, cur, "reroute");
  // No shared section at all: straight but still finite, never NaN.
  const alone = buildRoute(old, podAt({ ...m, path: ["byp0", "byp1"] }, 0, .4));
  assert.ok(alone.every((p) => p.every(Number.isFinite)));
});
test("sampling walks the polyline by arc length and faces the direction of travel", () => {
  const m = med();
  const pts = buildRoute(podAt(m, 1, .5), podAt(m, 2, .5)); // along the floor, then down
  const r = compileRoute(pts, 1672, 941, restFacing(podAt(m, 1, .5)));
  const out = { x: 0, y: 0, left: true };
  sampleRoute(r, 0, out, false);
  assert.ok(Math.abs(out.x - pts[0][0] * 1672) < 1e-6 && out.left === false);
  sampleRoute(r, 1, out, false);
  assert.ok(Math.abs(out.y - pts.at(-1)![1] * 941) < 1e-6);
  assert.equal(out.left, false, "a vertical leg keeps the facing from before");
  for (const t of [.1, .3, .5, .7, .9]) {
    sampleRoute(r, t, out, false);
    assert.ok(pts.slice(1).some((b, i) => onSegment([out.x / 1672, out.y / 941], pts[i], b)), "t=" + t + " stays on the line");
  }
  // Moving left (junction section 6 runs right to left) faces left.
  const i = m.path.indexOf("trunk0");
  const l = compileRoute(buildRoute(podAt(m, i, .2), podAt(m, i, .8)), 1672, 941, false);
  sampleRoute(l, .5, out, false);
  assert.equal(out.left, tracks.get(m.path[i])!.b[0] < tracks.get(m.path[i])!.a[0]);
});

// ---- Pods never jump back: no route doubles back on itself, and re-showing a tick never replays it.
import { DESCENT_LEVELS } from "../../echo/descent-levels";
import { tweenFor, type Tween } from "./motion";

/** A route that reverses direction (two consecutive legs more than 120 degrees apart) is a pod driving backwards along its own track. */
function assertNoReversal(route: Point[], label: string) {
  const px = route.map((p) => [p[0] * 1672, p[1] * 941]);
  for (let i = 2; i < px.length; i++) {
    const ax = px[i - 1][0] - px[i - 2][0], ay = px[i - 1][1] - px[i - 2][1];
    const bx = px[i][0] - px[i - 1][0], by = px[i][1] - px[i - 1][1];
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 2 || lb < 2) continue;
    assert.ok((ax * bx + ay * by) / (la * lb) > -0.5, `${label}: route doubles back at ${px[i - 1].map(Math.round)} (${JSON.stringify(px.map((q) => q.map(Math.round)))})`);
  }
}
function checkForward(frames: (t: number) => Observation, end: number, label: string) {
  for (let t = 1; t <= end; t++) {
    const now = frames(t), before = frames(t - 1);
    for (const p of now.pods) {
      const old = before.pods.find((q) => q.id === p.id)!;
      const route = buildRoute(old, p);
      assert.deepEqual(route[0], route.length > 1 ? podPose(old) : podPose(p), `${label} t${t} ${p.id}: starts where the last tick ended`);
      assertNoReversal(route, `${label} t${t} ${p.id}`);
    }
  }
}
test("pods never drive backwards: every tick of levels 1-3 (story echo/tower, live attempts with and without beacons)", () => {
  for (const mode of ["echo", "tower"] as const) {
    const sample = createRun(mode);
    checkForward((t) => sample(t).obs, sample(0).obs.endTick, "L1 story " + mode);
  }
  try {
    for (const level of DESCENT_LEVELS) {
      applyLayout(level.id);
      for (let attempt = 0; attempt < 4; attempt++) {
        for (const beacons of [true, false]) {
          const frames = runOf(level.build(attempt), beacons ? level.solutionFor(attempt) : []);
          checkForward((t) => frames[Math.min(t, frames.length - 1)], frames.length - 1, `${level.id} a${attempt} ${beacons ? "solved" : "bare"}`);
        }
      }
    }
  } finally {
    applyLayout("");
  }
});
test("a dock on the pod's first section rolls forward out of it (SUP-2 used to slide back to the start of the track)", () => {
  const sup2 = createRun("echo")(0).obs.pods.find((p) => p.id === "SUP-2")!;
  const first = tracks.get(sup2.path[0])!;
  const dock = podDock(sup2);
  const out = buildRoute(podAt(sup2, -1, 0, { status: "waiting" }), podAt(sup2, 0, 1 / 3));
  assert.ok(!out.some((p) => p[0] === first.a[0] && p[1] === first.a[1]), "does not visit the section start behind the dock");
  assert.ok(out.at(-1)![0] > dock[0], "ends ahead of where it waited");
  assert.equal(restFacing(podAt(sup2, -1, 0, { status: "waiting" })), first.b[0] < first.a[0], "waits facing its way out");
});
test("re-showing the tick on screen keeps its clock: pause, hold, resume or a speed change never replay it", () => {
  let tw: Tween | null = tweenFor(null, 5, true, 600, 1000);
  assert.deepEqual(tw, { tick: 5, start: 1000, duration: 600 });
  assert.equal(tweenFor(tw, 5, false, 0, 1300), tw, "pause mid-tick");
  assert.equal(tweenFor(tw, 5, true, 150, 1400), tw, "resume at 4x: same clock, same duration");
  tw = tweenFor(tw, 6, false, 600, 2000); // paused on a fresh tick: snapped
  assert.equal(tw.duration, 0);
  assert.equal(tweenFor(tw, 6, true, 600, 2500), tw, "resume after a hold stays at the end pose");
  assert.deepEqual(tweenFor(tw, 7, true, 600, 3000), { tick: 7, start: 3000, duration: 600 }, "the next tick animates");
});

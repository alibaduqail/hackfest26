import { createEngine } from "../../echo/engine";
import { descent, DESCENT_BEATS, DESCENT_LAYOUT } from "../../echo/descent";
import { descentLive2 } from "../../echo/descent2";
import { descentLive3 } from "../../echo/descent3";
import type { LogEvent, Observation, Pod } from "../../echo/types";

export type System = "tower" | "echo";
export type Point = readonly [number, number];
export const beats = DESCENT_BEATS;
export const beatNames = [
  "Tower lies",
  "Dispatch",
  "Priority",
  "Credential",
  "Seal + reroute",
  "Nurse arrives",
  "Medicine",
];
export const beatLevels = [1, 2, 3, 2, 4, 5, 5];
const paths: Record<"track" | "main" | "bypass", Point[]> = {
  track: [
    [.326, .225],
    [.425, .225],
    [.513, .225],
    [.513, .407],
    [.664, .407],
    [.790, .407],
    [.827, .594],
    [.743, .594],
    [.652, .594],
    [.513, .594],
  ],
  main: [[.513, .594], [.603, .765], [.736, .765], [.71, .944]],
  bypass: [[.513, .594], [.373, .708], [.337, .80], [.374, .944], [.71, .944]],
};
export const tracks = new Map(DESCENT_LAYOUT.sectors.map((s) => {
  const path = paths[s.shaft];
  return [s.sectorId, { ...s, a: path[s.order], b: path[s.order + 1] }];
}));
export type Track = NonNullable<ReturnType<typeof tracks.get>>;
export function along(track: Track, fraction: number): Point {
  return [track.a[0] + (track.b[0] - track.a[0]) * fraction, track.a[1] + (track.b[1] - track.a[1]) * fraction];
}
export function neighbors(a: Track, b: Track) {
  return [a.a, a.b].some((p) => [b.a, b.b].some((q) => p[0] === q[0] && p[1] === q[1]));
}

const dock: Record<string, Point> = {
  "MED-1": [.125, .225],
  "SUP-3": [.213, .225],
  "PAX-1": [.902, .594],
  "SUP-1": [.325, .225],
  "SUP-2": [.421, .225],
  "GHOST-1": [.555, .407],
};
const berths: Record<string, Point> = {
  "MED-1": [.895, .944],
  "SUP-3": [.790, .944],
  "PAX-1": [.594, .944],
  "GHOST-1": [.495, .944],
  "SUP-1": [.648, .407],
  "SUP-2": [.737, .407],
};
/** Where a pod waits before it enters its first track section. */
export function podDock(pod: Pod): Point {
  return dock[pod.id] ?? tracks.get(pod.path[0])!.a;
}
/** Where an arrived pod parks. Levels 2-3 bring pods with no fixed berth, so those line up along the floor. */
export function podBerth(pod: Pod): Point {
  return berths[pod.id] ?? ([.4 + (pod.id.charCodeAt(pod.id.length - 1) % 4) * .07, .944] as Point);
}
/** A point on a track section. Junction sections (level 1, order >= 6) are drawn inset: the engine tracks a point, the art shows the pod inside its occupied box. */
export function onTrack(track: Track, progress: number): Point {
  if (track.shaft === "track" && track.order >= 6) {
    const inset = .034 / Math.abs(track.b[0] - track.a[0]);
    progress = inset + progress * (1 - 2 * inset);
  }
  return along(track, progress);
}
export function podPose(pod: Pod): Point {
  if (pod.status === "arrived") return podBerth(pod);
  if (pod.at < 0) return podDock(pod);
  return onTrack(tracks.get(pod.path[pod.at])!, pod.progress);
}

export interface Frame {
  obs: Observation;
  rejected: Map<string, LogEvent>;
  events: LogEvent[];
  arrived: Set<string>;
}
const tickerKinds = new Set([
  "tower-down",
  "yield",
  "credential-reject",
  "seal",
  "seal-heard",
  "reroute",
  "arrive",
  "grant",
  "hold",
]);
export function createRun(mode: System) {
  const engine = createEngine(descent(), mode);
  const frames: Frame[] = [];
  function sample(tick: number) {
    while (frames.length <= tick) {
      if (frames.length) engine.step();
      const obs = engine.observe();
      const previous = frames.at(-1);
      const rejected = new Map(previous?.rejected);
      const arrived = new Set(previous?.arrived);
      const events = [...(previous?.events ?? [])];
      // The shared log is capped. Consume only events from the tick just completed.
      for (const event of obs.log.filter((e) => e.tick === obs.tick - 1)) {
        if (event.kind === "arrive" && event.podId) arrived.add(event.podId);
        if (event.kind === "credential-reject" && event.podId) {
          if (rejected.has(event.podId)) continue;
          rejected.set(event.podId, event);
        }
        if (tickerKinds.has(event.kind)) events.push(event);
      }
      frames.push({ obs, rejected, arrived, events: events.slice(-3) });
      if (obs.over) break;
    }
    return frames[Math.min(tick, frames.length - 1)];
  }
  return sample;
}

export function beatAt(tick: number) {
  return beats.filter((b) => b.tick <= tick).length;
}
// The comparison uses Echo's capture clock in both modes, including when Tower never reroutes.
export function captureStops(echo: ReturnType<typeof createRun>) {
  const end = echo(0).obs.endTick;
  return beats.map((beat, i) => {
    const settled = beats[i + 1] ? beats[i + 1].tick - 1 : end;
    const first = beat.tick + 1;
    let cue = first;
    if (beat.beat === 5) {
      for (let t = first; t <= settled; t++) {
        if (echo(t).obs.pods.some((p) => p.nurse && p.rerouted)) {
          cue = t;
          break;
        }
      }
    }
    return { cue, settled };
  });
}

const routeLabels: Record<string, string> = {
  spur: "forged spur",
  paxline: "passenger line",
  mainA: "first main shaft",
  bypA: "first bypass",
  mainB: "second main shaft",
  bypB: "second bypass",
  ramp: "depot ramp",
  link: "relay track",
  trunk: "junction track",
  main: "main shaft",
  byp: "dry bypass",
};
const sectorNames = new Map(
  [descent(), descentLive2(), descentLive3()].flatMap((m) => m.world.sectors.map((s) => [s.id, routeLabels[s.routeId] + " section " + (s.index + 1)] as const)),
);
export function displayLocations(text: string) {
  return text.replace(/\b[A-Za-z]+\d+\b/g, (id) => sectorNames.get(id) ?? id);
}
export function describe(frame: Frame, beat: number): [string, string] {
  const { obs, arrived, rejected } = frame;
  const med = obs.pods.find((p) => p.nurse)!;
  const supply = obs.pods.find((p) => p.cargo === "medicine")!;
  if (!beat) {
    return [
      "From depot to deep clinic",
      "Nurse Mara Vale and a pod of medicine are due below. The upper depot still has tower clearance.",
    ];
  }
  if (beat === 1) {
    return [
      obs.towerUp ? "Directorate clearance" : "The tower goes dark",
      obs.towerUp ? "The depot counts tower authorizations and actual pod movement separately." : beats[0].caption,
    ];
  }
  if (obs.mode === "tower") {
    return [
      beat >= 6 ? "The clinic is still waiting" : "Tower dark · no clearances",
      "Mara and the medicine pod are still at the upper depot. The clinic is waiting for both.",
    ];
  }
  switch (beat) {
    case 2:
      return [
        "Dispatch by beacon",
        med.at < 0 ? "The depot beacon is checking the first track section." : beats[1].caption,
      ];
    case 3:
      return [
        "One pod per track section",
        obs.log.some((e) => e.kind === "yield")
          ? "Passengers let Mara through and wait at the junction. Medical goes first."
          : "Medical, supply and passenger pods approach the same junction.",
      ];
    case 4:
      return [
        "The beacon checks the pod",
        rejected.size ? beats[3].caption : "The relay checks the pod’s simulated medical signature.",
      ];
    case 5:
      return [
        "News hops. Pods reroute.",
        med.rerouted
          ? "Mara has heard the seal news. Her pod takes the dry bypass to the clinic."
          : "Trackside radios carry seal news one neighbor at a time.",
      ];
    case 6:
      return [
        arrived.has(med.id) ? "Mara reaches the clinic" : "The nurse approaches",
        arrived.has(med.id)
          ? "The bed lamp is on. The clinic still needs the medicine traveling separately."
          : "The clinic attendant is waiting at the end of the line.",
      ];
    default:
      return [
        arrived.has(supply.id) ? "Medicine reaches the deep clinic" : "Medicine approaches the clinic",
        arrived.has(supply.id)
          ? "Mara is on duty. The medicine pod has arrived, and the clinic shelf now holds medicine."
          : "The medicine pod is closing the last track section. The medicine shelf is still empty.",
      ];
  }
}

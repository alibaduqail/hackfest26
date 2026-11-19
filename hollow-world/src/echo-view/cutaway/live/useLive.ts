import { useEffect, useState, useSyncExternalStore } from "react";
import { createEngine } from "../../../echo/engine";
import { descentLive } from "../../../echo/descent";
import { DESCENT_LEVELS } from "../../../echo/descent-levels";
import type { Command, LogEvent, Mission, Observation, Pod } from "../../../echo/types";

type Speed = 1 | 2;
type Result = { ok: boolean; reason?: string };

type LiveState = {
  mission: Mission;
  observation: Observation;
  previous: Observation;
  playing: boolean;
  ended: boolean;
  events: readonly LogEvent[];
  speed: Speed;
  remaining: number;
  commands: Command[];
  queued: ReadonlySet<string>;
  solution: boolean;
  attempt: number; // retries so far: free play picks the flood candidate from it
  building: ReadonlySet<string>; // beacons ordered and ticking toward live (the engine's build delay)
  feedback: string | null;
  stepMs: number;
  slow: boolean;
};

export function heldAtFlood(pod: Pod, obs: Observation): boolean {
  return pod.status === "holding" && obs.sectors.some((sector) => sector.sealed && sector.id === pod.path[pod.at + 1]);
}

function complete(obs: Observation): boolean {
  return obs.over || obs.pods.filter((p) => p.id === "MED-1" || p.id === "SUP-3")
    .every((p) => p.status === "arrived" || heldAtFlood(p, obs));
}

/** A flood telegraph (sector and minute) is on screen. Read from the observation, never from the mission, so nothing shows before the reveal. */
export function warning(_mission: Mission, obs: Observation): boolean {
  return !!obs.floodWarnings?.some((w) => w.sectorId !== undefined);
}

function blindApproach(obs: Observation): boolean {
  return obs.pods.some((pod) => {
    if ((pod.id !== "MED-1" && pod.id !== "SUP-3") || !["moving", "waiting"].includes(pod.status)) return false;
    const next = obs.sectors.find((sector) => sector.id === pod.path[pod.at + 1]);
    const current = obs.sectors.find((sector) => sector.id === pod.path[pod.at]);
    return next?.beacon === false && !next.sealed &&
      (pod.status === "waiting" || !current || (1 - pod.progress) * current.minutes <= 3);
  });
}

/** Which level to run: defaults to Descent I. A journey leg passes its own (budget-capped) mission and that level's solution. */
export interface LiveSpec { build: (attempt: number) => Mission; solution: (attempt: number) => Command[] }
const LEVEL_1: LiveSpec = { build: (a) => descentLive({ attempt: a }), solution: (a) => DESCENT_LEVELS[0].solutionFor(a) };

export function createLive(spec: LiveSpec = LEVEL_1) {
  let attempt = 0;
  let mission = spec.build(attempt);
  let engine = createEngine(mission, "echo");
  let observation = engine.observe();
  let previous = observation;
  let playing = false, started = false, solution = false, override = false;
  let speed: Speed = 1;
  let commands: Command[] = [];
  let slowTicks = 0;
  let events: LogEvent[] = [];
  let queued = new Set<string>();
  let feedback: string | null = null;
  const listeners = new Set<() => void>();

  function snapshot(): LiveState {
    const ended = complete(observation);
    // Reserve 11 slow ticks for the flood countdown (only once its telegraph is visible).
    const limit = warning(mission, observation) ? 16 : 5;
    const remaining = Math.max(0, (mission.beaconBudget ?? 0) - commands.length);
    const slow = !ended && !override && slowTicks < limit &&
      (warning(mission, observation) || (remaining > 0 && blindApproach(observation)));
    return {
      mission,
      observation,
      previous,
      playing,
      ended,
      events,
      speed,
      commands,
      queued,
      solution,
      attempt,
      building: new Set((observation.building ?? []).map((b) => b.sectorId)),
      feedback,
      remaining,
      slow,
      stepMs: 600 / speed / (slow ? 0.35 : 1),
    };
  }
  let state = snapshot();
  function publish() {
    state = snapshot();
    listeners.forEach((listener) => listener());
  }
  function suppressSlow() {
    if (state.slow) override = true;
  }
  function reset(watch: boolean) { // watching the solution replays the same flood; a retry draws the next one
    mission = spec.build(attempt);
    engine = createEngine(mission, "echo");
    observation = engine.observe();
    previous = observation;
    playing = watch;
    started = watch;
    solution = watch;
    override = false;
    slowTicks = 0;
    events = [];
    commands = [];
    queued = new Set();
    feedback = null;
    publish();
  }
  function place(sectorId: string): Result {
    suppressSlow();
    const command: Command = { type: "placeBeacon", sectorId, atTick: observation.tick };
    const result = state.ended
      ? { ok: false, reason: "run ended" }
      : solution
      ? { ok: false, reason: "solution is read-only" }
      : engine.act(command);
    feedback = result.ok ? null : result.reason ?? "placement refused";
    if (result.ok) {
      commands = [...commands, command];
      queued = new Set(queued).add(sectorId);
      if (!started) {
        started = true;
        playing = true;
      }
    }
    publish();
    return result;
  }
  function step() {
    if (state.ended) return;
    if (state.slow) slowTicks++;
    if (solution) {
      for (const command of spec.solution(attempt)) {
        if (command.atTick !== observation.tick) continue;
        const result = engine.act(command);
        if (result.ok) commands = [...commands, command];
        else feedback = result.reason ?? "solution placement refused";
      }
    }
    previous = observation;
    engine.step();
    observation = engine.observe();
    // queued = accepted this tick, not stepped yet; once stepped a beacon is `building` (observation.building) until it is live
    queued = new Set([...queued].filter((id) => !observation.sectors.find((sector) => sector.id === id)?.beacon && !observation.building?.some((b) => b.sectorId === id)));
    events = [...events, ...observation.log.filter((e) => e.tick === previous.tick)];
    if (
      (!warning(mission, previous) && warning(mission, observation)) ||
      (!warning(mission, observation) && !blindApproach(observation))
    ) override = false;
    if (complete(observation)) playing = false;
    publish();
  }
  function start() { // the intro's Start button: unpause in one click
    if (!state.ended) { playing = true; started = true; }
    publish();
  }
  function togglePause() {
    suppressSlow();
    if (!state.ended) {
      playing = !playing;
      started = true;
    }
    publish();
  }
  function setSpeed(next: Speed) {
    speed = next;
    publish();
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    place,
    step,
    togglePause,
    start,
    setSpeed,
    retry: () => { attempt++; reset(false); },
    watchSolution: () => reset(true),
  };
}

export function useLive(spec?: LiveSpec) {
  const [run] = useState(() => createLive(spec));
  const state = useSyncExternalStore(run.subscribe, run.getSnapshot, run.getSnapshot);
  useEffect(() => {
    if (!state.playing) return;
    if (document.hidden) {
      run.togglePause();
      return;
    }
    const timer = setTimeout(() => {
      if (run.getSnapshot() === state) run.step();
    }, state.stepMs);
    return () => clearTimeout(timer);
  }, [run, state]);
  useEffect(() => {
    function hide() {
      if (document.hidden && run.getSnapshot().playing) run.togglePause();
    }
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, [run]);
  return {
    ...state,
    place: run.place,
    togglePause: run.togglePause,
    start: run.start,
    setSpeed: run.setSpeed,
    retry: run.retry,
    watchSolution: run.watchSolution,
  };
}

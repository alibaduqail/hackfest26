/// <reference lib="webworker" />
import { HollowEngine } from "./engine";
import { replayWorld } from "./replay";
import type { WorkerRequest, WorkerResponse } from "./types";
let engine: HollowEngine | undefined,
  playing = true,
  speed = 60,
  accumulator = 0,
  last = performance.now(),
  serial = 0,
  achieved = 0,
  tickMs = 0;
function send(message: WorkerResponse) {
  self.postMessage(message);
}
function publish() {
  if (engine)
    send({
      type: "state",
      state: engine.state,
      playing,
      speed,
      achievedSpeed: achieved,
      tickMs,
    });
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const message = event.data;
    if (message.type === "init") {
      const next = new HollowEngine(
        message.scenario,
        undefined,
        `run-${++serial}`,
      );
      engine = next;
      playing = true;
      accumulator = 0;
    } else if (message.type === "replay") {
      const next = replayWorld(message.replay);
      engine = next;
      playing = false;
      accumulator = 0;
    } else if (message.type === "load") {
      const next = new HollowEngine(message.scenario, message.state);
      engine = next;
      playing = false;
      accumulator = 0;
    } else if (!engine) throw new Error("World is not initialized");
    else if (message.type === "play") {
      playing = !!message.playing;
      accumulator = 0;
    } else if (message.type === "speed") {
      if (![1, 10, 60, 300].includes(message.speed))
        throw new Error("Unsupported speed");
      speed = message.speed;
    } else if (message.type === "step") {
      playing = false;
      engine.step(60);
    } else if (message.type === "incident") engine.incident(message.kind);
    else if (message.type === "command")
      send({ type: "receipt", receipt: engine.act(message.command) });
    else if (message.type === "reset") {
      engine = new HollowEngine(engine.scenario, undefined, `run-${++serial}`);
      playing = false;
      accumulator = 0;
    } else throw new Error("Unknown worker request");
    last = performance.now();
    publish();
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : "Simulation failed",
    });
  }
};
setInterval(() => {
  const now = performance.now(),
    elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (!engine || !playing) return;
  accumulator = Math.min(accumulator + elapsed * speed, Math.max(speed, 120));
  const start = performance.now();
  let steps = 0;
  try {
    while (accumulator >= 1 && performance.now() - start < 16 && steps < 120) {
      engine.step();
      accumulator--;
      steps++;
    }
    tickMs = steps ? (performance.now() - start) / steps : tickMs;
    achieved = elapsed ? Math.round(steps / elapsed) : 0;
    publish();
  } catch (error) {
    playing = false;
    send({
      type: "error",
      message: error instanceof Error ? error.message : "Simulation failed",
    });
  }
}, 100);

import { HollowEngine } from "./engine";
import type { ReplayFile } from "./types";
export function replayWorld(file: ReplayFile) {
  if (
    file.format !== "hollow-replay-v1" ||
    !Number.isSafeInteger(file.finalTick) ||
    file.finalTick < 0 ||
    file.finalTick > 604800 ||
    !Array.isArray(file.actions) ||
    !Array.isArray(file.commands) ||
    file.actions.length + file.commands.length > 10000
  )
    throw new Error("Invalid replay or size/time limit exceeded");
  const engine = new HollowEngine(file.scenario);
  const actions = new Map<number, ReplayFile["actions"]>(),
    commands = new Map<number, ReplayFile["commands"]>();
  for (const [items, map] of [
    [file.actions, actions],
    [file.commands, commands],
  ] as const)
    for (const item of items) {
      if (
        !Number.isSafeInteger(item.tick) ||
        item.tick < 0 ||
        item.tick > file.finalTick
      )
        throw new Error("Replay event tick outside the run");
      const list = map.get(item.tick) ?? [];
      (list as unknown[]).push(item);
      map.set(item.tick, list as never);
    }
  for (let tick = 0; tick <= file.finalTick; tick++) {
    const inputs = [
      ...(actions.get(tick) ?? []).map((a) => ({
        order: a.order,
        action: a,
        command: null,
      })),
      ...(commands.get(tick) ?? []).map((c) => ({
        order: c.order,
        action: null,
        command: c.command,
      })),
    ].sort((a, b) => a.order - b.order);
    for (const input of inputs) {
      if (!Number.isSafeInteger(input.order))
        throw new Error("Invalid replay input sequence");
      if (input.action) engine.incident(input.action.kind);
      else if (input.command) {
        const receipt = engine.act({
          ...input.command,
          expectedRunId: engine.state.runId,
        });
        if (!receipt.ok)
          throw new Error(`Replay command rejected: ${receipt.reason}`);
      }
    }
    if (tick < file.finalTick) engine.step();
  }
  return engine;
}

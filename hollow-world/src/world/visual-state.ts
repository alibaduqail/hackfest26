import type { RoomState, Scenario, WorldState } from "../engine/types";

export const pumpOperating = (room: RoomState) => room.powered;

export const waterDepth = (state: WorldState, scenario: Scenario) =>
  state.waterL / (scenario.settings.tunnelAreaM2 * 1000);

export function movementTransition(
  previous: { key: string; progress: number } | undefined,
  next: { key: string; progress: number },
) {
  return { ...next, snap: !previous || previous.key !== next.key || next.progress < previous.progress };
}

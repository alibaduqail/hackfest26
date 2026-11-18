import type { Scenario } from "../engine/types";
import { project } from "./projection";

export function connectedSlice(scenario: Scenario) {
  const link = scenario.links.find((item) => item.id === "cross-0-1" && item.kind === "corridor");
  if (!link) return;
  const a = scenario.rooms.find((room) => room.id === link.a);
  const b = scenario.rooms.find((room) => room.id === link.b);
  if (!a || !b) return;
  const [left, right] = a.x < b.x ? [a, b] : [b, a];
  const floor = left.y + left.h - 15;
  if (left.x + left.w >= right.x || floor !== right.y + right.h - 15) return;
  return { left, right, start: project(left.x + left.w, floor, 18), end: project(right.x, floor, 18) };
}

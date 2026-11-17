import type { RoomDef } from "../engine/types";
import { alongPath, LIFT_BOARD, LIFT_ALIGHT, type Point } from "./projection";

export { alongPath, LIFT_BOARD, LIFT_ALIGHT };
export type { Point } from "./projection";

export function roomBounds(room: RoomDef) {
  return { x: room.x, y: room.y, width: room.w, height: room.h };
}

export function containsRoom(room: RoomDef, point: Point) {
  return point.x >= room.x && point.x <= room.x + room.w &&
    point.y >= room.y && point.y <= room.y + room.h;
}

export function roomFloor(room: RoomDef): Point {
  return { x: room.x + room.w / 2, y: room.y + room.h - 15 };
}

export function cutawaySpot(room: RoomDef, slot: number, count: number): Point {
  const inset = Math.min(16, room.w / 4);
  return {
    x: room.x + inset + (room.w - inset * 2) * (slot + 0.5) / Math.max(1, count),
    y: roomFloor(room).y,
  };
}

export function pathPoints(a: RoomDef, b: RoomDef, kind: string): Point[] {
  const start = roomFloor(a), end = roomFloor(b);
  if (start.y === end.y) return [start, end];
  if (kind === "lift") {
    const shaft = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
    return [start, { x: (start.x + shaft) / 2, y: start.y }, { x: shaft, y: start.y },
      { x: shaft, y: end.y }, { x: (end.x + shaft) / 2, y: end.y }, end];
  }
  const left = a.x < b.x || (a.x === b.x && a.id < b.id) ? a : b;
  const shaft = left.x + 22;
  return [start, { x: shaft, y: start.y }, { x: shaft, y: end.y }, end];
}

export function traversalPoint(a: RoomDef, b: RoomDef, kind: string, progress: number): Point {
  const points = pathPoints(a, b, kind), p = Math.max(0, Math.min(1, progress));
  if (kind !== "lift" || points.length !== 6) return alongPath(points, p);
  if (p < LIFT_BOARD) return alongPath(points.slice(0, 3), p / LIFT_BOARD);
  if (p <= LIFT_ALIGHT) return alongPath(points.slice(2, 4), (p - LIFT_BOARD) / (LIFT_ALIGHT - LIFT_BOARD));
  return alongPath(points.slice(3), (p - LIFT_ALIGHT) / (1 - LIFT_ALIGHT));
}

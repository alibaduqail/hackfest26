import type { RoomDef } from "../engine/types";

export interface Point {
  x: number;
  y: number;
}
export const ROOM_DEPTH = 150;
export const WALL_HEIGHT = 104;

// Keep authored scenario coordinates; only the observer's drawing is projected.
export function project(x: number, y: number, depth = 0, height = 0): Point {
  return {
    x: x * 0.93 + depth * 0.72,
    y: y * 1.25 + x * 0.22 - depth * 0.42 - height,
  };
}

export function roomBase(room: RoomDef): Point {
  return project(room.x, room.y + room.h - 15);
}

export function local(x: number, depth: number, height = 0): Point {
  return { x: x * 0.93 + depth * 0.72, y: x * 0.22 - depth * 0.42 - height };
}

export function roomOutline(room: RoomDef): Point[] {
  const base = roomBase(room);
  return [
    [0, 0, 0],
    [room.w, 0, 0],
    [room.w, ROOM_DEPTH, 0],
    [room.w, ROOM_DEPTH, WALL_HEIGHT],
    [0, ROOM_DEPTH, WALL_HEIGHT],
    [0, 0, WALL_HEIGHT],
  ].map(([x, z, h]) => {
    const p = local(x, z, h);
    return { x: p.x + base.x, y: p.y + base.y };
  });
}

export function contains(points: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}

export function pathPoints(a: RoomDef, b: RoomDef, kind: string): Point[] {
  const x1 = a.x + a.w / 2,
    y1 = a.y + a.h - 15;
  const x2 = b.x + b.w / 2,
    y2 = b.y + b.h - 15;
  const left = a.x < b.x || (a.x === b.x && a.id < b.id) ? a : b;
  const shaft = kind === "lift" ? left.x + left.w - 24 : left.x + 22;
  const points =
    y1 === y2
      ? [
          [x1, y1],
          [x2, y2],
        ]
      : [
          [x1, y1],
          [shaft, y1],
          [shaft, y2],
          [x2, y2],
        ];
  return points.map(([x, y]) => project(x, y, 18));
}

export function alongPath(points: Point[], progress: number): Point {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  let distance =
    lengths.reduce((sum, length) => sum + length, 0) *
    Math.max(0, Math.min(1, progress));
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] ? distance / lengths[i] : 0;
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    distance -= lengths[i];
  }
  return points[0];
}

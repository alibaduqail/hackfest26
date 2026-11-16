import type { Point } from "./projection";

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function constrainCamera(
  camera: Point,
  world: Bounds,
  view: Bounds,
  zoom: number,
): Point {
  function axis(
    value: number,
    start: number,
    end: number,
    near: number,
    far: number,
  ) {
    const min = far - end * zoom,
      max = near - start * zoom;
    return min > max ? (min + max) / 2 : Math.max(min, Math.min(max, value));
  }
  return {
    x: axis(camera.x, world.left, world.right, view.left, view.right),
    y: axis(camera.y, world.top, world.bottom, view.top, view.bottom),
  };
}

export function elasticCamera(
  camera: Point,
  world: Bounds,
  view: Bounds,
  zoom: number,
): Point {
  const target = constrainCamera(camera, world, view, zoom);
  const resistance = (distance: number) =>
    distance / (1 + Math.abs(distance) / 80);
  return {
    x: target.x + resistance(camera.x - target.x),
    y: target.y + resistance(camera.y - target.y),
  };
}

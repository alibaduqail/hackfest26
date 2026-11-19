import type { Track } from "../run";

export const RAIL_WIDTH = 1672;
export const RAIL_HEIGHT = 941;

export function hitSector(
  nx: number,
  ny: number,
  tracks: ReadonlyMap<string, Track>,
  available: (id: string) => boolean = () => true,
): string | null {
  let nearest: string | null = null;
  let distance = 26 ** 2;
  for (const [id, { a, b }] of tracks) {
    const x = (nx - a[0]) * RAIL_WIDTH;
    const y = (ny - a[1]) * RAIL_HEIGHT;
    const dx = (b[0] - a[0]) * RAIL_WIDTH;
    const dy = (b[1] - a[1]) * RAIL_HEIGHT;
    const length = dx * dx + dy * dy;
    const offset = length ? Math.min(1, Math.max(0, (x * dx + y * dy) / length)) : 0;
    const squared = (x - dx * offset) ** 2 + (y - dy * offset) ** 2;
    if (squared >= distance) continue;
    distance = squared;
    nearest = id;
  }
  return nearest && available(nearest) ? nearest : null;
}

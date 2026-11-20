// Pure geometry and rules for the "light the track" placement layer (TrackLight.tsx). Read-only over mission data, the shared
// track geometry and reach.ts's beacon graph: no DOM, no engine writes. Pinned by track-light.test.ts against the engine.
import type { Sector } from "../../../echo/types";
import type { Point, Track } from "../run";
import type { Graph } from "./reach";

type SectorLite = Pick<Sector, "id" | "routeId" | "index">;

/**
 * The sections that must carry a beacon for the flood news at `sealId` to reach Mara before her fork: the sealed section and every
 * section of its route back to the fork, sealed one first. Each one is the chain neighbour of the next, so news hops along them one
 * section per minute (reach.ts), and the last one touches the fork city where Mara turns. Empty when the seal is the first section
 * after the fork: Mara sees it from the fork and needs no news. Null when the seal is not ahead of her on her path.
 */
export function warnChain(sectors: readonly SectorLite[], sealId: string, maraPath: readonly string[], maraAt: number): string[] | null {
  const seal = sectors.find((s) => s.id === sealId);
  if (!seal || !maraPath.slice(maraAt + 1).includes(sealId)) return null;
  if (seal.index === 0) return [];
  return sectors.filter((s) => s.routeId === seal.routeId && s.index <= seal.index).sort((a, b) => b.index - a.index).map((s) => s.id);
}

const same = (p: Point, q: Point) => p[0] === q[0] && p[1] === q[1];

/** For each lit section, whether its start (a) and end (b) meet a lit section it can hear. An unmet end is drawn cut off. */
export function litEnds(tracks: ReadonlyMap<string, Pick<Track, "a" | "b">>, graph: Graph, lit: ReadonlySet<string>) {
  const out = new Map<string, { a: boolean; b: boolean }>();
  for (const id of lit) {
    const t = tracks.get(id);
    if (!t) continue;
    const ns = (graph.get(id) ?? []).filter((n) => lit.has(n)).map((n) => tracks.get(n)).filter((n) => !!n);
    out.set(id, {
      a: ns.some((n) => same(t.a, n!.a) || same(t.a, n!.b)),
      b: ns.some((n) => same(t.b, n!.a) || same(t.b, n!.b)),
    });
  }
  return out;
}

/** Lit sections grouped into runs that hear each other (connected over the beacon graph). One run is one continuous line of light. */
export function litRuns(graph: Graph, lit: ReadonlySet<string>): string[][] {
  const seen = new Set<string>();
  const runs: string[][] = [];
  for (const id of [...lit].sort()) {
    if (seen.has(id)) continue;
    const run: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const x = stack.pop()!;
      run.push(x);
      for (const n of graph.get(x) ?? []) if (lit.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
    }
    runs.push(run.sort());
  }
  return runs;
}

/** Where a news pulse enters `id`: the end it shares with a section the news reached the tick before, else null (it starts here). */
export function pulseEntry(t: Pick<Track, "a" | "b">, from: readonly Pick<Track, "a" | "b">[]): "a" | "b" | null {
  for (const f of from) {
    if (same(t.a, f.a) || same(t.a, f.b)) return "a";
    if (same(t.b, f.a) || same(t.b, f.b)) return "b";
  }
  return null;
}

/** Chevron marks along a section in world pixels, pointing from a to b, one every `gap` px and none on the section's ends. */
export function chevrons(t: Pick<Track, "a" | "b">, w: number, h: number, gap = 54): { x: number; y: number; deg: number }[] {
  const ax = t.a[0] * w, ay = t.a[1] * h, dx = t.b[0] * w - ax, dy = t.b[1] * h - ay;
  const len = Math.hypot(dx, dy);
  const n = Math.max(1, Math.floor(len / gap));
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return Array.from({ length: n }, (_, i) => {
    const f = (i + .5) / n;
    return { x: ax + dx * f, y: ay + dy * f, deg };
  });
}

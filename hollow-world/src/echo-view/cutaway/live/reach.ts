// Beacon reach for the placement view. Mirrors the engine's beacon graph (engine.ts `adjacent`, read-only): a beacon hears its chain
// neighbours (previous and next sector of the same route) and every sector touching the same city at either end. News hops one
// beacon to the next, so two beaconed sectors are linked exactly when they are adjacent. A dark sector neither hears nor relays.
// Pure: no DOM, no engine writes. Rules pinned by reach.test.ts against the engine's own news reach.
import type { Sector } from "../../../echo/types";

export type Graph = Map<string, string[]>;

/** Adjacency of every sector (beaconed or not), sorted, never including itself. Same construction as the engine's buildTopo. */
export function sectorGraph(sectors: readonly Pick<Sector, "id" | "routeId" | "index" | "from" | "to">[]): Graph {
  const chains = new Map<string, typeof sectors[number][]>();
  for (const s of sectors) (chains.get(s.routeId) ?? chains.set(s.routeId, []).get(s.routeId)!).push(s);
  const pred = new Map<string, string | null>();
  const succ = new Map<string, string | null>();
  const start = new Map<string, string | null>();
  const end = new Map<string, string | null>();
  for (const ch of chains.values()) {
    ch.sort((a, b) => a.index - b.index);
    ch.forEach((s, i) => {
      const prev = ch[i - 1];
      const next = ch[i + 1];
      pred.set(s.id, prev?.id ?? null);
      succ.set(s.id, next?.id ?? null);
      start.set(s.id, !prev || prev.to === s.from ? s.from : null);
      end.set(s.id, !next || next.from === s.to ? s.to : null);
    });
  }
  const touching = new Map<string, string[]>();
  for (const s of sectors) for (const c of [start.get(s.id), end.get(s.id)]) if (c) (touching.get(c) ?? touching.set(c, []).get(c)!).push(s.id);
  const out: Graph = new Map();
  for (const s of sectors) {
    const n = new Set<string>();
    for (const x of [pred.get(s.id), succ.get(s.id)]) if (x) n.add(x);
    for (const c of [start.get(s.id), end.get(s.id)]) if (c) for (const x of touching.get(c)!) n.add(x);
    n.delete(s.id);
    out.set(s.id, [...n].sort());
  }
  return out;
}

/** Links between beaconed sectors that can hear each other, each pair once, sorted. */
export function liveLinks(graph: Graph, beaconed: ReadonlySet<string>): [string, string][] {
  const out: [string, string][] = [];
  for (const [id, ns] of graph) if (beaconed.has(id)) for (const n of ns) if (n > id && beaconed.has(n)) out.push([id, n]);
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
}

/** What a beacon at `id` would reach: neighbours that already hear it (`linked`) and neighbours that are dark and so would not (`dark`). */
export function previewReach(graph: Graph, beaconed: ReadonlySet<string>, id: string): { linked: string[]; dark: string[] } {
  const ns = graph.get(id) ?? [];
  return { linked: ns.filter((n) => beaconed.has(n)), dark: ns.filter((n) => !beaconed.has(n)) };
}

/** Sectors on `route` that no beacon covers: the gap in Mara's chain. */
export const uncovered = (route: readonly string[], beaconed: ReadonlySet<string>): string[] => route.filter((id) => !beaconed.has(id));

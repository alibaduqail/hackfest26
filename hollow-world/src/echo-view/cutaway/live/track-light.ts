// Pure rules for the blackout's warn-here chain and lit regions (Blackout.tsx). Read-only over mission data and reach.ts's beacon
// graph: no DOM, no engine writes. Pinned by track-light.test.ts against the engine.
import type { Sector } from "../../../echo/types";
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

import type { LinkDef, Scenario, WorldState } from "./types";
export function blocked(link: LinkDef, w: WorldState, permit = true) {
  if (w.closedLinks.includes(link.id)) return "Flooded passage";
  if (link.kind === "checkpoint" && (!permit || w.lockdown))
    return "Directorate access restriction";
  if (link.kind === "lift" && w.blackout && (link.feederFloor ?? 0) >= 5)
    return "Lift feeder is unpowered";
  return "";
}
export class Router {
  adjacency = new Map<string, LinkDef[]>();
  cache = new Map<string, string[] | null>();
  constructor(public scenario: Scenario) {
    for (const r of scenario.rooms) this.adjacency.set(r.id, []);
    for (const l of scenario.links) {
      this.adjacency.get(l.a)!.push(l);
      this.adjacency.get(l.b)!.push(l);
    }
  }
  route(
    from: string,
    to: string,
    w: WorldState,
    permit = true,
    knownOnly?: string[],
  ): string[] | null {
    if (from === to) return [];
    const key = `${w.topology}:${from}:${to}:${permit}:${knownOnly?.join(",") ?? "truth"}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    if (this.cache.size > 10000) this.cache.clear();
    const dist = new Map([[from, 0]]),
      prev = new Map<string, { node: string; link: string }>(),
      open = new Set([from]);
    while (open.size) {
      let best = "";
      let min = Infinity;
      for (const n of open) {
        const d = dist.get(n)!;
        if (d < min) {
          min = d;
          best = n;
        }
      }
      open.delete(best);
      if (best === to) break;
      for (const l of this.adjacency.get(best) ?? []) {
        if (
          knownOnly
            ? knownOnly.includes(l.id) ||
              (l.kind === "checkpoint" && (!permit || w.lockdown))
            : blocked(l, w, permit)
        )
          continue;
        const next = l.a === best ? l.b : l.a;
        const cost = min + l.seconds;
        if (cost < (dist.get(next) ?? Infinity)) {
          dist.set(next, cost);
          prev.set(next, { node: best, link: l.id });
          open.add(next);
        }
      }
    }
    if (!prev.has(to)) {
      this.cache.set(key, null);
      return null;
    }
    const result: string[] = [];
    for (let n = to; n !== from; ) {
      const p = prev.get(n)!;
      result.unshift(p.link);
      n = p.node;
    }
    this.cache.set(key, result);
    return result;
  }
}

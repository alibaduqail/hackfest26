// The Hollow's tunnel network: 12 cities, 16 routes, each route two one-way sector chains.
// Pure data plus helpers. Sector ids look like "s07-lagos-f0" (route "s07-lagos", forward, index 0) or "...-b2" (backward).
// Sector.routeId is the one-way chain id ("s07-lagos-f"), so one chain = one routeId, ordered by index.
import type { City, Sector, World } from "./types";

export const cities: City[] = [
  { id: "ny", name: "New York Deep", above: "New York", x: 0.294, y: 0.274 },
  { id: "s07", name: "Sector 07", above: "Washington", x: 0.286, y: 0.292, strata: true },
  { id: "sao", name: "São Paulo Deep", above: "São Paulo", x: 0.371, y: 0.631 },
  { id: "lon", name: "London Deep", above: "London", x: 0.5, y: 0.214 },
  { id: "lagos", name: "Lagos Deep", above: "Lagos", x: 0.509, y: 0.464, outbreak: true },
  { id: "cairo", name: "Cairo Deep", above: "Cairo", x: 0.587, y: 0.333 },
  { id: "mow", name: "Moscow Deep", above: "Moscow", x: 0.605, y: 0.19 },
  { id: "mum", name: "Mumbai Deep", above: "Mumbai", x: 0.702, y: 0.394 },
  { id: "bei", name: "Beijing Deep", above: "Beijing", x: 0.824, y: 0.278 },
  { id: "tok", name: "Tokyo Deep", above: "Tokyo", x: 0.887, y: 0.302 },
  { id: "jak", name: "Jakarta Deep", above: "Jakarta", x: 0.797, y: 0.534 },
  { id: "syd", name: "Sydney Deep", above: "Sydney", x: 0.92, y: 0.688 },
];

// 16 bidirectional routes. [routeId, cityA, cityB]
const ROUTES: [string, string, string][] = [
  ["s07-lagos", "s07", "lagos"], // the direct Atlantic tunnel the Directorate seals
  ["s07-sao", "s07", "sao"],
  ["sao-lagos", "sao", "lagos"],
  ["s07-ny", "s07", "ny"],
  ["ny-lon", "ny", "lon"],
  ["lon-lagos", "lon", "lagos"],
  ["lon-cairo", "lon", "cairo"],
  ["lon-mow", "lon", "mow"],
  ["lagos-cairo", "lagos", "cairo"],
  ["cairo-mow", "cairo", "mow"],
  ["cairo-mum", "cairo", "mum"],
  ["mow-bei", "mow", "bei"],
  ["mum-bei", "mum", "bei"],
  ["mum-jak", "mum", "jak"],
  ["bei-tok", "bei", "tok"],
  ["jak-syd", "jak", "syd"],
];

const byId = new Map(cities.map((c) => [c.id, c]));
const city = (id: string): City => byId.get(id)!;

function chain(routeId: string, from: string, to: string): Sector[] {
  const f = city(from);
  const t = city(to);
  const len = Math.hypot(t.x - f.x, t.y - f.y);
  const n = Math.min(6, Math.max(3, Math.round(len / 0.06))); // 3-6 sectors by map distance
  const minutes = Math.max(4, Math.round((len / n) * 170)); // ~8 min per sector on a long hop
  return Array.from({ length: n }, (_, i) => ({
    id: `${routeId}${i}`,
    routeId,
    index: i,
    from,
    to,
    a: [f.x + ((t.x - f.x) * i) / n, f.y + ((t.y - f.y) * i) / n] as [number, number],
    b: [f.x + ((t.x - f.x) * (i + 1)) / n, f.y + ((t.y - f.y) * (i + 1)) / n] as [number, number],
    minutes,
    holder: null,
    sealed: false,
  }));
}

export const sectors: Sector[] = ROUTES.flatMap(([id, a, b]) => [chain(`${id}-f`, a, b), chain(`${id}-b`, b, a)].flat());

export const world: World = { cities, sectors };

/** Fresh copy of the world; the engine mutates holder/sealed, so every run takes its own. */
export const cloneWorld = (w: World = world): World => structuredClone(w);

/** Sector ids of the shortest path (fewest sectors, ties by lower sector id) between two cities, or null. */
export function findPath(from: string, to: string, blocked: ReadonlySet<string> = new Set(), w: World = world): string[] | null {
  if (from === to) return [];
  const chains = new Map<string, Sector[]>(); // routeId -> sectors in order
  for (const s of [...w.sectors].sort((x, y) => x.index - y.index)) (chains.get(s.routeId) ?? chains.set(s.routeId, []).get(s.routeId)!).push(s);
  const out = new Map<string, Sector[][]>();// city -> chains starting there
  for (const c of chains.values()) (out.get(c[0].from) ?? out.set(c[0].from, []).get(c[0].from)!).push(c);
  // BFS over cities; each step takes a whole chain, cost = its sector count (Dijkstra-lite, graph is tiny)
  const best = new Map<string, { cost: number; path: string[] }>([[from, { cost: 0, path: [] }]]);
  const todo = [from];
  while (todo.length) {
    todo.sort((a, b) => best.get(a)!.cost - best.get(b)!.cost || a.localeCompare(b));
    const c = todo.shift()!;
    const cur = best.get(c)!;
    for (const ch of out.get(c) ?? []) {
      if (ch.some((s) => blocked.has(s.id))) continue;
      const cost = cur.cost + ch.length;
      const path = [...cur.path, ...ch.map((s) => s.id)];
      const prev = best.get(ch[0].to);
      if (!prev || cost < prev.cost || (cost === prev.cost && path.join() < prev.path.join())) {
        if (!prev) todo.push(ch[0].to);
        best.set(ch[0].to, { cost, path });
      }
    }
  }
  return best.get(to)?.path ?? null;
}

/** Data check. Returns problems; empty array = valid. */
export function validateWorld(w: World = world): string[] {
  const errs: string[] = [];
  const ids = new Set(w.cities.map((c) => c.id));
  const bySector = new Map(w.sectors.map((s) => [s.id, s]));
  if (bySector.size !== w.sectors.length) errs.push("duplicate sector id");
  const near = (p: [number, number], c: City) => Math.hypot(p[0] - c.x, p[1] - c.y) < 1e-9;
  const chains = new Map<string, Sector[]>();
  for (const s of w.sectors) (chains.get(s.routeId) ?? chains.set(s.routeId, []).get(s.routeId)!).push(s);
  for (const [rid, ch] of chains) {
    ch.sort((x, y) => x.index - y.index);
    ch.forEach((s, i) => {
      if (s.index !== i) errs.push(`${rid}: index gap at ${s.id}`);
      if (!ids.has(s.from) || !ids.has(s.to)) errs.push(`${s.id}: unknown city`);
      if (s.minutes < 1) errs.push(`${s.id}: minutes < 1`);
      if (i > 0 && (ch[i - 1].b[0] !== s.a[0] || ch[i - 1].b[1] !== s.a[1])) errs.push(`${s.id}: does not meet previous sector`);
    });
    if (ch.length < 3 || ch.length > 6) errs.push(`${rid}: ${ch.length} sectors, want 3-6`);
    if (!near(ch[0].a, city(ch[0].from))) errs.push(`${rid}: start not at ${ch[0].from}`);
    if (!near(ch[ch.length - 1].b, city(ch[0].to))) errs.push(`${rid}: end not at ${ch[0].to}`);
  }
  if (chains.size !== 32) errs.push(`${chains.size} one-way chains, want 32 (16 routes)`);
  for (const a of w.cities) for (const b of w.cities) if (a !== b && !findPath(a.id, b.id, new Set(), w)) errs.push(`no path ${a.id} -> ${b.id}`);
  return errs;
}

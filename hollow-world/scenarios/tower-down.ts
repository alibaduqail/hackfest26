// Headless Tower Down: runs the same mission with the tower failing, with Echo, and on a normal day, and prints the scoreboard.
// Usage: npm run harness. Exits 1 if the shape is wrong (AC-9): Echo must beat the failed tower and cost something vs a normal day.
// npm run harness:all (--all): every campaign mission, Echo with each beacon layout, to set star thresholds.
import { createEngine, sealsOf } from "../src/echo/engine";
import { MISSIONS, towerDown, validateMission } from "../src/echo/missions";
import type { Mission, Mode, Observation } from "../src/echo/types";
import { findPath } from "../src/echo/world";

if (process.argv.includes("--all")) process.exit(allMissions());

const m = towerDown(); // one mission object: the normal-day reference is computed once and shared
const run = (mode: Mode): Observation => {
  const e = createEngine(m, mode);
  e.step(m.endTick);
  return e.observe();
};
const [tower, echo, normal] = (["tower", "echo", "normal"] as Mode[]).map(run);
const med1 = (o: Observation) => o.pods.find((p) => p.id === "MED-1")!;
const ratio = (o: Observation) => (normal.score.passengerDelayMin ? `${(o.score.passengerDelayMin / normal.score.passengerDelayMin).toFixed(1)}x` : "-");

const rows: [string, (o: Observation) => string][] = [
  ["Nurses arrived", (o) => `${o.score.nursesArrived}/${o.score.nursesTotal}`],
  ["Supplies delivered", (o) => `${o.score.suppliesDelivered}/${o.score.suppliesTotal}`],
  ["Passenger delay (min)", (o) => `${o.score.passengerDelayMin} (${ratio(o)} normal)`],
  ["Network capacity vs normal day", (o) => `${o.score.capacityPct}%`],
  ["Flights: real / claimed by tower", (o) => `${o.score.realFlights} / ${o.mode === "normal" ? "-" : o.score.towerClaimed}`],
  ["MED-1 Nurse Mara Vale", (o) => (med1(o).arriveTick === null ? `${med1(o).status}, not arrived` : `arrived t+${med1(o).arriveTick}${med1(o).rerouted ? " (rerouted)" : ""}`)],
];
const w0 = Math.max(...rows.map(([l]) => l.length));
const cells = rows.map(([, f]) => [tower, echo, normal].map(f));
const w = [0, 1, 2].map((i) => Math.max(["Tower failed", "Echo", "Normal day"][i].length, ...cells.map((c) => c[i].length)));
const line = (a: string, b: string[]) => `${a.padEnd(w0)}  ${b.map((x, i) => x.padEnd(w[i])).join("  ")}`;
console.log(`${m.title}: seed ${m.seed}, ${m.pods.length} pods, tower down at t+${m.towerDownAt}, seal ${m.sealSectorId} at t+${m.sealAt}, ends t+${m.endTick}\n`);
console.log(line("", ["Tower failed", "Echo", "Normal day"]));
rows.forEach(([l], i) => console.log(line(l, cells[i])));

const t = tower.score, e = echo.score, n = normal.score;
const checks: [string, boolean][] = [
  ["Echo beats failed tower on nurses", e.nursesArrived > t.nursesArrived],
  ["Echo beats failed tower on supplies", e.suppliesDelivered > t.suppliesDelivered],
  ["normal day delivers everything", n.nursesArrived === n.nursesTotal && n.suppliesDelivered === n.suppliesTotal],
  ["Echo capacity is below the normal day", e.capacityPct < n.capacityPct],
  ["Echo costs passengers time", e.passengerDelayMin > n.passengerDelayMin],
  ["tower real flights < claimed", t.realFlights < t.towerClaimed],
];
const bad = checks.filter(([, ok]) => !ok);
console.log(`\n${bad.length ? "FAIL" : "OK"}: ${checks.length - bad.length}/${checks.length} shape checks${bad.length ? ` (${bad.map(([l]) => l).join("; ")})` : ""}`);
process.exit(bad.length ? 1 : 0);

/** Beacon ids for a budget: sectors of every city's shortest path to Lagos (shortest first, then city id), then every pod's path; first N. */
function heuristicBeacons(m: Mission, budget: number): Set<string> {
  // ponytail: naive greedy placement, only a yardstick for star thresholds; a real solver would score layouts by simulation
  const toLagos = m.world.cities.filter((c) => c.id !== "lagos").map((c) => ({ c: c.id, path: findPath(c.id, "lagos", new Set(), m.world)! }));
  toLagos.sort((a, b) => a.path.length - b.path.length || (a.c < b.c ? -1 : 1));
  return new Set([...new Set([...toLagos.flatMap((x) => x.path), ...m.pods.flatMap((p) => p.path)])].slice(0, budget));
}

/** Beacon ids: MED-1's post-seal detour and every Lagos-bound pod's path around all seals first, then sectors by how many pod paths use them. */
function detourFirstBeacons(m: Mission, budget: number): Set<string> {
  const sealed = new Set(sealsOf(m).map((x) => x.sectorId));
  const lagos = m.pods.filter((p) => p.dest === "lagos").sort((a, b) => (a.id === "MED-1" ? -1 : b.id === "MED-1" ? 1 : 0));
  const first = lagos.flatMap((p) => findPath(p.origin, "lagos", sealed, m.world) ?? []);
  const freq = new Map<string, number>();
  for (const p of m.pods) for (const id of p.path) freq.set(id, (freq.get(id) ?? 0) + 1);
  const rest = [...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([id]) => id);
  return new Set([...new Set([...first, ...rest])].slice(0, budget));
}

function allMissions(): number {
  const head = ["Mission", "Layout", "Beacons", "Nurses", "Lagos nurses", "Supplies", "Pax delay", "Capacity", "Mara", "Last Lagos nurse", "Median supply", "Last supply"];
  // arrival ticks of a pod group: "t+N", or "-" while any of them has not arrived ("4/5 by t+N" for the last)
  const at = (ts: (number | null)[], pick: (xs: number[]) => number) => {
    const ok = ts.filter((x): x is number => x !== null).sort((a, b) => a - b);
    if (!ok.length) return "-";
    return ok.length === ts.length ? `t+${pick(ok)}` : `${ok.length}/${ts.length} by t+${pick(ok)}`;
  };
  const last = (xs: number[]) => xs[xs.length - 1];
  const median = (xs: number[]) => xs[Math.floor((xs.length - 1) / 2)]; // lower median: a real arrival tick
  const rows: string[][] = [];
  let bad = 0;
  for (const { id, build } of MISSIONS) {
    const errs = validateMission(build());
    if (errs.length) (bad++, console.log(`${id}: INVALID ${errs.join("; ")}`));
    const go = (layout: string, mode: Mode, beacons?: (m: Mission) => Set<string> | null) => {
      const m = build();
      if (beacons) {
        const on = beacons(m);
        for (const s of m.world.sectors) s.beacon = on === null || on.has(s.id);
      }
      const e = createEngine(m, mode);
      e.step(m.endTick);
      return { layout, m, o: e.observe() };
    };
    const normal = go("normal day", "normal");
    const budget = build().beaconBudget;
    const runs = [
      go("tower failed", "tower"),
      ...(typeof budget === "number"
        ? [go("echo, all beacons", "echo", () => null), go(`echo, heuristic`, "echo", (m) => heuristicBeacons(m, budget)), go("echo, detour-first", "echo", (m) => detourFirstBeacons(m, budget)), go("echo, no beacons", "echo")]
        : [go("echo, fixed", "echo")]),
      normal,
    ];
    for (const { layout, m, o } of runs) {
      const sc = o.score;
      const med1 = o.pods.find((p) => p.id === "MED-1")!;
      const lit = m.world.sectors.filter((s) => s.beacon !== false).length;
      rows.push([
        m.id, layout, o.mode === "echo" ? `${lit}/${m.world.sectors.length}${typeof budget === "number" ? ` (budget ${budget})` : ""}` : "-",
        `${sc.nursesArrived}/${sc.nursesTotal}`,
        `${o.pods.filter((p) => p.nurse && p.dest === "lagos" && p.status === "arrived").length}/${o.pods.filter((p) => p.nurse && p.dest === "lagos").length}`,
        `${sc.suppliesDelivered}/${sc.suppliesTotal}`,
        `${sc.passengerDelayMin} (${normal.o.score.passengerDelayMin ? (sc.passengerDelayMin / normal.o.score.passengerDelayMin).toFixed(1) : "-"}x)`,
        `${sc.capacityPct}%`,
        med1.arriveTick === null ? med1.status : `t+${med1.arriveTick}${med1.rerouted ? " rerouted" : ""}`,
        at(o.pods.filter((p) => p.nurse && p.dest === "lagos").map((p) => p.arriveTick), last),
        at(o.pods.filter((p) => p.cargo).map((p) => p.arriveTick), median),
        at(o.pods.filter((p) => p.cargo).map((p) => p.arriveTick), last),
      ]);
    }
  }
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((x, i) => x.padEnd(w[i])).join("  ").trimEnd();
  console.log(line(head));
  rows.forEach((r, i) => (i && r[0] !== rows[i - 1][0] ? console.log("") : 0, console.log(line(r))));
  return bad ? 1 : 0;
}

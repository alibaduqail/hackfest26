// Headless Tower Down: runs the same mission with the tower failing, with Echo, and on a normal day, and prints the scoreboard.
// Usage: npm run harness. Exits 1 if the shape is wrong (AC-9): Echo must beat the failed tower and cost something vs a normal day.
import { createEngine } from "../src/echo/engine";
import { towerDown } from "../src/echo/missions";
import type { Mode, Observation } from "../src/echo/types";

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

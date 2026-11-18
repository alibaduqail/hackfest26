// Offline calibration of DESCENT_LIVE_GOALS (npx tsx scenarios/live-search.ts). Not used by tests or the game.
// Exhaustive: every set of up to `budget` live beacons on the dark sectors, all placed at tick 0 (placing earlier never hurts), scored by arrival ticks.
import { createEngine } from "../src/echo/engine";
import { descentLive } from "../src/echo/descent";

const base = descentLive();
const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budget = base.beaconBudget!;
const hist = new Map<number, Map<string, number>>(); // beacons used -> "mara/medicine" -> sets
const best = new Map<number, { key: string; set: string[] }>();
for (let mask = 0; mask < 1 << dark.length; mask++) {
  const set = dark.filter((_, i) => mask & (1 << i));
  if (set.length > budget) continue;
  const e = createEngine(descentLive(), "echo");
  for (const sectorId of set) e.act({ type: "placeBeacon", sectorId, atTick: 0 });
  e.step(base.endTick);
  const at = (id: string) => e.observe().pods.find((p) => p.id === id)!.arriveTick ?? Infinity;
  const key = `${at("MED-1")}/${at("SUP-3")}`;
  const h = hist.get(set.length) ?? hist.set(set.length, new Map()).get(set.length)!;
  h.set(key, (h.get(key) ?? 0) + 1);
  const b = best.get(set.length);
  if (!b || key < b.key) best.set(set.length, { key, set });
}
console.log(`dark sectors ${dark.length}, budget ${budget}; outcome Mara/medicine: number of placement sets`);
for (const [n, h] of [...hist].sort((a, b) => a[0] - b[0]))
  console.log(`${n} beacons: ${[...h].sort().map(([k, c]) => `${k} x${c}`).join("  ")}   best ${best.get(n)!.key}: ${best.get(n)!.set.join(" ")}`);

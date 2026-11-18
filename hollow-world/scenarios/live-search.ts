// Offline calibration of DESCENT_LIVE_GOALS (npx tsx scenarios/live-search.ts). Not used by tests or the game.
// Exhaustive: every set of up to `budget` live beacons on the dark sectors, all placed at tick 0, scored by arrival ticks and stars.
import { createEngine } from "../src/echo/engine";
import { descentLive, descentLiveStars } from "../src/echo/descent";

const base = descentLive();
const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budget = base.beaconBudget!;
const warn = [base.sealSectorId!, "main0"]; // the flood-warning chain: the sealed sector and the one the news hops through to the fork
const hist = new Map<number, Map<string, number>>(); // beacons used -> "mara/medicine" -> sets
const stars = [0, 0, 0, 0];
const three: string[][] = [];
let routeOnly = 0; // best stars with no beacon on the warning chain
for (let mask = 0; mask < 1 << dark.length; mask++) {
  const set = dark.filter((_, i) => mask & (1 << i));
  if (set.length > budget) continue;
  const e = createEngine(descentLive(), "echo");
  for (const sectorId of set) e.act({ type: "placeBeacon", sectorId, atTick: 0 });
  e.step(base.endTick);
  const pods = e.observe().pods;
  const at = (id: string) => pods.find((p) => p.id === id)!.arriveTick ?? "never";
  const key = `${at("MED-1")}/${at("SUP-3")}`;
  const h = hist.get(set.length) ?? hist.set(set.length, new Map()).get(set.length)!;
  h.set(key, (h.get(key) ?? 0) + 1);
  const st = descentLiveStars(pods);
  if (set.length === budget) stars[st]++;
  if (st === 3) three.push(set);
  if (!set.some((s) => warn.includes(s))) routeOnly = Math.max(routeOnly, st);
}
console.log(`dark sectors ${dark.length}, budget ${budget}, seal ${base.sealSectorId}; outcome Mara/medicine: number of placement sets`);
for (const [n, h] of [...hist].sort((a, b) => a[0] - b[0])) console.log(`${n} beacons: ${[...h].sort().map(([k, c]) => `${k} x${c}`).join("  ")}`);
console.log(`full-budget sets by stars: 0*=${stars[0]} 1*=${stars[1]} 2*=${stars[2]} 3*=${stars[3]}`);
console.log(`3-star sets (any size): ${three.length}, all with the warning chain: ${three.every((s) => warn.every((w) => s.includes(w)))}; best stars with no warning beacon: ${routeOnly}`);
console.log(`example 3-star sets: ${three.slice(0, 3).map((s) => s.join(" ")).join(" | ")}`);

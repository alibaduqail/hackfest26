// Offline calibration of DESCENT_LIVE_GOALS_3 (npx tsx scenarios/live-search3.ts). Not used by tests or the game.
// Exhaustive: every set of up to `budget` live beacons on the dark sectors, all placed at tick 0, scored by arrival
// ticks and stars. Also checks that no 3-star set skips the flood warning or the junction beacon (the lesson: priority
// alone does not beat a dark junction).
import { createEngine } from "../src/echo/engine";
import { descentLive3, descentLiveStars3 } from "../src/echo/descent3";

const base = descentLive3();
const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budget = base.beaconBudget!;
const warn = [base.sealSectorId!, "main0"];
const junction = "trunk0";
const hist = new Map<number, Map<string, number>>();
const stars = [0, 0, 0, 0];
const three: string[][] = [];
let noWarn = 0; // best stars with no beacon on the warning chain
let noJunction = 0; // best stars with no beacon on the junction
for (let mask = 0; mask < 1 << dark.length; mask++) {
  const set = dark.filter((_, i) => mask & (1 << i));
  if (set.length > budget) continue;
  const e = createEngine(descentLive3(), "echo");
  for (const sectorId of set) e.act({ type: "placeBeacon", sectorId, atTick: 0 });
  e.step(base.endTick);
  const pods = e.observe().pods;
  const at = (id: string) => pods.find((p) => p.id === id)!.arriveTick ?? "never";
  const key = `${at("MED-1")}/${at("SUP-3")}`;
  const h = hist.get(set.length) ?? hist.set(set.length, new Map()).get(set.length)!;
  h.set(key, (h.get(key) ?? 0) + 1);
  const st = descentLiveStars3(pods);
  if (set.length === budget) stars[st]++;
  if (st === 3) three.push(set);
  if (!set.some((s) => warn.includes(s))) noWarn = Math.max(noWarn, st);
  if (!set.includes(junction)) noJunction = Math.max(noJunction, st);
}
console.log(`dark sectors ${dark.length}, budget ${budget}, seal ${base.sealSectorId}, junction ${junction}`);
for (const [n, h] of [...hist].sort((a, b) => a[0] - b[0])) console.log(`${n} beacons: ${[...h].sort().map(([k, c]) => `${k} x${c}`).join("  ")}`);
console.log(`full-budget sets by stars: 0*=${stars[0]} 1*=${stars[1]} 2*=${stars[2]} 3*=${stars[3]}`);
console.log(`3-star sets: ${three.length}; all include the warning: ${three.every((s) => warn.every((w) => s.includes(w)))}; all include the junction: ${three.every((s) => s.includes(junction))}`);
console.log(`best stars with no beacon on the warning: ${noWarn}; with no beacon on the junction: ${noJunction}`);
console.log(`example 3-star sets: ${three.slice(0, 5).map((s) => s.join(" ")).join(" | ")}`);

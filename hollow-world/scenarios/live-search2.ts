// Offline calibration of DESCENT_LIVE_GOALS_2 (npx tsx scenarios/live-search2.ts). Not used by tests or the game.
// Exhaustive: every set of up to `budget` live beacons on the dark sectors, all placed at tick 0, scored by arrival ticks
// and stars. Also checks that no 3-star set skips either warning chain (the lesson: split the budget across both floods).
import { createEngine } from "../src/echo/engine";
import { descentLive2, descentLiveStars2 } from "../src/echo/descent2";

const base = descentLive2();
const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budget = base.beaconBudget!;
const warnA = [base.sealSectorId!, "mainA0"];
const warnB = [base.seals![0].sectorId, "mainB0"];
const hist = new Map<number, Map<string, number>>();
const stars = [0, 0, 0, 0];
const three: string[][] = [];
let noA = 0; // best stars with no beacon on warning A
let noB = 0; // best stars with no beacon on warning B
let noWarn = 0; // best stars with neither warning
for (let mask = 0; mask < 1 << dark.length; mask++) {
  const set = dark.filter((_, i) => mask & (1 << i));
  if (set.length > budget) continue;
  const e = createEngine(descentLive2(), "echo");
  for (const sectorId of set) e.act({ type: "placeBeacon", sectorId, atTick: 0 });
  e.step(base.endTick);
  const pods = e.observe().pods;
  const at = (id: string) => pods.find((p) => p.id === id)!.arriveTick ?? "never";
  const key = `${at("MED-1")}/${at("SUP-3")}`;
  const h = hist.get(set.length) ?? hist.set(set.length, new Map()).get(set.length)!;
  h.set(key, (h.get(key) ?? 0) + 1);
  const st = descentLiveStars2(pods);
  if (set.length === budget) stars[st]++;
  if (st === 3) three.push(set);
  if (!set.some((s) => warnA.includes(s))) noA = Math.max(noA, st);
  if (!set.some((s) => warnB.includes(s))) noB = Math.max(noB, st);
  if (!set.some((s) => [...warnA, ...warnB].includes(s))) noWarn = Math.max(noWarn, st);
}
console.log(`dark sectors ${dark.length}, budget ${budget}, seals ${base.sealSectorId} + ${base.seals![0].sectorId}`);
for (const [n, h] of [...hist].sort((a, b) => a[0] - b[0])) console.log(`${n} beacons: ${[...h].sort().map(([k, c]) => `${k} x${c}`).join("  ")}`);
console.log(`full-budget sets by stars: 0*=${stars[0]} 1*=${stars[1]} 2*=${stars[2]} 3*=${stars[3]}`);
console.log(`3-star sets: ${three.length}; all include warning A: ${three.every((s) => warnA.every((w) => s.includes(w)))}; all include warning B: ${three.every((s) => warnB.every((w) => s.includes(w)))}`);
console.log(`best stars with no beacon on warning A: ${noA}; on warning B: ${noB}; on neither: ${noWarn}`);
console.log(`example 3-star sets: ${three.slice(0, 3).map((s) => s.join(" ")).join(" | ")}`);

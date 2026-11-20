// Offline calibration of the live Descent I candidates (npx tsx scenarios/live-search.ts). Not used by tests or the game.
// Exhaustive: every set of up to `budget` live beacons on the dark sectors, all placed at tick 0, run against every flood candidate.
// Reports (1) per candidate the outcome histogram, (2) the "placing everything at t0" averages: the best blind set, and each candidate's own
// 3-star set replayed at t0 against every candidate, (3) that every stored solution reaches 3 stars and reacts to the flood telegraph.
import { createEngine } from "../src/echo/engine";
import { DEFAULT_REVEAL_LEAD, DESCENT_LIVE_CANDIDATES as C, descentLive, descentLiveCandidateIndex, starsFor } from "../src/echo/descent";
import type { Command } from "../src/echo/types";

const attemptOf = (ci: number) => [...Array(2000).keys()].find((a) => descentLiveCandidateIndex(a) === ci)!; // first attempt that gets candidate ci

const run = (ci: number, cmds: Command[]) => {
  const m = descentLive(attemptOf(ci));
  const e = createEngine(m, "echo");
  for (const c of cmds) e.act(c);
  e.step(m.endTick);
  const o = e.observe();
  return { stars: starsFor(C[ci].goals, o.pods), pods: o.pods, o };
};
const base = descentLive();
const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budget = base.beaconBudget!;
const t0 = (set: string[]): Command[] => set.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick: 0 }));

const sets: string[][] = [];
for (let mask = 0; mask < 1 << dark.length; mask++) {
  const set = dark.filter((_, i) => mask & (1 << i));
  if (set.length <= budget) sets.push(set);
}
const stars = sets.map((set) => C.map((_, ci) => run(ci, t0(set)).stars));
C.forEach((c, ci) => {
  const h = [0, 0, 0, 0];
  stars.forEach((s) => h[s[ci]]++);
  console.log(`${c.id} (${c.sectorId} at t${c.at}): sets by stars 0*=${h[0]} 1*=${h[1]} 2*=${h[2]} 3*=${h[3]}`);
});
const total = stars.map((s) => s.reduce((a, b) => a + b, 0));
const best = total.indexOf(Math.max(...total));
console.log(`best blind t0 set ${sets[best].join(" ")}: stars ${stars[best].join("/")}, average ${(total[best] / C.length).toFixed(2)} (max over all ${sets.length} sets)`);
console.log("each candidate's stored 3-star set replayed at t0, stars per candidate (rows: solution, columns: flood):");
let sum = 0;
C.forEach((c, k) => {
  const row = C.map((_, ci) => run(ci, t0(c.solution.map((x) => (x as { sectorId: string }).sectorId))).stars);
  sum += row.reduce((a, b) => a + b, 0);
  console.log(`  ${c.id}: ${row.join(" ")}  average ${(row.reduce((a, b) => a + b, 0) / C.length).toFixed(2)}`);
});
console.log(`overall memorise-and-place-at-t0 average: ${(sum / (C.length * C.length)).toFixed(2)}`);
C.forEach((c, ci) => {
  const r = run(ci, c.solution);
  const reveal = c.at - DEFAULT_REVEAL_LEAD;
  const late = c.solution.filter((x) => x.atTick >= reveal).length;
  const at = (id: string) => r.pods.find((p) => p.id === id)!.arriveTick;
  console.log(`${c.id}: stored solution ${r.stars}* (Mara t${at("MED-1")}, medicine t${at("SUP-3")}), ${c.solution.length}/${budget} beacons, ${late} placed at or after the telegraph (t${reveal}); ends: ${r.o.endReason}`);
});

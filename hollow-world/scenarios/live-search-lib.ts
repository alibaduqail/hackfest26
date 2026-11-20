// Shared by scenarios/live-search2.ts and live-search3.ts: exhaustive calibration of a level's flood candidates. Not used by tests or the game.
// Every set of up to `budget` beacons on the dark sectors, all placed at tick 0, run against every candidate; then the "placing everything at t0" averages.
import { createEngine } from "../src/echo/engine";
import { DEFAULT_REVEAL_LEAD, starsFor } from "../src/echo/descent";
import type { LiveCandidate } from "../src/echo/descent";
import type { Command, Mission } from "../src/echo/types";

export function search(name: string, C: LiveCandidate[], build: (attempt: number) => Mission, indexOf: (attempt: number) => number) {
  const attemptOf = (ci: number) => [...Array(2000).keys()].find((a) => indexOf(a) === ci)!;
  const run = (ci: number, cmds: Command[]) => {
    const m = build(attemptOf(ci));
    const e = createEngine(m, "echo");
    for (const c of cmds) e.act(c);
    e.step(m.endTick);
    const o = e.observe();
    return { stars: starsFor(C[ci].goals, o.pods), pods: o.pods, o };
  };
  const base = build(0);
  const dark = base.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
  const budget = base.beaconBudget!;
  const t0 = (set: string[]): Command[] => set.map((sectorId) => ({ type: "placeBeacon", sectorId, atTick: 0 }));
  const sets: string[][] = [];
  const rec = (i: number, cur: string[]) => {
    sets.push([...cur]);
    if (cur.length >= budget) return;
    for (let j = i; j < dark.length; j++) (cur.push(dark[j]), rec(j + 1, cur), cur.pop());
  };
  rec(0, []);
  const totals = new Array(sets.length).fill(0);
  const hist = C.map(() => [0, 0, 0, 0]);
  sets.forEach((set, k) => {
    const cmds = t0(set);
    C.forEach((_, ci) => {
      const st = run(ci, cmds).stars;
      hist[ci][st]++;
      totals[k] += st;
    });
  });
  console.log(`${name}: ${sets.length} sets within budget ${budget}`);
  C.forEach((c, ci) => console.log(`  ${c.id}: sets by stars 0*=${hist[ci][0]} 1*=${hist[ci][1]} 2*=${hist[ci][2]} 3*=${hist[ci][3]}`));
  const best = totals.indexOf(Math.max(...totals));
  console.log(`best blind t0 set ${sets[best].join(" ")}: total ${totals[best]} stars, average ${(totals[best] / C.length).toFixed(2)} across ${C.length} candidates (max over all sets)`);
  let sum = 0;
  C.forEach((c) => {
    const ids = c.solution.map((x) => (x as { sectorId: string }).sectorId);
    const row = C.map((_, ci) => run(ci, t0(ids)).stars);
    sum += row.reduce((a, b) => a + b, 0);
    console.log(`  ${c.id}'s stored run replayed at t0, stars per flood: ${row.join(" ")}`);
  });
  console.log(`memorise-and-place-at-t0 average: ${(sum / (C.length * C.length)).toFixed(2)}`);
  C.forEach((c, ci) => {
    const r = run(ci, c.solution);
    const floods = [{ at: c.at }, ...(c.seals ?? [])];
    const late = c.solution.filter((x) => floods.some((f) => x.atTick >= f.at - DEFAULT_REVEAL_LEAD)).length;
    const at = (id: string) => r.pods.find((p) => p.id === id)!.arriveTick;
    console.log(`  ${c.id}: stored run ${r.stars}* (Mara t${at("MED-1")}, medicine t${at("SUP-3")}), ${c.solution.length}/${budget} beacons, ${late} placed at/after a telegraph; ${r.o.endReason}`);
  });
  return Math.max(...totals) / C.length;
}

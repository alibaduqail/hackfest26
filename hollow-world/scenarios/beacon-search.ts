// Offline beacon-layout search for star calibration (npm run harness:search). Not used by tests or the game.
// Deterministic local search: start from detour-first, try swaps (drop one beacon, add one unbeaconed sector that some pod path uses),
// keep a swap if it improves the objective, stop after a full pass with no gain or at the evaluation cap.
import { createEngine } from "../src/echo/engine";
import { deadZones, grounding } from "../src/echo/missions";
import type { Mission } from "../src/echo/types";
import { detourFirstBeacons } from "./layouts";

const MARA_BY = 145; // constraint for both missions: Mara arrives by t+145

interface Result { mara: number; lastSupply: number; medianSupply: number; delay: number }

function evaluate(m: Mission, on: Set<string>, normalDelay: number): Result {
  for (const s of m.world.sectors) s.beacon = on.has(s.id); // one mission object, so the normal-day capacity reference stays cached
  const e = createEngine(m, "echo");
  e.step(m.endTick);
  const o = e.observe();
  const t = (x: number | null) => x ?? Infinity;
  const sup = o.pods.filter((p) => p.cargo).map((p) => t(p.arriveTick)).sort((a, b) => a - b);
  return {
    mara: t(o.pods.find((p) => p.id === "MED-1")!.arriveTick),
    lastSupply: sup[sup.length - 1],
    medianSupply: sup[Math.floor((sup.length - 1) / 2)],
    delay: o.score.passengerDelayMin / normalDelay,
  };
}

/** Lexicographic keys, smaller is better: feasibility (how late Mara is past the limit) first, then the mission's objective. */
type Key = (r: Result) => number[];
const better = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
};

function search(build: () => Mission, key: Key, cap: number) {
  const m = build();
  const budget = m.beaconBudget!;
  const ne = createEngine(m, "normal");
  ne.step(m.endTick);
  const normalDelay = ne.observe().score.passengerDelayMin;
  const candidates = [...new Set(m.pods.flatMap((p) => p.path))].sort();
  let best = detourFirstBeacons(m, budget);
  let bestR = evaluate(m, best, normalDelay);
  const start = bestR;
  let evals = 1;
  let accepted = 0;
  // ponytail: first-improvement swap search with a fixed cap; simulated annealing or restarts if this plateaus too early
  for (let improved = true; improved && evals < cap; ) {
    improved = false;
    for (const out of [...best].sort()) {
      for (const inn of candidates) {
        if (best.has(inn) || !best.has(out) || evals >= cap) continue;
        const next = new Set(best);
        next.delete(out);
        next.add(inn);
        const r = evaluate(m, next, normalDelay);
        evals++;
        if (better(key(r), key(bestR))) [best, bestR, improved] = [next, r, true], accepted++;
      }
    }
  }
  return { m, start, best: bestR, layout: [...best].sort(), evals, accepted, candidates: candidates.length };
}

const late = (r: Result) => Math.max(0, r.mara - MARA_BY);
const fmt = (r: Result) => `Mara t+${r.mara}, last supply t+${r.lastSupply}, median supply t+${r.medianSupply}, delay ${r.delay.toFixed(2)}x`;
const jobs: [() => Mission, Key, number, string][] = [
  [deadZones, (r) => [late(r), r.lastSupply, r.delay], 6000, "minimize last supply, Mara <= t+145"],
  [grounding, (r) => [late(r), r.delay, r.medianSupply], 3000, "minimize delay ratio, Mara <= t+145"],
];
for (const [build, key, cap, goal] of jobs) {
  const t0 = performance.now();
  const r = search(build, key, cap);
  console.log(`${r.m.title} (budget ${r.m.beaconBudget}, ${r.candidates} candidate sectors): ${goal}`);
  console.log(`  detour-first: ${fmt(r.start)}`);
  console.log(`  best found:   ${fmt(r.best)}${late(r.best) ? "  (Mara constraint NOT met)" : ""}`);
  console.log(`  ${r.evals} evaluations, ${r.accepted} swaps kept, ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  layout: ${r.layout.join(" ")}\n`);
}

// Difficulty of the live Descent for NAIVE and GOOD players, measured on the real engine (npx tsx scenarios/difficulty.ts).
// Not used by tests or the game. Every player model is a function from the level's mission to placeBeacon commands; the engine plays it out and
// the level's own star table scores it (win = at least 1 star, which is what completeLeg treats as a won leg). Seeded: same output every run.
// Then a small journey Monte Carlo turns the per-leg win rates into "does the player finish the journey" under the real retry rules.
import { createEngine, sealsOf } from "../src/echo/engine";
import { DEFAULT_REVEAL_LEAD, mulberry32, starsFor } from "../src/echo/descent";
import { DESCENT_LEVELS } from "../src/echo/descent-levels";
import { TUNING } from "../src/echo/journey-events";
import type { Command, Mission } from "../src/echo/types";

type Model = { name: string; plan: (m: Mission, rnd: () => number) => Command[] };
const place = (sectorId: string, atTick: number): Command => ({ type: "placeBeacon", sectorId, atTick });
const dark = (m: Mission) => m.world.sectors.filter((s) => s.beacon === false).map((s) => s.id);
const budgetOf = (m: Mission) => m.beaconBudget ?? 0;
const routeOf = (m: Mission) => m.pods.find((p) => p.nurse)!.path;
// the beacons a flood needs: the sealed sector and every sector between it and the fork (same route, lower index)
const warnChain = (m: Mission, sealId: string) => {
  const s = m.world.sectors.find((x) => x.id === sealId)!;
  return m.world.sectors.filter((x) => x.routeId === s.routeId && x.index <= s.index).sort((a, b) => b.index - a.index).map((x) => x.id);
};
const seals = (m: Mission) => sealsOf(m);
const revealAt = (m: Mission, at: number) => at - (m.floodReveal?.lead ?? DEFAULT_REVEAL_LEAD);
const pickN = <T,>(xs: T[], n: number, rnd: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };

const MODELS: Model[] = [
  { name: "no beacons", plan: () => [] },
  { name: "click anywhere (random sectors, random time 0-60)", plan: (m, r) => pickN(dark(m), budgetOf(m), r).map((s) => place(s, Math.floor(r() * 60))) },
  { name: "route only (ignores the flood)", plan: (m) => routeOf(m).filter((s) => dark(m).includes(s)).slice(0, budgetOf(m)).map((s, i) => place(s, 8 + 4 * i)) },
  { name: "all at t0 on the first dark sectors", plan: (m) => dark(m).slice(0, budgetOf(m)).map((s) => place(s, 0)) },
  // reactive players: wait for the flood telegraph, then answer it (d = reaction time in ticks after it appears)
  ...[0, 3, 6].map((d): Model => ({ name: `warns the sealed sector only, ${d} ticks after the telegraph`, plan: (m) => seals(m).map((s) => place(s.sectorId, Math.max(0, revealAt(m, s.at) + d))) })),
  ...[0, 3, 6, 9].map((d): Model => ({
    name: `GOOD: route first, then the full warning chain ${d} ticks after the telegraph`,
    plan: (m) => {
      const warn = seals(m).flatMap((s) => warnChain(m, s.sectorId).map((id) => ({ id, at: Math.max(0, revealAt(m, s.at) + d) })));
      const routeBudget = Math.max(0, budgetOf(m) - warn.length);
      const route = routeOf(m).filter((s) => dark(m).includes(s) && !warn.some((w) => w.id === s)).slice(0, routeBudget).map((s, i) => place(s, 8 + 4 * i));
      return [...route, ...warn.map((w) => place(w.id, w.at))];
    },
  })),
];

const N_RANDOM = 200;
type Cell = { win: number; three: number; n: number; clockSum: number; wins: number };
const attemptOf = (li: number, ci: number) => [...Array(4000).keys()].find((a) => DESCENT_LEVELS[li].candidateIndex(a) === ci)!;

export function measure() {
  const out: { level: string; model: string; candidates: Cell[]; p: number; three: number }[] = [];
  DESCENT_LEVELS.forEach((lv, li) => {
    const nCand = lv.candidates.length;
    for (const model of MODELS) {
      const random = model.name.startsWith("click anywhere");
      const cells: Cell[] = [];
      for (let ci = 0; ci < nCand; ci++) {
        const attempt = attemptOf(li, ci);
        const cell: Cell = { win: 0, three: 0, n: 0, clockSum: 0, wins: 0 };
        for (let k = 0; k < (random ? N_RANDOM : 1); k++) {
          const m = lv.build(attempt);
          const rnd = mulberry32(1000 * li + 100 * ci + k + 1);
          const e = createEngine(m, "echo");
          for (const c of model.plan(m, rnd)) e.act(c);
          e.step(m.endTick);
          const o = e.observe();
          const st = starsFor(lv.goalsFor(attempt), o.pods);
          cell.n++;
          if (st >= 1) { cell.win++; cell.wins++; cell.clockSum += o.pods.find((p) => p.nurse)!.arriveTick ?? 0; }
          if (st === 3) cell.three++;
        }
        cells.push(cell);
      }
      const tot = cells.reduce((a, c) => a + c.n, 0);
      out.push({ level: lv.id, model: model.name, candidates: cells, p: cells.reduce((a, c) => a + c.win, 0) / tot, three: cells.reduce((a, c) => a + c.three, 0) / tot });
    }
  });
  return out;
}

// ---- journey Monte Carlo: per-leg win probability -> does the player finish, under the retry rules ----
type Rules = { name: string; failExtra: number; loseBeaconsOnFail: boolean; doseOnFail: number; freeFirstRetry: boolean };
const RULES: Rules[] = [
  { name: "current rules (retry costs ticks+15, placed beacons lost, -1 dose)", failExtra: TUNING.failPenalty, loseBeaconsOnFail: true, doseOnFail: 1, freeFirstRetry: false },
  { name: "free first retry (no clock, beacons or dose lost the first time a leg fails)", failExtra: TUNING.failPenalty, loseBeaconsOnFail: true, doseOnFail: 1, freeFirstRetry: true },
  { name: "retry keeps the beacons you had (clock and dose still cost)", failExtra: TUNING.failPenalty, loseBeaconsOnFail: false, doseOnFail: 1, freeFirstRetry: false },
];
const LEG_WIN_TICKS = [92, 120, 111]; // a 1-star arrival (the slowest winning run) per leg: the clock a won leg adds in the worst case
const LEG_FAIL_TICKS = [76, 100, 100]; // roughly when a failed run is decided (early end)
const LEG_BEACONS = [5, 7, 6];

export function journey(pLeg: number[], rules: Rules, n: number, seed: number) {
  const rnd = mulberry32(seed);
  let saved = 0, clockSum = 0, finished = 0;
  for (let k = 0; k < n; k++) {
    let beacons = TUNING.start.beacons + 4, clock = TUNING.start.clock, doses = TUNING.start.doses - 1; // extra beacons at outfitting
    let ok = true;
    for (let leg = 0; leg < 3 && ok; leg++) {
      let attempt = 0;
      for (;;) {
        const need = [2, 4, 2][leg];
        while (beacons < need) { beacons += 2; clock += 25; } // Scavenge guard
        if (clock > TUNING.limit) { ok = false; break; }
        const used = Math.min(LEG_BEACONS[leg], beacons);
        if (rnd() < pLeg[leg]) { clock += LEG_WIN_TICKS[leg]; beacons -= used; break; }
        const free = rules.freeFirstRetry && attempt === 0;
        clock += free ? 0 : LEG_FAIL_TICKS[leg] + rules.failExtra;
        if (!free) { if (rules.loseBeaconsOnFail) beacons -= used; doses = Math.max(0, doses - rules.doseOnFail); }
        attempt++;
        if (attempt > 8) { ok = false; break; }
      }
    }
    if (ok) finished++;
    if (ok && clock <= TUNING.limit && doses >= 1) saved++;
    clockSum += clock;
  }
  return { saved: saved / n, finished: finished / n, meanClock: clockSum / n };
}

/** How long a player has: the latest reaction (ticks after the flood telegraph appears) at which the GOOD plan still wins, per level and flood. */
export function latestReaction() {
  return DESCENT_LEVELS.map((lv, li) => lv.candidates.map((_, ci) => {
    const attempt = attemptOf(li, ci);
    let latest = -1;
    for (let d = 0; d <= 40; d++) {
      const m = lv.build(attempt);
      const warn = seals(m).flatMap((sl) => warnChain(m, sl.sectorId).map((id) => ({ id, at: Math.max(0, revealAt(m, sl.at) + d) })));
      const routeBudget = Math.max(0, budgetOf(m) - warn.length);
      const route = routeOf(m).filter((x) => dark(m).includes(x) && !warn.some((w) => w.id === x)).slice(0, routeBudget).map((x, i) => place(x, 8 + 4 * i));
      const e = createEngine(m, "echo");
      for (const c of [...route, ...warn.map((w) => place(w.id, w.at))]) e.act(c);
      e.step(m.endTick);
      if (starsFor(lv.goalsFor(attempt), e.observe().pods) >= 1) latest = d; else if (latest >= 0) break;
    }
    return { level: lv.id, flood: lv.candidates[ci].id, latest };
  }));
}

if (process.argv[1]?.endsWith("difficulty.ts")) {
  const rows = measure();
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(4);
  console.log(`Per leg, win = at least 1 star, over every flood candidate of the level (telegraph lead per level: ${DESCENT_LEVELS.map((l) => `${l.build().floodReveal?.lead ?? DEFAULT_REVEAL_LEAD}`).join(" / ")} ticks, build delay 2 ticks). 3* = the top tier.`);
  for (const lv of DESCENT_LEVELS) {
    console.log(`\n${lv.id}  (${lv.candidates.length} flood candidates; budget ${lv.build().beaconBudget})`);
    for (const r of rows.filter((x) => x.level === lv.id)) console.log(`  win ${pct(r.p)}  3* ${pct(r.three)}  per-flood [${r.candidates.map((c) => pct(c.win / c.n)).join(" ")}]  ${r.model}`);
  }
  console.log(`\nHow long the player has (ticks after the telegraph the full warning chain can still be placed and the leg is still won; the telegraph itself shows ${DESCENT_LEVELS.map((l) => l.build().floodReveal?.lead ?? DEFAULT_REVEAL_LEAD).join(" / ")} ticks before the seal on levels I / II / III):`);
  for (const lv of latestReaction()) console.log("  " + lv.map((x) => `${x.level}/${x.flood}: ${x.latest} ticks (= ${(x.latest * 0.6).toFixed(1)} s at 1x, ${(x.latest * 0.3).toFixed(1)} s at 2x)`).join("   "));
  const byModel = (name: string) => DESCENT_LEVELS.map((l) => rows.find((x) => x.level === l.id && x.model === name)!.p);
  console.log("\nJourney Monte Carlo (5000 players, 15+4 beacons after outfitting, start clock 30, limit 390): P(Saved) / P(finishes all 3 legs) / mean clock");
  for (const name of ["click anywhere (random sectors, random time 0-60)", "warns the sealed sector only, 3 ticks after the telegraph", "GOOD: route first, then the full warning chain 3 ticks after the telegraph", "GOOD: route first, then the full warning chain 6 ticks after the telegraph", "GOOD: route first, then the full warning chain 9 ticks after the telegraph"]) {
    const p = byModel(name);
    console.log(`\n  ${name}  (per-leg win ${p.map(pct).join(" ")})`);
    for (const rl of RULES) { const j = journey(p, rl, 5000, 7); console.log(`    ${pct(j.saved)} saved  ${pct(j.finished)} finish  clock ${Math.round(j.meanClock)}  ${rl.name}`); }
  }
}

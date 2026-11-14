import { readFileSync, writeFileSync } from "node:fs";
import { platform, arch, cpus } from "node:os";
import assert from "node:assert/strict";
import { HollowEngine } from "./engine";
import type { Scenario } from "./types";
import { validateSave } from "./validation";
const scenario = JSON.parse(
  readFileSync(new URL("../../public/scenario.json", import.meta.url), "utf8"),
) as Scenario;
scenario.incidents = [
  { id: "b1", tick: 1800, kind: "blackout" },
  { id: "c1", tick: 2000, kind: "comms" },
  { id: "r1", tick: 3000, kind: "restore" },
  { id: "n1", tick: 3100, kind: "reconnect" },
];
const days = Number(process.env.HOLLOW_BENCH_DAYS ?? 30);
assert.ok(Number.isFinite(days) && days > 0 && days <= 365);
const e = new HollowEngine(scenario);
const initial = e.totals();
const start = performance.now();
const samples: number[] = [];
for (let tick = 0; tick < days * 86400; tick += 3600) {
  const before = performance.now();
  e.step(Math.min(3600, days * 86400 - tick));
  samples.push((performance.now() - before) / 3600);
  validateSave(scenario, e.state);
  assert.equal(e.state.people.length, 180);
  assert.ok(
    Math.abs(
      e.state.waterL - (e.state.hydrology.inflowL - e.state.hydrology.drainedL),
    ) < 0.01,
  );
  if ((tick + 3600) % 604800 === 0)
    console.log(`Completed ${(tick + 3600) / 86400} simulated days`);
}
const total = e.totals();
for (const k of Object.keys(total) as (keyof typeof total)[])
  assert.ok(
    Math.abs(
      total[k] -
        (initial[k] + e.state.ledger.produced[k] - e.state.ledger.consumed[k]),
    ) < 0.1,
    `${k} balance`,
  );
samples.sort((a, b) => a - b);
const result = {
  date: new Date().toISOString(),
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  simulatedDays: days,
  wallSeconds: (performance.now() - start) / 1000,
  p95MeanTickMs: samples[Math.floor(samples.length * 0.95)],
  residents: e.state.people.length,
  rooms: e.state.rooms.length,
  delivered: e.state.cart.delivered,
  finalTick: e.state.tick,
  resourceConservation: "passed",
  hourlySnapshotValidation: "passed",
  renderer: "not measured by headless benchmark",
};
console.log(JSON.stringify(result, null, 2));
writeFileSync(
  new URL("../../benchmark-results.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);

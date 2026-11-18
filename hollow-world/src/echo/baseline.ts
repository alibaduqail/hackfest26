// runBaseline: the same mission played three ways, silently and deterministically: the tower, Echo with no beacons, and the player's own commands.
// Pure engine code, no DOM. The debrief shows the three side by side so the value of the system is visible without narration.
import { descentLiveStars } from "./descent";
import { createEngine } from "./engine";
import type { Command, LogEvent, Mission, Mode } from "./types";

export interface RunOutcome {
  mode: Mode;
  mara: number | null; // tick the first nurse pod arrived, null = never
  medicine: number | null; // tick the first medicine pod arrived, null = never
  stars: 0 | 1 | 2 | 3 | null; // descent-live star table; null on missions without one
  claimed: number; // what the Directorate banner says
  actual: number; // pods that really moved after the tower went down
  log: LogEvent[]; // the complete log (observe().log keeps only the last 60 events)
}

export interface Baseline {
  tower: RunOutcome;
  none: RunOutcome;
  you: RunOutcome;
  towerSays: string; // "Tower says: 84 flights authorized; actual: 5 flew. Mara never arrives."
}

/** Play `mission` to its end. Each command fires at the start of its atTick, exactly as a live click does; refused commands are ignored. */
export function playRun(mission: Mission, mode: Mode, commands: Command[] = []): RunOutcome {
  const e = createEngine(mission, mode);
  const log: LogEvent[] = [];
  for (let t = 0; t < mission.endTick; t++) {
    for (const c of commands) if (c.atTick === t) e.act(c);
    e.step();
    log.push(...e.observe().log.filter((l) => l.tick === t)); // everything logged during tick t
  }
  const o = e.observe();
  const arrive = (pred: (p: (typeof o.pods)[number]) => boolean) => o.pods.find(pred)?.arriveTick ?? null;
  return {
    mode,
    mara: arrive((p) => !!p.nurse),
    medicine: arrive((p) => p.cargo === "medicine"),
    stars: mission.id === "descent-live" ? descentLiveStars(o.pods) : null,
    claimed: o.score.towerClaimed,
    actual: o.score.realFlights,
    log,
  };
}

/** Tower, no beacons, and the player's placements for one mission. `placements` is the command log of the live run. */
export function runBaseline(mission: Mission, placements: Command[]): Baseline {
  const tower = playRun(mission, "tower");
  const none = playRun(mission, "echo");
  const you = playRun(mission, "echo", placements);
  const fate = tower.mara === null ? "Mara never arrives" : `Mara arrives at minute ${tower.mara}`;
  return { tower, none, you, towerSays: `Tower says: ${tower.claimed} flights authorized; actual: ${tower.actual} flew. ${fate}.` };
}

// runBaseline: the same mission played three ways, silently and deterministically: the tower, Echo with no beacons, and the player's own commands.
// Pure engine code, no DOM. The debrief shows the three side by side so the value of the system is visible without narration.
import { DESCENT_LEVELS } from "./descent-levels";
import { createEngine } from "./engine";
import type { Command, LogEvent, Mission, Mode } from "./types";

export interface RunOutcome {
  mode: Mode;
  mara: number | null; // tick the first nurse pod arrived, null = never
  medicine: number | null; // tick the first medicine pod arrived, null = never
  stars: 0 | 1 | 2 | 3 | null; // the level's star table (DESCENT_LEVELS); null on missions without one
  claimed: number; // what the Directorate banner says
  actual: number; // pods that really moved after the tower went down
  log: LogEvent[]; // the complete log (observe().log keeps only the last 60 events)
}

export interface Baseline {
  tower: RunOutcome;
  none: RunOutcome;
  you: RunOutcome;
  towerSays: string; // "Tower says: 84 pod runs authorized; actual: 5 ran. Mara never arrives."
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
  const goals = DESCENT_LEVELS.find((l) => l.id === mission.id)?.goals; // the live Descent levels carry their own star table
  const by = (id: string, t: number) => (o.pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
  const arrive = (pred: (p: (typeof o.pods)[number]) => boolean) => o.pods.find(pred)?.arriveTick ?? null;
  return {
    mode,
    mara: arrive((p) => !!p.nurse),
    medicine: arrive((p) => p.cargo === "medicine"),
    stars: goals ? goals.reduce<0 | 1 | 2 | 3>((n, g) => (by("MED-1", g.maraBy) && (g.medicineBy === undefined || by("SUP-3", g.medicineBy)) ? g.stars : n), 0) : null,
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
  const nurse = mission.pods.find((p) => p.nurse);
  const who = (nurse?.label.split("· ")[1] ?? "The nurse").replace(/^Nurse /, "").split(" ")[0];
  const fate = tower.mara === null ? `${who} never arrives` : `${who} arrives at minute ${tower.mara}`;
  return { tower, none, you, towerSays: `Tower says: ${tower.claimed} pod runs authorized; actual: ${tower.actual} ran. ${fate}.` };
}

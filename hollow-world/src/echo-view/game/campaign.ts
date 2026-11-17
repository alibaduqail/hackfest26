// The campaign catalog, in play order. Star thresholds live here (GAME.md §3), not in the engine.
// Builders are looked up by name so the game compiles while the engine lane is still adding missions:
// a mission whose builder is missing shows as a locked "coming soon" card.
import * as M from "../../echo/missions";
import { CONTRACT_VERSION, type Mission, type Observation, type Sector } from "../../echo/types";

export interface Objective {
  label: string;
  met: (echo: Observation, normal: Observation) => boolean; // final Echo observation + the normal-day run
}
export interface CampaignMission {
  id: string;
  number: number;
  name: string;
  hook: string; // one line on the mission card
  briefing: string[]; // typewriter paragraphs
  broadcast: string; // the Directorate's line, shown in the BROADCAST frame
  prepTip?: string; // the Prepare screen's hint
  objectives: Objective[]; // one star each, from STARS
  allowDispatch: boolean;
  defaultSpeed: number;
  build: (() => Mission) | null; // null = the engine lane hasn't landed it yet
}

// ---- star thresholds: tune here (from the engine's beacon search and `npm run harness`) ----
// Beacons change timing, never who arrives, so most stars are deadlines on the final pods' arriveTick (1 tick = 1 minute).
// A goal is a list of conditions that must all hold. Condition `what`: mara = MED-1 · Nurse Mara Vale; nurses = every nurse;
// supplies = cargo pods. `by` = arrived by that minute (missing = any time); `half` = the median one (half of them) by then.
// maxDelay: passenger delay vs the normal day; ghost: every forged pod was rejected.
export interface Cond { what: "mara" | "nurses" | "supplies"; by?: number; half?: boolean }
export interface Goal { all: Cond[]; maxDelay?: number; ghost?: boolean }
export const STARS: Record<string, Goal[]> = {
  "tower-down": [
    { all: [{ what: "mara" }] },
    { all: [{ what: "nurses" }] },
    { all: [{ what: "supplies" }], maxDelay: 3 },
  ],
  // beacon search best: Mara t143, last supply t162; detour-first: Mara t137, last supply t189
  "dead-zones": [
    { all: [{ what: "mara", by: 160 }] },
    { all: [{ what: "mara", by: 145 }] },
    { all: [{ what: "mara", by: 148 }, { what: "supplies", by: 172 }] },
  ],
  // beacon search best: Mara t143, median supply t140, delay 3.04x; detour-first: 137 / 131 / 3.31x
  grounding: [
    { all: [{ what: "mara", by: 160 }] },
    { all: [{ what: "mara", by: 148 }, { what: "supplies", by: 145, half: true }] },
    { all: [{ what: "mara", by: 148 }, { what: "supplies", by: 145, half: true }], maxDelay: 3.4 },
  ],
  "ghost-flight": [
    { all: [{ what: "mara" }], ghost: true },
    { all: [{ what: "nurses" }] },
    { all: [{ what: "supplies" }], maxDelay: 3 },
  ],
};

// ---- goals -> objectives ----
const delayX = (o: Observation, n: Observation) =>
  n.score.passengerDelayMin > 0 ? o.score.passengerDelayMin / n.score.passengerDelayMin : o.score.passengerDelayMin > 0 ? Infinity : 1;
const pool = (o: Observation, w: Cond["what"]) => o.pods.filter((p) => (w === "mara" ? p.id === "MED-1" : w === "supplies" ? !!p.cargo : !!p.nurse));

function holds(o: Observation, c: Cond): boolean {
  const ps = pool(o, c.what);
  const ok = ps.filter((p) => p.arriveTick !== null && (c.by === undefined || p.arriveTick <= c.by)).length;
  return ps.length > 0 && ok >= (c.half ? Math.ceil(ps.length / 2) : ps.length);
}
function say(c: Cond): string {
  const by = c.by === undefined ? "" : ` by minute ${c.by}`;
  if (c.what === "mara") return `Mara reaches Lagos${by}`;
  if (c.what === "nurses") return `all nurses arrive${by}`;
  if (c.half) return `half the supply runs arrive${by}`;
  return c.by === undefined ? "all supply runs arrive" : `the last supply run arrives${by}`;
}

export function objective(g: Goal): Objective {
  const parts = [...(g.ghost ? ["the forged pod is rejected"] : []), ...g.all.map(say), ...(g.maxDelay ? [`passenger delay ≤ ${g.maxDelay}× normal`] : [])];
  const label = parts.join(" and ").replace(/^./, (ch) => ch.toUpperCase());
  return {
    label,
    met: (o, n) => g.all.every((c) => holds(o, c))
      && (!g.maxDelay || delayX(o, n) <= g.maxDelay)
      && (!g.ghost || o.pods.filter((p) => p.ghost).every((p) => !p.credentialOk)),
  };
}
const goals = (id: string) => (STARS[id] ?? []).map(objective);

const builder = (name: string): (() => Mission) | null => {
  const f = (M as unknown as Record<string, unknown>)[name];
  return typeof f === "function" ? (f as () => Mission) : null;
};

export const CAMPAIGN: CampaignMission[] = [
  {
    id: "tower-down", number: 1, name: "Tower Down",
    hook: "The tower goes dark. Get Nurse Mara Vale to Lagos.",
    briefing: [
      "Two billion people live in the Hollow, in cities under the dead ones. Pods run the tunnels between them, and one Directorate tower clears every flight.",
      "Nurse Mara Vale is in Sector 07. Her patients are in Lagos, where a lung sickness is spreading.",
      "Tonight the tower goes dark at minute twenty. The residents already bolted a beacon into every tunnel. Watch what Echo does with them.",
    ],
    broadcast: "ALL FLIGHTS REMAIN AUTHORIZED. THE NETWORK IS STABLE. REMAIN IN YOUR SECTOR.",
    objectives: goals("tower-down"),
    allowDispatch: true, defaultSpeed: 10, build: builder("towerDown"),
  },
  {
    id: "dead-zones", number: 2, name: "Dead Zones",
    hook: "Not enough beacons for every tunnel. Choose.",
    briefing: [
      "Same tunnels, same night. But the beacon stores ran low: you have far fewer beacons than tunnels.",
      "A tunnel with no beacon hears nothing and passes nothing on. A pod waits there blind before it dares to enter.",
      "Place the beacons where the news has to travel. The Directorate will seal the Lagos tunnel at minute thirty.",
    ],
    broadcast: "UNLICENSED RADIOS ARE A DANGER TO ALL FLIGHTS. HAND THEM IN AT YOUR SECTOR OFFICE.",
    prepTip: "The Directorate will seal the direct tunnel to Lagos. Beacon the detour. Mara's detour runs through São Paulo. The supply runs need the rest.",
    objectives: goals("dead-zones"),
    allowDispatch: true, defaultSpeed: 10, build: builder("deadZones"),
  },
  {
    id: "grounding", number: 3, name: "The Grounding",
    hook: "Weeks, not hours. The Directorate keeps cutting.",
    briefing: [
      "The tower is not coming back. The Directorate calls it a grounding and says it is temporary.",
      "Lagos needs nurses for weeks, not hours. A second wave of pods will leave once the first has landed.",
      "Expect more seals. First the Lagos tunnel, then Cairo, then London. Build a network that can lose a tunnel and keep talking.",
    ],
    broadcast: "THE GROUNDING PROTECTS YOU. TRAVEL WILL RESUME WHEN ORDER IS RESTORED.",
    objectives: goals("grounding"),
    allowDispatch: false, defaultSpeed: 300, build: builder("grounding"),
  },
  {
    id: "ghost-flight", number: 4, name: "Ghost Flight",
    hook: "A medical pod with a forged signature wants the front of the queue.",
    briefing: [
      "The Directorate has learned how Echo works: medicine goes first.",
      "Tonight it slips a pod of its own into the tunnels. It calls itself medical, and its signature is forged.",
      "There is no center to ask. Every beacon checks the signature itself.",
    ],
    broadcast: "A MEDICAL CONVOY IS EN ROUTE. ALL FLIGHTS MUST GIVE WAY.",
    objectives: goals("ghost-flight"),
    allowDispatch: true, defaultSpeed: 10, build: builder("ghostFlight"),
  },
];

export const byId = (id: string | null | undefined) => CAMPAIGN.find((m) => m.id === id);
export const starsFor = (cm: CampaignMission, echo: Observation, normal: Observation) => cm.objectives.filter((x) => x.met(echo, normal)).length;

/** The one-line debrief verdict. Names on screen: only Mara, Echo, the Directorate, the Hollow. */
export function verdict(echo: Observation, normal: Observation): string {
  const s = echo.score;
  const m = echo.pods.find((p) => p.id === "MED-1")?.status === "arrived" ? "Mara made it." : "Mara never made it.";
  const d = delayX(echo, normal);
  const wait = Number.isFinite(d) ? ` Passengers waited ${d.toFixed(1)}× longer than on a normal day.` : "";
  return `${m} ${s.nursesArrived}/${s.nursesTotal} nurses, ${s.suppliesDelivered}/${s.suppliesTotal} supply runs.${wait}`;
}

/** A still frame of a mission's world for the map (title, prepare): no pods, tower dark so lanes draw live. */
export const staticObs = (m: Mission, sectors: Sector[] = m.world.sectors): Observation => ({
  contract: CONTRACT_VERSION, tick: 0, endTick: m.endTick, mode: "echo", towerUp: false, towerDownAt: m.towerDownAt,
  cities: m.world.cities, sectors, pods: [], log: [], pulses: [], over: false,
  score: { nursesArrived: 0, nursesTotal: 0, suppliesDelivered: 0, suppliesTotal: 0, passengerDelayMin: 0, capacityPct: 100, realFlights: 0, towerClaimed: 0 },
});

// The campaign catalog, in play order. Star thresholds live here (GAME.md §3), not in the engine.
// Builders are looked up by name so the game compiles while the engine lane is still adding missions:
// a mission whose builder is missing shows as a locked "coming soon" card.
import * as M from "../../echo/missions";
import { CONTRACT_VERSION, type Mission, type Observation, type Pod, type Sector } from "../../echo/types";

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

// ---- star thresholds: tune here (placeholders; numbers from `npm run harness`) ----
// Beacons change timing, never who arrives, so every star is a deadline on the final pods' arriveTick.
// what: mara = MED-1 · Nurse Mara Vale; nurses = any nurse; lagosNurses = nurses bound for Lagos; supplies = cargo pods.
// count missing = all of them. ghost: also every ghost pod's signature was rejected. maxDelay: passenger delay vs the normal day.
export interface Goal { what: "mara" | "nurses" | "lagosNurses" | "supplies"; count?: number; by: number; maxDelay?: number; ghost?: boolean }
export const STARS: Record<string, Goal[]> = {
  // Tower Down Echo run (seed 20261117): Mara t137, last nurse t137, last supply t162, delay 2.4x
  "tower-down": [{ what: "mara", by: 160 }, { what: "nurses", by: 150 }, { what: "supplies", by: 180, maxDelay: 3 }],
  "dead-zones": [{ what: "mara", by: 175 }, { what: "lagosNurses", count: 6, by: 160 }, { what: "supplies", by: 220, maxDelay: 4 }],
  grounding: [{ what: "lagosNurses", count: 6, by: 200 }, { what: "supplies", count: 12, by: 900 }, { what: "lagosNurses", count: 10, by: 1000, maxDelay: 4 }],
  "ghost-flight": [{ what: "mara", by: 160, ghost: true }, { what: "nurses", by: 150 }, { what: "supplies", by: 180, maxDelay: 3 }],
};

// ---- goals -> objectives ----
const arrivedBy = (p: Pod, t: number) => p.arriveTick !== null && p.arriveTick <= t;
const delayX = (o: Observation, n: Observation) =>
  n.score.passengerDelayMin > 0 ? o.score.passengerDelayMin / n.score.passengerDelayMin : o.score.passengerDelayMin > 0 ? Infinity : 1;
const pool = (o: Observation, w: Goal["what"]) =>
  o.pods.filter((p) => (w === "mara" ? p.id === "MED-1" : w === "supplies" ? !!p.cargo : p.nurse && (w === "nurses" || p.dest === "lagos")));
const NOUN = { mara: "", nurses: "nurses arrive", lagosNurses: "nurses reach Lagos", supplies: "supply runs arrive" };

export function objective(g: Goal): Objective {
  const head = g.what === "mara" ? "Mara reaches Lagos" : `${g.count ?? "All"} ${NOUN[g.what]}`;
  const label = `${g.ghost ? `The ghost is rejected and ${head}` : head} by t+${g.by}${g.maxDelay ? `, delay ≤ ${g.maxDelay}× normal` : ""}`;
  return {
    label,
    met: (o, n) => {
      const ps = pool(o, g.what);
      const need = g.count ?? ps.length;
      return ps.length > 0 && ps.filter((p) => arrivedBy(p, g.by)).length >= need
        && (!g.maxDelay || delayX(o, n) <= g.maxDelay)
        && (!g.ghost || o.pods.filter((p) => p.ghost).every((p) => !p.credentialOk));
    },
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
    prepTip: "The Directorate will seal the direct tunnel to Lagos. Beacon the detour.",
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

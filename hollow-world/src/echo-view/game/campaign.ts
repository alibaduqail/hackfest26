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
  objectives: [Objective, Objective, Objective]; // one star each
  allowDispatch: boolean;
  defaultSpeed: number;
  build: (() => Mission) | null; // null = the engine lane hasn't landed it yet
}

// ---- helpers over the final observation ----
const mara = (o: Observation): Pod | undefined => o.pods.find((p) => p.id === "MED-1");
const maraArrives = (o: Observation) => mara(o)?.status === "arrived";
const delayX = (o: Observation, n: Observation) =>
  n.score.passengerDelayMin > 0 ? o.score.passengerDelayMin / n.score.passengerDelayMin : o.score.passengerDelayMin > 0 ? Infinity : 1;
const nursesTo = (o: Observation, city: string) => o.pods.filter((p) => p.nurse && p.dest === city && p.status === "arrived").length;
const ghostRejected = (o: Observation) => o.pods.filter((p) => p.ghost).every((p) => !p.credentialOk);

// ---- star thresholds: tune here ----
export const STARS = {
  "tower-down": { maxDelay: 3 },
  "dead-zones": { nurses: 6, supplies: 8, maxDelay: 4 },
  grounding: { lagosNurses: 6, supplies: 8, maxDelay: 4 },
  "ghost-flight": { maxDelay: 3 },
} as const;

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
    objectives: [
      { label: "Mara reaches Lagos", met: (o) => maraArrives(o) },
      { label: "All nurses arrive", met: (o) => o.score.nursesArrived === o.score.nursesTotal },
      { label: `All supplies, passenger delay ≤ ${STARS["tower-down"].maxDelay}× normal`, met: (o, n) => o.score.suppliesDelivered === o.score.suppliesTotal && delayX(o, n) <= STARS["tower-down"].maxDelay },
    ],
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
    objectives: [
      { label: "Mara reaches Lagos", met: (o) => maraArrives(o) },
      { label: `At least ${STARS["dead-zones"].nurses} nurses arrive`, met: (o) => o.score.nursesArrived >= STARS["dead-zones"].nurses },
      { label: `${STARS["dead-zones"].supplies}+ supplies, delay ≤ ${STARS["dead-zones"].maxDelay}× normal`, met: (o, n) => o.score.suppliesDelivered >= STARS["dead-zones"].supplies && delayX(o, n) <= STARS["dead-zones"].maxDelay },
    ],
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
    objectives: [
      { label: `Lagos gets ${STARS.grounding.lagosNurses}+ nurses`, met: (o) => nursesTo(o, "lagos") >= STARS.grounding.lagosNurses },
      { label: `${STARS.grounding.supplies}+ supplies delivered`, met: (o) => o.score.suppliesDelivered >= STARS.grounding.supplies },
      { label: `Passenger delay ≤ ${STARS.grounding.maxDelay}× normal`, met: (o, n) => delayX(o, n) <= STARS.grounding.maxDelay },
    ],
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
    objectives: [
      { label: "The ghost is rejected and Mara reaches Lagos", met: (o) => ghostRejected(o) && maraArrives(o) },
      { label: "All nurses arrive", met: (o) => o.score.nursesArrived === o.score.nursesTotal },
      { label: `All supplies, passenger delay ≤ ${STARS["ghost-flight"].maxDelay}× normal`, met: (o, n) => o.score.suppliesDelivered === o.score.suppliesTotal && delayX(o, n) <= STARS["ghost-flight"].maxDelay },
    ],
    allowDispatch: true, defaultSpeed: 10, build: builder("ghostFlight"),
  },
];

export const byId = (id: string | null | undefined) => CAMPAIGN.find((m) => m.id === id);
export const starsFor = (cm: CampaignMission, echo: Observation, normal: Observation) => cm.objectives.filter((x) => x.met(echo, normal)).length;

/** The one-line debrief verdict. Names on screen: only Mara, Echo, the Directorate, the Hollow. */
export function verdict(echo: Observation, normal: Observation): string {
  const s = echo.score;
  const m = maraArrives(echo) ? "Mara made it." : "Mara never made it.";
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

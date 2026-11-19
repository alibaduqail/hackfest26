// Echo contract v1 — the only coupling between the engine lane (src/echo) and the view lane (src/echo-view).
// Owned by @m_opus. Change requests go on the board: "@m_opus CONTRACT? <field> <why>". See docs/specs/echo/PLAN.md §1.2, §3.2.
export const CONTRACT_VERSION = 2; // v2 (game): beacons, multiple seals, beacon budget, ghost pods. Additive over v1.

export type Priority = "medical" | "supply" | "passenger";
export type Mode = "tower" | "echo" | "normal"; // normal = tower never fails (reference run)

export interface City {
  id: string;
  name: string; // "Lagos Deep"
  above: string; // dead city above, "Lagos"
  x: number; // 0..1 equirectangular
  y: number;
  outbreak?: boolean;
  strata?: boolean; // Sector 07, links to the city sim
}

export interface Sector {
  id: string;
  routeId: string;
  index: number; // position along its route; one direction per sector, so no head-on conflicts
  from: string; // city ids of the route ends
  to: string;
  a: [number, number]; // map coordinates of the sector's ends
  b: [number, number];
  minutes: number; // travel time through the sector, in ticks
  holder: string | null; // pod id
  sealed: boolean; // Directorate sealed this tunnel: Echo can't open it, only route around it
  beacon?: boolean; // v2: residents' trackside radio in this sector. Missing = true. No beacon: news can't hop through it, and Echo pods wait blind before entering
}

export interface World {
  cities: City[];
  sectors: Sector[];
}

export interface Pod {
  id: string;
  label: string; // "MED-1 · Nurse Mara Vale"
  priority: Priority;
  sig?: string; // simulated clinic signature (credential.ts); the engine derives credentialOk from it
  credentialOk: boolean;
  origin: string;
  dest: string;
  path: string[]; // sector ids in order
  at: number; // index into path; -1 = at origin terminal
  progress: number; // 0..1 within the current sector
  status: "scheduled" | "waiting" | "moving" | "holding" | "arrived";
  rerouted: boolean; // path was re-planned around a seal
  waitedMin: number;
  departTick: number;
  arriveTick: number | null;
  cargo?: "medicine" | "water" | "food";
  nurse?: boolean;
  ghost?: boolean; // v2: Directorate-injected fake pod (forged signature); the view may reveal it after its credential is rejected
}

export type LogKind =
  | "grant"
  | "tower-down"
  | "seal"
  | "seal-heard"
  | "reroute"
  | "hold"
  | "announce"
  | "claim"
  | "yield"
  | "enter"
  | "release"
  | "arrive"
  | "credential-reject"
  | "blind" // v2: an Echo pod waits at an unbeaconed sector because it can't hear whether it is clear
  | "beacon-placed"; // v2: a live placeBeacon took effect; sectorId is the sector that now has a beacon

export interface LogEvent {
  tick: number;
  kind: LogKind;
  podId?: string;
  sectorId?: string;
  text: string;
}

// One beacon hop this tick; the view animates it. Echo mode only.
export interface Pulse {
  sectorId: string;
  kind: "announce" | "seal" | "release";
  age: number;
}

export interface Score {
  nursesArrived: number;
  nursesTotal: number;
  suppliesDelivered: number; // water, food and medicine pods arrived
  suppliesTotal: number;
  passengerDelayMin: number; // summed wait of passenger pods
  capacityPct: number; // sectors entered per hour vs the normal-day run, 0..100
  realFlights: number; // pods that moved at least one sector after tower-down
  towerClaimed: number; // what the Directorate banner says
}

export interface Observation {
  contract: typeof CONTRACT_VERSION;
  tick: number;
  endTick: number;
  mode: Mode;
  towerUp: boolean;
  towerDownAt: number;
  cities: City[];
  sectors: Sector[];
  pods: Pod[];
  log: LogEvent[]; // newest last, max 60
  pulses: Pulse[];
  score: Score;
  over: boolean;
  // Live Descent only (present only when the mission sets the matching option; absent keys keep every other observation identical):
  floodWarnings?: FloodWarning[]; // one per seal that has not fired yet, in seal order
  building?: { sectorId: string; readyAt: number }[]; // beacons ordered but not live yet
  endReason?: string; // why the run is over, once it is (set when Mission.earlyEnd is on)
}

/** A flood telegraph. `risk` is always shown; `sectorId` and `at` (the seal minute) appear only inside the reveal window. */
export interface FloodWarning {
  risk: string;
  sectorId?: string;
  at?: number;
}

// dispatchMedical makes a scheduled medical pod depart at atTick. Apply the same command to every engine in a split screen.
// placeBeacon (additive, echo mode only): the Relay bolts a beacon into sectorId at the start of tick atTick, before the protocol steps; it counts against Mission.beaconBudget.
export type Command = { type: "dispatchMedical"; podId: string; atTick: number } | { type: "placeBeacon"; sectorId: string; atTick: number };

export interface Mission {
  id: string; // v2: any mission id ("tower-down", "grounding", ...)
  title: string;
  seed: number;
  world: World;
  endTick: number;
  towerDownAt: number;
  towerRatePerHour: number;
  towerInflation: number;
  sealAt: number | null; // Directorate seals one tunnel sector (not in normal mode)
  sealSectorId: string | null;
  seals?: { at: number; sectorId: string }[]; // v2: further seals after the first; all follow the same rules
  beaconBudget?: number | null; // v2: null/missing = fixed layout; a number = the player places up to N beacons before the run
  pods: Pod[]; // initial and scheduled
  // Live Descent opt-ins (all additive; a mission without them behaves exactly as before):
  floodReveal?: { lead: number; risk: string[] }; // seal telegraphs (sector + minute) show `lead` ticks before each seal; 0 = never before it fires. risk[i] is the always-visible text for seal i (sealsOf order)
  beaconBuildTicks?: number; // a placed beacon goes live this many ticks after the command; the observation lists it under `building`
  earlyEnd?: boolean; // the run ends as soon as the key pods are decided, and the observation carries endReason
}

export interface EchoEngineApi {
  step(n?: number): void;
  observe(): Observation;
  act(c: Command): { ok: boolean; reason?: string };
}

// engine.ts exports: createEngine(mission, mode)
export type CreateEngine = (mission: Mission, mode: Mode) => EchoEngineApi;

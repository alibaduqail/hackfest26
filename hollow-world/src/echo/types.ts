// Echo contract v1 — the only coupling between the engine lane (src/echo) and the view lane (src/echo-view).
// Owned by @m_opus. Change requests go on the board: "@m_opus CONTRACT? <field> <why>". See docs/specs/echo/PLAN.md §1.2, §3.2.
export const CONTRACT_VERSION = 1;

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
  | "credential-reject";

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
}

// Makes a scheduled medical pod depart at atTick. Apply the same command to every engine in a split screen.
export type Command = { type: "dispatchMedical"; podId: string; atTick: number };

export interface Mission {
  id: "tower-down" | "grounding";
  title: string;
  seed: number;
  world: World;
  endTick: number;
  towerDownAt: number;
  towerRatePerHour: number;
  towerInflation: number;
  sealAt: number | null; // Directorate seals one tunnel sector (not in normal mode)
  sealSectorId: string | null;
  pods: Pod[]; // initial and scheduled
}

export interface EchoEngineApi {
  step(n?: number): void;
  observe(): Observation;
  act(c: Command): { ok: boolean; reason?: string };
}

// engine.ts exports: createEngine(mission, mode)
export type CreateEngine = (mission: Mission, mode: Mode) => EchoEngineApi;

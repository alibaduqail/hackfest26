export type Item = "food" | "water" | "medicine" | "parts" | "waste";
export type Stock = Record<Item, number>;
export type RoomKind =
  | "home"
  | "clinic"
  | "depot"
  | "farm"
  | "plant"
  | "switchgear"
  | "recycler"
  | "tap"
  | "fan"
  | "pump"
  | "workshop"
  | "mess"
  | "checkpoint"
  | "relay"
  | "gate";
export interface RoomDef {
  id: string;
  name: string;
  district: number;
  floor: number;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  beds: number;
  condition: number;
  feederFloor?: number;
  demandW: number;
  stock: Stock;
  capacity: number;
}
export interface LinkDef {
  id: string;
  a: string;
  b: string;
  kind: "corridor" | "stairs" | "lift" | "sump" | "checkpoint";
  seconds: number;
  capacity: number;
  permit?: string;
  feederFloor?: number;
}
export interface HouseholdDef {
  id: string;
  name: string;
  homeId: string;
  depotId: string;
  members: string[];
  stock: Stock;
}
export interface PersonDef {
  id: string;
  name: string;
  householdId: string;
  homeId: string;
  workId: string | null;
  role: string;
  shift: number;
  appearance: number;
  permit: boolean;
}
export interface Scenario {
  schemaVersion: 1;
  modelVersion: string;
  id: string;
  seed: number;
  startHour: number;
  rooms: RoomDef[];
  links: LinkDef[];
  households: HouseholdDef[];
  residents: PersonDef[];
  airZones: { fanId: string; roomIds: string[] }[];
  waterLinks: { fromId: string; toId: string; litersPerSecond: number }[];
  settings: {
    hungerPerSecond: number;
    thirstPerSecond: number;
    fatiguePerSecond: number;
    sleepRecoveryPerSecond: number;
    heatResponse: number;
    waterTreatmentLps: number;
    waterTreatmentYield: number;
    growWaterLps: number;
    harvestUnits: number;
    fanAirReduction: number;
    occupiedAirLoad: number;
    stagnantAirRise: number;
    baseCelsius: number;
    depthHeating: number;
    fanCoolingDelta: number;
    storageCapacity: number;
    generationW: number;
    batteryWh: number;
    batteryMaxW: number;
    seepLps: number;
    pumpLps: number;
    tunnelAreaM2: number;
    closeDepthM: number;
    reportEvery: number;
    reportDelay: number;
    reportStaleAfter: number;
    cropSeconds: number;
    cartCrates: number;
    cartCapacity: number;
  };
  incidents: {
    id: string;
    tick: number;
    kind: IncidentKind;
    targetId?: string;
  }[];
  assumptions: string[];
}
export type IncidentKind =
  | "blackout"
  | "restore"
  | "comms"
  | "reconnect"
  | "lockdown"
  | "unlock";
export interface PersonState {
  id: string;
  roomId: string;
  edgeId: string | null;
  fromId: string;
  toId: string;
  edgeProgress: number;
  destination: string;
  path: string[];
  task: string;
  taskState: "traveling" | "queued" | "active" | "blocked" | "resting";
  reason: string;
  activityUntil: number;
  nextPlan: number;
  hunger: number;
  thirst: number;
  fatigue: number;
  heatExposure: number;
  airExposure: number;
  careNeeded: number;
  bag: Stock;
  knownClosed: string[];
  completed: number;
}
export interface RoomState {
  id: string;
  powered: boolean;
  suppliedW: number;
  temperature: number;
  air: number;
  contamination: number;
  stock: Stock;
  occupants: number;
  staff: number;
  growth: number;
  output: number;
  condition: number;
  reason: string;
}
export interface HouseholdState {
  id: string;
  stock: Stock;
  cutoffSeconds: number;
  coolingSeconds: number;
  unmetFood: number;
  unmetWater: number;
  accessClosed: boolean;
  accessStart: number | null;
  causes: string[];
}
export interface CartState {
  roomId: string;
  edgeId: string | null;
  fromId: string;
  toId: string;
  progress: number;
  path: string[];
  cargo: Stock;
  targetId: string;
  phase: "loading" | "traveling" | "waiting" | "unloading";
  delivered: number;
  reason: string;
  until: number;
}
export interface WorldEvent {
  id: string;
  tick: number;
  text: string;
  subjectId: string;
  causeIds: string[];
  kind: string;
}
export interface Report {
  subjectId: string;
  sampledAtTick: number;
  receivedAtTick: number;
  waterM: number;
  temperature: number;
  air: number;
  powered: boolean;
}
export interface Command {
  commandId: string;
  actorId: string;
  expectedRunId: string;
  requestedAtTick: number;
  type:
    | "assignBackup"
    | "setDeviceEnabled"
    | "requestRepair"
    | "requestDelivery";
  targetId: string;
  value?: string | boolean;
}
export interface Receipt {
  commandId: string;
  ok: boolean;
  reason?: string;
  scheduledTick?: number;
}
export interface WorldState {
  schemaVersion: 1;
  modelVersion: string;
  scenarioHash: string;
  runId: string;
  tick: number;
  rooms: RoomState[];
  people: PersonState[];
  households: HouseholdState[];
  cart: CartState;
  events: WorldEvent[];
  eventSequence: number;
  inputSequence: number;
  reports: Report[];
  pendingReports: Report[];
  comms: boolean;
  blackout: boolean;
  lockdown: boolean;
  backup: "fan" | "pump";
  backupTarget:string;
  batteryMilliWh: number;
  batteryResidual: number;
  disabled: string[];
  waterL: number;
  hydrology: { inflowL: number; drainedL: number };
  closedLinks: string[];
  topology: number;
  receipts: Receipt[];
  commands: Command[];
  commandLog: { tick: number; order: number; command: Command }[];
  actions: {
    tick: number;
    order: number;
    kind: IncidentKind;
    targetId?: string;
  }[];
  ledger: { produced: Stock; consumed: Stock; external: Stock };
  deficits: {
    householdId: string;
    start: number;
    end: number | null;
    causes: string[];
  }[];
}
export type WorkerRequest =
  | { type: "init"; scenario: Scenario }
  | { type: "play"; playing: boolean }
  | { type: "speed"; speed: number }
  | { type: "step" }
  | { type: "incident"; kind: IncidentKind }
  | { type: "command"; command: Command }
  | { type: "load"; scenario: Scenario; state: WorldState }
  | { type: "reset" }
  | { type: "replay"; replay: ReplayFile };
export type WorkerResponse =
  | {
      type: "state";
      state: WorldState;
      playing: boolean;
      speed: number;
      achievedSpeed: number;
      tickMs: number;
    }
  | { type: "error"; message: string }
  | { type: "receipt"; receipt: Receipt };

export interface ReplayFile {
  format: "hollow-replay-v1";
  scenario: Scenario;
  finalTick: number;
  actions: WorldState["actions"];
  commands: WorldState["commandLog"];
}

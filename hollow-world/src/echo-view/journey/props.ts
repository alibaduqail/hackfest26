// Prop types for the Journey screens. Field names mirror the #107 contract (src/echo/journey.ts) structurally,
// so the wiring can pass JourneyState / CampEvent / ending() output straight through. Deliberately no import of journey.ts.

export type LegId = "descent1" | "descent2" | "descent3";
export type Stars = 0 | 1 | 2 | 3;

export interface Resources { beacons: number; clock: number; doses: number }
export interface Effect { beacons?: number; clock?: number; doses?: number; nextRevealLead?: number }
export interface Choice { id: string; label: string; detail: string; effect: Effect; reveal?: string }
export interface CampEvent { id: string; title: string; body: string; choices: Choice[] }
export interface LegResult { legId: LegId; stars: Stars; maraAt: number | null; medicineAt: number | null; beaconsPlaced: number; ticks: number }
export type LogEntry =
  | { kind: "leg"; legId: LegId; attempt: number; result: LegResult }
  | { kind: "choice"; eventId: string; choiceId: string };
export interface Ending { kind: "saved" | "late"; score: number; title: string; lines: string[] }

export interface TitleProps {
  onBegin: () => void;
  onContinue?: () => void; // shown only when given (a saved journey exists)
  onTowerDown?: () => void;
  onStrata?: () => void;
  onFreePlay?: () => void;
}

export interface CampScreenProps {
  event: CampEvent; // campEvent(state)
  res: Resources; // state.res
  limit: number; // the patient's clock limit (~300)
  legIndex: number; // state.legIndex: legs finished so far (0 = outfitting)
  attempt: number; // state.attempt (1 = first try of this leg)
  log: LogEntry[]; // state.log (drives the trail map's stars)
  onPick?: (choiceId: string) => void; // fires when a choice is locked in (sound hook); the state is NOT advanced yet
  onContinue: (choiceId: string) => void; // "Continue down": call choose(state, choiceId) here
}

export interface TrailMapProps {
  legIndex: number; // legs finished
  log: LogEntry[];
  compact?: boolean;
}

export interface EndingScreenProps {
  ending: Ending; // ending(state)
  res: Resources;
  limit: number;
  log: LogEntry[];
  choiceNames?: Record<string, string>; // `${eventId}/${choiceId}` -> readable label; falls back to the ids
  onAgain: () => void;
}

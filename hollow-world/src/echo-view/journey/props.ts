// Prop types for the Journey screens.

// The journey types come straight from src/echo/journey.ts (type-only imports), so a contract change breaks tsc here instead of drifting.
import type { CampEvent, ending as endingFn, LegResult, LogEntry, Resources } from "../../echo/journey";
export type { CampEvent, Choice, Effect, JourneyState, LegId, LegResult, LogEntry, Resources } from "../../echo/journey";
export type Stars = LegResult["stars"];
export type Ending = ReturnType<typeof endingFn>;

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
  limit?: number; // the patient's clock limit; defaults to LIMIT from journey.ts
  legIndex: number; // state.legIndex: legs finished so far (0 = outfitting)
  attempt: number; // state.attempt: failed tries of this leg so far (0 = first try)
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
  limit?: number; // defaults to LIMIT from journey.ts
  log: LogEntry[];
  choiceNames?: Record<string, string>; // `${eventId}/${choiceId}` -> readable label; falls back to the ids
  onAgain: () => void;
}

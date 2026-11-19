// The Journey: runs the journey.ts state machine through title -> camp -> leg -> ... -> ending and saves it (spec: issue #107).
// The screens are props-only (see WIRING.md); this file is the only place that calls choose() / completeLeg() and touches localStorage.
import { lazy, Suspense, useMemo, useState, type MouseEvent } from "react";
import { campEvent, choose, completeLeg, currentLeg, ending, LIMIT, startJourney, type JourneyState, type LegResult } from "../../echo/journey";
import { Backdrop } from "../game/Backdrop";
import { SoundToggle } from "../game/SoundToggle";
import { CampScreen } from "./CampScreen";
import { EndingScreen } from "./EndingScreen";
import { choiceNamesFor } from "./helpers";
import { TitleScreen } from "./TitleScreen";
import "./journey.css";

const LiveScreen = lazy(() => import("../cutaway/live/LiveScreen").then((m) => ({ default: m.LiveScreen })));

const KEY = "echo.journey.v1";
const PHASES = ["camp", "leg", "ending"];

const valid = (x: unknown): x is JourneyState => {
  const s = x as JourneyState | null;
  return !!s && typeof s === "object" && PHASES.includes(s.phase) && Number.isInteger(s.legIndex) && s.legIndex >= 0 && s.legIndex <= (s.phase === "ending" ? 3 : 2) && (s.phase !== "ending" || s.legIndex === 3) &&
    Number.isInteger(s.attempt) && Array.isArray(s.log) && !!s.res && [s.res.beacons, s.res.clock, s.res.doses].every((n) => typeof n === "number") &&
    typeof s.seed === "number" && !!s.pending && typeof s.pending === "object";
};
function load(): JourneyState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    return valid(s) ? s : null;
  } catch { return null; }
}
function save(s: JourneyState | null) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode or full: the journey just is not saved */ }
}

export interface JourneyAppProps { onTowerDown: () => void; onStrata: () => void; onFreePlay: () => void }

export function JourneyApp({ onTowerDown, onStrata, onFreePlay }: JourneyAppProps) {
  const [saved, setSaved] = useState(load); // the save on disk, for "Continue the journey"
  const [s, setS] = useState<JourneyState | null>(null); // null = on the title screen
  const play = (next: JourneyState) => { save(next); setSaved(next); setS(next); };

  if (!s) {
    return (
      <>
        <Backdrop />
        <TitleScreen
          onBegin={() => play(startJourney())}
          onContinue={saved ? () => setS(saved) : undefined}
          onTowerDown={onTowerDown} onStrata={onStrata} onFreePlay={onFreePlay}
        />
        <SoundToggle />
      </>
    );
  }
  if (s.phase === "leg") return <Leg s={s} play={play} toTitle={() => setS(null)} />;
  return (
    <>
      <Backdrop />
      {s.phase === "camp" ? (
        <CampScreen
          key={s.log.length} // Scavenge stays in camp: a new log entry is a new card
          event={campEvent(s)} res={s.res} limit={LIMIT} legIndex={s.legIndex} attempt={s.attempt} log={s.log}
          onContinue={(id) => play(choose(s, id))}
        />
      ) : (
        <EndingScreen
          ending={tower(ending(s))} res={s.res} limit={LIMIT} log={s.log} choiceNames={choiceNamesFor(s.seed)}
          onAgain={() => { save(null); setSaved(null); setS(startJourney()); }}
        />
      )}
      <SoundToggle />
    </>
  );
}

/** ending() lists every leg and choice (the trail log shows those); the card keeps the supplies line and the tower comparison. */
const tower = (e: ReturnType<typeof ending>) => ({ ...e, lines: e.lines.slice(-2) });

function Leg({ s, play, toTitle }: { s: JourneyState; play: (s: JourneyState) => void; toTitle: () => void }) {
  const cur = useMemo(() => currentLeg(s), [s]); // only mounted in phase "leg" (currentLeg throws on an ending state)
  return (
    <Suspense fallback={<p role="status" className="g-muted">Loading the Descent…</p>}>
      <LiveScreen
        key={`${s.legIndex}-${s.attempt}-${s.log.length}`}
        mission={cur.mission} legId={cur.legId} journeyMode
        onLegEnd={(r: LegResult) => play(completeLeg(s, r))}
        onExit={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); toTitle(); }}
      />
    </Suspense>
  );
}

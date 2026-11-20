// The Journey: runs the journey.ts state machine through title -> camp -> leg -> ... -> ending and saves it (spec: issue #107).
// The screens are props-only (see WIRING.md); this file is the only place that calls choose() / completeLeg() and touches localStorage.
import { lazy, Suspense, useEffect, useMemo, useState, type MouseEvent } from "react";
import { campEvent, choose, completeLeg, currentLeg, ending, LIMIT, startJourney, type JourneyState, type LegResult } from "../../echo/journey";
import { SettingsGear } from "../game/SettingsGear";
import { CampScreen } from "./CampScreen";
import { EndingScreen } from "./EndingScreen";
import { ghostData } from "./ghosts";
import { choiceNamesFor } from "./helpers";
import { TitleScreen } from "./TitleScreen";
import "./journey.css";
import "../characters/bubble.css";

// The leg screen is its own chunk. It is fetched as soon as the journey mounts, and once it is in, Leg renders it directly: going through
// Suspense on the camp -> leg switch showed a blank "Loading" frame for ~0.3 s between the two screens.
type LiveModule = typeof import("../cutaway/live/LiveScreen");
let liveModule: LiveModule | null = null;
const loadLive = () => import("../cutaway/live/LiveScreen").then((m) => (liveModule = m));
const LazyLive = lazy(() => loadLive().then((m) => ({ default: m.LiveScreen })));

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

/** A new seed per journey (UI layer): it decides which floods this run draws; the engine is deterministic given it. */
const freshSeed = () => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

export interface JourneyAppProps { onTowerDown: () => void; onStrata: () => void; onFreePlay: () => void }

export function JourneyApp({ onTowerDown, onStrata, onFreePlay }: JourneyAppProps) {
  const [saved, setSaved] = useState(load); // the save on disk, for "Continue the journey"
  const [s, setS] = useState<JourneyState | null>(null); // null = on the title screen
  const ghosts = useMemo(() => (s?.phase === "ending" ? ghostData(s.seed, s.log) : undefined), [s]); // the ending's counterfactual paths
  const play = (next: JourneyState) => { save(next); setSaved(next); setS(next); };
  useEffect(() => { void loadLive().catch(() => {}); }, []); // warm the leg chunk while the player is on the title or in camp

  if (!s) {
    return (
      <>
        <TitleScreen
          onBegin={() => play(startJourney(freshSeed()))}
          onContinue={saved ? () => setS(saved) : undefined}
          onTowerDown={onTowerDown} onStrata={onStrata} onFreePlay={onFreePlay}
        />
        <SettingsGear />
      </>
    );
  }
  if (s.phase === "leg") return <Leg s={s} play={play} remember={(next) => { save(next); setSaved(next); }} toTitle={() => setS(null)} />;
  // No Strata <Backdrop/> here: camp and ending paint their own opaque .j-camp-bg over the whole viewport, so the live Pixi city was never
  // visible, yet its WebGL init and 30 sim minutes of catch-up (~300 ms of long tasks) landed exactly on the fade in from black.
  return (
    <>
      {s.phase === "camp" ? (
        <CampScreen
          key={s.log.length} // Scavenge stays in camp: a new log entry is a new card
          event={campEvent(s)} res={s.res} limit={LIMIT} legIndex={s.legIndex} attempt={s.attempt} log={s.log}
          onContinue={(id) => play(choose(s, id))}
        />
      ) : (
        <EndingScreen
          ending={tower(ending(s))} res={s.res} limit={LIMIT} log={s.log} choiceNames={choiceNamesFor(s.seed)} ghosts={ghosts}
          onAgain={() => { save(null); setSaved(null); setS(startJourney(freshSeed())); }}
        />
      )}
      <SettingsGear />
    </>
  );
}

/** ending() lists every leg and choice (the trail log shows those); the card keeps the supplies line and the tower comparison. */
const tower = (e: ReturnType<typeof ending>) => ({ ...e, lines: e.lines.slice(-2) });

function Leg({ s, play, remember, toTitle }: { s: JourneyState; play: (s: JourneyState) => void; remember: (s: JourneyState) => void; toTitle: () => void }) {
  const cur = useMemo(() => currentLeg(s), [s]); // only mounted in phase "leg" (currentLeg throws on an ending state)
  const [LiveScreen] = useState(() => liveModule?.LiveScreen ?? LazyLive); // fixed per mount: a type change mid-leg would remount the run
  return (
    <Suspense fallback={<p role="status" className="g-muted">Loading the Descent…</p>}>
      <LiveScreen
        key={`${s.legIndex}-${s.attempt}-${s.log.length}`}
        mission={cur.mission} legId={cur.legId} attempt={0} seed={s.seed} journeyMode pool={s.res.beacons} // attempt 0: every retry of a leg faces the same flood (see currentLeg)
        onLegResult={(r: LegResult) => remember(completeLeg(s, r))} // the debrief is up: save the finished leg now, so a reload resumes at the camp it leads to
        onLegEnd={(r: LegResult, o?: { continueAnyway?: boolean }) => play(completeLeg(s, r, { advance: o?.continueAnyway }))}
        onExit={(e: MouseEvent<HTMLAnchorElement>) => { e.preventDefault(); toTitle(); }}
      />
    </Suspense>
  );
}

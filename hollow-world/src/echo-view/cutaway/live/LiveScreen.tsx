import { type MouseEventHandler, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DESCENT_LEVELS } from "../../../echo/descent-levels";
import { LEGS } from "../../../echo/journey-events";
import type { LegId, LegResult } from "../../../echo/journey";
import type { LogEvent, Mission, Observation, Pod } from "../../../echo/types";
import { ambience, play } from "../../game/audio";
import { THEME } from "../../theme";
import { SettingsGear } from "../../game/SettingsGear";
import { applyLayout } from "../layouts";
import { along, type Frame, podPose, tracks } from "../run";
import { plainLog, plainText, podName } from "./names";
import { createScene, lamp } from "../scene";
import { type Tween, tweenFor } from "../motion";
import "../style.css";
import { hitSector, RAIL_HEIGHT, RAIL_WIDTH } from "./hit";
import { mountEffects } from "./mount-effects";
import * as fx from "./fx";
import * as sfx from "./sfx";
import trim from "./art/shaft-trim.png";
import { FREE_PLAY_SEED, heldAtFlood, useLive } from "./useLive";
import { LiveDebrief } from "./LiveDebrief";
import { analyzeRun } from "./cause";
import { previewReach, sectorGraph } from "./reach";
import { Blackout } from "./Blackout";
import { poolOf } from "./pools";
import { warnChain } from "./track-light";
import { LiveIntro } from "./LiveIntro";
import { LEG_LEVELS, LEVEL_NAMES } from "../../journey/helpers";
import "../../characters/bubble.css";
import { LEVEL_HINTS, nextHint } from "./hints";
import { Dialogue } from "../../characters/Dialogue";
import "./live.css";
import "./intro-debrief.css";

const alertKinds = new Set(["blind", "beacon-placed", "credential-reject", "seal", "seal-heard", "hold", "reroute"]);
const logLocation = (id: string) => plainText(id).replace(/^./, (c) => c.toUpperCase());

function sceneFrame(obs: Observation, rejected = new Map<string, LogEvent>()): Frame {
  return {
    obs,
    rejected,
    events: [],
    arrived: new Set(obs.pods.filter((p) => p.status === "arrived").map((p) => p.id)),
  };
}
function atMidpoint(id: string) {
  const [x, y] = along(tracks.get(id)!, 0.5);
  return { left: x * 100 + "%", top: y * 100 + "%" };
}
// The hint a leg's intro card shows: Descent I the click-a-rail rule, II the flood, III the priority queue.
const INTRO_HINTS = [LEVEL_HINTS[1], LEVEL_HINTS[4], LEVEL_HINTS[3]];
const HINT_MS = 6000;
function starsOf(goals: { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number }[], pods: Pick<Pod, "id" | "arriveTick">[]): 0 | 1 | 2 | 3 {
  const by = (id: string, t = Infinity) => (pods.find((p) => p.id === id)?.arriveTick ?? Infinity) <= t;
  return goals.reduce<0 | 1 | 2 | 3>((n, g) => (by("MED-1", g.maraBy) && (g.medicineBy === undefined || by("SUP-3", g.medicineBy)) ? g.stars : n), 0);
}
const pillPos = (p: { x: number; y: number }) => ({ left: Math.min(.79, p.x) * 100 + "%", top: Math.min(.92, p.y) * 100 + "%" });
function arrival(tick: number | null) {
  return tick === null ? "En route" : "Minute " + tick;
}

export interface LiveScreenProps {
  onExit?: MouseEventHandler<HTMLAnchorElement>;
  /** Journey leg mode: the mission to play (already budget-capped), reported through onLegEnd. Omit all of these for free play. */
  mission?: Mission;
  legId?: LegId;
  journeyMode?: boolean;
  pool?: number; // journey mode: the beacons in the pack when the leg starts (the leg takes up to its own cap from it)
  attempt?: number; // journey mode: the leg's failed tries so far, and the journey's seed: together they picked the flood candidate when the mission was built
  seed?: number;
  onLegEnd?: (result: LegResult, opts?: { continueAnyway?: boolean }) => void;
  /** Journey mode: the run just ended and the debrief is showing, before the player confirms. The journey saves the result here so a reload from the debrief resumes at the next camp, not the start of this leg. */
  onLegResult?: (result: LegResult) => void;
}

export function LiveScreen({ onExit, mission: legMission, legId, journeyMode = false, pool, attempt: journeyAttempt = 0, seed: journeySeed, onLegEnd, onLegResult }: LiveScreenProps) {
  applyLayout(legMission?.id ?? "descent-live"); // the shared track map must match this level before anything reads it
  const levelIndex = Math.max(0, DESCENT_LEVELS.findIndex((l) => l.id === legMission?.id));
  const level = DESCENT_LEVELS[levelIndex];
  const spec = useMemo(() => legMission ? { build: () => structuredClone(legMission), solution: () => level.solutionFor({ seed: journeySeed, attempt: journeyAttempt }) } : undefined, [legMission, level, journeyAttempt, journeySeed]);
  const live = useLive(spec);
  const { mission, observation: obs, previous, playing, queued, remaining, solution, feedback } = live;
  const runAttempt = legMission ? journeyAttempt : live.attempt;
  const goals = level.goalsFor({ seed: legMission ? journeySeed : FREE_PLAY_SEED, attempt: runAttempt }); // the flood candidate has its own star table
  const poolMore = journeyMode && pool !== undefined && pool > (mission.beaconBudget ?? 0); // the pack holds more than this leg may use
  const [introDone, setIntroDone] = useState(false);
  const [maraHost, setMaraHost] = useState<HTMLElement | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const seenHints = useRef(new Set<number>([1])); // level 1's hint is on the intro card
  const finished = useRef(false);
  const spaceDown = useRef(false); // a Space press that already started the run: one press does one thing
  const starterId = mission.world.sectors.find((s) => s.beacon === false)?.id ?? "link0";
  const [attempt, setAttempt] = useState(0);
  // The hover pill follows the pointer by direct style writes: a React render per pointermove re-rendered the whole screen.
  const cursor = useRef({ x: 0, y: 0 });
  const pill = useRef<HTMLSpanElement>(null);
  const [selected, setSelected] = useState(starterId);
  const [hover, setHover] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState(false); // the selection preview follows the arrow keys; a mouse user sees only what they hover
  const ground = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const tween = useRef<Tween | null>(null); // the clock of the tick on screen
  const lightCanvas = useRef<HTMLCanvasElement>(null);
  const fxCanvas = useRef<HTMLCanvasElement>(null);
  const effects = useRef<ReturnType<typeof mountEffects> | null>(null);
  const rejected = useRef(new Map<string, LogEvent>());
  const mara = obs.pods.find((p) => p.id === "MED-1")!;
  const medicine = obs.pods.find((p) => p.id === "SUP-3")!;
  const primary = obs.sectors.find((s) => s.id === selected)!;
  // The flood comes only from the observation: a telegraph (sector + minute) inside the reveal window, else a sealed sector, else just the risk line.
  const telegraph = obs.floodWarnings?.find((w) => w.sectorId !== undefined);
  const risk = obs.floodWarnings?.[0]?.risk ?? "flood risk";
  const sealedNow = obs.sectors.filter((s) => s.sealed);
  const flood = (telegraph ? obs.sectors.find((s) => s.id === telegraph.sectorId) : sealedNow[sealedNow.length - 1]) ?? null;
  const untilFlood = telegraph ? telegraph.at! - obs.tick : 0;
  const warning = !!telegraph;
  const sealed = !warning && !!flood?.sealed;
  const building = new Map((obs.building ?? []).map((b) => [b.sectorId, b.readyAt]));
  // A beacon is live when its entry leaves observation.building (sector.beacon flips at readyAt + 1), so the countdown runs to readyAt inclusive.
  const liveIn = (id: string) => Math.max(1, building.get(id)! - obs.tick + 1);
  const sectionOrder = [...tracks.keys()];
  const activeSector = tracks.get(mara.path[mara.at]);
  // Beacon range, from the engine's own beacon graph: who hears whom. Every sector with a beacon, live or on its way, counts for the links.
  const graph = useMemo(() => sectorGraph(mission.world.sectors), [mission]);
  const live_ = obs.sectors.filter((s) => s.beacon !== false).map((s) => s.id);
  const beaconed = new Set([...live_, ...queued, ...building.keys()]);
  const beaconKey = [...beaconed].sort().join(",");
  const over = live.ended;
  // The track-light layer's inputs, rebuilt only when what they describe changes.
  const lit = useMemo(() => new Set(live_), [live_.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = useMemo(() => new Map<string, number | null>([...[...queued].map((id): [string, number | null] => [id, null]), ...[...building.keys()].map((id): [string, number | null] => [id, liveIn(id)])]),
    [beaconKey, obs.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Warn here: once the flood is announced, the sections its news must cross to reach Mara's fork (track-light.ts, pinned against the engine).
  const newsChain = useMemo(() => flood ? warnChain(mission.world.sectors, flood.id, mara.path, mara.at) : null, [flood?.id, mission, mara.path.join(","), mara.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const chain = newsChain; // shown from the announcement until Mara hears (or the flood is behind her): a beacon placed after the seal still relays
  const floodLead = mission.floodReveal?.lead ?? 10;
  const floodMark = useMemo(() => flood && (warning || sealed) ? { id: flood.id, sealed, until: untilFlood, lead: floodLead } : null, [flood?.id, warning, sealed, untilFlood, floodLead]); // eslint-disable-line react-hooks/exhaustive-deps
  const held = obs.pods.filter((p) => heldAtFlood(p, obs));
  const holdForFlood = !!live.floodHold && !playing && !over; // the run paused itself at the flood announcement
  const waiting = !over && !solution && (live.planning || holdForFlood); // planning or held: Run is the next move
  const placementsOpen = !over && !solution && remaining > 0;
  const canPlace = (id: string) =>
    placementsOpen && !queued.has(id) && !building.has(id) && obs.sectors.find((s) => s.id === id)?.beacon === false;
  const target = hover ?? (keyboard ? selected : null);
  const previewId = introDone && target && canPlace(target) ? target : null;
  const focusId = introDone && keyboard && !hover && !previewId && !over && !solution ? selected : null;
  const joins = (id: string) => previewReach(graph, beaconed, id).linked.length;
  const pressure = warning ? "Flood imminent" : sealed ? "Shaft flooded" : "Monitoring the shafts";
  const events = live.events.filter((e) =>
    alertKinds.has(e.kind) &&
    (e.kind !== "credential-reject" ||
      live.events.find((first) => first.kind === e.kind && first.podId === e.podId) === e)
  ).slice(-3);
  const stars = starsOf(goals, obs.pods);
  const won = stars > 0 && mara.arriveTick !== null;
  const failed = over && !solution && stars === 0;
  const gaps = failed ? analyzeRun(mission, live.commands, stars).verdict.marks.filter((id) => tracks.has(id)) : [];

  useLayoutEffect(() => {
    const world = createScene(canvas.current!, ground.current!, trim, { blackout: true });
    const overlay = mountEffects(lightCanvas.current!, fxCanvas.current!);
    effects.current = overlay;
    scene.current = world;
    return () => {
      world.dispose();
      overlay.dispose();
      effects.current = null;
      scene.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    if (!obs.tick) rejected.current.clear();
    for (const event of obs.log) {
      if (event.kind === "credential-reject" && event.podId && !rejected.current.has(event.podId)) {
        rejected.current.set(event.podId, event);
      }
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Only the clock steps, so a fresh tick always animates, even the one that triggers a flood hold or ends the run (it used to snap).
    const smooth = !reduced && previous.tick + 1 === obs.tick;
    const trapped = obs.pods.filter((p) => heldAtFlood(p, obs));
    const hiddenChips = trapped.length > 1 ? new Set(trapped.map((p) => p.id)) : undefined;
    // Pause/resume, a flood hold, a speed change or a placement re-shows the same tick: keep its clock so pods never replay it from the start.
    const { start, duration } = (tween.current = tweenFor(tween.current, obs.tick, smooth, live.stepMs, performance.now()));
    scene.current?.show(
      sceneFrame(obs, rejected.current),
      sceneFrame(previous),
      warning ? 4 : activeSector?.level ?? 1,
      duration,
      hiddenChips,
      start,
    );
  }, [obs, previous, playing, activeSector, warning, live.stepMs]);

  // The blackout's pools of light: every live beacon, the ones on their way a little fainter, and the hover preview fainter still.
  const previewKey = !over && !solution ? previewId : null;
  useEffect(() => {
    const pools = [
      ...live_.filter((id) => tracks.has(id)).map((id) => ({ pool: poolOf(tracks.get(id)!), strength: 1 })),
      ...[...queued, ...building.keys()].filter((id) => tracks.has(id)).map((id) => ({ pool: poolOf(tracks.get(id)!), strength: .72 })),
      ...(previewKey && tracks.has(previewKey) ? [{ pool: poolOf(tracks.get(previewKey)!), strength: .45 }] : []),
    ];
    effects.current?.light(pools);
  }, [beaconKey, live_.join(","), previewKey, mission]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!introDone || over) return;
    const h = nextHint(obs, seenHints.current);
    if (!h) return;
    seenHints.current.add(h.level);
    setHintText(h.text);
  }, [obs, introDone, over]);
  useEffect(() => {
    if (!hintText) return;
    const t = setTimeout(() => setHintText(null), HINT_MS);
    return () => clearTimeout(t);
  }, [hintText]);
  useEffect(() => () => applyLayout("descent-live"), []); // the other cutaway screens expect level 1's tracks
  useEffect(() => {
    const title = document.title;
    document.title = "Play the Descent · Echo";
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(sfx.unlockOnFirstGesture, []);
  useEffect(() => { ambience(playing && !over); return () => ambience(false); }, [playing, over]); // quiet cave bed while the leg runs
  useEffect(() => {
    if (warning && !previous.floodWarnings?.some((w) => w.sectorId !== undefined)) play("down");
    if (sealedNow.length > previous.sectors.filter((s) => s.sealed).length) {
      sfx.playFloodSplash();
      fx.shake(.5);
    }
    if (obs.pulses.some((p) => p.kind === "announce" && p.age === 0)) sfx.playHopBlip();
    for (const event of obs.log) {
      if (event.tick !== obs.tick - 1) continue;
      if (event.kind === "beacon-placed" && solution) sfx.playPlaceThunk();
      if (
        event.kind === "credential-reject" &&
        live.events.find((first) => first.kind === event.kind && first.podId === event.podId)?.tick === event.tick
      ) {
        sfx.playRejectBuzz();
        fx.shake(.35);
      }
      if (event.kind === "arrive" && (event.podId === mara.id || event.podId === medicine.id)) {
        const pod = event.podId === mara.id ? mara : medicine;
        const [x, y] = podPose(pod);
        sfx.playArrivalChime();
        fx.ring(x * RAIL_WIDTH, y * RAIL_HEIGHT - 32, THEME.good);
        fx.numberPop(x * RAIL_WIDTH, y * RAIL_HEIGHT - 42, "+1", THEME.good);
      }
    }
    if (!over) return;
    if (solution) return; // a replay earns no stars, so no star chimes
    const tones = Array.from({ length: stars }, (_, i) => setTimeout(() => sfx.playStarDing(i), i * 180));
    return () => tones.forEach(clearTimeout);
  }, [obs, previous, warning, sealedNow.length, over, stars, solution, live.events, mara, medicine]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (!introDone) { // the intro card owns the keyboard until Start: Space is its Start (and only that)
        if (e.key === " ") { e.preventDefault(); spaceDown.current = true; start(); }
        return;
      }
      if (spaceDown.current && e.key === " ") { e.preventDefault(); return; } // the press that started the run must not also pause it
      if (e.key.toLowerCase() === "r" && over) {
        e.preventDefault();
        if (journeyMode) { if (!won) endLeg(); } else restart(false);
      } else if ((e.key === " " && !(e.target as HTMLElement).closest?.("button, a")) || e.key.toLowerCase() === "p") {
        e.preventDefault();
        toggleRun();
      }
    }
    const keyup = (e: KeyboardEvent) => { if (e.key === " ") spaceDown.current = false; };
    window.addEventListener("keydown", keys);
    window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keys); window.removeEventListener("keyup", keyup); };
  });

  function tryPlace(id: string) {
    if (!introDone) return;
    setSelected(id);
    setAttempt((n) => n + 1);
    const result = live.place(id);
    if (result.ok) {
      const [x, y] = lamp(tracks.get(id)!);
      sfx.playPlaceThunk();
      fx.spawnParticles(x, y, 8, THEME.amberHi);
      fx.ring(x, y, THEME.amberHi);
      fx.shake(.15);
    } else {
      sfx.playRejectBuzz();
      fx.shake(.08);
    }
  }
  function toggleRun() {
    if (introDone) live.togglePause();
  }
  function start() { // the intro's Start: dismiss into planning, the clock still at t+0 (Run or Space starts it)
    setIntroDone(true);
  }
  /** Journey mode: hand the finished leg to the journey (a win moves on; a loss applies its cost and goes to the retry camp). Once only. */
  function endLeg(continueAnyway = false) {
    if (finished.current || !onLegEnd || !legId || solution) return; // a solution replay never records a leg
    finished.current = true;
    onLegEnd(legResult(), continueAnyway ? { continueAnyway } : undefined);
  }
  function legResult(): LegResult {
    return { legId: legId!, stars, maraAt: mara.arriveTick, medicineAt: medicine.arriveTick, beaconsPlaced: live.commands.length, ticks: obs.tick };
  }
  useEffect(() => { if (over) window.scrollTo(0, 0); }, [over]); // the debrief autofocuses its button, which scrolled the page down and cropped the map: keep the map in view
  useEffect(() => { if (over && journeyMode && legId && !solution && onLegResult) onLegResult(legResult()); }, [over]); // eslint-disable-line react-hooks/exhaustive-deps -- once per run end
  function restart(watch: boolean) {
    setIntroDone(true);
    seenHints.current = new Set([1]);
    setHintText(null);
    fx.reset();
    setAttempt(0);
    if (watch) live.watchSolution();
    else live.retry();
    setSelected(starterId);
    setHover(null);
  }
  function railPoint(event: { clientX: number; clientY: number; currentTarget: HTMLElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  return (
    <div className="descent descent-live">
      <SettingsGear />
      <header inert={!introDone}>
        <div>
          <a className="brand" href="?screen=title" onClick={onExit} aria-label="Back to the Echo title">← Back</a>
          <h1>{journeyMode && legId ? LEGS.find((l) => l.id === legId)?.story.title : "The Descent"}</h1>
        </div>
        <div className="live-status">
          <div className="live-pack" aria-live="polite" aria-atomic="true">
            <span>
              <strong>{remaining}</strong> / {mission.beaconBudget} beacons left{poolMore && <small className="live-pool"> · of your {pool}</small>}
            </span>
            <div className="live-pips" aria-hidden="true">
              {Array.from(
                { length: mission.beaconBudget ?? 0 },
                (_, index) => (
                  <i
                    key={index}
                    className={index < remaining
                      ? "charged"
                      : index === remaining && remaining !== mission.beaconBudget
                      ? "spent"
                      : ""}
                  />
                ),
              )}
            </div>
          </div>
          <div className="live-time">
            <time id="live-clock">t+{String(obs.tick).padStart(2, "0")}</time>
            <span>
              {over
                ? "Run ended"
                : live.planning
                ? "Planning"
                : holdForFlood
                ? "Held for the flood"
                : !playing
                ? "Paused"
                : live.slow
                ? "Slow motion"
                : solution
                ? "Solution replay"
                : "Run active"}
            </span>
          </div>
        </div>
      </header>
      <main inert={!introDone}>
        <div className="world-scroll">
          <div
            className={"world live-world" + (hover && canPlace(hover) ? " placeable" : "")}
            tabIndex={0}
            role="region"
            aria-label="Relay track map"
            aria-describedby="live-rail-help live-selection"
            onPointerMove={(event) => {
              if (!introDone || over || solution) return;
              if (keyboard) setKeyboard(false);
              const point = railPoint(event);
              cursor.current = point;
              if (pill.current) Object.assign(pill.current.style, pillPos(point));
              setHover(hitSector(point.x, point.y, tracks)); // same id: React bails out, no render
            }}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setKeyboard(false)}
            onClick={(event) => {
              const { x, y } = railPoint(event);
              const id = hitSector(x, y, tracks);
              if (id && !over && !solution) tryPlace(id);
            }}
            onKeyDown={(event) => {
              if (!introDone || over || solution || (event.repeat && event.key === "Enter")) return;
              if (event.key.startsWith("Arrow") || event.key === "Enter") setKeyboard(true);
              const move = event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
              if (move) {
                event.preventDefault();
                setSelected(
                  sectionOrder[(sectionOrder.indexOf(selected) + move + sectionOrder.length) % sectionOrder.length],
                );
              } else if (event.key === "Enter" && !over && !solution) {
                event.preventDefault();
                tryPlace(selected);
              }
            }}
          >
            <canvas ref={lightCanvas} className="live-overlay live-dark" aria-hidden="true" />
            <canvas ref={ground} aria-hidden="true" />
            <div className="live-markers" aria-hidden="true">
              {!over && (
                <Blackout graph={graph} lit={lit} pending={pending} flood={floodMark} chain={chain}
                  pulses={obs.pulses} tick={obs.tick} stepMs={live.stepMs}
                  preview={solution ? null : previewId} focus={focusId} />
              )}
              {failed && gaps.length > 0 && (
                <svg className="live-range" viewBox="0 0 1 1" preserveAspectRatio="none">
                  {gaps.map((id) => { const t = tracks.get(id)!; return <line key={id} className="gap" x1={t.a[0]} y1={t.a[1]} x2={t.b[0]} y2={t.b[1]} />; })}
                </svg>
              )}
              {gaps.map((id) => <span key={"g" + id} className="live-gap-mark" style={atMidpoint(id)}>!</span>)}
            </div>
            <canvas ref={canvas} role="img" aria-label="Five tunnel levels with moving pods and trackside beacons" />
            <canvas ref={fxCanvas} className="live-overlay" aria-hidden="true" />
            {waiting && introDone && <span className="live-ready-chip" role="status">{holdForFlood ? "Held for the flood · Run when ready" : "Place beacons · Run when ready"}</span>}
            {hover && !over && introDone && (
              <span
                ref={pill}
                className={"live-cursor " + (canPlace(hover) ? "valid" : "invalid")}
                style={pillPos(cursor.current)}
              >
                {canPlace(hover)
                  ? (joins(hover) ? "Lights here · joins your light" : "Lights here · isolated, can't pass news")
                  : queued.has(hover)
                  ? "Lighting up"
                  : building.has(hover)
                  ? "Lit in " + liveIn(hover)
                  : remaining === 0
                  ? "No beacons left"
                  : "Lit"}
              </span>
            )}
            {held.length > 1 && (
              <details
                className="live-hold-group"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <summary>{held.length} pods held at the flood</summary>
                <ul>{held.map((p) => <li key={p.id}>{podName(p)}</li>)}</ul>
              </details>
            )}
            {hintText && !over && <p className="live-hint-caption" role="status">{hintText}</p>}
            {/* characters: Director + Mara dialogue (src/echo-view/characters) */}
            <Dialogue obs={obs} previous={previous} ended={over} stars={stars} coach={mission.id === "descent-live"} placed={live.commands.length} maraHost={maraHost} />
          </div>
        </div>
        <aside aria-label="Relay controls and goals">
          {over
            ? (
              journeyMode
                ? won
                  ? <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} onNext={() => endLeg()} nextLabel="Continue the journey" />
                  : <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} onRetry={() => endLeg()} retryLabel="Retry leg" failed onContinue={() => endLeg(true)}
                      note={`Retrying costs ${obs.tick + 15} minutes on the clock, 1 dose${live.commands.length ? `, and the ${live.commands.length} beacon${live.commands.length === 1 ? "" : "s"} you placed` : ""}.`} />
                : <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} replay={solution} onRetry={() => restart(false)} retryLabel={solution ? "Play yourself" : undefined} onWatchSolution={solution ? undefined : () => restart(true)} />
            )
            : (
              <>
                <div className="eyebrow live-eyebrow">Relay control{solution ? " · solution replay" : ""}</div>
                <h2>Blackout</h2>
                <p className="live-sr" id="live-rail-help">Click a section of track, or use the arrow keys and Enter, to place a beacon.</p>
                <div className={"live-alert" + (sealed ? " danger" : warning ? " warning" : "")}>
                  <small>{pressure}</small>
                  <strong>
                    {warning && flood ? logLocation(flood.id) + " floods in " + Math.max(0, untilFlood)
                      : sealed && flood ? "Flooded · " + logLocation(flood.id)
                      : risk.charAt(0).toUpperCase() + risk.slice(1)}
                  </strong>
                </div>
                <div className="live-placement">
                  <p id="live-selection" aria-live="polite">
                    <strong>{logLocation(hover ?? selected)}</strong>
                    <span>
                      {queued.has(hover ?? selected)
                        ? "Lighting up"
                        : building.has(hover ?? selected)
                        ? "Lit in " + liveIn(hover ?? selected)
                        : (obs.sectors.find((s) => s.id === (hover ?? selected)) ?? primary).beacon
                        ? "Lit"
                        : "Dark"}
                    </span>
                  </p>
                  <button disabled={!introDone || !canPlace(hover ?? selected)} onClick={() => tryPlace(hover ?? selected)}>
                    Place beacon <kbd>Enter</kbd>
                  </button>
                  <p className="live-feedback" role="status">{feedback && <span key={attempt}>{feedback}</span>}</p>
                </div>
                <h3 className="live-goals-title">Clinic deadlines</h3>
                <ol className="live-goals">
                  {goals.map((goal) => {
                    const held = stars >= goal.stars;
                    const missed = !held && ((mara.arriveTick ?? obs.tick - 1) > goal.maraBy ||
                      (goal.medicineBy !== undefined && (medicine.arriveTick ?? obs.tick - 1) > goal.medicineBy));
                    return (
                      <li key={goal.stars} className={held ? "met" : missed ? "missed" : ""}>
                        <span aria-label={goal.stars + " stars"}>{"★".repeat(goal.stars)}</span>
                        <span>Mara ≤ {goal.maraBy}{goal.medicineBy ? " · Medicine ≤ " + goal.medicineBy : ""}</span>
                        {(held || missed) && <span>{held ? "Met" : "Missed"}</span>}
                      </li>
                    );
                  })}
                </ol>
                <dl className="live-arrivals">
                  <div>
                    <dt>Nurse Mara</dt>
                    <dd>{arrival(mara.arriveTick)}</dd>
                  </div>
                  <div>
                    <dt>Medicine</dt>
                    <dd>{arrival(medicine.arriveTick)}</dd>
                  </div>
                </dl>
              </>
            )}
          <ol id="events" aria-label="Latest system events">
            {events.map((e) => (
              <li key={[e.tick, e.kind, e.podId, e.sectorId].join("/")}>
                <time>t+{e.tick}</time>
                <span>{plainLog(e.text)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </main>
      <footer inert={!introDone}>
        <nav aria-label="Descent controls">
          <button className={"live-primary" + (waiting ? " ready" : "")} onClick={toggleRun} disabled={over}>
            {playing ? "Ⅱ Pause" : live.planning ? "▶ Run" : "▶ Resume"} <kbd>Space</kbd>
          </button>
          <div className="switch" role="group" aria-label="Run speed">
            {([1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                aria-pressed={live.speed === speed}
                onClick={() => live.setSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
          {!journeyMode && <button onClick={() => restart(false)}>Restart</button>}
          {!journeyMode && !over && (
            <button onClick={() => restart(!solution)}>{solution ? "Play yourself" : "Watch the solution"}</button>
          )}
        </nav>
        <p className="fine">Simulated run · deterministic engine</p>
        <div className="live-mara-slot" ref={setMaraHost} /> {/* Mara's speech strip: beside the controls, never over the map */}
      </footer>
      {!introDone && <LiveIntro mission={mission} pool={poolMore ? pool : undefined} from={journeyMode && levelIndex > 0 ? LEVEL_NAMES[LEG_LEVELS[levelIndex - 1].at(-1)! - 1] : undefined} goal={`Nurse Mara reaches the deep clinic by minute ${goals[0].maraBy}.`} hint={INTRO_HINTS[levelIndex]} onStart={start} />}
    </div>
  );
}

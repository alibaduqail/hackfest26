import { type MouseEventHandler, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DESCENT_LEVELS } from "../../../echo/descent-levels";
import { LEGS } from "../../../echo/journey-events";
import type { LegId, LegResult } from "../../../echo/journey";
import type { LogEvent, Mission, Observation, Pod } from "../../../echo/types";
import { play } from "../../game/audio";
import { THEME } from "../../theme";
import { SettingsGear } from "../../game/SettingsGear";
import { applyLayout } from "../layouts";
import { along, type Frame, neighbors, podPose, tracks } from "../run";
import { plainText } from "./names";
import { createScene, lamp } from "../scene";
import "../style.css";
import { hitSector, RAIL_HEIGHT, RAIL_WIDTH } from "./hit";
import { mountEffects } from "./mount-effects";
import * as fx from "./fx";
import * as sfx from "./sfx";
import trim from "./art/shaft-trim.png";
import { FREE_PLAY_SEED, heldAtFlood, useLive } from "./useLive";
import { LiveDebrief } from "./LiveDebrief";
import { LiveIntro } from "./LiveIntro";
import { LEVEL_HINTS, nextHint } from "./hints";
import { LiveRail } from "./LiveRail";
import { RelayBar, RelayButton } from "../../relay/Relay";
import "../../relay/relay.css";
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
const midpoint = (id: string) => { const [x, y] = along(tracks.get(id)!, 0.5); return { x, y }; };

export interface LiveScreenProps {
  onExit?: MouseEventHandler<HTMLAnchorElement>;
  /** Journey leg mode: the mission to play (already budget-capped), reported through onLegEnd. Omit all of these for free play. */
  mission?: Mission;
  legId?: LegId;
  journeyMode?: boolean;
  attempt?: number; // journey mode: the leg's failed tries so far, and the journey's seed: together they picked the flood candidate when the mission was built
  seed?: number;
  onLegEnd?: (result: LegResult, opts?: { continueAnyway?: boolean }) => void;
}

export function LiveScreen({ onExit, mission: legMission, legId, journeyMode = false, attempt: journeyAttempt = 0, seed: journeySeed, onLegEnd }: LiveScreenProps) {
  applyLayout(legMission?.id ?? "descent-live"); // the shared track map must match this level before anything reads it
  const levelIndex = Math.max(0, DESCENT_LEVELS.findIndex((l) => l.id === legMission?.id));
  const level = DESCENT_LEVELS[levelIndex];
  const spec = useMemo(() => legMission ? { build: () => structuredClone(legMission), solution: () => level.solutionFor({ seed: journeySeed, attempt: journeyAttempt }) } : undefined, [legMission, level, journeyAttempt, journeySeed]);
  const live = useLive(spec);
  const { mission, observation: obs, previous, playing, queued, remaining, solution, feedback } = live;
  const runAttempt = legMission ? journeyAttempt : live.attempt;
  const goals = level.goalsFor({ seed: legMission ? journeySeed : FREE_PLAY_SEED, attempt: runAttempt }); // the flood candidate has its own star table
  const [introDone, setIntroDone] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const seenHints = useRef(new Set<number>([1])); // level 1's hint is on the intro card
  const finished = useRef(false);
  const starterId = mission.world.sectors.find((s) => s.beacon === false)?.id ?? "link0";
  const [attempt, setAttempt] = useState(0);
  // The hover pill follows the pointer by direct style writes: a React render per pointermove re-rendered the whole screen.
  const cursor = useRef({ x: 0, y: 0 });
  const pill = useRef<HTMLSpanElement>(null);
  const [selected, setSelected] = useState(starterId);
  const [hover, setHover] = useState<string | null>(null);
  const [kbd, setKbd] = useState(false); // the map has keyboard selection: the on-art label follows the selected rail instead of the pointer
  const [firstPlacement, setFirstPlacement] = useState(false);
  const ground = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
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
  // Mara's planned route (from the observation's pod path) and, while hovering, the beacons a new one would link to.
  const route = new Set(mara.path);
  const hoverTrack = hover ? tracks.get(hover) : undefined;
  const linked = new Set(hoverTrack ? [...tracks].filter(([id, t]) => id !== hover && neighbors(hoverTrack, t)).map(([id]) => id) : []);
  const activeSector = tracks.get(mara.path[mara.at]);
  const over = live.ended;
  const warnSections = flood && warning
    ? [flood.id, obs.sectors.find((s) => s.routeId === flood.routeId && s.index === flood.index - 1)?.id]
    : [];
  const held = obs.pods.filter((p) => heldAtFlood(p, obs));
  const placementsOpen = !over && !solution && remaining > 0;
  const canPlace = (id: string) =>
    placementsOpen && !queued.has(id) && !building.has(id) && obs.sectors.find((s) => s.id === id)?.beacon === false;
  const events = live.events.filter((e) =>
    alertKinds.has(e.kind) &&
    (e.kind !== "credential-reject" ||
      live.events.find((first) => first.kind === e.kind && first.podId === e.podId) === e)
  ).slice(-3);
  const stars = starsOf(goals, obs.pods);
  const won = stars > 0 && mara.arriveTick !== null;

  useLayoutEffect(() => {
    const world = createScene(canvas.current!, ground.current!, trim);
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
    const smooth = playing && !reduced && previous.tick + 1 === obs.tick;
    const trapped = obs.pods.filter((p) => heldAtFlood(p, obs));
    const hiddenChips = trapped.length > 1 ? new Set(trapped.map((p) => p.id)) : undefined;
    effects.current?.sync(obs, previous, smooth ? live.stepMs : 0);
    scene.current?.show(
      sceneFrame(obs, rejected.current),
      sceneFrame(previous),
      warning ? 4 : activeSector?.level ?? 1,
      smooth ? live.stepMs : 0,
      hiddenChips,
    );
  }, [obs, previous, playing, activeSector, warning, live.stepMs]);

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
      if (!introDone) return; // the intro card owns the keyboard until Start
      if (e.key.toLowerCase() === "r" && over) {
        e.preventDefault();
        if (journeyMode) { if (!won) endLeg(); } else restart(false);
      } else if ((e.key === " " && !(e.target as HTMLElement).closest?.("button, a")) || e.key.toLowerCase() === "p") {
        e.preventDefault();
        toggleRun();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  function tryPlace(id: string) {
    if (!introDone) return;
    setSelected(id);
    setAttempt((n) => n + 1);
    const result = live.place(id);
    if (result.ok) {
      setFirstPlacement(true);
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
  function start() { // the intro's Start: dismiss and run in one click
    setIntroDone(true);
    live.start();
  }
  /** Journey mode: hand the finished leg to the journey (a win moves on; a loss applies its cost and goes to the retry camp). Once only. */
  function endLeg(continueAnyway = false) {
    if (finished.current || !onLegEnd || !legId || solution) return; // a solution replay never records a leg
    finished.current = true;
    onLegEnd({ legId, stars, maraAt: mara.arriveTick, medicineAt: medicine.arriveTick, beaconsPlaced: live.commands.length, ticks: obs.tick }, continueAnyway ? { continueAnyway } : undefined);
  }
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
    setKbd(false);
    setFirstPlacement(false);
  }
  function railPoint(event: { clientX: number; clientY: number; currentTarget: HTMLElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  const legTitle = journeyMode && legId ? LEGS.find((l) => l.id === legId)?.story.title ?? "The Descent" : "The Descent";
  const [kicker, title] = legTitle.includes(" · ") ? legTitle.split(" · ") : ["Free play", legTitle];
  const runState = over ? "Run ended" : !playing ? "Paused" : live.slow ? "Slow motion" : solution ? "Solution replay" : "Running";
  const floodLine = warning && flood
    ? { tone: "warn" as const, text: logLocation(flood.id) + " floods in " + Math.max(0, untilFlood) }
    : sealed && flood
    ? { tone: "sealed" as const, text: "Flooded · " + plainText(flood.id) }
    : { tone: "" as const, text: risk.charAt(0).toUpperCase() + risk.slice(1) };
  const focusId = hover ?? (kbd ? selected : null); // the place the on-art label names
  const stateOf = (id: string) => queued.has(id) ? "Placement queued" : building.has(id) ? "Building · live in " + liveIn(id)
    : (obs.sectors.find((s) => s.id === id) ?? primary).beacon ? "Beacon online" : remaining === 0 ? "No beacons left" : "No beacon";
  const runItem = { key: "run", label: playing ? "Pause" : obs.tick === 0 ? "Start run" : "Resume", tone: "primary" as const, onSelect: toggleRun, disabled: over || !introDone, title: "Space" };

  return (
    <div className={"descent descent-live" + (over ? " is-over" : "")}>
      <SettingsGear />
      <LiveRail
        kicker={kicker} title={title} onExit={onExit} tick={obs.tick} runState={runState} flood={floodLine}
        budget={mission.beaconBudget ?? 0} remaining={remaining}
        goals={goals.map((goal) => {
          const met = stars >= goal.stars;
          const missed = !met && ((mara.arriveTick ?? obs.tick - 1) > goal.maraBy ||
            (goal.medicineBy !== undefined && (medicine.arriveTick ?? obs.tick - 1) > goal.medicineBy));
          return { ...goal, state: met ? "met" : missed ? "missed" : "" };
        })}
        mara={mara.arriveTick} medicine={medicine.arriveTick}
        feedback={{ key: attempt, text: feedback }}
        selection={logLocation(hover ?? selected) + " · " + stateOf(hover ?? selected)}
        events={events.map((e) => ({ key: [e.tick, e.kind, e.podId, e.sectorId].join("/"), tick: e.tick, text: plainText(e.text) }))}
      />
      <div className="lv-stage">
        <div className="world-scroll">
          <div
            className={"world live-world" + (hover && canPlace(hover) ? " placeable" : "")}
            tabIndex={0}
            role="region"
            aria-label="Relay track map"
            aria-describedby="live-rail-help live-selection"
            onPointerMove={(event) => {
              if (kbd) setKbd(false);
              if (!introDone || over || solution) return;
              const point = railPoint(event);
              cursor.current = point;
              if (pill.current) Object.assign(pill.current.style, pillPos(point));
              setHover(hitSector(point.x, point.y, tracks)); // same id: React bails out, no render
            }}
            onPointerLeave={() => setHover(null)}
            onBlur={() => setKbd(false)}
            onClick={(event) => {
              const { x, y } = railPoint(event);
              const id = hitSector(x, y, tracks);
              if (id && !over && !solution) tryPlace(id);
            }}
            onKeyDown={(event) => {
              if (!introDone || over || solution || (event.repeat && event.key === "Enter")) return;
              const move = event.key === "ArrowRight" || event.key === "ArrowDown"
                ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
              if (move) {
                event.preventDefault();
                setKbd(true);
                setSelected(
                  sectionOrder[(sectionOrder.indexOf(selected) + move + sectionOrder.length) % sectionOrder.length],
                );
              } else if (event.key === "Enter" && !over && !solution) {
                event.preventDefault();
                tryPlace(selected);
              }
            }}
          >
            <canvas ref={ground} aria-hidden="true" />
            <canvas ref={lightCanvas} className="live-overlay" aria-hidden="true" />
            <div className="live-markers" aria-hidden="true">
              {!over && !solution && (
                <svg className="live-route" viewBox="0 0 1 1" preserveAspectRatio="none">
                  {mara.path.map((id) => tracks.get(id)).filter((t) => !!t).map((t) => (
                    <line key={t!.sectorId} x1={t!.a[0]} y1={t!.a[1]} x2={t!.b[0]} y2={t!.b[1]} />
                  ))}
                </svg>
              )}
              {!over && obs.sectors.filter((s) =>
                s.beacon === false || queued.has(s.id) || hover === s.id ||
                live.events.some((e) => e.kind === "beacon-placed" && e.sectorId === s.id && e.tick === obs.tick - 1)
              ).map((s) => (
                <span
                  key={s.id}
                  className={"live-socket" + (queued.has(s.id) ? " queued" : "") + (building.has(s.id) ? " building" : "") +
                    ((hover ?? selected) === s.id ? " selected" : "") +
                    (hover === s.id && !canPlace(s.id) ? " invalid" : "") +
                    (route.has(s.id) ? " on-route" : "") + (linked.has(s.id) ? " linked" : "") +
                    (warning && warnSections.includes(s.id) ? " warn-here" : "") +
                    (live.events.some((e) =>
                        e.kind === "beacon-placed" && e.sectorId === s.id && e.tick === obs.tick - 1
                      )
                      ? " just-placed"
                      : "") +
                    (!firstPlacement && s.id === starterId ? " starter" : "")}
                  style={atMidpoint(s.id)}
                >
                  {building.has(s.id) ? liveIn(s.id) : queued.has(s.id) || s.beacon ? "✓" : "+"}
                </span>
              ))}
              {flood && (warning || sealed) && (
                <span
                  className={"live-water " + (sealed ? "sealed" : "warning")}
                  style={{
                    ...atMidpoint(flood.id),
                    height: (sealed ? 8 : 1 + (10 - Math.max(0, untilFlood)) * 0.65) + "%",
                  }}
                >
                </span>
              )}
            </div>
            <canvas ref={canvas} role="img" aria-label="Five tunnel levels with moving pods and trackside beacons" />
            <canvas ref={fxCanvas} className="live-overlay" aria-hidden="true" />
            {warning && <span className="live-flood-chip">Flood in {Math.max(0, untilFlood)}</span>}
            {focusId && !over && introDone && !solution && (
              <span
                ref={pill}
                className={"live-cursor " + (canPlace(focusId) ? "valid" : queued.has(focusId) || building.has(focusId) || remaining > 0 ? "info" : "invalid")}
                style={pillPos(hover ? cursor.current : midpoint(focusId))}
              >
                <b>{logLocation(focusId)}</b>
                <span>{canPlace(focusId) ? "Place beacon · " + remaining + " left" : stateOf(focusId)}</span>
              </span>
            )}
            {held.length > 1 && (
              <details
                className="live-hold-group"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <summary>{held.length} pods held at the flood</summary>
                <ul>{held.map((p) => <li key={p.id}>{p.label}</li>)}</ul>
              </details>
            )}
            {hintText && !over && <p className="live-hint-caption" role="status">{hintText}</p>}
            {/* characters: Director + Mara dialogue (src/echo-view/characters) */}
            <Dialogue obs={obs} previous={previous} ended={over} stars={stars} />
          </div>
        </div>
        <p className="sr" id="live-rail-help">Click a rail to place a beacon. Focus the map to use the arrow keys and Enter.</p>
        {!over && (
          <nav className="lv-bar" aria-label="Descent controls">
            <RelayButton {...runItem} />
            <RelayBar
              size="sm" label="Run speed" value={String(live.speed)}
              items={([1, 2, 4] as const).map((speed) => ({ key: String(speed), label: speed + "×", onSelect: () => live.setSpeed(speed) }))}
            />
            {!journeyMode && (
              <RelayBar
                label="Restart or watch" rest={null}
                items={[
                  { key: "restart", label: "Restart", tone: "danger", hold: true, onSelect: () => restart(false) },
                  { key: "solution", label: solution ? "Play yourself" : "Watch the solution", onSelect: () => restart(!solution) },
                ]}
              />
            )}
            <p className="lv-keys" aria-hidden="true"><kbd>Space</kbd> run <kbd>Enter</kbd> place</p>
          </nav>
        )}
      </div>
      {over && (
        journeyMode
          ? won
            ? <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} onNext={() => endLeg()} nextLabel="Continue the journey" />
            : <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} onRetry={() => endLeg()} retryLabel="Retry leg" onContinue={() => endLeg(true)}
                note={`Retrying costs ${obs.tick + 15} minutes on the clock, 1 dose${live.commands.length ? `, and the ${live.commands.length} beacon${live.commands.length === 1 ? "" : "s"} you placed` : ""}.`} />
          : <LiveDebrief mission={mission} commands={live.commands} stars={stars} endReason={obs.endReason} replay={solution} onRetry={() => restart(false)} retryLabel={solution ? "Play yourself" : undefined} onWatchSolution={solution ? undefined : () => restart(true)} />
      )}
      {!introDone && <LiveIntro mission={mission} goal={`Nurse Mara reaches the deep clinic by minute ${goals[0].maraBy}.`} hint={INTRO_HINTS[levelIndex]} onStart={start} />}
    </div>
  );
}

import { type MouseEventHandler, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DESCENT_LIVE_GOALS, descentLiveStars } from "../../../echo/descent";
import type { LogEvent, Observation } from "../../../echo/types";
import { play } from "../../game/audio";
import { THEME } from "../../theme";
import { SoundToggle } from "../../game/SoundToggle";
import { along, displayLocations, type Frame, podPose, tracks } from "../run";
import { createScene, lamp } from "../scene";
import "../style.css";
import { hitSector, RAIL_HEIGHT, RAIL_WIDTH } from "./hit";
import { mountEffects } from "./mount-effects";
import * as fx from "./fx";
import * as sfx from "./sfx";
import trim from "./art/shaft-trim.png";
import { heldAtFlood, useLive } from "./useLive";
import { blindWindows, deadlineMargin } from "./result";
import "./live.css";

const alertKinds = new Set(["blind", "beacon-placed", "credential-reject", "seal", "seal-heard", "hold", "reroute"]);
const sectionOrder = [...tracks.keys()];
const logLocation = (id: string) => displayLocations(id);

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
function arrival(tick: number | null) {
  return tick === null ? "En route" : "Minute " + tick;
}

export function LiveScreen({ onExit }: { onExit?: MouseEventHandler<HTMLAnchorElement> }) {
  const live = useLive();
  const { mission, observation: obs, previous, playing, queued, remaining, solution, feedback } = live;
  const [intro, setIntro] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState("link0");
  const [hover, setHover] = useState<string | null>(null);
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
  const flood = obs.sectors.find((s) => s.id === mission.sealSectorId)!;
  const untilFlood = mission.sealAt! - obs.tick;
  const warning = !flood.sealed && untilFlood <= 10;
  const activeSector = tracks.get(mara.path[mara.at]);
  const over = live.ended;
  const warnSections = [
    flood.id,
    obs.sectors.find((s) => s.routeId === flood.routeId && s.index === flood.index - 1)?.id,
  ];
  const held = obs.pods.filter((p) => heldAtFlood(p, obs));
  const best = DESCENT_LIVE_GOALS[DESCENT_LIVE_GOALS.length - 1];
  const clinics = [{ pod: mara, label: "Nurse Mara", deadline: best.maraBy }, {
    pod: medicine,
    label: "Medicine",
    deadline: best.medicineBy!,
  }];
  const placementsOpen = !over && !solution && remaining > 0;
  const canPlace = (id: string) =>
    placementsOpen && !queued.has(id) && obs.sectors.find((s) => s.id === id)?.beacon === false;
  const pressure = warning ? "Flood imminent" : flood.sealed ? "Main shaft flooded" : "Monitoring main shaft";
  const events = live.events.filter((e) =>
    alertKinds.has(e.kind) &&
    (e.kind !== "credential-reject" ||
      live.events.find((first) => first.kind === e.kind && first.podId === e.podId) === e)
  ).slice(-3);
  const stars = descentLiveStars(obs.pods);

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
    const title = document.title;
    document.title = "Play the Descent · Echo";
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(sfx.unlockOnFirstGesture, []);
  useEffect(() => {
    if (obs.tick === mission.sealAt! - 10) play("down");
    if (!previous.sectors.find((s) => s.id === flood.id)?.sealed && flood.sealed) {
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
    const tones = Array.from({ length: stars }, (_, i) => setTimeout(() => sfx.playStarDing(i), i * 180));
    return () => tones.forEach(clearTimeout);
  }, [obs, previous, flood, mission.sealAt, over, stars, solution, live.events, mara, medicine]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key.toLowerCase() === "r" && over) {
        e.preventDefault();
        restart(false);
      } else if ((e.key === " " && !(e.target as HTMLElement).closest?.("button, a")) || e.key.toLowerCase() === "p") {
        e.preventDefault();
        toggleRun();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  function tryPlace(id: string) {
    if (intro) return;
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
    if (intro) setIntro(false);
    live.togglePause();
  }
  function restart(watch: boolean) {
    setIntro(false);
    fx.reset();
    setAttempt(0);
    if (watch) live.watchSolution();
    else live.retry();
    setSelected("link0");
    setHover(null);
    setFirstPlacement(false);
  }
  function railPoint(event: { clientX: number; clientY: number; currentTarget: HTMLElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  return (
    <div className="descent descent-live">
      <SoundToggle />
      <header>
        <div>
          <a className="brand" href="?screen=title" onClick={onExit} aria-label="Back to the Echo title">← Back</a>
          <h1>The Descent</h1>
        </div>
        <div className="live-status">
          <div className="live-pack" aria-live="polite" aria-atomic="true">
            <span>
              <strong>{remaining}</strong> / {mission.beaconBudget} beacons left
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
      <main>
        <div className="world-scroll">
          <div
            className={"world live-world" + (hover && canPlace(hover) ? " placeable" : "")}
            tabIndex={0}
            role="region"
            aria-label="Relay track map"
            aria-describedby="live-rail-help live-selection"
            onPointerMove={(event) => {
              if (intro || over || solution) return;
              const point = railPoint(event);
              setCursor(point);
              setHover(hitSector(point.x, point.y, tracks));
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(event) => {
              const { x, y } = railPoint(event);
              const id = hitSector(x, y, tracks);
              if (id && !over && !solution) tryPlace(id);
            }}
            onKeyDown={(event) => {
              if (intro || over || solution || (event.repeat && event.key === "Enter")) return;
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
            <canvas ref={ground} aria-hidden="true" />
            <canvas ref={lightCanvas} className="live-overlay" aria-hidden="true" />
            <div className="live-markers" aria-hidden="true">
              {!over && obs.sectors.filter((s) =>
                s.beacon === false || queued.has(s.id) || hover === s.id ||
                live.events.some((e) => e.kind === "beacon-placed" && e.sectorId === s.id && e.tick === obs.tick - 1)
              ).map((s) => (
                <span
                  key={s.id}
                  className={"live-socket" + (queued.has(s.id) ? " queued" : "") +
                    ((hover ?? selected) === s.id ? " selected" : "") +
                    (hover === s.id && !canPlace(s.id) ? " invalid" : "") +
                    (warning && warnSections.includes(s.id) ? " warn-here" : "") +
                    (live.events.some((e) =>
                        e.kind === "beacon-placed" && e.sectorId === s.id && e.tick === obs.tick - 1
                      )
                      ? " just-placed"
                      : "") +
                    (!firstPlacement && s.id === "link0" ? " starter" : "")}
                  style={atMidpoint(s.id)}
                >
                  {queued.has(s.id) || s.beacon ? "✓" : "+"}
                </span>
              ))}
              {(warning || flood.sealed) && (
                <span
                  className={"live-water " + (flood.sealed ? "sealed" : "warning")}
                  style={{
                    ...atMidpoint(flood.id),
                    height: (flood.sealed ? 8 : 1 + (10 - Math.max(0, untilFlood)) * 0.65) + "%",
                  }}
                >
                </span>
              )}
            </div>
            <canvas ref={canvas} role="img" aria-label="Five tunnel levels with moving pods and trackside beacons" />
            <canvas ref={fxCanvas} className="live-overlay" aria-hidden="true" />
            {warning && <span className="live-flood-chip">Flood in {Math.max(0, untilFlood)}</span>}
            {hover && !over && !intro && (
              <span
                className={"live-cursor " + (canPlace(hover) ? "valid" : "invalid")}
                style={{ left: Math.min(.79, cursor.x) * 100 + "%", top: Math.min(.92, cursor.y) * 100 + "%" }}
              >
                {canPlace(hover)
                  ? "Place beacon · " + remaining + " left"
                  : queued.has(hover)
                  ? "Placement queued"
                  : remaining === 0
                  ? "No beacons left"
                  : "Beacon online"}
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
            {intro && (
              <div className="live-intro">
                <p>
                  The tower goes dark at t+{mission.towerDownAt}. You have {mission.beaconBudget}{" "}
                  beacons. Warn the main shaft before the flood at t+{mission.sealAt}.
                </p>
                <button className="live-primary" onClick={toggleRun}>
                  Start run <kbd>Space</kbd>
                </button>
              </div>
            )}
          </div>
        </div>
        <aside aria-label="Relay controls and goals">
          {over
            ? (
              <section className="live-debrief" aria-label="Run result">
                <div className="eyebrow">RUN COMPLETE</div>
                <h2>{stars ? "Clinic supplied" : "Deadline missed"}</h2>
                <p className="live-stars" aria-label={stars + " of 3 stars"}>
                  {"★".repeat(stars)}
                  {"☆".repeat(3 - stars)}
                </p>
                <dl className="live-arrivals live-margins">
                  {clinics.map(({ pod, label, deadline }) => (
                    <div key={pod.id}>
                      <dt>{label}</dt>
                      <dd>
                        {pod.arriveTick === null ? "Did not arrive" : arrival(pod.arriveTick)}
                        <small>{deadlineMargin(pod.arriveTick, deadline)}</small>
                      </dd>
                    </div>
                  ))}
                </dl>
                {stars < 3 && clinics.map(({ pod, label }) => {
                  const waits = blindWindows(pod.id, live.events, obs.tick);
                  return waits.length > 0 && (
                    <details key={pod.id} className="live-blind">
                      <summary>
                        {label} · {waits.reduce((minutes, wait) => minutes + wait.minutes, 0)} min in blind waits
                      </summary>
                      <ul>
                        {waits.map((wait) => (
                          <li key={wait.sectorId}>{logLocation(wait.sectorId)} · {wait.minutes} min</li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
                <p className="live-next-star">
                  {stars === 3
                    ? "Best possible run."
                    : held.length
                    ? "A delivery was held at the sealed shaft. Beacon both main shaft sections before the pods reach the fork."
                    : "For the next star, beacon the relay track early to cut blind waits."}
                </p>
                <div className="live-button-row">
                  <button onClick={() => restart(false)} autoFocus>
                    Retry <kbd>R</kbd>
                  </button>
                  <button onClick={() => restart(true)}>Watch the solution</button>
                </div>
              </section>
            )
            : (
              <>
                <div className="eyebrow">RELAY CONTROL{solution ? " · SOLUTION" : ""}</div>
                <h2>Guide the pods</h2>
                <p className="live-instructions" id="live-rail-help">
                  Click a + on the track to place a beacon. News travels only between neighbors. Focus the map to use
                  arrow keys and Enter.
                </p>
                <div className={"live-alert" + (flood.sealed ? " danger" : warning ? " warning" : "")}>
                  <small>{pressure}</small>
                  <strong>
                    {flood.sealed ? "Flooded · " + logLocation(flood.id) : logLocation(flood.id) + " floods " +
                      (warning ? "in " + untilFlood : "at minute " + mission.sealAt)}
                  </strong>
                </div>
                <div className="live-placement">
                  <p id="live-selection" aria-live="polite">
                    <strong>{logLocation(hover ?? selected)}</strong>
                    <span>
                      {queued.has(hover ?? selected)
                        ? "Placement queued"
                        : (obs.sectors.find((s) => s.id === (hover ?? selected)) ?? primary).beacon
                        ? "Beacon online"
                        : "No beacon"}
                    </span>
                  </p>
                  <button disabled={intro || !canPlace(hover ?? selected)} onClick={() => tryPlace(hover ?? selected)}>
                    Place beacon <kbd>Enter</kbd>
                  </button>
                  <p className="live-feedback" role="status">{feedback && <span key={attempt}>{feedback}</span>}</p>
                </div>
                <h3>Clinic deadlines</h3>
                <ol className="live-goals">
                  {DESCENT_LIVE_GOALS.map((goal) => {
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
                <span>{displayLocations(e.text)}</span>
              </li>
            ))}
          </ol>
        </aside>
      </main>
      <footer>
        <nav aria-label="Descent controls">
          <button className="live-primary" onClick={toggleRun} disabled={over}>
            {playing ? "Ⅱ Pause" : obs.tick === 0 ? "▶ Start run" : "▶ Resume"} <kbd>Space</kbd>
          </button>
          <div className="switch" role="group" aria-label="Run speed">
            {([1, 2] as const).map((speed) => (
              <button
                key={speed}
                aria-pressed={live.speed === speed}
                onClick={() => live.setSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
          <button onClick={() => restart(false)}>Restart</button>
          {!over && (
            <button onClick={() => restart(!solution)}>{solution ? "Play yourself" : "Watch the solution"}</button>
          )}
        </nav>
        <p className="fine">Simulated run · deterministic engine</p>
      </footer>
    </div>
  );
}

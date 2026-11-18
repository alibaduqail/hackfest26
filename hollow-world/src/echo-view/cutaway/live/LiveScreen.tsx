import { type MouseEventHandler, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DESCENT_LIVE_GOALS, descentLiveStars } from "../../../echo/descent";
import type { LogEvent, Observation } from "../../../echo/types";
import { play } from "../../game/audio";
import { along, displayLocations, type Frame, tracks } from "../run";
import { createScene } from "../scene";
import "../style.css";
import { hitSector } from "./hit";
import { useLive } from "./useLive";
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
  const [selected, setSelected] = useState("link0");
  const [hover, setHover] = useState<string | null>(null);
  const [firstPlacement, setFirstPlacement] = useState(false);
  const ground = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const rejected = useRef(new Map<string, LogEvent>());
  const mara = obs.pods.find((p) => p.id === "MED-1")!;
  const medicine = obs.pods.find((p) => p.id === "SUP-3")!;
  const primary = obs.sectors.find((s) => s.id === selected)!;
  const flood = obs.sectors.find((s) => s.id === mission.sealSectorId)!;
  const untilFlood = mission.sealAt! - obs.tick;
  const warning = !flood.sealed && untilFlood <= 10;
  const activeSector = tracks.get(mara.path[mara.at]);
  const over = obs.over;
  const placementsOpen = !over && !solution && remaining > 0;
  const canPlace = (id: string) =>
    placementsOpen && !queued.has(id) && obs.sectors.find((s) => s.id === id)?.beacon === false;
  const pressure = warning ? "Flood imminent" : flood.sealed ? "Main shaft flooded" : "Monitoring main shaft";
  const events = obs.log.filter((e) => alertKinds.has(e.kind)).slice(-3);
  const stars = descentLiveStars(obs.pods);

  useLayoutEffect(() => {
    const world = createScene(canvas.current!, ground.current!);
    scene.current = world;
    return () => {
      world.dispose();
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
    scene.current?.show(
      sceneFrame(obs, rejected.current),
      sceneFrame(previous),
      warning ? 4 : activeSector?.level ?? 1,
      smooth ? live.stepMs : 0,
    );
  }, [obs, previous, playing, activeSector, warning, live.stepMs]);

  useEffect(() => {
    const title = document.title;
    document.title = "Play the Descent · Echo";
    return () => {
      document.title = title;
    };
  }, []);
  useEffect(() => {
    if (obs.tick === mission.sealAt! - 10) play("down");
    if (!previous.sectors.find((s) => s.id === flood.id)?.sealed && flood.sealed) play("seal");
  }, [flood.id, flood.sealed, mission.sealAt, obs.tick, previous]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (e.key.toLowerCase() === "r" && over) {
        e.preventDefault();
        restart(false);
      } else if ((e.key === " " && !(e.target as HTMLElement).closest?.("button, a")) || e.key.toLowerCase() === "p") {
        e.preventDefault();
        live.togglePause();
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  function tryPlace(id: string) {
    setSelected(id);
    const result = live.place(id);
    if (result.ok) {
      setFirstPlacement(true);
      play("place");
    } else play("empty");
  }
  function restart(watch: boolean) {
    if (watch) live.watchSolution();
    else live.retry();
    setSelected("link0");
    setHover(null);
    setFirstPlacement(false);
  }
  function railAt(event: { clientX: number; clientY: number; currentTarget: HTMLElement }) {
    const rect = event.currentTarget.getBoundingClientRect();
    return hitSector((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, tracks);
  }

  return (
    <div className="descent descent-live">
      <header>
        <div>
          <a className="brand" href="?screen=title" onClick={onExit} aria-label="Back to the Echo title">← Back</a>
          <h1>The Descent</h1>
        </div>
        <div className="live-status">
          <div className="live-pack" aria-live="polite">
            <span>
              <strong>{remaining}</strong> / {mission.beaconBudget} beacons left
            </span>
            <div className="live-pips" aria-hidden="true">
              {Array.from(
                { length: mission.beaconBudget ?? 0 },
                (_, index) => <i key={index} className={index < remaining ? "charged" : ""} />,
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
            onPointerMove={(event) => setHover(railAt(event))}
            onPointerLeave={() => setHover(null)}
            onClick={(event) => {
              const id = railAt(event);
              if (id && !over && !solution) tryPlace(id);
            }}
            onKeyDown={(event) => {
              if (event.repeat && event.key === "Enter") return;
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
            <canvas ref={canvas} role="img" aria-label="Five tunnel levels with moving pods and trackside beacons" />
            <div className="live-markers" aria-hidden="true">
              {!over && obs.sectors.filter((s) => s.beacon === false || queued.has(s.id)).map((s) => (
                <span
                  key={s.id}
                  className={"live-socket" + (queued.has(s.id) ? " queued" : "") +
                    ((hover ?? selected) === s.id ? " selected" : "") +
                    (!firstPlacement && s.id === "link0" ? " starter" : "")}
                  style={atMidpoint(s.id)}
                >
                  {queued.has(s.id) ? "✓" : "+"}
                </span>
              ))}
              {(warning || flood.sealed) && (
                <span className={"live-water " + (flood.sealed ? "sealed" : "warning")} style={atMidpoint(flood.id)}>
                  {!flood.sealed && <span>{untilFlood > 0 ? "FLOOD IN " + untilFlood : "FLOOD NEXT TICK"}</span>}
                </span>
              )}
            </div>
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
                <dl className="live-arrivals">
                  <div>
                    <dt>Nurse Mara</dt>
                    <dd>{mara.arriveTick === null ? "Did not arrive" : arrival(mara.arriveTick)}</dd>
                  </div>
                  <div>
                    <dt>Medicine</dt>
                    <dd>{medicine.arriveTick === null ? "Did not arrive" : arrival(medicine.arriveTick)}</dd>
                  </div>
                </dl>
                {stars === 0 && (
                  <p>
                    {mara.status === "holding" && !mara.rerouted
                      ? "Mara was held at the sealed shaft. Carry the flood warning along connected beacons before she reaches the fork."
                      : "Mara missed the first deadline. Place beacons along her route to reduce blind waits."}
                  </p>
                )}
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
                <div className={"live-alert" + (warning || flood.sealed ? " danger" : "")}>
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
                  <button disabled={!canPlace(hover ?? selected)} onClick={() => tryPlace(hover ?? selected)}>
                    Place beacon <kbd>Enter</kbd>
                  </button>
                  <p className="live-feedback" role="status">{feedback ?? ""}</p>
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
          <button className="live-primary" onClick={live.togglePause} disabled={over}>
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

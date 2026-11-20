import { type MouseEventHandler, useEffect, useLayoutEffect, useRef, useState } from "react";
import { DESCENT_LAYOUT } from "../../echo/descent";
import { themeLabel } from "../../echo/theme-labels";
import {
  beatAt,
  beatLevels,
  beatNames,
  beats,
  captureStops,
  createRun,
  describe,
  displayLocations,
  type System,
} from "./run";
import { createScene } from "./scene";
import "./style.css";

const rules = [
  "Tower claims vs actual",
  "Beacon relay · Rule 3 · credentials",
  <>
    Rule 1 · one pod per section<br />Rule 2 · medical › supply › passenger
  </>,
  "News hops · reroute",
  "Care and medicine",
];
const STEP_MS = 410;

export function CutawayScreen({ onExit }: { onExit?: MouseEventHandler<HTMLAnchorElement> }) {
  const [run] = useState(() => {
    const echo = createRun("echo"), tower = createRun("tower");
    const params = new URLSearchParams(location.search);
    return {
      echo,
      tower,
      stops: captureStops(echo),
      end: echo(0).obs.endTick,
      params,
      motion: matchMedia("(prefers-reduced-motion: reduce)"),
    };
  });
  const [reduced, setReduced] = useState(run.motion.matches);
  function seekTick(beat: number, settled = reduced) {
    return settled ? run.stops[beat - 1].settled : run.stops[beat - 1].cue;
  }
  const [mode, setMode] = useState<System>(run.params.get("mode") === "tower" ? "tower" : "echo");
  const [tick, setTick] = useState(() => {
    const beat = Number(run.params.get("beat"));
    return Number.isInteger(beat) && beat >= 1 && beat <= beats.length ? seekTick(beat) : 0;
  });
  const [playing, setPlaying] = useState(run.params.get("autoplay") === "1" && tick < run.end && !document.hidden);
  const [speed, setSpeed] = useState(1);
  const frame = run[mode](tick), obs = frame.obs;
  const active = beatAt(tick), level = beatLevels[active - 1] ?? 1;
  const [title, caption] = describe(frame, active);
  const stocked = frame.arrived.has("SUP-3");

  const canvas = useRef<HTMLCanvasElement>(null), ground = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const previous = useRef({ tick, mode });
  useLayoutEffect(() => {
    const world = createScene(canvas.current!, ground.current!);
    scene.current = world;
    return () => {
      world.dispose();
      scene.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    const smooth = playing && !reduced && previous.current.mode === mode && previous.current.tick + 1 === tick;
    scene.current!.show(frame, run[mode](Math.max(0, tick - 1)), level, smooth ? STEP_MS / speed : 0);
    previous.current = { tick, mode };
  }, [frame, level, mode, playing, reduced, run, speed, tick]);

  useEffect(() => {
    const change = () => {
      setReduced(run.motion.matches);
      if (run.motion.matches) setTick((t) => beatAt(t) ? run.stops[beatAt(t) - 1].settled : t);
    };
    const hide = () => {
      if (document.hidden) setPlaying(false);
    };
    run.motion.addEventListener("change", change);
    document.addEventListener("visibilitychange", hide);
    const oldTitle = document.title;
    document.title = "The Descent · Echo";
    return () => {
      document.title = oldTitle;
      run.motion.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [run]);

  function advance(direction: number) {
    if (!reduced) return Math.min(run.end, Math.max(0, tick + direction));
    if (direction > 0) return run.stops.find((s) => s.settled > tick)?.settled ?? run.end;
    return run.stops.filter((s) => s.settled < tick).at(-1)?.settled ?? 0;
  }
  useEffect(() => {
    if (!playing) return;
    if (tick === run.end) {
      setPlaying(false);
      return;
    }
    const hold = run.stops.some((s) => s.cue === tick);
    const delay = reduced ? 2200 : STEP_MS + (hold ? 2000 : 0);
    const timer = window.setTimeout(() => setTick(advance(1)), delay / speed);
    return () => clearTimeout(timer);
  }, [playing, tick, reduced, run, speed]);

  function bookmark(beat: number, system: System) {
    if (location.protocol === "file:") return;
    const url = new URL(location.href);
    if (beat) url.searchParams.set("beat", String(beat));
    else url.searchParams.delete("beat");
    url.searchParams.set("mode", system);
    history.replaceState(history.state, "", url);
  }
  function jump(beat: number) {
    setPlaying(false);
    setTick(seekTick(beat));
    bookmark(beat, mode);
  }
  function switchMode(system: System) {
    setMode(system);
    bookmark(active, system);
  }
  function togglePlay() {
    if (tick === run.end) {
      setTick(0);
      bookmark(0, mode);
    }
    setPlaying((p) => !p);
  }
  function step(direction: number) {
    setPlaying(false);
    setTick(advance(direction));
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.key === " " && (event.target as HTMLElement).closest?.("button,a")) return;
      switch (event.key.toLowerCase()) {
        case " ":
          togglePlay();
          break;
        case "arrowright":
          step(1);
          break;
        case "arrowleft":
          step(-1);
          break;
        case "t":
          switchMode("tower");
          break;
        case "e":
          switchMode("echo");
          break;
        default:
          return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  return (
    <div className={"descent" + (run.params.get("clean") === "1" ? " clean" : "")}>
      <header>
        <div>
          <a
            className="brand"
            href={location.protocol === "file:" ? "https://hollow-world-eight.vercel.app/" : "./index.html"}
            onClick={onExit}
            aria-label="Echo game title"
          >
            ECHO
          </a>
          <h1>The Descent</h1>
        </div>
        <div className="mode">
          <time id="clock">t+{String(tick).padStart(2, "0")}</time>
          <div className="switch" role="group" aria-label="Clearance system">
            {(["tower", "echo"] as const).map((system) => (
              <button
                key={system}
                data-mode={system}
                aria-pressed={system === mode}
                onClick={() => switchMode(system)}
              >
                {system === "echo" ? "Echo" : "Tower"}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main>
        <div
          className="world-scroll"
          tabIndex={0}
          role="region"
          aria-label="Five-level cutaway, scroll horizontally on small screens"
        >
          <div className="world">
            <canvas ref={ground} aria-hidden="true" />
            <canvas
              ref={canvas}
              id="scene"
              role="img"
              aria-label="Pod locations, occupied tracks and beacon activity in the five-level cutaway"
              aria-describedby="manifest"
            />
          </div>
        </div>
        <aside aria-label="Run observations">
          <div className="eyebrow">L{level} · {DESCENT_LAYOUT.levels[level - 1].name.toUpperCase()}</div>
          <div aria-live="polite" aria-atomic="true">
            <h2>{title}</h2>
            <p id="caption">{caption}</p>
          </div>
          <ol id="rules" aria-label="System rules">
            {rules.map((rule, i) => (
              <li
                key={i}
                className={level === i + 1
                  ? "active"
                  : active > 0 && beatLevels.slice(0, active - 1).includes(i + 1)
                  ? "past"
                  : ""}
              >
                <b>L{i + 1}</b>
                <span>{rule}</span>
              </li>
            ))}
          </ol>
          <dl className="stats">
            <div>
              <dt>pod runs authorized</dt>
              <dd id="claim" className={obs.towerUp ? "" : "offline"}>{obs.score.towerClaimed}</dd>
            </div>
            <div>
              <dt>actually moving</dt>
              <dd id="actual">{obs.score.realFlights}</dd>
            </div>
          </dl>
          <section className="ward">
            <h3>Deep clinic</h3>
            <p id="ward" className={stocked ? "stocked" : ""}>
              {frame.arrived.has("MED-1") ? "Nurse on duty" : "No care"} ·{" "}
              {stocked ? "Medicine delivered" : "Out of medicine"}
            </p>
          </section>
          <ol id="events" aria-label="Latest system events">
            {frame.events.map((e) => (
              <li key={[e.tick, e.kind, e.podId, e.sectorId].join("/")}>
                <time>t+{e.tick}</time>
                <span>{displayLocations(e.text)}</span>
              </li>
            ))}
          </ol>
          <p id="manifest" className="sr">
            {obs.pods.map((p) => {
              const city = p.status === "arrived" ? p.dest : p.origin;
              const place = p.status === "arrived" || p.at < 0
                ? obs.cities.find((c) => c.id === city)!.name
                : displayLocations(p.path[p.at]);
              return themeLabel(p) + ", " + p.status + " at " + place;
            }).join(". ")}
          </p>
        </aside>
      </main>
      <footer>
        <nav aria-label="Run playback">
          <div className="controls">
            <button id="play" aria-keyshortcuts="Space" onClick={togglePlay}>
              {playing ? "Ⅱ Pause" : tick === run.end ? "↺ Replay" : "▶ Play"}
            </button>
            <button
              id="step"
              aria-keyshortcuts="ArrowRight"
              title="Step forward (→), back (←)"
              disabled={tick === run.end}
              onClick={() => step(1)}
            >
              Step
            </button>
            <div className="switch" role="group" aria-label="Playback speed">
              {[1, 4].map((n) => (
                <button
                  key={n}
                  data-speed={n}
                  aria-pressed={speed === n}
                  onClick={() => setSpeed(n)}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>
          <div id="beats" role="group" aria-label="Jump to a beat">
            {beats.map((b) => (
              <button
                key={b.beat}
                title={`Beat ${b.beat} · t+${b.tick} · ${b.rule}`}
                aria-current={b.beat === active ? "step" : undefined}
                onClick={() => jump(b.beat)}
              >
                {beatNames[b.beat - 1]}
              </button>
            ))}
          </div>
        </nav>
        <div className="fine">
          <span>Simulated run · deterministic engine (npm run harness)</span>
          <span>Credential check uses a simulated signature.</span>
        </div>
      </footer>
    </div>
  );
}

// Live split screen: the Directorate-only engine on the left, Echo on the right, one mission object, one clock.
// Both panes and the panels read Observation only. View effects (pulses, yield tags, faded paths) live in Fx.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createEngine } from "../echo/engine";
import { towerDown } from "../echo/missions";
import type { EchoEngineApi, LogEvent, LogKind, Mission, Observation } from "../echo/types";
import { drawMap, makeProjection, PULSE_MS, shakeOffset, type Fx, type Variant } from "./map";
import { play, type Sound } from "./game/audio";

const STRATA_URL = "/strata.html"; // the Strata city sim, home of Sector 07
import { EchoBanner, EchoLog, Scoreboard, TowerBanner } from "./panels";
import { Legend } from "./Legend";
import { EndCard } from "./EndCard";
import { RelayBar } from "./relay/Relay";
import "./echo.css";

const SPEEDS = [1, 10, 60] as const;
const DISPATCH_POD = "MED-1"; // Nurse Mara Vale
const DISPATCH_MIN_TICK = 31; // the reroute beat needs the pod to depart at or after the seal news (t30+)

const css = `
html,body,#root{margin:0;height:100%;background:var(--bg);color:var(--text);font:13px/1.45 var(--sans)}
.echo-screen{position:relative;display:flex;flex-direction:column;height:100%}
.echo-main{flex:1;display:grid;grid-template-columns:1fr 1fr 360px;gap:2px;background:var(--line);min-height:0}
.echo-side{background:var(--bg);padding:12px;min-height:0;overflow:hidden}
.echo-side .echo-panels{height:100%}
.echo-bar{background:var(--panel);display:flex;flex-wrap:wrap;gap:4px 20px;align-items:center;padding:2px 14px;border-top:1px solid var(--line)}
.echo-bar .grow{flex:1;min-width:0;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.echo-speed{display:flex;align-items:center;gap:8px}
.echo-speed-l{font-family:var(--label,var(--mono));font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.echo-speed .rl-node[data-selected] .rl-label{font-weight:700;text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:2px}
.echo-speed .rl-node[data-selected] .rl-dot{background:var(--amber);border-color:var(--amberHi)}
.echo-bar .echo-clock{font-family:var(--label,var(--mono));font-variant-numeric:tabular-nums;color:var(--text2)}
.echo-ticker{display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:5px 10px;background:var(--redBg);border:1px solid var(--redLine);border-radius:4px;color:var(--red);font-size:12px;letter-spacing:.06em;animation:echo-tick .5s ease-out}
.echo-ticker b{flex:none;background:var(--red);color:var(--redBg);padding:0 6px;font-size:10px;letter-spacing:.25em}
@keyframes echo-tick{from{opacity:0;transform:translateY(4px)}}
.echo-hint{position:absolute;left:14px;bottom:104px;z-index:3;max-width:calc(100% - 28px);display:flex;flex-direction:column;gap:2px;text-align:left;background:linear-gradient(var(--amberBg),var(--amberBg)),var(--panel);color:var(--amberText);border:1px solid var(--amber);border-radius:6px;padding:10px 14px;font:inherit;font-size:16px;line-height:1.35;cursor:pointer;animation:echo-hint .35s ease-out;text-wrap:balance;hyphens:none}
.echo-hint small{color:var(--amberDim);font-size:11px;letter-spacing:.08em}
@keyframes echo-hint{from{opacity:0;transform:translateY(6px)}}
.echo-flash{position:absolute;inset:0;z-index:4;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(90,8,6,.38);box-shadow:inset 0 0 160px rgba(255,59,59,.55);animation:echo-flash 2s forwards}
.echo-flash b{font-size:clamp(36px,7vw,84px);letter-spacing:.2em;color:var(--red);text-shadow:0 0 24px rgba(255,59,59,.6)}
.echo-flash span{color:var(--redText);letter-spacing:.12em}
@keyframes echo-flash{0%{opacity:0}8%{opacity:1}70%{opacity:1}100%{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.echo-flash{animation-duration:2.5s}.echo-ticker,.echo-hint{animation:none}}
@media (max-width:1100px){.echo-main{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,3fr) minmax(0,2fr)}.echo-side{grid-column:1 / -1}}
@media (max-width:760px){.echo-main{grid-template-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr))}.echo-side{grid-column:auto}}
`;

interface World {
  mission: Mission;
  tower: EchoEngineApi;
  echo: EchoEngineApi;
  normal: Observation; // the normal-day run, finished, for the delay ratio
}
function makeWorld(mission: Mission): World {
  // one mission object for all three engines: they share the cached normal-day reference
  const normal = createEngine(mission, "normal");
  normal.step(mission.endTick);
  return { mission, tower: createEngine(mission, "tower"), echo: createEngine(mission, "echo"), normal: normal.observe() };
}
const newFx = (): Fx => ({ pulses: [], yields: [], oldPaths: {}, frac: 0, blind: {}, rejected: {}, speech: [], stamps: [], flashAt: 0, arrivals: [], cues: [] });

/** In-run story beats (the game passes them; echo.html doesn't, so the video capture stays clean). */
export interface Story {
  ticker: { before: string; down: string; seal: string; mid: string }; // the Directorate's broadcast; {claimed} = flights it claims
  mara: Partial<Record<LogKind, string>>; // Nurse Mara Vale's line per event kind, said the first time it happens
}
const FLASH_MS = 2000; // the TOWER OFFLINE flash (the CSS animation runs the same 2s)
const SPEECH_GAP_MS = 2600; // a line shows at least this long before the next one replaces it
const SCENE_KINDS = new Set<LogKind>(["tower-down", "credential-reject"]); // Mara reacts to these whoever they happen to

/** Is this event one Mara speaks to? Her own events, a pod yielding to her, or a scene-wide one. */
const forMara = (e: LogEvent, yieldTo: string) =>
  SCENE_KINDS.has(e.kind) || (e.kind === "yield" ? yieldTo === DISPATCH_POD : e.podId === DISPATCH_POD);
const SOUND: Record<string, Sound> = { down: "down", seal: "seal", yield: "yield", "yield-med": "yield", "arrive-med": "chime" };
// Mission 1 is the tutorial: one hint card at a time; a newer beat replaces it after 2.5 s (5 s otherwise, or click). Dismissal lasts for the page session.
const HINTS: Record<string, string> = {
  start: "Run the clock. Watch the tower on the left.",
  down: "The tower is dark. On the right, Echo takes over.",
  seal: "The Directorate sealed the tunnel. Watch Mara re-plan.",
  "yield-med": "A passenger yields. Medicine goes first.",
};
const HINT_MS = 5000, HINT_MIN_MS = 2500;
const hintsSeen = new Set<string>();
const BEAT_TICKS = 25; // a ticker line stays this many ticks after its event

function tickerLine(story: Story, o: Observation, m: Mission): [beat: string, text: string] {
  if (o.towerUp) return ["before", story.ticker.before];
  const seals = [m.sealAt, ...(m.seals ?? []).map((x) => x.at)].filter((t): t is number => t !== null && t < o.tick);
  const lastSeal = seals.length ? Math.max(...seals) : -Infinity;
  if (o.tick - lastSeal <= BEAT_TICKS) return [`seal${lastSeal}`, story.ticker.seal];
  if (o.tick - o.towerDownAt <= BEAT_TICKS) return ["down", story.ticker.down];
  return ["mid", story.ticker.mid.replace("{claimed}", String(o.score.towerClaimed))];
}

/** Pull this tick's protocol events out of the log into wall-clock effects. */
function collectFx(fx: Fx, history: LogEvent[], o: Observation, mission: Mission, now: number, story?: Story) {
  for (const p of o.pulses) fx.pulses.push({ sectorId: p.sectorId, kind: p.kind, born: now });
  for (const e of o.log) {
    if (e.tick !== o.tick - 1) continue;
    history.push(e); // the engine log keeps 60; the panel filters this full history
    if (story && e.kind === "tower-down") fx.flashAt = now;
    if (story && e.kind === "seal" && e.sectorId) fx.stamps.push({ sectorId: e.sectorId, born: now });
    const to = e.kind === "yield" ? (/ to (\S+)/.exec(e.text)?.[1] ?? "").replace(/·.*/, "") : "";
    const line = story?.mara[e.kind];
    if (line && forMara(e, to) && !fx.speech.some((x) => x.text === line)) { // first occurrence only
      const prev = fx.speech.at(-1);
      fx.speech.push({ podId: DISPATCH_POD, text: line, born: Math.max(now, (prev?.born ?? -Infinity) + SPEECH_GAP_MS) });
    }
    if (story) { // sound and hint cues (drained by the screen, so the sim never waits on them)
      const cue = e.kind === "tower-down" ? "down" : e.kind === "seal" ? "seal" : e.kind === "yield" ? (to === DISPATCH_POD ? "yield-med" : "yield") : e.kind === "arrive" && e.podId === DISPATCH_POD ? "arrive-med" : "";
      if (cue) fx.cues.push(cue);
      const path = e.kind === "arrive" && e.podId === DISPATCH_POD ? o.pods.find((p) => p.id === DISPATCH_POD)?.path : undefined;
      if (path) fx.arrivals.push({ path, born: now });
    }
    if (!e.podId) continue;
    if (e.kind === "blind" && e.sectorId) fx.blind[e.podId] = e.sectorId;
    if (e.kind === "credential-reject") fx.rejected[e.podId] = true;
    if (e.kind === "yield") fx.yields.push({ podId: e.podId, to, born: now });
    if (e.kind === "reroute" && !fx.oldPaths[e.podId]) {
      const orig = mission.pods.find((p) => p.id === e.podId);
      if (orig) fx.oldPaths[e.podId] = { path: orig.path, born: now };
    }
  }
}

function MapPane({ obsRef, fxRef, variant, kicker, title, sub, down, children }: {
  obsRef: MutableRefObject<Observation>; fxRef: MutableRefObject<Fx>; variant: Variant; kicker: string; title: string; sub: string; down: boolean; children?: React.ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const loop = (t: number) => {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [sx, sy] = shakeOffset(fxRef.current, t); // seal impact: a short decaying shake (view only)
      if (sx || sy) { ctx.fillStyle = "#0a1013"; ctx.fillRect(0, 0, w, h); ctx.translate(sx, sy); }
      drawMap(ctx, obsRef.current, { variant, width: w, height: h, time: t, fx: fxRef.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant, obsRef, fxRef]);
  return (
    <div className={`echo-pane echo-pane-${variant}${down ? " is-down" : ""}`}>
      <header className="echo-cap"><span className="echo-kicker">{kicker}</span><b>{title}</b><span>{sub}</span></header>
      <div className="echo-map">
      <canvas
        ref={ref}
        onClick={(ev) => {
          const o = obsRef.current, r = ev.currentTarget.getBoundingClientRect();
          const city = o.cities.find((c) => c.strata);
          if (!city) return;
          const [x, y] = makeProjection(o, r.width, r.height)([city.x, city.y]);
          if (Math.hypot(ev.clientX - r.left - x, ev.clientY - r.top - y) < 16) location.href = STRATA_URL;
        }}
      />
      {children}
      </div>
    </div>
  );
}

export interface MissionScreenProps {
  mission?: Mission; // default: Tower Down (echo.html)
  allowDispatch?: boolean; // default true
  speed?: number; // starting speed; a speed above 60 (time-lapse) is added to the speed buttons
  onEnd?: (tower: Observation, echo: Observation, normal: Observation) => void; // once, when the Echo run is over; replaces the end card
  onExit?: () => void; // adds an "Abort mission" button
  story?: Story; // in-run story beats; off when missing
}

export function MissionScreen({ mission: missionProp, allowDispatch = true, speed: speedProp, onEnd, onExit, story }: MissionScreenProps = {}) {
  const q = new URLSearchParams(location.search); // ?run=1&speed=10&t=N for screenshots
  const missionRef = useRef<Mission>(null as unknown as Mission);
  if (!missionRef.current) missionRef.current = missionProp ?? towerDown();
  const fxRef = useRef<Fx>(newFx());
  const historyRef = useRef<LogEvent[]>([]);
  const world = useRef<World>(null as unknown as World);
  if (!world.current) {
    const w = (world.current = makeWorld(missionRef.current));
    const t = Math.max(0, Number(q.get("t")) || 0); // ?t=N starts at tick N; effects are aged as if played at 10x
    const now = performance.now();
    for (let i = 0; i < t && !w.echo.observe().over; i++) {
      w.tower.step(1);
      w.echo.step(1);
      collectFx(fxRef.current, historyRef.current, w.echo.observe(), w.mission, now - (t - 1 - i) * 100, story);
    }
  }
  const speeds: readonly number[] = speedProp && speedProp > 60 ? [...SPEEDS, speedProp] : SPEEDS;
  const towerRef = useRef<Observation>(world.current.tower.observe());
  const echoRef = useRef<Observation>(world.current.echo.observe());
  const [snap, setSnap] = useState({ tower: towerRef.current, echo: echoRef.current });
  const [running, setRunning] = useState(q.get("run") === "1");
  const [speed, setSpeed] = useState<number>(speeds.find((s) => s === Number(q.get("speed"))) ?? speeds.find((s) => s === speedProp) ?? 10);
  const [note, setNote] = useState("");
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // sound cues and Mission 1 hints (game only: `story` is missing on echo.html)
  const tutorial = !!story && missionRef.current.id === "tower-down";
  const [hint, setHint] = useState<{ id: string; text: string } | null>(null);
  const hintQ = useRef<string[]>([]);
  const hintAt = useRef(0);
  const nextHint = useCallback(() => {
    const id = hintQ.current.shift();
    hintAt.current = performance.now();
    setHint(id ? { id, text: HINTS[id] } : null);
  }, []);
  const pushHints = useCallback((ids: string[], idle: boolean) => {
    const fresh = ids.filter((id, i) => HINTS[id] && !hintsSeen.has(id) && ids.indexOf(id) === i);
    fresh.forEach((id) => hintsSeen.add(id));
    if (!fresh.length) return;
    hintQ.current = [fresh[fresh.length - 1]]; // one at a time: the newest beat replaces any waiting one
    if (idle || performance.now() - hintAt.current >= HINT_MIN_MS) nextHint();
  }, [nextHint]);
  const hintOn = useRef(false);
  hintOn.current = !!hint;
  const drain = useCallback((live: boolean) => {
    const cues = fxRef.current.cues.splice(0);
    if (!story) return;
    if (live) for (const c of new Set(cues)) if (SOUND[c]) play(SOUND[c]);
    if (tutorial) pushHints(live ? cues : cues.slice(-1), !hintOn.current); // a deep link (?t=N) shows only the latest beat
  }, [story, tutorial, pushHints]);
  useEffect(() => { // on mount: the start swell and the first hint (a fresh run only)
    if (!story) return;
    if (echoRef.current.tick === 0) { play("start"); if (tutorial) pushHints(["start"], true); }
    drain(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hint) return;
    const id = setInterval(() => {
      const age = performance.now() - hintAt.current;
      if (age >= HINT_MS || (hintQ.current.length && age >= HINT_MIN_MS)) nextHint();
    }, 250);
    return () => clearInterval(id);
  }, [hint, nextHint]);

  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now(), acc = 0;
    const loop = (now: number) => {
      const w = world.current, fx = fxRef.current;
      acc += (Math.min(100, now - last) / 1000) * speedRef.current;
      last = now;
      const n = Math.min(Math.floor(acc), 120);
      acc = Math.min(acc - Math.floor(acc), 0.999);
      for (let i = 0; i < n; i++) {
        w.tower.step(1);
        w.echo.step(1);
        collectFx(fx, historyRef.current, w.echo.observe(), w.mission, now, story);
      }
      if (fx.cues.length) drainRef.current(true);
      fx.pulses = fx.pulses.filter((p) => now - p.born < PULSE_MS);
      fx.frac = acc;
      if (n > 0) {
        towerRef.current = w.tower.observe();
        echoRef.current = w.echo.observe();
        setSnap({ tower: towerRef.current, echo: echoRef.current });
        if (echoRef.current.over) return void (fx.frac = 0, setRunning(false));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const drainRef = useRef(drain);
  drainRef.current = drain;
  const reset = useCallback(() => {
    world.current = makeWorld(missionRef.current);
    towerRef.current = world.current.tower.observe();
    echoRef.current = world.current.echo.observe();
    fxRef.current = newFx();
    historyRef.current = [];
    setSnap({ tower: towerRef.current, echo: echoRef.current });
    setRunning(false);
    setNote("");
  }, []);

  const { tower, echo } = snap;
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const ended = useRef(false);
  useEffect(() => {
    if (!echo.over || ended.current) return;
    ended.current = true; // a Replay builds a new world but onEnd still fires once per mount
    endRef.current?.(tower, echo, world.current.normal);
  }, [echo.over, tower, echo]);
  const nurse = echo.pods.find((p) => p.id === DISPATCH_POD);
  const dispatch = () => {
    const w = world.current;
    const atTick = Math.max(DISPATCH_MIN_TICK, echo.tick + 1);
    const res = [w.tower, w.echo].map((e) => e.act({ type: "dispatchMedical", podId: DISPATCH_POD, atTick })); // same tick on both engines
    setNote(res.every((r) => r.ok) ? `Mara dispatched · t+${atTick}` : `Refused: ${res.find((r) => !r.ok)?.reason}`);
  };

  return (
    <div className="echo-screen">
      <style>{css}</style>
      <div className="echo-main">
        <MapPane obsRef={towerRef} fxRef={fxRef} variant="tower" kicker="Centralized" title="Tower" sub="One tower clears every flight. Lose it and the network is blind." down={!tower.towerUp}>
          <div className="echo-overlay">
            {story && (() => { const [beat, line] = tickerLine(story, tower, world.current.mission); return <div className="echo-ticker" key={beat} role="status"><b>BROADCAST</b>{line}</div>; })()}
            <TowerBanner obs={tower} />
          </div>
        </MapPane>
        <MapPane obsRef={echoRef} fxRef={fxRef} variant="echo" kicker="Decentralized" title="Echo" sub="Every pod navigates. Beacons relay seals and yields. No tower." down={!tower.towerUp}>
          <div className="echo-overlay"><EchoBanner obs={echo} /></div>
          {hint && <button className="echo-hint" key={hint.id} onClick={nextHint}>{hint.text}<small>click to dismiss</small></button>}
        </MapPane>
        <div className="echo-side">
          <div className="echo-panels">
            <EchoLog obs={echo} log={historyRef.current} />
            <Scoreboard obs={echo} tower={tower} normal={world.current.normal} />
          </div>
        </div>
      </div>
      <Legend />
      <div className="echo-bar">
        <RelayBar label="Run controls" items={[
          { key: "run", label: echo.over ? "Replay" : running ? "Pause" : "Run", tone: "primary", onSelect: () => (echo.over ? reset() : setRunning((r) => !r)) },
          { key: "reset", label: "Reset", tone: "danger", hold: true, onSelect: reset },
          ...(allowDispatch ? [{ key: "dispatch", label: "Dispatch Mara", disabled: !nurse || nurse.status !== "scheduled" || echo.over, onSelect: dispatch }] : []),
        ]} />
        <div className="echo-speed"><span className="echo-speed-l" aria-hidden>Speed</span><RelayBar label="Speed" value={String(speed)} items={speeds.map((s) => ({ key: String(s), label: `${s}×`, onSelect: () => setSpeed(s) }))} /></div>
        <span className="grow">{note}</span>
        <RelayBar size="md" label="Elsewhere" rest={null} items={[{ key: "strata", label: "Sector 07 city sim", tone: "secondary", nav: true, href: STRATA_URL, onSelect: () => location.assign(STRATA_URL) }]} />
        <span className="echo-clock">t+{echo.tick} / {echo.endTick}</span>
        {onExit && <RelayBar size="sm" label="Leave" items={[{ key: "abort", label: "Abort mission", tone: "danger", hold: true, onSelect: onExit }]} />}
      </div>
      {story && fxRef.current.flashAt > 0 && performance.now() - fxRef.current.flashAt < FLASH_MS && (
        <div className="echo-flash" key={fxRef.current.flashAt} aria-hidden><b>TOWER OFFLINE</b><span>the Directorate's tower has gone dark</span></div>
      )}
      {echo.over && !onEnd && <EndCard tower={tower} echo={echo} normal={world.current.normal} onReplay={reset} />}
    </div>
  );
}

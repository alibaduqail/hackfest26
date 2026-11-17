// Live split screen: the Directorate-only engine on the left, Echo on the right, one mission object, one clock.
// Both panes and the panels read Observation only. View effects (pulses, yield tags, faded paths) live in Fx.
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { createEngine } from "../echo/engine";
import { towerDown } from "../echo/missions";
import type { EchoEngineApi, LogEvent, Mission, Observation } from "../echo/types";
import { drawMap, PULSE_MS, type Fx, type Variant } from "./map";
import { EchoLog, Scoreboard, TowerBanner } from "./panels";
import { EndCard } from "./EndCard";
import "./echo.css";

const SPEEDS = [1, 10, 60] as const;
const DISPATCH_POD = "MED-1"; // Nurse Mara Vale
const DISPATCH_MIN_TICK = 31; // the reroute beat needs the pod to depart at or after the seal news (t30+)

const css = `
html,body,#root{margin:0;height:100%;background:#0a1013;color:#cfe3e8;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
.echo-screen{position:relative;display:flex;flex-direction:column;height:100%}
.echo-main{flex:1;display:grid;grid-template-columns:1fr 1fr 360px;gap:1px;background:#1a272c;min-height:0}
.echo-pane{position:relative;background:#0a1013;min-width:0;min-height:0}
.echo-pane canvas{position:absolute;inset:0;width:100%;height:100%}
.echo-cap{position:absolute;left:14px;top:12px;z-index:1;pointer-events:none}
.echo-cap b{display:block;font-size:14px;letter-spacing:.04em}
.echo-cap span{color:#7f979f}
.echo-overlay{position:absolute;left:14px;bottom:14px;z-index:1;max-width:calc(100% - 28px)}
.echo-overlay .echo-card{padding:8px 12px}.echo-overlay .echo-title{margin:0 0 2px}
.echo-overlay .echo-tower-lie{display:flex;flex-wrap:wrap;gap:0 16px;align-items:baseline}
.echo-overlay .echo-claimed,.echo-overlay .echo-real{font-size:20px;margin:0}
.echo-side{background:#0a1013;padding:12px;min-height:0;overflow:hidden}
.echo-side .echo-panels{height:100%}
.echo-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:8px 14px;border-top:1px solid #1a272c}
.echo-bar button{background:#14222a;color:#cfe3e8;border:1px solid #2a3d46;border-radius:4px;padding:5px 12px;font:inherit;cursor:pointer}
.echo-bar button[aria-pressed=true]{background:#1d5f7a;border-color:#45d1c4}
.echo-bar button:disabled{opacity:.4;cursor:default}
.echo-bar .echo-dispatch{border-color:#ff5a52;color:#ffd5d2}
.echo-bar .grow{flex:1}
@media (max-width:1100px){.echo-main{grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,3fr) minmax(0,2fr)}.echo-side{grid-column:1 / -1}}
@media (max-width:760px){.echo-main{grid-template-columns:1fr;grid-template-rows:repeat(3,minmax(0,1fr))}.echo-side{grid-column:auto}}
`;

interface World {
  mission: Mission;
  tower: EchoEngineApi;
  echo: EchoEngineApi;
  normal: Observation; // the normal-day run, finished, for the delay ratio
}
function makeWorld(): World {
  const mission = towerDown(); // one object: the engines share the cached normal-day reference
  const normal = createEngine(mission, "normal");
  normal.step(mission.endTick);
  return { mission, tower: createEngine(mission, "tower"), echo: createEngine(mission, "echo"), normal: normal.observe() };
}
const newFx = (): Fx => ({ pulses: [], yields: [], oldPaths: {}, frac: 0 });

/** Pull this tick's protocol events out of the log into wall-clock effects. */
function collectFx(fx: Fx, history: LogEvent[], o: Observation, mission: Mission, now: number) {
  for (const p of o.pulses) fx.pulses.push({ sectorId: p.sectorId, kind: p.kind, born: now });
  for (const e of o.log) {
    if (e.tick !== o.tick - 1) continue;
    history.push(e); // the engine log keeps 60; the panel filters this full history
    if (!e.podId) continue;
    if (e.kind === "yield") fx.yields.push({ podId: e.podId, to: (/ to (\S+)/.exec(e.text)?.[1] ?? "").replace(/·.*/, ""), born: now });
    if (e.kind === "reroute" && !fx.oldPaths[e.podId]) {
      const orig = mission.pods.find((p) => p.id === e.podId);
      if (orig) fx.oldPaths[e.podId] = { path: orig.path, born: now };
    }
  }
}

function MapPane({ obsRef, fxRef, variant, title, sub, children }: {
  obsRef: MutableRefObject<Observation>; fxRef: MutableRefObject<Fx>; variant: Variant; title: string; sub: string; children?: React.ReactNode;
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
      drawMap(ctx, obsRef.current, { variant, width: w, height: h, time: t, fx: fxRef.current });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant, obsRef, fxRef]);
  return (
    <div className="echo-pane">
      <div className="echo-cap"><b>{title}</b><span>{sub}</span></div>
      <canvas ref={ref} />
      {children}
    </div>
  );
}

export function MissionScreen() {
  const world = useRef<World>(null as unknown as World);
  if (!world.current) world.current = makeWorld();
  const towerRef = useRef<Observation>(world.current.tower.observe());
  const echoRef = useRef<Observation>(world.current.echo.observe());
  const fxRef = useRef<Fx>(newFx());
  const historyRef = useRef<LogEvent[]>([]);
  const [snap, setSnap] = useState({ tower: towerRef.current, echo: echoRef.current });
  const q = new URLSearchParams(location.search); // ?run=1&speed=10 for screenshots
  const [running, setRunning] = useState(q.get("run") === "1");
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(SPEEDS.find((s) => s === Number(q.get("speed"))) ?? 10);
  const [note, setNote] = useState("");
  const speedRef = useRef(speed);
  speedRef.current = speed;

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
        collectFx(fx, historyRef.current, w.echo.observe(), w.mission, now);
      }
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

  const reset = useCallback(() => {
    world.current = makeWorld();
    towerRef.current = world.current.tower.observe();
    echoRef.current = world.current.echo.observe();
    fxRef.current = newFx();
    historyRef.current = [];
    setSnap({ tower: towerRef.current, echo: echoRef.current });
    setRunning(false);
    setNote("");
  }, []);

  const { tower, echo } = snap;
  const nurse = echo.pods.find((p) => p.id === DISPATCH_POD);
  const dispatch = () => {
    const w = world.current;
    const atTick = Math.max(DISPATCH_MIN_TICK, echo.tick + 1);
    const res = [w.tower, w.echo].map((e) => e.act({ type: "dispatchMedical", podId: DISPATCH_POD, atTick })); // same tick on both engines
    setNote(res.every((r) => r.ok) ? `Nurse Mara Vale dispatched for t+${atTick}` : `Dispatch refused: ${res.find((r) => !r.ok)?.reason}`);
  };

  return (
    <div className="echo-screen">
      <style>{css}</style>
      <div className="echo-main">
        <MapPane obsRef={towerRef} fxRef={fxRef} variant="tower" title="Directorate alone" sub="one tower clears every flight">
          <div className="echo-overlay"><TowerBanner obs={tower} /></div>
        </MapPane>
        <MapPane obsRef={echoRef} fxRef={fxRef} variant="echo" title="Echo" sub="every pod navigates, beacons relay, three rules" />
        <div className="echo-side">
          <div className="echo-panels">
            <EchoLog obs={echo} log={historyRef.current} />
            <Scoreboard obs={echo} normal={world.current.normal} />
          </div>
        </div>
      </div>
      <div className="echo-bar">
        <button onClick={() => (echo.over ? reset() : setRunning((r) => !r))}>{echo.over ? "Replay" : running ? "Pause" : "Run"}</button>
        {SPEEDS.map((s) => (
          <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>{s}×</button>
        ))}
        <button onClick={reset}>Reset</button>
        <button className="echo-dispatch" disabled={!nurse || nurse.status !== "scheduled" || echo.over} onClick={dispatch}>
          Dispatch Nurse Mara Vale
        </button>
        <span className="grow">{note}</span>
        <span>t+{echo.tick} / {echo.endTick}</span>
      </div>
      {echo.over && <EndCard tower={tower} echo={echo} normal={world.current.normal} onReplay={reset} />}
    </div>
  );
}

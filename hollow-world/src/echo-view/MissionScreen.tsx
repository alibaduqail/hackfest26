// Split screen on mock frames: left = Directorate-only placeholder, right = Echo.
// Swapped for two live engines in 2.1; both panes only ever read Observation.
import { useEffect, useMemo, useRef, useState } from "react";
import { mock } from "../echo/mock";
import type { Observation } from "../echo/types";
import { drawMap, type Variant } from "./map";

const css = `
html,body,#root{margin:0;height:100%;background:#0a1013;color:#cfe3e8;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
.echo-screen{display:flex;flex-direction:column;height:100%}
.echo-panes{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#1a272c;min-height:0}
.echo-pane{position:relative;background:#0a1013;min-width:0;min-height:0}
.echo-pane canvas{position:absolute;inset:0;width:100%;height:100%}
.echo-cap{position:absolute;left:14px;top:12px;z-index:1;pointer-events:none}
.echo-cap b{display:block;font-size:14px;letter-spacing:.04em}
.echo-cap span{color:#7f979f}
.echo-bar{display:flex;gap:12px;align-items:center;padding:8px 14px;border-top:1px solid #1a272c}
.echo-bar button{background:#14222a;color:#cfe3e8;border:1px solid #2a3d46;border-radius:4px;padding:5px 12px;font:inherit;cursor:pointer}
.echo-bar input{flex:1}
@media (max-width:760px){.echo-panes{grid-template-columns:1fr;grid-template-rows:1fr 1fr}}
`;

/** Left pane placeholder: the same world with the tower dead. Pods freeze where the tower left them. */
function towerView(frames: Observation[], i: number): Observation {
  const cur = frames[i];
  const freezeAt = frames.find((f) => f.tick >= f.towerDownAt + 4) ?? frames[frames.length - 1];
  if (cur.tick < freezeAt.tick) return { ...cur, mode: "tower", pulses: [] };
  return { ...freezeAt, mode: "tower", tick: cur.tick, pulses: [], sectors: freezeAt.sectors.map((s) => ({ ...s, sealed: cur.sectors.find((x) => x.id === s.id)!.sealed })) };
}

function MapPane({ obs, variant, title, sub }: { obs: Observation; variant: Variant; title: string; sub: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(obs);
  latest.current = obs;
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    let raf = 0;
    const loop = (t: number) => {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMap(ctx, latest.current, { variant, width: w, height: h, time: t });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [variant]);
  return (
    <div className="echo-pane">
      <div className="echo-cap"><b>{title}</b><span>{sub}</span></div>
      <canvas ref={ref} />
    </div>
  );
}

export function MissionScreen() {
  const frames = mock;
  const [i, setI] = useState(() => Math.min(frames.length - 1, Math.max(0, Number(new URLSearchParams(location.search).get("frame")) || 0))); // ?frame=N for screenshots
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (!play) return;
    const id = setInterval(() => setI((x) => (x + 1 < frames.length ? x + 1 : (setPlay(false), x))), 1400);
    return () => clearInterval(id);
  }, [play, frames.length]);
  const echo = frames[i];
  const tower = useMemo(() => towerView(frames, i), [frames, i]);
  const banner = !tower.towerUp ? `Banner: ${tower.score.towerClaimed} flights authorized · ${tower.score.realFlights} moving` : "Tower up · clearing flights";
  return (
    <div className="echo-screen">
      <style>{css}</style>
      <div className="echo-panes">
        <MapPane obs={tower} variant="tower" title="Directorate alone" sub={banner} />
        <MapPane obs={echo} variant="echo" title="Echo" sub={`${echo.log.at(-1)?.text ?? "tower up"}`} />
      </div>
      <div className="echo-bar">
        <button onClick={() => { if (!play && i >= frames.length - 1) setI(0); setPlay((p) => !p); }}>{play ? "Pause" : i >= frames.length - 1 ? "Replay" : "Run"}</button>
        <button onClick={() => { setPlay(false); setI((x) => Math.max(0, x - 1)); }}>◀</button>
        <button onClick={() => { setPlay(false); setI((x) => Math.min(frames.length - 1, x + 1)); }}>▶</button>
        <input type="range" min={0} max={frames.length - 1} value={i} onChange={(e) => { setPlay(false); setI(+e.target.value); }} aria-label="mock frame" />
        <span>tick {echo.tick}/{echo.endTick} · mock frame {i + 1}/{frames.length}</span>
      </div>
    </div>
  );
}

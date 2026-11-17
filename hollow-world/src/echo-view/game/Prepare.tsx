// Prepare: bolt beacons into tunnel sectors before the tower goes dark. Click a lane to toggle the sector under the cursor.
// Placement edits a copy of the mission's sectors; Begin hands a new Mission object to the run (the engines never see this screen).
import { useEffect, useRef, useState } from "react";
import type { Mission, Sector } from "../../echo/types";
import { drawMap, sectorAt } from "../map";
import { staticObs, type CampaignMission } from "./campaign";

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

/** A canvas that redraws every frame at the device pixel ratio. `draw` is read from a ref, so it can change every render. */
export function MapCanvas({ draw, label, onMove, onClick, onLeave }: {
  draw: Draw; label: string;
  onMove?: (x: number, y: number, w: number, h: number) => void;
  onClick?: (x: number, y: number, w: number, h: number) => void;
  onLeave?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext("2d")!;
    let raf = 0;
    const loop = (t: number) => {
      const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const at = (ev: React.MouseEvent<HTMLCanvasElement>, f?: (x: number, y: number, w: number, h: number) => void) => {
    const r = ev.currentTarget.getBoundingClientRect();
    f?.(ev.clientX - r.left, ev.clientY - r.top, r.width, r.height);
  };
  return <canvas ref={ref} className="g-canvas" role="img" aria-label={label} onMouseMove={(e) => at(e, onMove)} onClick={(e) => at(e, onClick)} onMouseLeave={onLeave} />;
}

const placedCount = (ss: Sector[]) => ss.filter((s) => s.beacon !== false).length;

export function Prepare({ cm, mission, onBegin, onBack }: { cm: CampaignMission; mission: Mission; onBegin: (m: Mission) => void; onBack: () => void }) {
  const budget = mission.beaconBudget ?? 0;
  const [sectors, setSectors] = useState<Sector[]>(() => structuredClone(mission.world.sectors));
  const [hover, setHover] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const placed = placedCount(sectors);
  const obs = staticObs(mission, sectors);
  const names = new Map(mission.world.cities.map((c) => [c.id, c.name]));
  const hovered = sectors.find((s) => s.id === hover);

  const toggle = (id: string) => {
    const s = sectors.find((x) => x.id === id);
    if (!s) return;
    const on = s.beacon !== false;
    if (!on && placed >= budget) return setNote("No beacons left. Remove one first.");
    setNote("");
    setSectors(sectors.map((x) => (x.id === id ? { ...x, beacon: !on } : x)));
  };

  return (
    <div className="g-screen g-prep">
      <div className="g-prep-bar">
        <div>
          <div className="g-kicker">Mission {cm.number} · prepare</div>
          <h2>{cm.name}</h2>
        </div>
        <div className="g-meter" aria-live="polite">
          <b className={placed > budget ? "over" : ""}>{placed} / {budget}</b>
          <div className="track" aria-hidden><div className="fill" style={{ width: `${Math.min(100, (placed / Math.max(1, budget)) * 100)}%` }} /></div>
          <span className="g-muted">beacons</span>
        </div>
        <span className="g-legend"><span><i />beacon</span><span><s />dead zone</span></span>
        <span style={{ flex: 1 }} className="g-muted">{note}</span>
        <div className="g-row">
          <button className="g-btn" onClick={onBack}>Back</button>
          <button className="g-btn" disabled={placed === 0} onClick={() => setSectors(sectors.map((s) => ({ ...s, beacon: false })))}>Clear all</button>
          <button className="g-btn primary" autoFocus disabled={placed > budget} onClick={() => onBegin({ ...mission, world: { ...mission.world, sectors } })}>
            Begin
          </button>
        </div>
      </div>
      <div className="g-prep-map">
        <MapCanvas
          label={`Tunnel map, ${placed} of ${budget} beacons placed`}
          draw={(ctx, w, h, t) => drawMap(ctx, obs, { variant: "echo", width: w, height: h, time: t, prepare: true, hover })}
          onMove={(x, y, w, h) => { const id = sectorAt(obs, w, h, x, y); if (id !== hover) setHover(id); }}
          onClick={(x, y, w, h) => { const id = sectorAt(obs, w, h, x, y); if (id) toggle(id); }}
          onLeave={() => setHover(null)}
        />
        <div className="g-prep-tip">
          {hovered
            ? `${names.get(hovered.from)} → ${names.get(hovered.to)} · section ${hovered.index + 1} · ${hovered.beacon !== false ? "beacon (click to remove)" : "dead zone (click to place)"}`
            : "Click a tunnel to bolt in a beacon. Each direction is its own tunnel. News only hops between beacons."}
        </div>
      </div>
    </div>
  );
}

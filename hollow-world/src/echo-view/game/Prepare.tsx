// Prepare: bolt beacons into tunnel sectors before the tower goes dark. Click a lane to toggle the sector under the cursor.
// Placement edits a copy of the mission's sectors; Begin hands a new Mission object to the run (the engines never see this screen).
import { useEffect, useRef, useState } from "react";
import type { Mission, Sector } from "../../echo/types";
import { hasBeacon, sealsOf } from "../../echo/engine";
import { findPath } from "../../echo/world";
import { drawMap, sectorAt, type Pop } from "../map";
import { play } from "./audio";
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

/** Dead tunnels (no beacon) on Mara's expected detour: MED-1's shortest route once the first seal is blocked. null = no MED-1. */
export function deadOnMaraRoute(m: Mission, sectors: Sector[]): number | null {
  const mara = m.pods.find((p) => p.id === "MED-1");
  if (!mara) return null;
  const route = findPath(mara.origin, mara.dest, new Set(sealsOf(m).slice(0, 1).map((x) => x.sectorId)), m.world) ?? mara.path;
  const dead = new Set(sectors.filter((s) => !hasBeacon(s)).map((s) => s.id));
  return route.filter((id) => dead.has(id)).length;
}

export function Prepare({ cm, mission, onBegin, onBack }: { cm: CampaignMission; mission: Mission; onBegin: (m: Mission) => void; onBack: () => void }) {
  const budget = mission.beaconBudget ?? 0;
  const [sectors, setSectors] = useState<Sector[]>(() => structuredClone(mission.world.sectors));
  const [hover, setHover] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [bump, setBump] = useState({ n: 0, kind: "bump" }); // remounts the counter to replay its animation
  const pops = useRef<Pop[]>([]); // wall-clock ms, read by the draw loop (no re-render needed)
  const placed = placedCount(sectors);
  const obs = staticObs(mission, sectors);
  const names = new Map(mission.world.cities.map((c) => [c.id, c.name]));
  const dead = deadOnMaraRoute(mission, sectors);
  const hovered = sectors.find((s) => s.id === hover);

  const toggle = (id: string) => {
    const s = sectors.find((x) => x.id === id);
    if (!s) return;
    const on = s.beacon !== false;
    if (!on && placed >= budget) {
      play("empty");
      setBump({ n: bump.n + 1, kind: "shake" });
      return setNote("No beacons left. Remove one first.");
    }
    setNote("");
    play(on ? "remove" : "place");
    setBump({ n: bump.n + 1, kind: "bump" });
    const now = performance.now();
    pops.current = [...pops.current.filter((p) => now - p.born < 700 && p.sectorId !== id), { sectorId: id, born: now, kind: on ? "remove" : "place" }];
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
          <b key={bump.n} className={`${placed > budget ? "over" : ""} ${bump.n ? bump.kind : ""}`}>{placed} / {budget}</b>
          <div className="track" aria-hidden><div className="fill" style={{ width: `${Math.min(100, (placed / Math.max(1, budget)) * 100)}%` }} /></div>
          <span className="g-muted">beacons</span>
        </div>
        <span className="g-legend"><span><i />beacon</span><span><s />dead zone</span></span>
        <span style={{ flex: 1 }} className="g-muted">{note}</span>
        <div className="g-row">
          <button className="g-btn" onClick={onBack}>Back</button>
          <button className="g-btn" disabled={placed === 0} onClick={() => { play("remove"); setSectors(sectors.map((s) => ({ ...s, beacon: false }))); }}>Clear all</button>
          <button className="g-btn primary" autoFocus disabled={placed > budget} onClick={() => onBegin({ ...mission, world: { ...mission.world, sectors } })}>
            Begin
          </button>
        </div>
      </div>
      <div className="g-prep-map">
        <MapCanvas
          label={`Tunnel map, ${placed} of ${budget} beacons placed`}
          draw={(ctx, w, h, t) => drawMap(ctx, obs, { variant: "echo", width: w, height: h, time: t, prepare: true, hover, pops: pops.current })}
          onMove={(x, y, w, h) => { const id = sectorAt(obs, w, h, x, y); if (id !== hover) setHover(id); }}
          onClick={(x, y, w, h) => { const id = sectorAt(obs, w, h, x, y); if (id) toggle(id); }}
          onLeave={() => setHover(null)}
        />
        {dead !== null && (
          <div className={`g-prep-route${dead > 0 ? " bad" : ""}`} aria-live="polite">
            Mara's route crosses <b>{dead === 0 ? "no" : dead}</b> dead {dead === 1 ? "tunnel" : "tunnels"}
          </div>
        )}
        <div className="g-prep-tip">
          {hovered
            ? `${names.get(hovered.from)} → ${names.get(hovered.to)} · section ${hovered.index + 1} · ${hovered.beacon !== false ? "beacon (click to remove)" : "dead zone (click to place)"}`
            : cm.prepTip ?? "Click a tunnel to bolt in a beacon. Each direction is its own tunnel. News only hops between beacons."}
        </div>
      </div>
    </div>
  );
}

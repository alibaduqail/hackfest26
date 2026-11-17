// Title: the dark tunnel map with a scatter of beacons pulsing slowly behind the name.
import { useMemo } from "react";
import { towerDown } from "../../echo/missions";
import { drawMap, lane, makeProjection } from "../map";
import { staticObs } from "./campaign";
import { MapCanvas } from "./Prepare";

const PERIOD = 4200; // ms per beacon ring

export function Title({ onBegin, onMissions }: { onBegin: () => void; onMissions: () => void }) {
  const obs = useMemo(() => {
    const m = towerDown();
    return staticObs(m, m.world.sectors.map((s, i) => ({ ...s, beacon: i % 3 === 0 }))); // a third of the tunnels lit
  }, []);
  const lit = useMemo(() => obs.sectors.filter((s, i) => s.beacon && i % 4 === 0), [obs]);
  return (
    <div className="g-screen g-title">
      <MapCanvas
        label="The tunnel map of the Hollow, with beacons pulsing"
        draw={(ctx, w, h, t) => {
          drawMap(ctx, obs, { variant: "echo", width: w, height: h, time: t });
          const project = makeProjection(obs, w, h);
          lit.forEach((s, i) => {
            const life = ((t + i * 977) % PERIOD) / PERIOD;
            const [a, b] = lane(project, s);
            ctx.strokeStyle = "#f2b84b";
            ctx.globalAlpha = 0.5 * (1 - life);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 3 + life * 22, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
          });
        }}
      />
      <h1>ECHO</h1>
      <div className="sub">when the tower goes dark</div>
      <div className="g-row">
        <button className="g-btn primary" autoFocus onClick={onBegin}>Begin</button>
        <button className="g-btn" onClick={onMissions}>Missions</button>
      </div>
      <div className="foot">A fallback for the Hollow, when the Directorate's tower fails.</div>
    </div>
  );
}

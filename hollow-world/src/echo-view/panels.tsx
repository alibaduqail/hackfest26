// Echo side panels. Props in, JSX out: reads only Observation (no engine, timers or fetch).
import { useEffect, useRef } from "react";
import type { Observation } from "../echo/types";

const mm = (t: number) => `t+${String(t).padStart(2, "0")}`;

export function TowerBanner({ obs }: { obs: Observation }) {
  const s = obs.score;
  return (
    <section className={`echo-card echo-tower ${obs.towerUp ? "echo-tower-up" : "echo-tower-down"}`}>
      <h3 className="echo-title">Directorate tower</h3>
      {obs.towerUp ? (
        <div className="echo-tower-online">tower online</div>
      ) : (
        <div className="echo-tower-lie">
          <div className="echo-claimed">{s.towerClaimed} flights authorized</div>
          <div className="echo-real">{s.realFlights} actually moving</div>
        </div>
      )}
    </section>
  );
}

export function EchoLog({ obs }: { obs: Observation }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [obs.log.length]);
  return (
    <section className="echo-card echo-logcard">
      <h3 className="echo-title">Echo log</h3>
      <ul className="echo-log" ref={ref}>
        {obs.log.map((e, i) => (
          <li key={i} className={`echo-line log-${e.kind}`}>
            <span className="echo-time">{mm(e.tick)}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Scoreboard({ obs, normal }: { obs: Observation; normal?: Observation }) {
  const s = obs.score;
  const ratio = normal && normal.score.passengerDelayMin > 0 && s.passengerDelayMin > 0 ? s.passengerDelayMin / normal.score.passengerDelayMin : null;
  return (
    <section className="echo-card echo-score">
      <h3 className="echo-title">Scoreboard</h3>
      <div className="echo-stat echo-medical">
        <b>{s.nursesArrived}/{s.nursesTotal}</b>
        <span>nurses arrived</span>
      </div>
      <div className="echo-stat">
        <b>{s.suppliesDelivered}/{s.suppliesTotal}</b>
        <span>supplies delivered</span>
      </div>
      <div className="echo-stat">
        <b>{s.passengerDelayMin} min</b>
        <span>passenger delay{` · ${ratio !== null ? `${ratio.toFixed(1)}x` : "—"} normal day`}</span>
      </div>
      <div className="echo-stat">
        <b>{Math.round(s.capacityPct)}%</b>
        <span>network capacity vs a normal day</span>
      </div>
      <div className="echo-stat">
        <b>{s.realFlights} vs {s.towerClaimed}</b>
        <span>real vs claimed flights</span>
      </div>
    </section>
  );
}

export default function Panels({ obs, normal }: { obs: Observation; normal?: Observation }) {
  return (
    <div className="echo-panels">
      <TowerBanner obs={obs} />
      <EchoLog obs={obs} />
      <Scoreboard obs={obs} normal={normal} />
    </div>
  );
}

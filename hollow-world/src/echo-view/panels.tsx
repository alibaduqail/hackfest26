// Echo side panels. Props in, JSX out: reads only Observation (no engine, timers or fetch).
import { useEffect, useRef, useState } from "react";
import type { LogEvent, Observation } from "../echo/types";

const mm = (t: number) => `t+${String(t).padStart(2, "0")}`;

export function TowerBanner({ obs }: { obs: Observation }) {
  const s = obs.score;
  return (
    <section className={`echo-card d-panel echo-tower ${obs.towerUp ? "echo-tower-up" : "echo-tower-down"}`}>
      <h3 className="echo-title"><i className="echo-dot" />Directorate tower is {obs.towerUp ? "online" : "offline"}</h3>
      {obs.towerUp ? (
        <div className="echo-tower-online">clearing every flight</div>
      ) : (
        <div className="echo-tower-lie">
          <div className="echo-claimed">{s.towerClaimed} pod runs authorized</div>
          <div className="echo-real">{s.realFlights} actually moving</div>
        </div>
      )}
    </section>
  );
}

/** The Echo pane's counterpart to the tower banner: the same number, kept honest by the beacons. */
export function EchoBanner({ obs }: { obs: Observation }) {
  const beacons = obs.sectors.filter((x) => x.beacon !== false).length;
  return (
    <section className="echo-card d-panel echo-echo">
      <h3 className="echo-title"><i className="echo-dot" />Echo network is {obs.towerUp ? "idle" : "carrying the load"}</h3>
      <div className="echo-tower-lie">
        <div className="echo-real echo-good">{obs.score.realFlights} flights moving</div>
        <div className="echo-sub">{beacons} beacons relaying, no tower needed</div>
      </div>
    </section>
  );
}

const KEY_KINDS = new Set<LogEvent["kind"]>(["tower-down", "seal", "seal-heard", "reroute", "yield", "arrive", "credential-reject"]);
const isKey = (e: LogEvent) => KEY_KINDS.has(e.kind) || (e.kind === "claim" && !!e.podId?.startsWith("MED")); // medical claims

/** `log` overrides obs.log (the engine keeps only the newest 60), so key events do not scroll away. */
export function EchoLog({ obs, log }: { obs: Observation; log?: LogEvent[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [all, setAll] = useState(false);
  const events = (log ?? obs.log).filter((e) => all || isKey(e));
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);
  return (
    <section className="echo-card d-panel echo-logcard">
      <h3 className="echo-title echo-logtitle">
        Echo log
        <span className="d-toggle" role="group" aria-label="Log filter">
          <button type="button" className="d-btn d-btn--secondary" aria-pressed={!all} onClick={() => setAll(false)}>Key moments</button>
          <button type="button" className="d-btn d-btn--secondary" aria-pressed={all} onClick={() => setAll(true)}>All events</button>
        </span>
      </h3>
      {events.length === 0 && <p className="echo-empty">Nothing yet. Press Run and key moments appear here: tower loss, seals, yields, reroutes.</p>}
      <ul className="echo-log" ref={ref}>
        {events.map((e, i) => (
          <li key={`${e.tick}-${i}`} className={`echo-line log-${e.kind}`}>
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
    <section className="echo-card d-panel echo-score">
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
        <span>passenger delay, {ratio !== null ? `${ratio.toFixed(1)}x` : "—"} a normal day</span>
      </div>
      <div className="echo-stat">
        <b>{Math.round(s.capacityPct)}%</b>
        <span>of normal-day capacity</span>
      </div>
      <div className="echo-stat">
        <b>{s.realFlights} vs {s.towerClaimed}</b>
        <span>flying vs claimed by tower</span>
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

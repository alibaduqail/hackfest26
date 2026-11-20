// Echo side panels. Props in, JSX out: reads only Observation (no engine, timers or fetch).
import { useEffect, useRef, useState } from "react";
import { RelayBar } from "./relay/Relay";
import { plainLog } from "./cutaway/live/names";
import type { LogEvent, Observation } from "../echo/types";

const mm = (t: number) => `t+${String(t).padStart(2, "0")}`;

export function TowerBanner({ obs }: { obs: Observation }) {
  const s = obs.score;
  return (
    <section className={`echo-card echo-tower ${obs.towerUp ? "echo-tower-up" : "echo-tower-down"}`}>
      <h3 className="echo-title"><i className="echo-dot" />Directorate tower is {obs.towerUp ? "on" : "off"}</h3>
      {obs.towerUp ? (
        <div className="echo-tower-online">clears every pod</div>
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
    <section className="echo-card echo-echo">
      <h3 className="echo-title"><i className="echo-dot" />Echo network is {obs.towerUp ? "idle" : "carrying the load"}</h3>
      <div className="echo-tower-lie">
        <div className="echo-real echo-good">{obs.score.realFlights} pods moving</div>
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
    <section className="echo-card echo-logcard">
      <h3 className="echo-title echo-logtitle">
        Echo log
        <RelayBar size="sm" label="Log filter" value={all ? "all" : "key"} items={[
          { key: "key", label: "Key moments", onSelect: () => setAll(false) },
          { key: "all", label: "All events", onSelect: () => setAll(true) },
        ]} />
      </h3>
      {events.length === 0 && <p className="echo-empty">Nothing yet. Press Run and key moments appear here: tower loss, floods, who goes first, new routes.</p>}
      <ul className="echo-log" ref={ref}>
        {events.map((e, i) => (
          <li key={`${e.tick}-${i}`} className={`echo-line log-${e.kind}`}>
            <span className="echo-time">{mm(e.tick)}</span>
            <span>{plainLog(e.text)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Tower vs Echo, one row per measure. `tower` is the tower-only run of the same mission; without it the Tower column shows a dash. */
export function Scoreboard({ obs, tower }: { obs: Observation; tower?: Observation; normal?: Observation }) {
  const e = obs.score, t = tower?.score;
  const rows: [label: string, tower: string, echo: string][] = [
    ["Moving", t ? String(t.realFlights) : "—", String(e.realFlights)],
    ["Nurses", t ? `${t.nursesArrived}/${t.nursesTotal}` : "—", `${e.nursesArrived}/${e.nursesTotal}`],
    ["Supplies", t ? `${t.suppliesDelivered}/${t.suppliesTotal}` : "—", `${e.suppliesDelivered}/${e.suppliesTotal}`],
    ["Delay min", t ? String(t.passengerDelayMin) : "—", String(e.passengerDelayMin)],
    ["Capacity", t ? `${Math.round(t.capacityPct)}%` : "—", `${Math.round(e.capacityPct)}%`],
  ];
  return (
    <section className="echo-card echo-score">
      <h3 className="echo-title">Scoreboard</h3>
      <div className="echo-sb" role="table" aria-label="Tower versus Echo">
        <span />
        <span className="echo-sb-h echo-sb-tower" role="columnheader">Tower</span>
        <span className="echo-sb-h echo-sb-echo" role="columnheader">Echo</span>
        {rows.map(([label, a, c]) => (
          <div key={label} className="echo-sb-row" role="row">
            <span className="echo-sb-l" role="rowheader">{label}</span>
            <b className="echo-sb-tower" role="cell">{a}</b>
            <b className="echo-sb-echo" role="cell">{c}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Panels({ obs, tower, normal }: { obs: Observation; tower?: Observation; normal?: Observation }) {
  return (
    <div className="echo-panels">
      <TowerBanner obs={obs} />
      <EchoLog obs={obs} />
      <Scoreboard obs={obs} tower={tower} normal={normal} />
    </div>
  );
}

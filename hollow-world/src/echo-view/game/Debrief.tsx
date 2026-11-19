import { useEffect, useState } from "react";
import type { Observation } from "../../echo/types";
import { RelayBar } from "../relay/Relay";
import { play } from "./audio";
import type { CampaignMission } from "./campaign";
import { Objectives } from "./Briefing";

const STAR_GAP_MS = 250;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The earned stars light up one by one (a pop and a ping each); with reduced motion they are simply there. */
function StarReveal({ n, of = 3 }: { n: number; of?: number }) {
  const [shown, setShown] = useState(() => (reduced() ? n : 0));
  useEffect(() => {
    const ids = Array.from({ length: n }, (_, i) => setTimeout(() => { setShown(i + 1); play("star", i); }, 350 + i * STAR_GAP_MS));
    return () => ids.forEach(clearTimeout);
  }, [n]);
  return (
    <span className="g-stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={i < shown ? "lit" : "off"} aria-hidden>★</span>)}
    </span>
  );
}

export interface RunResult { tower: Observation; echo: Observation; normal: Observation }

const arrival = (o: Observation) => { const t = o.pods.find((p) => p.id === "MED-1")?.arriveTick; return t == null ? "never" : `t+${t}`; };

export function Debrief({ cm, result, onRetry, onNext, nextLabel = "Next mission", onMissions }: {
  cm: CampaignMission; result: RunResult; onRetry: () => void; onNext?: () => void; nextLabel?: string; onMissions: () => void;
}) {
  const { tower, echo, normal } = result;
  const met = cm.objectives.map((o) => o.met(echo, normal));
  const stars = met.filter(Boolean).length;
  const t = tower.score, e = echo.score, n = normal.score;
  const x = (s: number) => (n.passengerDelayMin > 0 ? `${(s / n.passengerDelayMin).toFixed(1)}×` : "—");
  const rows: [string, string, string][] = [
    ["Mara arrives", arrival(tower), arrival(echo)],
    ["Nurses arrived", `${t.nursesArrived}/${t.nursesTotal}`, `${e.nursesArrived}/${e.nursesTotal}`],
    ["Supply runs", `${t.suppliesDelivered}/${t.suppliesTotal}`, `${e.suppliesDelivered}/${e.suppliesTotal}`],
    ["Passenger delay", x(t.passengerDelayMin), x(e.passengerDelayMin)],
    ["Network capacity", `${t.capacityPct}%`, `${e.capacityPct}%`],
  ];
  return (
    <div className="g-screen g-fp g-fp-debrief">
      <section className="fp-left" aria-label={cm.name}>
        <p className="fp-kicker">{cm.name} · t+{echo.endTick}</p>
        <StarReveal n={stars} />
        <RelayBar className="fp-bar" size="lg" label="After the mission" items={[
          { key: "missions", label: "Missions", nav: true, onSelect: onMissions },
          { key: "retry", label: "Retry", tone: onNext ? "secondary" : "primary", nav: true, autoFocus: !onNext, onSelect: onRetry },
          ...(onNext ? [{ key: "next", label: nextLabel, tone: "primary" as const, nav: true, autoFocus: true, onSelect: onNext }] : []),
        ]} />
      </section>
      <div className="fp-right">
        <Objectives cm={cm} met={met} />
        <table className="fp-ledger">
          <thead><tr><th scope="col"><span className="g-sr">Figure</span></th><th scope="col">Directorate</th><th scope="col">Echo</th></tr></thead>
          <tbody>{rows.map(([k, a, b]) => <tr key={k}><th scope="row">{k}</th><td>{a}</td><td className="echo">{b}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

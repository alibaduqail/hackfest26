// End card: the Directorate-alone run next to the Echo run, plus the honest cost. Props in, Observation only, no engine imports.
// Mount it over the split screen when `echo.over`; `normal` is the final observation of the normal-day run.
import type { ReactNode } from "react";
import type { Observation } from "../echo/types";

const css = `
.echo-end{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;background:var(--bg);color:var(--text);font:15px var(--sans)}
.echo-end h2{margin:0;font:700 34px/1 var(--sign);letter-spacing:.02em}
.echo-end-grid{--cut:18px;--face-a:#182a31;--face-b:#142228;padding:22px 34px;display:grid;grid-template-columns:minmax(0,auto) repeat(2,minmax(0,300px));gap:14px 40px;align-items:baseline}
.echo-end-grid .h{color:var(--text2);font:600 22px/1 var(--sign);letter-spacing:.02em}
.echo-end-grid .l{color:var(--text2)}
.echo-end-grid .v{font:700 50px/1.05 var(--sign)}
.echo-end-grid .v.sm{font-size:30px;white-space:nowrap}
.echo-end-grid .bad{color:var(--red)}
.echo-end-grid .good{color:var(--good)}
.echo-end-note{max-width:760px;text-align:center;color:var(--text2);line-height:1.5}
`;

export function EndCard({ tower, echo, normal, onReplay, title = "Tower Down", top, children }: {
  tower: Observation; echo: Observation; normal: Observation; onReplay?: () => void;
  title?: string; top?: ReactNode; children?: ReactNode; // the game's debrief adds stars (top) and its buttons (children)
}) {
  const t = tower.score, e = echo.score, n = normal.score;
  const ratio = (s: number) => (n.passengerDelayMin > 0 ? `${(s / n.passengerDelayMin).toFixed(1)}× normal day` : "—");
  const row = (label: string, a: string, b: string, small = false) => (
    <>
      <div className="l">{label}</div>
      <div className={`v bad${small ? " sm" : ""}`}>{a}</div>
      <div className={`v good${small ? " sm" : ""}`}>{b}</div>
    </>
  );
  return (
    <div className="echo-end">
      <style>{css}</style>
      <h2>{title}, t+{echo.endTick}</h2>
      {top}
      <div className="echo-end-grid">
        <div />
        <div className="h">Directorate alone</div>
        <div className="h">Echo</div>
        {row("Nurses arrived", `${t.nursesArrived}/${t.nursesTotal}`, `${e.nursesArrived}/${e.nursesTotal}`)}
        {row("Water, food, medicine delivered", `${t.suppliesDelivered}/${t.suppliesTotal}`, `${e.suppliesDelivered}/${e.suppliesTotal}`)}
        {row("Flights moving vs claimed", `${t.realFlights} of ${t.towerClaimed}`, `${e.realFlights}`, true)}
        {row("Passenger delay", ratio(t.passengerDelayMin), ratio(e.passengerDelayMin), true)}
        {row("Network capacity vs normal day", `${t.capacityPct}%`, `${e.capacityPct}%`, true)}
      </div>
      <div className="echo-end-note">
        Echo costs time: passengers wait {n.passengerDelayMin > 0 ? `${(e.passengerDelayMin / n.passengerDelayMin).toFixed(1)}× as long as` : "longer than"} on a normal day and the network runs at {e.capacityPct}% of normal. Echo is a fallback protocol, not a replacement for the tower. Nurse credentials are a simulated signature.
      </div>
      {onReplay && <button className="hw-btn lg primary" onClick={onReplay}>Replay</button>}
      {children}
    </div>
  );
}

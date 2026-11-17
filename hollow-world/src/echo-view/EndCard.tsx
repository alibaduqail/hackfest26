// End card: the Directorate-alone run next to the Echo run, plus the honest cost. Props in, Observation only, no engine imports.
// Mount it over the split screen when `echo.over`; `normal` is the final observation of the normal-day run.
import type { Observation } from "../echo/types";

const css = `
.echo-end{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;background:rgba(6,10,12,.94);color:#cfe3e8;font:15px ui-monospace,SFMono-Regular,Menlo,monospace}
.echo-end h2{margin:0;font-size:22px;letter-spacing:.06em;font-weight:600}
.echo-end-grid{display:grid;grid-template-columns:minmax(0,auto) repeat(2,minmax(0,300px));gap:14px 40px;align-items:baseline}
.echo-end-grid .h{color:#7f979f;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.echo-end-grid .l{color:#9fb6bd}
.echo-end-grid .v{font-size:44px;line-height:1.1;font-weight:600}
.echo-end-grid .v.sm{font-size:24px;white-space:nowrap}
.echo-end-grid .bad{color:#ff5a52}
.echo-end-grid .good{color:#45d1c4}
.echo-end-note{max-width:760px;text-align:center;color:#7f979f;line-height:1.5}
.echo-end button{background:#14222a;color:#cfe3e8;border:1px solid #2a3d46;border-radius:4px;padding:6px 16px;font:inherit;cursor:pointer}
`;

export function EndCard({ tower, echo, normal, onReplay }: { tower: Observation; echo: Observation; normal: Observation; onReplay?: () => void }) {
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
      <h2>TOWER DOWN · t+{echo.endTick}</h2>
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
      {onReplay && <button onClick={onReplay}>Replay</button>}
    </div>
  );
}

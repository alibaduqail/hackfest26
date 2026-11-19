// End panel for the live Descent: stars, the cause chain, Tower / No beacons / You, the next-star hint. Pure render from props; the
// three baseline runs and the explanation come from src/echo (runBaseline, explainRun). Mounted by LiveScreen (see WIRING-INTRO-DEBRIEF.md).
import { useMemo } from "react";
import { runBaseline, type RunOutcome } from "../../../echo/baseline";
import { explainRun } from "../../../echo/explain";
import type { Command, Mission } from "../../../echo/types";
import { displayLocations } from "../run";

export interface LiveDebriefProps {
  mission: Mission;
  commands: Command[]; // the player's accepted command log (the save)
  stars: 0 | 1 | 2 | 3;
  onRetry: () => void;
  onNext?: () => void; // next level; the button is hidden when omitted
  onWatchSolution?: () => void;
}

const when = (t: number | null) => (t === null ? "never" : `minute ${t}`);
const isMargin = (l: string) => /^(Next star|Best possible)/.test(l);

function nextStep(stars: number, o: RunOutcome): string | null {
  if (stars >= 3) return null;
  if (stars === 0) return o.mara === null ? "Put beacons on the flooding shaft and the link before it, before the flood lands." : "Light Mara's route so she is not waiting blind.";
  return "Beacon the relay track early to cut blind waits.";
}

export function LiveDebrief({ mission, commands, stars, onRetry, onNext, onWatchSolution }: LiveDebriefProps) {
  const base = useMemo(() => runBaseline(mission, commands), [mission, commands]);
  const lines = useMemo(() => explainRun(base.you.log, mission).map((l) => displayLocations(l).replace(/^./, (c) => c.toUpperCase())), [base, mission]);
  const why = lines.filter((l) => !isMargin(l));
  const margin = lines.find(isMargin);
  const hint = nextStep(stars, base.you);
  const cols: [string, RunOutcome, string][] = [["Tower", base.tower, "tower"], ["No beacons", base.none, "none"], ["You", base.you, "you"]];
  return (
    <section className="live-debrief live-debrief2" aria-label="Run result">
      <div className="eyebrow">RUN COMPLETE</div>
      <h2>{stars ? "Clinic supplied" : "Deadline missed"}</h2>
      <p className="live-stars" aria-label={stars + " of 3 stars"}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</p>
      {margin && <p className="live-margin">{margin}</p>}
      <h3>What happened</h3>
      <ol className="live-why">{why.map((l) => <li key={l}>{l}</li>)}</ol>
      <h3>The same run, three ways</h3>
      <table className="live-compare">
        <thead><tr><th scope="col" /> {cols.map(([n, , k]) => <th key={k} scope="col" className={k === "you" ? "you" : ""}>{n}</th>)}</tr></thead>
        <tbody>
          {([["Nurse Mara", "mara"], ["Medicine", "medicine"]] as const).map(([label, key]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {cols.map(([, o, k]) => <td key={k} className={(k === "you" ? "you " : "") + (o[key] === null ? "never" : "")}>{when(o[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="live-tower-says">{base.towerSays}</p>
      {hint && <p className="live-next"><strong>Next star:</strong> {hint}</p>}
      {stars >= 3 && <p className="live-next"><strong>Best possible run.</strong></p>}
      <div className="live-button-row">
        <button className="live-primary" onClick={onRetry} autoFocus>Retry <kbd>R</kbd></button>
        {onNext && <button onClick={onNext}>Next level</button>}
        {onWatchSolution && <button onClick={onWatchSolution}>Watch the solution</button>}
      </div>
    </section>
  );
}

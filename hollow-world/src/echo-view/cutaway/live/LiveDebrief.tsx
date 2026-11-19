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
  onRetry?: () => void; // hidden when omitted (journey mode after a win)
  onNext?: () => void; // next level; the button is hidden when omitted
  onWatchSolution?: () => void;
  onContinue?: () => void; // journey mode after a leg without a star: move on anyway ("Continue anyway")
  retryLabel?: string; // journey mode: "Retry leg" (and the R key is then LiveScreen's)
  nextLabel?: string; // journey mode: "Continue the journey"
  endReason?: string; // why the run ended (observation.endReason), shown under the result
  note?: string; // a line above the buttons (the cost of a retry)
}

const when = (t: number | null) => (t === null ? "never" : `minute ${t}`);
const isMargin = (l: string) => /^(Next star|Best possible)/.test(l);

/** The dark sections on Mara's route, named in plain words: where she waited blind, else (she never got through) the unlit sections of her planned path, the flooded one first. */
function darkSections(mission: Mission, commands: Command[], o: RunOutcome): string[] {
  const placed = new Set(commands.flatMap((c) => (c.type === "placeBeacon" ? [c.sectorId] : [])));
  const dark = (id: string) => mission.world.sectors.find((s) => s.id === id)?.beacon === false && !placed.has(id);
  const mara = mission.pods.find((p) => p.nurse);
  const blind = [...new Set(o.log.filter((l) => l.kind === "blind" && l.podId === mara?.id && l.sectorId && dark(l.sectorId)).map((l) => l.sectorId!))];
  const planned = (mara?.path ?? []).filter(dark);
  const flood = o.mara === null && mission.sealSectorId && planned.includes(mission.sealSectorId) ? [mission.sealSectorId] : []; // the flooded shaft only matters when the news never reached her
  return [...new Set([...flood, ...(blind.length ? blind : planned)])].slice(0, 3);
}

function nextStep(stars: number, mission: Mission, commands: Command[], o: RunOutcome): string | null {
  if (stars >= 3) return null;
  const names = darkSections(mission, commands, o).map((id) => displayLocations(id));
  if (names.length) return `Light ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}.`;
  return stars === 0 ? "Light Mara's route." : "Beat the next deadline.";
}

export function LiveDebrief({ mission, commands, stars, onRetry, onNext, onWatchSolution, onContinue, retryLabel = "Retry", nextLabel = "Next level", endReason, note }: LiveDebriefProps) {
  const base = useMemo(() => runBaseline(mission, commands), [mission, commands]);
  const lines = useMemo(() => explainRun(base.you.log, mission).map((l) => displayLocations(l).replace(/^./, (c) => c.toUpperCase())), [base, mission]);
  const why = lines.filter((l) => !isMargin(l));
  const margin = lines.find(isMargin);
  const hint = nextStep(stars, mission, commands, base.you);
  const headline = stars ? "Clinic supplied" : base.you.mara !== null ? "Not fast enough" : "Deadline missed"; // never "missed" for a run that reached the clinic
  const cols: [string, RunOutcome, string][] = [["Tower", base.tower, "tower"], ["No beacons", base.none, "none"], ["You", base.you, "you"]];
  return (
    <section className="live-debrief live-debrief2" aria-label="Run result">
      <div className="eyebrow">RUN COMPLETE</div>
      <h2>{headline}</h2>
      {endReason && <p className="live-end-reason">{endReason}</p>}
      <p className="live-stars" aria-label={stars + " of 3 stars"}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</p>
      {margin && <p className="live-margin">{margin}</p>}
      <h3>What happened</h3>
      <ol className="live-why">{why.map((l) => <li key={l}>{l}</li>)}</ol>
      <h3>The same run, three ways</h3>
      <table className="live-compare">
        <thead><tr><th scope="col" />{cols.map(([n, , k]) => <th key={k} scope="col" className={k === "you" ? "you" : ""}>{n}</th>)}</tr></thead>
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
      {note && <p className="live-next">{note}</p>}
      <div className="live-button-row">
        {onRetry && <button className="live-primary" onClick={onRetry} autoFocus={!onNext}>{retryLabel} <kbd>R</kbd></button>}
        {onNext && <button className="live-primary" onClick={onNext} autoFocus>{nextLabel}</button>}
        {onContinue && <button onClick={onContinue}>Continue anyway</button>}
        {onWatchSolution && <button onClick={onWatchSolution}>Watch the solution</button>}
      </div>
    </section>
  );
}

// End of a Descent run, as a quiet overlay on the art: the verdict and the stars on the left, the race down the shaft beside it (tower,
// tower + backup, no beacons, you), one plain "Next star" line, Relay actions. Pure render from props; the baseline runs and the explanation
// come from src/echo (runBaseline, explainRun). The race is decorative; a visually hidden table carries the same numbers for screen readers.
import { useMemo } from "react";
import { runBaseline, type RunOutcome } from "../../../echo/baseline";
import { explainRun } from "../../../echo/explain";
import { STANDBY_AFTER } from "../../../echo/tower";
import type { Command, Mission } from "../../../echo/types";
import { RelayBar, type RelayItem } from "../../relay/Relay";
import { LiveRace, type RaceColumn } from "./LiveRace";
import { placeName, plainText } from "./names";

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
  replay?: boolean; // "Watch the solution" playback: no stars, no credit, no next-level; only a way back to play
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
  const names = darkSections(mission, commands, o).map((id) => placeName(id));
  if (names.length) return `Light ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}.`;
  return stars === 0 ? "Light Mara's route." : "Beat the next deadline.";
}

export function LiveDebrief({ mission, commands, stars, onRetry, onNext, onWatchSolution, onContinue, retryLabel = "Retry", nextLabel = "Next level", endReason, note, replay = false }: LiveDebriefProps) {
  const base = useMemo(() => runBaseline(mission, commands), [mission, commands]);
  const lines = useMemo(() => explainRun(base.you.log, mission).map((l) => plainText(l).replace(/^./, (c) => c.toUpperCase())), [base, mission]);
  const why = lines.filter((l) => !isMargin(l));
  const margin = lines.find(isMargin);
  const hint = nextStep(stars, mission, commands, base.you);
  const headline = stars ? "Clinic supplied" : base.you.mara !== null ? "Not fast enough" : "Deadline missed"; // never "missed" for a run that reached the clinic
  const descent = /^descent/.test(mission.id); // the backup-tower column only means something on the Descent levels
  const cols: [string, RunOutcome, string][] = [["Tower", base.tower, "tower"], ...(descent ? [["Tower + backup", base.standby, "standby"] as [string, RunOutcome, string]] : []), ["No beacons", base.none, "none"], ["You", base.you, "you"]];
  const race: RaceColumn[] = [
    { id: "tower", head: ["tower", "only"], run: base.tower },
    ...(descent ? [{ id: "standby", head: ["tower +", "backup"], run: base.standby }] : []),
    { id: "none", head: ["no", "beacons"], run: base.none },
    { id: "you", head: ["you"], run: base.you, you: true },
  ];
  const city = (id?: string) => mission.world.cities.find((c) => c.id === id)?.name ?? "";
  const nurse = mission.pods.find((p) => p.nurse);
  const items: RelayItem[] = [
    ...(onNext && !replay ? [{ key: "next", label: nextLabel, tone: "primary" as const, onSelect: onNext, autoFocus: true }] : []),
    ...(onRetry ? [{ key: "retry", label: retryLabel, tone: (onNext && !replay ? "secondary" : "primary") as RelayItem["tone"], onSelect: onRetry, autoFocus: !(onNext && !replay) }] : []),
    ...(onWatchSolution ? [{ key: "solution", label: "Watch the solution", onSelect: onWatchSolution }] : []),
    ...(onContinue && !replay ? [{ key: "continue", label: "Continue anyway", tone: "quiet" as const, onSelect: onContinue }] : []),
  ];
  return (
    <section className={"live-debrief" + (replay ? " replay" : stars ? " won" : " lost")} aria-label="Run result">
      <div className="lv-dl">
        <p className="lv-verdict">Run complete</p>
        <h2>{headline}</h2>
        {replay
          ? <p className="live-stars live-replay-tag">Solution replay</p>
          : <p className="live-stars" aria-label={stars + " of 3 stars"}>{[0, 1, 2].map((i) => <span key={i} className={i < stars ? "lit" : "off"} style={{ animationDelay: i * 180 + "ms" }}>★</span>)}</p>}
        {endReason && <p className="live-end-reason">{endReason}</p>}
        {margin && !replay && <p className="live-margin">{margin}</p>}
        {hint && !replay && <p className="live-next"><strong>Next star:</strong> {hint}</p>}
        {stars >= 3 && !replay && !margin && <p className="live-next"><strong>Best possible run.</strong></p>}
        {note && <p className="live-note">{note}</p>}
        {items.length > 0 && <div className="lv-actions"><RelayBar items={items} label="After the run" /></div>}
        {onRetry && <p className="lv-key"><kbd>R</kbd> {retryLabel.toLowerCase()}</p>}
        <details className="lv-why">
          <summary>What happened</summary>
          <ol className="live-why">{why.map((l) => <li key={l}>{l}</li>)}</ol>
        </details>
      </div>
      <div className="lv-dr">
        <LiveRace cols={race} from={city(nurse?.origin)} to={city(nurse?.dest)} />
        <p className="live-tower-says">{base.towerSays}</p>
        {descent && <p className="live-tower-says">Backup tower back at min {mission.towerDownAt + STANDBY_AFTER} · no flood news reaches it</p>}
      </div>
      <table className="live-compare sr">
        <caption>The same run, {cols.length === 4 ? "four" : "three"} ways</caption>
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
    </section>
  );
}

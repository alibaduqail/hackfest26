// End of a Descent run, as a quiet overlay on the art (type and Relay actions as camp and missions): the verdict, stars, the cause chain
// and next-star hint on the left, the race down the shaft (tower, tower + backup, no beacons, you) on the right, the same numbers in a
// visually hidden table. Pure render from props; the
// three baseline runs and the explanation come from src/echo (runBaseline, explainRun). Mounted by LiveScreen (see WIRING-INTRO-DEBRIEF.md).
import { useMemo } from "react";
import type { RunOutcome } from "../../../echo/baseline";
import { STANDBY_AFTER } from "../../../echo/tower";
import { explainRun } from "../../../echo/explain";
import type { Command, Mission } from "../../../echo/types";
import { analyzeRun, darkSections } from "./cause";
import { placeName, plainLog } from "./names";
import { RelayBar, type RelayItem } from "../../relay/Relay";
import { LiveRace, type RaceColumn } from "./LiveRace";

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
  failed?: boolean; // journey mode: a leg without a star is a failed leg, even when Mara did reach the clinic (late)
  replay?: boolean; // "Watch the solution" playback: no stars, no credit, no next-level; only a way back to play
}

const when = (t: number | null) => (t === null ? "never" : `minute ${t}`);
const isMargin = (l: string) => /^(Next star|Best possible)/.test(l);

function nextStep(stars: number, mission: Mission, commands: Command[], o: RunOutcome): string | null {
  if (stars >= 3) return null;
  const names = darkSections(mission, commands, o.log, o.mara).map((id) => placeName(id));
  if (names.length) return `Light ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}.`;
  return stars === 0 ? "Light Mara's route." : "Beat the next deadline.";
}

export function LiveDebrief({ mission, commands, stars, onRetry, onNext, onWatchSolution, onContinue, retryLabel = "Retry", nextLabel = "Next level", endReason, note, failed = false, replay = false }: LiveDebriefProps) {
  const { base, verdict } = useMemo(() => analyzeRun(mission, commands, stars), [mission, commands, stars]);
  const lines = useMemo(() => explainRun(base.you.log, mission).map((l) => plainLog(l).replace(/^./, (c) => c.toUpperCase())), [base, mission]);
  const why = lines.filter((l) => !isMargin(l));
  const margin = lines.find(isMargin);
  const hint = nextStep(stars, mission, commands, base.you);
  const cols: [string, RunOutcome, string][] = [["Tower", base.tower, "tower"], ["Tower +\u00a0backup", base.standby, "standby"], ["No beacons", base.none, "none"], ["You", base.you, "you"]];
  const race: RaceColumn[] = [
    { id: "tower", head: ["tower", "only"], run: base.tower },
    { id: "standby", head: ["tower +", "backup"], run: base.standby },
    { id: "none", head: ["no", "beacons"], run: base.none },
    { id: "you", head: ["you"], run: base.you, you: true },
  ];
  const city = (id?: string) => mission.world.cities.find((c) => c.id === id)?.name ?? "";
  const nurse = mission.pods.find((p) => p.nurse);
  const items: RelayItem[] = [
    ...(onNext && !replay ? [{ key: "next", label: nextLabel, tone: "primary" as const, onSelect: onNext, autoFocus: true }] : []),
    ...(onRetry ? [{ key: "retry", label: retryLabel, tone: (onNext && !replay ? "secondary" : "primary") as RelayItem["tone"], onSelect: onRetry, autoFocus: !(onNext && !replay) }] : []),
    ...(onContinue && !replay ? [{ key: "continue", label: "Continue anyway", onSelect: onContinue }] : []),
    ...(onWatchSolution ? [{ key: "solution", label: "Watch the solution", onSelect: onWatchSolution }] : []),
  ];
  const won = stars > 0 && !failed;
  return (
    <section className={"live-debrief" + (replay ? " replay" : won ? " won" : " lost")} aria-label="Run result">
      <div className="lv-dl">
        <p className="lv-verdict">{failed ? "Leg failed" : "Run complete"}</p>
        <h2>{verdict.headline}</h2>
        {replay
          ? <p className="live-stars live-replay-tag">Solution replay</p>
          : <p className="live-stars" aria-label={stars + " of 3 stars"}>{[0, 1, 2].map((i) => <span key={i} className={i < stars ? "lit" : "off"} style={{ animationDelay: i * 180 + "ms" }}>{i < stars ? "★" : "☆"}</span>)}</p>}
        {verdict.cause && !replay && <p className="live-cause">{verdict.cause}</p>}
        {endReason && !(stars === 0 && base.you.mara !== null) && <p className="live-end-reason">{endReason}</p>}
        {margin && !replay && <p className="live-margin">{margin}</p>}
        {hint && !replay && <p className="live-next"><strong>Next star:</strong> {hint}</p>}
        {stars >= 3 && !replay && !margin && <p className="live-next"><strong>Best possible run.</strong></p>}
        {note && <p className="live-note">{note}</p>}
        {items.length > 0 && <div className="lv-actions"><RelayBar items={items} label="After the run" /></div>}
        {onRetry && <p className="lv-key"><kbd>R</kbd> {retryLabel.toLowerCase()}</p>}
        <h3 className="lv-label">What happened</h3>
        <ol className="live-why">{why.map((l) => <li key={l}>{l}</li>)}</ol>
      </div>
      <div className="lv-dr">
        <LiveRace cols={race} from={city(nurse?.origin)} to={city(nurse?.dest)} />
        <p className="live-tower-says"><strong>Tower-only run:</strong> {base.towerSays.replace(/^Tower says: /, "")}</p>
        <p className="live-tower-says live-backup">tower + backup · back at min {mission.towerDownAt + STANDBY_AFTER} · no flood news reaches it</p>
      </div>
      <table className="live-compare live-sr">
        <caption>The same run, four ways</caption>
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

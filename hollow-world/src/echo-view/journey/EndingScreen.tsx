import { LIMIT } from "../../echo/journey";
import { RelayButton } from "../relay/Relay";
import { retriesOf } from "./helpers";
import { useEnterKey } from "./keys";
import type { EndingScreenProps } from "./props";
import { SupplyLine } from "./ResourceBar";
import { TrailRecord } from "./TrailMap";

/** One sentence: the tower line keeps only its first, so "Without the beacons, Mara never leaves level 2." stands alone. */
const firstSentence = (s: string) => s.match(/^.+?[.?!](?=\s|$)/)?.[0] ?? s;

/** The ending: the verdict, the score, one line (the tower comparison), the supplies, and the whole descent drawn as one trail line with Mara at its end. Begin again (Enter). */
export function EndingScreen({ ending, res, limit = LIMIT, log, choiceNames, onAgain }: EndingScreenProps) {
  useEnterKey(onAgain);
  const saved = ending.kind === "saved";
  const attempts = log.filter((l) => l.kind === "leg").length;
  const retries = retriesOf(log);
  const closing = ending.lines.length > 1 ? firstSentence(ending.lines[ending.lines.length - 1]) : undefined;
  return (
    <div className={`g-screen j-end2 ${saved ? "saved" : "late"}`}>
      <div className="j-title-bg j-camp-bg" aria-hidden />
      <section className="j-el" aria-labelledby="j-end-title">
        <p className="j-verdict2">{saved ? "Saved" : "Too late"}<span>{attempts} attempts, {retries} {retries === 1 ? "retry" : "retries"}</span></p>
        <h2 id="j-end-title">{ending.title}</h2>
        <p className="j-score2"><b>{ending.score}</b><span>points</span></p>
        {closing && <p className="j-line">{closing}</p>}
        <SupplyLine res={res} limit={limit} />
        <div className="j-again"><RelayButton size="lg" label="Begin again" tone="primary" nav autoFocus onSelect={onAgain} /></div>
        <p className="j-key">Enter to begin again</p>
      </section>
      <div className="j-er"><TrailRecord log={log} choiceNames={choiceNames} /></div>
    </div>
  );
}

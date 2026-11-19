import { LIMIT } from "../../echo/journey";
import { RelayButton } from "../relay/Relay";
import { retriesOf } from "./helpers";
import { useEnterKey } from "./keys";
import type { EndingScreenProps } from "./props";
import { SupplyLine } from "./ResourceBar";
import { TrailRecord } from "./TrailMap";

/** The ending: the verdict, the score, the supplies, and the whole descent drawn as one trail line with Mara at its end. Begin again (Enter). */
export function EndingScreen({ ending, res, limit = LIMIT, log, choiceNames, onAgain }: EndingScreenProps) {
  useEnterKey(onAgain);
  const saved = ending.kind === "saved";
  const attempts = log.filter((l) => l.kind === "leg").length;
  const retries = retriesOf(log);
  return (
    <div className={`g-screen j-end2 ${saved ? "saved" : "late"}`}>
      <div className="j-title-bg j-camp-bg" aria-hidden />
      <section className="j-el" aria-labelledby="j-end-title">
        <p className="j-verdict2">{saved ? "Saved" : "Too late"}<span>{attempts} attempts, {retries} {retries === 1 ? "retry" : "retries"}</span></p>
        <h2 id="j-end-title">{ending.title}</h2>
        <p className="j-score2"><b>{ending.score}</b><span>points</span></p>
        <SupplyLine res={res} limit={limit} />
        <div className="j-again"><RelayButton size="lg" label="Begin again" tone="primary" nav autoFocus onSelect={onAgain} /></div>
      </section>
      <div className="j-er"><TrailRecord log={log} choiceNames={choiceNames} /></div>
    </div>
  );
}

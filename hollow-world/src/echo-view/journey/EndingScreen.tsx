import { retriesOf, trailRows } from "./helpers";
import { useEnterKey } from "./keys";
import type { EndingScreenProps } from "./props";
import { ResourceBar } from "./ResourceBar";
import { TrailMap } from "./TrailMap";

const STAR_TEXT = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

/** The ending: Saved or Too late, the score, the closing lines (the last is the tower comparison), the trail log, Begin again. */
export function EndingScreen({ ending, res, limit, log, choiceNames, onAgain }: EndingScreenProps) {
  useEnterKey(onAgain);
  const saved = ending.kind === "saved";
  const rows = trailRows(log, choiceNames);
  const retries = retriesOf(log);
  const closing = ending.lines.length > 1 ? ending.lines[ending.lines.length - 1] : undefined;
  const lines = closing ? ending.lines.slice(0, -1) : ending.lines;
  return (
    <div className="g-screen j-camp-screen">
      <div className="j-page">
        <div className="j-camp-grid">
          <section className={`j-card j-verdict ${saved ? "saved" : "late"}`} aria-labelledby="j-end-title">
            <div className="j-stamp">{saved ? "Saved" : "Too late"}</div>
            <h2 id="j-end-title">{ending.title}</h2>
            <div className="j-score"><b>{ending.score}</b><span>points</span></div>
            {lines.map((l, i) => <p key={i} className="j-body">{l}</p>)}
            {closing && <p className="j-closing">{closing}</p>}
            <ResourceBar res={res} limit={limit} />
            <div className="g-row j-actions">
              <button className="g-btn primary" autoFocus onClick={onAgain}>Begin again</button>
              <span className="j-hint">Enter to begin again</span>
            </div>
          </section>
          <aside className="j-side"><TrailMap legIndex={3} log={log} /></aside>
        </div>
        <section className="j-card j-logcard" aria-labelledby="j-log-title">
            <div className="g-kicker">{rows.filter((r) => r.kind === "leg").length} attempts, {retries} {retries === 1 ? "retry" : "retries"}</div>
            <h2 id="j-log-title">Trail log</h2>
            <ol className="j-log">
              {rows.map((r, i) => (
                <li key={i} className={`${r.kind}${r.failed ? " failed" : ""}`}>
                  <span className="j-log-title">{r.title}</span>
                  {r.stars !== undefined && <span className="g-stars" aria-label={`${r.stars} of 3 stars`}>{STAR_TEXT(r.stars)}</span>}
                  <span className="j-log-detail">{r.detail}</span>
                </li>
              ))}
            </ol>
        </section>
      </div>
    </div>
  );
}

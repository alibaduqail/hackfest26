import { CAMPAIGN } from "./campaign";
import { RelayBar, activate } from "../relay/Relay";
import { hasSeen, isUnlocked, type Progress } from "./progress";

export const Stars = ({ n, of = 3 }: { n: number; of?: number }) => (
  <span className="g-stars" aria-label={`${n} of ${of} stars`}>
    {"★".repeat(n)}<span className="off">{"★".repeat(of - n)}</span>
  </span>
);

export function MissionSelect({ progress, onPick, onBack, onStory }: {
  progress: Progress; onPick: (id: string) => void; onBack: () => void; onStory: (which: "prologue" | "epilogue") => void;
}) {
  const ids = CAMPAIGN.map((m) => m.id);
  const earned = ids.reduce((n, id) => n + (progress[id] ?? 0), 0);
  return (
    <div className="g-screen g-fp">
      <section className="fp-left" aria-labelledby="fp-title">
        <h2 id="fp-title">Missions</h2>
        <p className="fp-figs"><b>{earned}</b> / {ids.length * 3} stars</p>
        <RelayBar className="fp-bar" label="Campaign" items={[
          { key: "prologue", label: "Prologue", nav: true, onSelect: () => onStory("prologue") },
          ...(hasSeen(progress, "epilogue") ? [{ key: "epilogue", label: "Epilogue", nav: true, onSelect: () => onStory("epilogue") }] : []),
          { key: "back", label: "Back", nav: true, onSelect: onBack },
        ]} />
      </section>
      <div className="fp-right">
        <ol className="fp-ladder">
          {CAMPAIGN.map((cm, i) => {
            const open = isUnlocked(ids, i, progress);
            const ready = !!cm.build;
            const stars = progress[cm.id] ?? 0;
            const tone = !ready || !open ? "locked" : stars ? "done" : "new";
            const note = !ready ? "Coming soon" : !open ? `Earn a star in ${i}` : null;
            const next = CAMPAIGN[i + 1];
            const ahead = next && !(isUnlocked(ids, i + 1, progress) && !!next.build);
            return (
              <li key={cm.id} className={ahead ? "ahead" : ""}>
                <button className={`fp-rung ${tone}`} disabled={!open || !ready} autoFocus={i === 0} onClick={(e) => activate(e.currentTarget, () => onPick(cm.id))}>
                  <i className="fp-node" aria-hidden />
                  <span className="fp-num">{String(cm.number).padStart(2, "0")}</span>
                  <span className="fp-name">{cm.name}</span>
                  {note ? <span className="fp-note">{note}</span> : <Stars n={stars} />}
                  {!note && <span className="fp-hook">{cm.hook}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

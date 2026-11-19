import { CAMPAIGN } from "./campaign";
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
  return (
    <div className="g-screen">
      <div className="g-page g-select">
        <div className="g-head">
          <div>
            <div className="d-kicker">Campaign</div>
            <h2 className="d-h">Missions</h2>
          </div>
          <div className="d-btn-row" role="group" aria-label="Campaign">
            <button type="button" className="d-btn d-btn--secondary" onClick={() => onStory("prologue")}>Prologue</button>
            {hasSeen(progress, "epilogue") && <button type="button" className="d-btn d-btn--secondary" onClick={() => onStory("epilogue")}>Epilogue</button>}
            <button type="button" className="d-btn d-btn--secondary" onClick={onBack}>Back <kbd>Esc</kbd></button>
          </div>
        </div>
        <div className="g-cards">
          {CAMPAIGN.map((cm, i) => {
            const open = isUnlocked(ids, i, progress);
            const ready = !!cm.build;
            const stars = progress[cm.id] ?? 0;
            const state = !ready ? "Coming soon" : !open ? `Locked, earn a star in mission ${i}` : stars ? "Replay" : "New";
            const tone = !ready || !open ? "locked" : stars ? "done" : "new";
            return (
              <button key={cm.id} className={`g-card ${tone}`} disabled={!open || !ready} autoFocus={i === 0} onClick={() => onPick(cm.id)}>
                <span className="num">{String(cm.number).padStart(2, "0")}</span>
                <span className="name">{cm.name}</span>
                <span className="hook">{cm.hook}</span>
                <Stars n={stars} />
                <span className="state"><i aria-hidden />{state}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

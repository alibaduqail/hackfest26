// Briefing: typewriter story (click to skip), the Directorate's broadcast, objectives with their stars.
import { useEffect, useState } from "react";
import type { CampaignMission } from "./campaign";
import { Stars } from "./MissionSelect";

const CHARS_PER_FRAME = 2;

export function Briefing({ cm, best, hasBudget, onNext, onBack }: { cm: CampaignMission; best: number; hasBudget: boolean; onNext: () => void; onBack: () => void }) {
  const total = cm.briefing.reduce((n, p) => n + p.length, 0);
  const instant = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(instant ? total : 0);
  const done = shown >= total;
  useEffect(() => {
    if (done) return;
    const id = requestAnimationFrame(() => setShown((n) => Math.min(total, n + CHARS_PER_FRAME)));
    return () => cancelAnimationFrame(id);
  }, [shown, done, total]);

  let left = shown;
  const paras = cm.briefing.map((p) => { const t = p.slice(0, Math.max(0, left)); left -= p.length; return t; }).filter((p, i) => p || i === 0);

  return (
    <div className="g-screen">
      <div className="g-page g-brief">
        <div className="g-head">
          <div>
            <div className="g-kicker">Mission {cm.number} · briefing</div>
            <h2>{cm.name}</h2>
          </div>
          {!done && <button className="g-skip" onClick={() => setShown(total)}>skip ▸</button>}
        </div>
        <div className="g-type" onClick={() => setShown(total)} aria-live="off">
          {paras.map((p, i) => (
            <p key={i}>{p}{!done && i === paras.length - 1 && <span className="caret" />}</p>
          ))}
        </div>
        <div className="g-broadcast" style={{ opacity: done ? 1 : 0 }} aria-hidden={!done}>
          <b>BROADCAST</b>
          <div>THE DIRECTORATE: {cm.broadcast}</div>
        </div>
        <div className="g-kicker" style={{ marginBottom: 10 }}>Objectives</div>
        <ul className="g-objs">
          {cm.objectives.map((o, i) => (
            <li key={i} className={best > i ? "met" : ""}><Stars n={i + 1} />{o.label}</li>
          ))}
        </ul>
        <div className="g-row">
          <button className="g-btn" onClick={onBack}>Back</button>
          <button className="g-btn primary" autoFocus onClick={onNext}>{hasBudget ? "Place beacons" : "Begin"}</button>
        </div>
      </div>
    </div>
  );
}

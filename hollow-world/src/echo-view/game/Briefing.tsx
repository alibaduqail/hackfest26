// Briefing: typewriter story (click to skip), the Directorate's broadcast, objectives with their stars.
// Also exports the typewriter and the Interlude page used by the prologue and epilogue.
import { useEffect, useState } from "react";
import type { CampaignMission } from "./campaign";
import { Stars } from "./MissionSelect";

const CHARS_PER_FRAME = 2;

/** Types `paras` out a couple of characters per frame; instant with reduced motion. */
export function useTypewriter(paras: string[]) {
  const total = paras.reduce((n, p) => n + p.length, 0);
  const instant = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(instant ? total : 0);
  const done = shown >= total;
  useEffect(() => {
    if (done) return;
    const id = requestAnimationFrame(() => setShown((n) => Math.min(total, n + CHARS_PER_FRAME)));
    return () => cancelAnimationFrame(id);
  }, [shown, done, total]);
  let left = shown;
  const visible = paras.map((p) => { const t = p.slice(0, Math.max(0, left)); left -= p.length; return t; }).filter((p, i) => p || i === 0);
  return { visible, paras, done, skip: () => setShown(total) };
}
type Typewriter = ReturnType<typeof useTypewriter>;

const Typed = ({ tw }: { tw: Typewriter }) => (
  <div className="g-type" onClick={tw.skip} aria-live="off">
    {tw.paras.map((full, i) => {
      const shown = tw.visible[i] ?? "";
      return (
        <p key={i}>{shown}{!tw.done && i === tw.visible.length - 1 && <span className="caret" />}<span className="rest" aria-hidden>{full.slice(shown.length)}</span></p>
      );
    })}
  </div>
);

export function Briefing({ cm, best, hasBudget, onNext, onBack }: { cm: CampaignMission; best: number; hasBudget: boolean; onNext: () => void; onBack: () => void }) {
  const tw = useTypewriter(cm.briefing);
  return (
    <div className="g-screen">
      <div className="g-page g-brief">
        <div className="g-head">
          <div>
            <div className="g-kicker">Mission {cm.number} · briefing</div>
            <h2>{cm.name}</h2>
          </div>
          {!tw.done && <button className="g-skip" onClick={tw.skip}>skip ▸</button>}
        </div>
        <Typed tw={tw} />
        <div className="g-broadcast" style={{ opacity: tw.done ? 1 : 0 }} aria-hidden={!tw.done}>
          <b>BROADCAST</b>
          <div>THE DIRECTORATE: {cm.broadcast}</div>
        </div>
        <div className="g-kicker g-objs-head">Objectives</div>
        <ul className="g-objs">
          {cm.objectives.map((o, i) => (
            <li key={i} className={best > i ? "met" : ""}><Stars n={i + 1} /><span>{o.label}</span></li>
          ))}
        </ul>
        <div className="g-row g-actions">
          <button className="g-btn" onClick={onBack}>Back</button>
          <button className="g-btn lg primary" autoFocus onClick={onNext}>{hasBudget ? "Place beacons" : "Begin"}</button>
        </div>
      </div>
    </div>
  );
}

/** Prologue / epilogue: a typed story page with one way on (Continue, or Skip while it types). */
export function Interlude({ kicker, title, paras, onDone }: { kicker: string; title: string; paras: string[]; onDone: () => void }) {
  const tw = useTypewriter(paras);
  return (
    <div className="g-screen">
      <div className="g-page g-brief g-select">
        <div className="g-head">
          <div>
            <div className="g-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
        </div>
        <Typed tw={tw} />
        <div className="g-row g-actions end">
          <button className="g-btn lg primary" autoFocus onClick={onDone}>{tw.done ? "Continue" : "Skip"}</button>
        </div>
      </div>
    </div>
  );
}

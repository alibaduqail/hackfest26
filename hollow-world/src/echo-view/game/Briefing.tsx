// Briefing: the mission, its one-line goal and its objectives on a relay line.
// Also exports the objectives line, the typewriter and the Interlude page used by the prologue and epilogue.
import { useEffect, useState } from "react";
import type { CampaignMission } from "./campaign";
import { RelayBar } from "../relay/Relay";
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

/** The objectives as nodes on one line; a met one is lit. Shared by the briefing and the debrief. */
export function Objectives({ cm, met, stars = false }: { cm: CampaignMission; met: boolean[]; stars?: boolean }) {
  return (
    <ol className="fp-objs" aria-label="Objectives">
      {cm.objectives.map((o, i) => (
        <li key={i} className={met[i] ? "met" : ""}>
          <i className="fp-node" aria-hidden />
          {stars && <Stars n={i + 1} />}
          <span>{o.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function Briefing({ cm, best, hasBudget, onNext, onBack }: { cm: CampaignMission; best: number; hasBudget: boolean; onNext: () => void; onBack: () => void }) {
  return (
    <div className="g-screen g-fp">
      <section className="fp-left" aria-labelledby="fp-title">
        <p className="fp-kicker">Mission {cm.number}</p>
        <h2 id="fp-title">{cm.name}</h2>
        <p className="fp-line">{cm.hook}</p>
        <RelayBar className="fp-bar" size="lg" label="Briefing" items={[
          { key: "back", label: "Back", nav: true, onSelect: onBack },
          { key: "next", label: hasBudget ? "Place beacons" : "Begin", tone: "primary", nav: true, autoFocus: true, onSelect: onNext },
        ]} />
      </section>
      <div className="fp-right">
        <Objectives cm={cm} met={cm.objectives.map((_, i) => best > i)} stars />
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
        <div className="g-actions end">
          <RelayBar label={title} items={[{ key: "go", label: tw.done ? "Continue" : "Skip", tone: "primary", nav: tw.done, autoFocus: true, onSelect: onDone }]} />
        </div>
      </div>
    </div>
  );
}

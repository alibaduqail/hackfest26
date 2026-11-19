import { useEffect, useRef, useState } from "react";
import { applyEffect, formatEffect, LEG_IDS, LEG_NAMES } from "./helpers";
import { useEnterKey } from "./keys";
import type { CampScreenProps } from "./props";
import { ResourceBar } from "./ResourceBar";
import { TrailMap } from "./TrailMap";

/** Camp: supplies, the story card, and the choices with their costs. Pick (click or 1-3), read the reveal, Continue down (button or Enter). */
export function CampScreen({ event, res, limit, legIndex, attempt, log, onPick, onContinue }: CampScreenProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => setPicked(null), [event.id, legIndex, attempt]);
  useEffect(() => { if (picked) next.current?.focus(); }, [picked]);

  const choice = event.choices.find((c) => c.id === picked);
  const pick = (id: string) => { if (picked) return; setPicked(id); onPick?.(id); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !/^[1-9]$/.test(e.key)) return;
      const c = event.choices[Number(e.key) - 1];
      if (c) pick(c.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEnterKey(() => picked && onContinue(picked), !!picked);

  const leg = LEG_NAMES[LEG_IDS[Math.min(legIndex, LEG_IDS.length - 1)]];
  const where = attempt > 1 ? `Before ${leg}, try ${attempt}` : legIndex === 0 ? "Before the first leg" : `After ${LEG_NAMES[LEG_IDS[legIndex - 1]]}`;

  return (
    <div className="g-screen j-camp-screen">
      <div className="j-page">
        <ResourceBar res={res} limit={limit} preview={choice ? applyEffect(res, choice.effect) : undefined} />
        <div className="j-camp-grid">
          <section className="j-card" aria-labelledby="j-event-title">
            <div className="g-kicker">{where}</div>
            <h2 id="j-event-title">{event.title}</h2>
            <p className="j-body">{event.body}</p>
            <ol className="j-choices">
              {event.choices.map((c, i) => {
                const state = picked === null ? "" : c.id === picked ? " picked" : " passed";
                return (
                  <li key={c.id}>
                    <button className={`j-choice${state}`} aria-pressed={picked === null ? undefined : c.id === picked} aria-disabled={picked !== null && c.id !== picked} onClick={() => pick(c.id)}>
                      <kbd aria-hidden>{i + 1}</kbd>
                      <span className="j-choice-main">
                        <b>{c.label}</b>
                        <span className="j-detail">{c.detail}</span>
                        <span className="j-costs">
                          {formatEffect(c.effect).map((k) => <span key={k.text} className={`j-cost ${k.tone}`}>{k.text}</span>)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="j-reveal" role="status" aria-live="polite">
              {choice?.reveal && <p>{choice.reveal}</p>}
            </div>
            <div className="g-row j-actions">
              <button ref={next} className="g-btn primary" disabled={!picked} onClick={() => picked && onContinue(picked)}>Continue down</button>
              <span className="j-hint">{picked ? "Enter to continue" : `Press 1–${event.choices.length} to choose`}</span>
            </div>
          </section>
          <aside className="j-side"><TrailMap legIndex={legIndex} log={log} /></aside>
        </div>
      </div>
    </div>
  );
}

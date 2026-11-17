import { useEffect, useState } from "react";
import type { Observation } from "../../echo/types";
import { EndCard } from "../EndCard";
import { play } from "./audio";
import { verdict, type CampaignMission } from "./campaign";

const STAR_GAP_MS = 250;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The earned stars light up one by one (a pop and a ping each); with reduced motion they are simply there. */
function StarReveal({ n, of = 3 }: { n: number; of?: number }) {
  const [shown, setShown] = useState(() => (reduced() ? n : 0));
  useEffect(() => {
    const ids = Array.from({ length: n }, (_, i) => setTimeout(() => { setShown(i + 1); play("star", i); }, 350 + i * STAR_GAP_MS));
    return () => ids.forEach(clearTimeout);
  }, [n]);
  return (
    <span className="g-stars" aria-label={`${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => <span key={i} className={i < shown ? "lit" : "off"} aria-hidden>★</span>)}
    </span>
  );
}

export interface RunResult { tower: Observation; echo: Observation; normal: Observation }

export function Debrief({ cm, result, onRetry, onNext, nextLabel = "Next mission", onMissions }: {
  cm: CampaignMission; result: RunResult; onRetry: () => void; onNext?: () => void; nextLabel?: string; onMissions: () => void;
}) {
  const { tower, echo, normal } = result;
  const met = cm.objectives.map((o) => o.met(echo, normal));
  const stars = met.filter(Boolean).length;
  return (
    <div className="g-screen">
      <EndCard
        tower={tower} echo={echo} normal={normal} title={cm.name.toUpperCase()}
        top={
          <div className="g-debrief-top">
            <StarReveal n={stars} />
            {cm.verdicts?.[stars] && <div className="verdict">{cm.verdicts[stars]}</div>}
            <div className={cm.verdicts?.[stars] ? "g-muted" : "verdict"}>{verdict(echo, normal)}</div>
            <div className="g-debrief-objs">
              {cm.objectives.map((o, i) => <span key={i} className={met[i] ? "met" : ""}>{met[i] ? "✓" : "·"} {o.label}</span>)}
            </div>
          </div>
        }
      >
        <div className="g-row">
          <button className="g-btn" onClick={onMissions}>Missions</button>
          <button className="g-btn" autoFocus={!onNext} onClick={onRetry}>Retry</button>
          {onNext && <button className="g-btn primary" autoFocus onClick={onNext}>{nextLabel}</button>}
        </div>
      </EndCard>
    </div>
  );
}

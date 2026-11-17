import { useEffect } from "react";
import type { Observation } from "../../echo/types";
import { EndCard } from "../EndCard";
import { play } from "./audio";
import { verdict, type CampaignMission } from "./campaign";
import { Stars } from "./MissionSelect";

export interface RunResult { tower: Observation; echo: Observation; normal: Observation }

export function Debrief({ cm, result, onRetry, onNext, nextLabel = "Next mission", onMissions }: {
  cm: CampaignMission; result: RunResult; onRetry: () => void; onNext?: () => void; nextLabel?: string; onMissions: () => void;
}) {
  const { tower, echo, normal } = result;
  const met = cm.objectives.map((o) => o.met(echo, normal));
  const stars = met.filter(Boolean).length;
  useEffect(() => { // one ping per star
    const ids = Array.from({ length: stars }, (_, i) => setTimeout(() => play("star", i), 350 + i * 300));
    return () => ids.forEach(clearTimeout);
  }, [stars]);
  return (
    <div className="g-screen">
      <EndCard
        tower={tower} echo={echo} normal={normal} title={cm.name.toUpperCase()}
        top={
          <div className="g-debrief-top">
            <Stars n={stars} />
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

// Start card for the live Descent: who, where, the deadline, the one rule, the level hint. Paused until Start. Props only; LiveScreen mounts it (see WIRING-INTRO-DEBRIEF.md).
import { DESCENT_LIVE_GOALS } from "../../../echo/descent";
import type { Mission } from "../../../echo/types";
import { LEVEL_HINTS } from "./hints";
import { MaraBubble } from "../../characters/Bubble";
import { legLine } from "../../characters/bubbles";
import { podName } from "./names";
import { RelayButton } from "../../relay/Relay";

export interface LiveIntroProps {
  mission: Mission;
  hint?: string | null; // defaults to the level 1 hint; pass null to hide
  goal?: string; // the deadline line; defaults to Descent I's 1-star goal (pass the level's own from DESCENT_LEVELS)
  pool?: number; // journey mode: the whole pack, when it holds more than this leg may use
  from?: string; // journey mode: where this leg starts (the end of the previous leg); defaults to the mission's own start city
  onStart: () => void;
}

export function LiveIntro({ mission, hint = LEVEL_HINTS[1], goal: goalText, pool, from, onStart }: LiveIntroProps) {
  const mara = mission.pods.find((p) => p.nurse);
  const city = (id: string) => mission.world.cities.find((c) => c.id === id)?.name ?? id;
  const name = mara ? podName(mara) : "the nurse";
  const goal = { text: goalText ?? DESCENT_LIVE_GOALS[0].text };
  return (
    <div className="live-intro-backdrop">
      <MaraBubble text={legLine(mission)} />
      <section className="live-intro" role="dialog" aria-modal="true" aria-labelledby="live-intro-title">
        <p className="lv-kicker">You are the relay</p>
        <h2 id="live-intro-title">Get {name} to the clinic</h2>
        <p className="lv-lede">
          {mara ? `${name} leaves ${from ?? city(mara.origin)} for ${city(mara.dest)}. ` : ""}
          The tower goes dark at minute {mission.towerDownAt}. {mission.floodReveal ? (mission.floodReveal.lead === 0 ? "The Directorate will flood a shaft, and nothing warns you before it seals." : `The Directorate will flood a shaft; you see which one ${mission.floodReveal.lead} minutes before it seals.`) : mission.sealAt !== null && `The Directorate floods a shaft at minute ${mission.sealAt}.`}
        </p>
        <ul className="live-intro-rules">
          <li><strong>The tower is dark.</strong> News only hops beacon to beacon.</li>
          <li><strong>You have {mission.beaconBudget ?? 0} beacons{pool ? ` of your ${pool}` : ""}.</strong> Click a rail to bolt one in while the pods move.{mission.beaconBuildTicks ? ` A beacon takes ${mission.beaconBuildTicks} minutes to go live.` : ""}</li>
          <li className="deadline"><strong>Deadline.</strong> {goal.text}</li>
        </ul>
        {hint && <p className="live-intro-hint">{hint}</p>}
        <div className="lv-start">
          <RelayButton label="Start" tone="primary" size="lg" onSelect={onStart} autoFocus title="Start the run" />
          <kbd>Space</kbd>
        </div>
      </section>
    </div>
  );
}

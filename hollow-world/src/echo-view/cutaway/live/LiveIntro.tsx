// Start card for the live Descent: who, where, the deadline, the one rule, the level hint. Paused until Start. Props only; LiveScreen mounts it (see WIRING-INTRO-DEBRIEF.md).
import { DESCENT_LIVE_GOALS } from "../../../echo/descent";
import type { Mission } from "../../../echo/types";
import { LEVEL_HINTS } from "./hints";

export interface LiveIntroProps {
  mission: Mission;
  hint?: string | null; // defaults to the level 1 hint; pass null to hide
  goal?: string; // the deadline line; defaults to Descent I's 1-star goal (pass the level's own from DESCENT_LEVELS)
  onStart: () => void;
}

export function LiveIntro({ mission, hint = LEVEL_HINTS[1], goal: goalText, onStart }: LiveIntroProps) {
  const mara = mission.pods.find((p) => p.nurse);
  const city = (id: string) => mission.world.cities.find((c) => c.id === id)?.name ?? id;
  const name = (mara?.label.split("· ")[1] ?? "The nurse").replace(/^Nurse /, "");
  const goal = { text: goalText ?? DESCENT_LIVE_GOALS[0].text };
  return (
    <div className="live-intro-backdrop">
      <section className="live-intro" role="dialog" aria-modal="true" aria-labelledby="live-intro-title">
        <div className="eyebrow">YOU ARE THE RELAY</div>
        <h2 id="live-intro-title">Get Nurse {name} to the clinic</h2>
        <p>
          {mara ? `${name} leaves ${city(mara.origin)} for ${city(mara.dest)}. ` : ""}
          The tower goes dark at minute {mission.towerDownAt}. {mission.floodReveal ? (mission.floodReveal.lead === 0 ? "The Directorate will flood a shaft, and nothing warns you before it seals." : "The Directorate will flood a shaft; you see which one only moments before it seals.") : mission.sealAt !== null && `The Directorate floods a shaft at minute ${mission.sealAt}.`}
        </p>
        <ul className="live-intro-rules">
          <li><strong>The tower is dark.</strong> News only hops beacon to beacon.</li>
          <li><strong>You have {mission.beaconBudget ?? 0} beacons.</strong> Click a rail to bolt one in while the pods move.{mission.beaconBuildTicks ? ` A beacon takes ${mission.beaconBuildTicks} minutes to go live.` : ""}</li>
          <li><strong>Deadline:</strong> {goal.text}</li>
        </ul>
        {hint && <p className="live-intro-hint">{hint}</p>}
        <button className="live-primary" onClick={onStart} autoFocus>Start <kbd>Space</kbd></button>
      </section>
    </div>
  );
}

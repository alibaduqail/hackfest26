// Start of a Descent run, as a quiet overlay on the art: who and where, then the rules as nodes on one hop line, the level hint, Start.
// Paused until Start. Props only; LiveScreen mounts it.
import { DESCENT_LIVE_GOALS } from "../../../echo/descent";
import type { Mission } from "../../../echo/types";
import { RelayButton } from "../../relay/Relay";
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
  const goal = goalText ?? DESCENT_LIVE_GOALS[0].text;
  const flood = mission.floodReveal
    ? mission.floodReveal.lead === 0 ? "Nothing warns you before it seals." : "You see which shaft only moments before it seals."
    : mission.sealAt !== null ? `It floods at minute ${mission.sealAt}.` : null;
  return (
    <div className="live-intro-backdrop">
      <section className="live-intro" role="dialog" aria-modal="true" aria-labelledby="live-intro-title">
        <p className="lv-kicker">You are the relay</p>
        <h2 id="live-intro-title">Get Nurse {name} to the clinic</h2>
        <p className="lv-lede">{mara ? `${name} leaves ${city(mara.origin)} for ${city(mara.dest)}. ` : ""}The tower goes dark at minute {mission.towerDownAt}.</p>
        <ul className="live-intro-rules">
          <li><strong>The tower is dark.</strong> News only hops beacon to beacon.</li>
          <li><strong>You have {mission.beaconBudget ?? 0} beacons.</strong> Click a rail to bolt one in while the pods move.{mission.beaconBuildTicks ? ` Each takes ${mission.beaconBuildTicks} minutes to go live.` : ""}</li>
          {flood && <li><strong>The Directorate floods a shaft.</strong> {flood}</li>}
          <li className="deadline"><strong>Deadline.</strong> {goal}</li>
        </ul>
        {hint && <p className="live-intro-hint">{hint}</p>}
        <div className="lv-start">
          <RelayButton label="Start" tone="primary" size="lg" onSelect={onStart} autoFocus />
          <kbd>Space</kbd>
        </div>
      </section>
    </div>
  );
}

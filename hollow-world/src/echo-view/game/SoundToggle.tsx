// The sound switch, fixed bottom-right on every game screen: a small two-option Descent toggle. Starts muted.
import { useEffect, useSyncExternalStore } from "react";
import "../descent-theme.css";
import { isMuted, subscribe, toggleMuted, unlockOnFirstGesture } from "./audio";

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => true);
  useEffect(unlockOnFirstGesture, []);
  const set = (wantMuted: boolean) => { if (wantMuted !== isMuted()) toggleMuted(); };
  return (
    <div className="g-sound">
      <div className="d-toggle" role="group" aria-label="Sound">
        <button type="button" className="d-btn d-btn--secondary" aria-pressed={muted} onClick={() => set(true)}>Silent</button>
        <button type="button" className="d-btn d-btn--secondary" aria-pressed={!muted} onClick={() => set(false)}>Sound</button>
      </div>
    </div>
  );
}

// The sound switch, fixed bottom-right on every game screen: two nodes on one line, the packet parked on the current one. Starts muted.
import { useEffect, useSyncExternalStore } from "react";
import { RelayBar } from "../relay/Relay";
import { isMuted, subscribe, toggleMuted, unlockOnFirstGesture } from "./audio";

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => true);
  useEffect(unlockOnFirstGesture, []);
  const set = (wantMuted: boolean) => { if (wantMuted !== isMuted()) toggleMuted(); };
  return (
    <div className="g-sound">
      <RelayBar size="sm" label="Sound" value={muted ? "off" : "on"} items={[
        { key: "off", label: "Silent", onSelect: () => set(true) },
        { key: "on", label: "Sound", onSelect: () => set(false) },
      ]} />
    </div>
  );
}

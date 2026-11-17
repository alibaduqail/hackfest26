// The speaker button, fixed bottom-right on every game screen. Starts muted.
import { useEffect, useSyncExternalStore } from "react";
import { isMuted, subscribe, toggleMuted, unlockOnFirstGesture } from "./audio";

export function SoundToggle() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => true);
  useEffect(unlockOnFirstGesture, []);
  return (
    <button className="g-sound" aria-pressed={!muted} aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Turn sound off"} title={muted ? "Sound off" : "Sound on"} onClick={toggleMuted}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" stroke="none" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />}
      </svg>
    </button>
  );
}

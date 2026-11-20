// Settings: a small gear fixed top-right on every game screen; its panel holds the Sound switch (muted by default, same store the old bottom-right toggle used).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isMuted, subscribe, toggleMuted, unlockOnFirstGesture } from "./audio";

export function SettingsGear() {
  const muted = useSyncExternalStore(subscribe, isMuted, () => true);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(unlockOnFirstGesture, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation(); // capture phase: Esc closes the panel first, it does not also go back a screen
      setOpen(false);
      root.current?.querySelector<HTMLElement>(".g-gear-btn")?.focus();
    };
    addEventListener("pointerdown", away);
    addEventListener("keydown", esc, true);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc, true); };
  }, [open]);
  return (
    <div className="g-gear" ref={root}>
      <button type="button" className="g-gear-btn" aria-label="Settings" aria-expanded={open} aria-controls="g-gear-panel" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="g-gear-panel" id="g-gear-panel" role="group" aria-label="Settings">
          <span className="g-gear-label" id="g-gear-sound">Sound</span>
          <button type="button" role="switch" aria-checked={!muted} aria-labelledby="g-gear-sound" className="g-gear-switch" onClick={toggleMuted}>
            <i aria-hidden="true" /><span>{muted ? "Off" : "On"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

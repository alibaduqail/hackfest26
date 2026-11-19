import { useEffect } from "react";
import { useEnterKey } from "./keys";
import type { TitleProps } from "./props";

/** The front door: ECHO, The Descent, the premise, the start buttons and the way out to the other modes. The dimmed Backdrop is mounted by the parent. */
export function TitleScreen({ onBegin, onContinue, onTowerDown, onStrata, onFreePlay }: TitleProps) {
  useEnterKey(onContinue ?? onBegin);
  // If focus has fallen to the page (a click on the backdrop, a late autofocus), an arrow key would do nothing and the next Enter would hit the
  // screen-level Continue. Pull the arrow into the start buttons first, so "ArrowRight, Enter" always means the button the player moved to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
      const btns = document.querySelectorAll<HTMLElement>(".j-start .d-btn:not([disabled])");
      const to = e.key === "ArrowRight" ? btns[btns.length - 1] : btns[0];
      if (!to) return;
      e.preventDefault();
      to.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="g-screen j-title">
      <div className="d-panel d-panel--accent j-title-card">
        <h1 className="d-h d-h--xl j-echo" aria-label="Echo"><span aria-hidden>ECHO</span></h1>
        <p className="d-kicker">The Descent</p>
        <p className="d-body j-premise">
          The tower has gone dark. Get Nurse Mara down five levels of the Hollow to the Deep Clinic,
          with a crate of beacons and nothing else.
        </p>
        <div className="d-btn-row j-start" role="group" aria-label="Start">
          {onContinue ? (
            <>
              <button className="d-btn" autoFocus onClick={onContinue}>Continue <kbd>Enter</kbd></button>
              <button className="d-btn d-btn--secondary" onClick={onBegin}>New journey</button>
            </>
          ) : (
            <button className="d-btn" autoFocus onClick={onBegin}>Begin the descent <kbd>Enter</kbd></button>
          )}
        </div>
        {(onTowerDown || onStrata || onFreePlay) && (
          <div className="j-links">
            {onTowerDown && <button className="j-link" onClick={onTowerDown}>Tower Down split</button>}
            {onStrata && <button className="j-link" onClick={onStrata}>Strata city</button>}
            {onFreePlay && <button className="j-link" onClick={onFreePlay}>Free play</button>}
          </div>
        )}
        <div className="j-foot">A fallback for the Hollow, when the Directorate's tower fails.</div>
      </div>
    </div>
  );
}

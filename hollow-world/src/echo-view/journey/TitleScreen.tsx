import { useEffect } from "react";
import { useEnterKey } from "./keys";
import type { TitleProps } from "./props";

/** The front door: the name over the Strata scene (the dimmed Backdrop is mounted by the parent, as for the existing Title). */
export function TitleScreen({ onBegin, onContinue, onTowerDown, onStrata, onFreePlay }: TitleProps) {
  useEnterKey(onBegin);
  useEffect(() => { document.getElementById("j-begin")?.focus(); }, []);
  return (
    <div className="g-screen g-title j-title">
      <h1>ECHO</h1>
      <div className="j-descent"><span>The Descent</span></div>
      <p className="j-premise">
        The tower has gone dark. Get Nurse Mara down five levels of the Hollow to the Deep Clinic,
        with a crate of beacons and nothing else.
      </p>
      <div className="g-row">
        <button id="j-begin" className="g-btn primary j-begin" onClick={onBegin}>Begin the descent</button>
        {onContinue && <button className="g-btn" onClick={onContinue}>Continue the journey</button>}
      </div>
      {(onTowerDown || onStrata || onFreePlay) && (
        <div className="j-links">
          {onTowerDown && <button className="j-link" onClick={onTowerDown}>Tower Down split</button>}
          {onStrata && <button className="j-link" onClick={onStrata}>Strata city</button>}
          {onFreePlay && <button className="j-link" onClick={onFreePlay}>Free play</button>}
        </div>
      )}
      <div className="foot">A fallback for the Hollow, when the Directorate's tower fails.</div>
    </div>
  );
}

import type { MouseEventHandler } from "react";

// Title: the word, two buttons, two quieter links. The Descent look: flat slate, gold primary, outlined secondaries.
export function Title({ onBegin, onMissions, onDescent }: { onBegin: () => void; onMissions: () => void; onDescent: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <div className="g-screen g-title">
      <p className="d-kicker">Sector 07 · Directorate offline</p>
      <h1 className="d-h d-h--xl" aria-label="Echo">ECHO</h1>
      <div className="d-btn-row g-title-main" role="group" aria-label="Start">
        <button type="button" className="d-btn" autoFocus onClick={onBegin}>Begin</button>
        <button type="button" className="d-btn d-btn--secondary" onClick={onMissions}>Missions</button>
      </div>
      <div className="d-btn-row g-title-more" role="group" aria-label="More">
        <a className="d-btn d-btn--secondary" href="?screen=descent-live" onClick={onDescent}>Play the Descent</a>
        <a className="d-btn d-btn--secondary" href="?screen=descent" onClick={onDescent}>See how Echo works</a>
      </div>
    </div>
  );
}

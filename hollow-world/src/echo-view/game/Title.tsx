import type { MouseEventHandler } from "react";

// Title: the name over the Strata scene (the dimmed backdrop is mounted by GameApp).
export function Title({ onBegin, onMissions, onDescent }: { onBegin: () => void; onMissions: () => void; onDescent: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <div className="g-screen g-title">
      <div className="eyebrow">Sector 07</div>
      <h1>ECHO</h1>
      <div className="rule" aria-hidden />
      <div className="sub">when the tower goes dark</div>
      <div className="g-row main">
        <button className="g-btn lg primary" autoFocus onClick={onBegin}>Begin</button>
        <button className="g-btn lg" onClick={onMissions}>Missions</button>
      </div>
      <div className="g-row more">
        <a className="g-link" href="?screen=descent-live" onClick={onDescent}>Play the Descent</a>
        <a className="g-link" href="?screen=descent" onClick={onDescent}>See how Echo works</a>
      </div>
      <div className="foot">A fallback for the Hollow, when the Directorate's tower fails.</div>
    </div>
  );
}

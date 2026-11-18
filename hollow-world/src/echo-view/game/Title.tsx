// Title: the name over the Strata scene (the dimmed backdrop is mounted by GameApp).
export function Title({ onBegin, onMissions }: { onBegin: () => void; onMissions: () => void }) {
  return (
    <div className="g-screen g-title">
      <h1>ECHO</h1>
      <div className="sub">when the tower goes dark</div>
      <div className="g-row">
        <button className="g-btn primary" autoFocus onClick={onBegin}>Begin</button>
        <button className="g-btn" onClick={onMissions}>Missions</button>
        <a className="g-btn" href="./cutaway.html">See how Echo works</a>
      </div>
      <div className="foot">A fallback for the Hollow, when the Directorate's tower fails.</div>
    </div>
  );
}

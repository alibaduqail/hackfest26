// Ported from the 140-leg-redesign mock. The Descent's left rail: the leg name, the clock, the flood line, the beacon budget as five beacon dots, the star ladder and the
// arrivals. Pure render from props; LiveScreen computes every value. No boxes: a hop line and dots, the same language as the Relay nodes.
import type { MouseEventHandler } from "react";

export interface RailGoal { stars: 1 | 2 | 3; maraBy: number; medicineBy?: number; state: "met" | "missed" | "" }
export interface RailEvent { key: string; tick: number; text: string }

export interface LiveRailProps {
  kicker: string;
  title: string;
  onExit?: MouseEventHandler<HTMLAnchorElement>;
  tick: number;
  runState: string;
  flood: { tone: "" | "warn" | "sealed"; text: string };
  budget: number;
  remaining: number;
  pool?: number; // journey mode: the whole pack, when it holds more than this leg may use
  goals: RailGoal[];
  mara: number | null;
  medicine: number | null;
  feedback: { key: number; text: string | null };
  selection: string; // the selected or hovered place and its state, for screen readers (the map shows it on the art)
  events: RailEvent[];
}

const at = (t: number | null) => (t === null ? "En route" : `Minute ${t}`);

export function LiveRail(p: LiveRailProps) {
  const placed = p.budget - p.remaining;
  return (
    <aside className="lv-rail" aria-label="Relay status and goals">
      <a className="lv-back" href="?screen=title" onClick={p.onExit} aria-label="Back to the Echo title">Back</a>
      <p className="lv-kicker">{p.kicker}</p>
      <h1>{p.title}</h1>

      <p className="lv-clock">
        <time id="live-clock">t+{String(p.tick).padStart(2, "0")}</time>
        <span>{p.runState}</span>
      </p>
      <p className={"lv-flood " + p.flood.tone} aria-live="polite">{p.flood.text}</p>

      <div className="lv-beacons" aria-live="polite" aria-atomic="true">
        <span className="lv-dots" aria-hidden="true">
          {Array.from({ length: p.budget }, (_, i) => <i key={i + (i < placed ? "l" : "")} className={i < placed ? "lit" : ""} />)}
        </span>
        <span><b>{p.remaining}</b> / {p.budget} beacons left{p.pool !== undefined && <small> · of your {p.pool}</small>}</span>
      </div>
      <p className="live-feedback" role="status">{p.feedback.text && <span key={p.feedback.key}>{p.feedback.text}</span>}</p>

      <h2 className="lv-label">Clinic deadlines</h2>
      <ol className="lv-ladder" aria-label="Clinic deadlines">
        {[...p.goals].sort((a, b) => b.stars - a.stars).map((g) => (
          <li key={g.stars} className={g.state}>
            <i aria-hidden="true" />
            <span className="lv-stars" aria-label={g.stars + " stars"}>{"★".repeat(g.stars)}<span>{"★".repeat(3 - g.stars)}</span></span>
            <span>Mara ≤ {g.maraBy}{g.medicineBy !== undefined && <em> · Medicine ≤ {g.medicineBy}</em>}</span>
            {g.state && <small>{g.state === "met" ? "Met" : "Missed"}</small>}
          </li>
        ))}
      </ol>
      <dl className="lv-arrive">
        <div className="mara"><dt>Nurse Mara</dt><dd>{at(p.mara)}</dd></div>
        <div><dt>Medicine</dt><dd>{at(p.medicine)}</dd></div>
      </dl>

      <p className="sr" id="live-selection" aria-live="polite">{p.selection}</p>
      <ol id="events" aria-label="Latest system events">
        {p.events.map((e) => (
          <li key={e.key}><time>t+{e.tick}</time><span>{e.text}</span></li>
        ))}
      </ol>
    </aside>
  );
}

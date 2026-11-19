import { clockPct } from "./helpers";
import { BeaconIcon, ClockIcon, DoseIcon } from "./icons";
import type { Resources } from "./props";

const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/** The three supplies: beacons, the clock against the patient's limit, doses. `preview` shows what a locked-in choice changes. */
export function ResourceBar({ res, limit, preview }: { res: Resources; limit: number; preview?: Resources }) {
  const now = preview ?? res;
  const dBeacons = now.beacons - res.beacons, dClock = now.clock - res.clock, dDoses = now.doses - res.doses;
  const over = now.clock > limit;
  return (
    <div className="j-bar" role="group" aria-label="Supplies">
      <div className="j-res">
        <span className="j-res-ico"><BeaconIcon /></span>
        <span className="j-res-body">
          <b>{now.beacons}</b>
          <span className="j-res-name">{now.beacons === 1 ? "beacon" : "beacons"}</span>
        </span>
        {dBeacons !== 0 && <i className={`j-delta ${dBeacons > 0 ? "good" : "bad"}`}>{sign(dBeacons)}</i>}
      </div>
      <div className="j-res j-res-clock">
        <span className="j-res-ico"><ClockIcon /></span>
        <span className="j-res-body">
          <b className={over ? "over" : ""}>{now.clock}<small> / {limit} min</small></b>
          <span className="j-track" role="img" aria-label={`${clockPct(now.clock, limit)}% of the patient's time used`}>
            <span className={`j-fill${over ? " over" : ""}`} style={{ width: `${clockPct(now.clock, limit)}%` }} />
          </span>
        </span>
        {dClock !== 0 && <i className={`j-delta ${dClock > 0 ? "bad" : "good"}`}>{sign(dClock)} min</i>}
      </div>
      <div className="j-res">
        <span className="j-res-ico"><DoseIcon /></span>
        <span className="j-res-body">
          <b>{now.doses}</b>
          <span className="j-res-name">{now.doses === 1 ? "dose" : "doses"}</span>
        </span>
        {dDoses !== 0 && <i className={`j-delta ${dDoses > 0 ? "good" : "bad"}`}>{sign(dDoses)}</i>}
      </div>
    </div>
  );
}

/** The camp's supplies as one quiet line: "3 beacons · 40 / 390 min · 1 dose". `preview` shows the picked choice's change next to each figure. */
export function SupplyLine({ res, limit, preview }: { res: Resources; limit: number; preview?: Resources }) {
  const now = preview ?? res;
  const over = now.clock > limit;
  const delta = (d: number, goodWhenUp: boolean, unit = "") =>
    d !== 0 && <span className={`j-sd ${(d > 0) === goodWhenUp ? "good" : "bad"}`}>{`${sign(d)}${unit}`}</span>;
  return (
    <p className="j-supply" aria-label="Supplies">
      <span><b>{now.beacons}</b>{now.beacons === 1 ? " beacon" : " beacons"}{delta(now.beacons - res.beacons, true)}</span>
      <span><b className={over ? "over" : undefined}>{now.clock}</b>{` / ${limit} min`}{delta(now.clock - res.clock, false)}</span>
      <span><b>{now.doses}</b>{now.doses === 1 ? " dose" : " doses"}{delta(now.doses - res.doses, true)}</span>
    </p>
  );
}

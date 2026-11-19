import { Fragment } from "react";
import { LEG_NAMES, LEG_IDS, starsFromLog, trailModel, trailRows } from "./helpers";
import { TentIcon } from "./icons";
import type { TrailMapProps } from "./props";

const STAR_TEXT = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

/** The depth map: the surface ramp down five Hollow levels to the Deep Clinic. Legs done are lit, the next leg is amber, the rest are dim. */
export function TrailMap({ legIndex, log, compact = false }: TrailMapProps) {
  const { nodes, stars, hereLevel } = trailModel(legIndex, log);
  return (
    <nav className={`j-trail${compact ? " compact" : ""}`} aria-label="Trail map">
      <ol>
        <li className={`j-node start ${hereLevel === 0 ? "here" : "done"}`}>
          <span className="j-dot" aria-hidden />
          <span className="j-lv"><b>Surface ramp</b>{hereLevel === 0 && <em>Mara is here</em>}</span>
        </li>
        {nodes.map((n) => (
          <Fragment key={n.level}>
            <li className={`j-node ${n.state}${n.here ? " here" : ""}`} aria-current={n.state === "current" && n.legEnd ? "step" : undefined}>
              <span className="j-dot" aria-hidden />
              <span className="j-lv">
                <b>Level {n.level} <span>{n.name}</span></b>
                {n.here && <em>Mara is here</em>}
              </span>
              {n.legEnd && (
                <span className="j-leg">
                  {LEG_NAMES[LEG_IDS[n.leg]]}
                  {stars[n.leg] !== null
                    ? <span className="g-stars" aria-label={`${stars[n.leg]} of 3 stars`}>{STAR_TEXT(stars[n.leg]!)}</span>
                    : <span className="j-leg-state">{n.state === "current" ? "next" : "ahead"}</span>}
                </span>
              )}
            </li>
            {n.legEnd && n.leg < 2 && (
              <li className={`j-camp ${n.leg < legIndex ? "done" : "ahead"}`}>
                <span className="j-dot" aria-hidden><TentIcon /></span>
                <span className="j-lv">Camp {n.leg + 1}</span>
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export interface TrailRailProps { legIndex: number; log: TrailMapProps["log"]; x: number; maraY: number; contY: number; height: number }

/** The camp's depth line: levels already passed above Mara (solid), levels still ahead below Continue (dashed). No box; the fork fills the gap. */
export function TrailRail({ legIndex, log, x, maraY, contY, height }: TrailRailProps) {
  const { nodes, stars, hereLevel } = trailModel(legIndex, log);
  const above = [{ key: "surface", name: "Surface ramp", leg: -1, legEnd: false }, ...nodes.filter((n) => n.level < hereLevel).map((n) => ({ key: `l${n.level}`, ...n }))]
    .slice(0, hereLevel); // at the surface nothing is above Mara
  const below = nodes.filter((n) => n.level > hereLevel);
  const here = nodes.find((n) => n.level === hereLevel);
  const upStep = 40, downStep = Math.min(40, (height - 32 - (contY + 64)) / Math.max(1, below.length - 1));
  const legStars = (leg: number) => (leg >= 0 && stars[leg] !== null ? STAR_TEXT(stars[leg]!) : null);
  return (
    <div className="j-rail" aria-hidden>
      <svg className="j-rail-lines" width="100%" height={height}>
        <line className="done" x1={x} x2={x} y1={0} y2={maraY} />
        <line className="ahead" x1={x} x2={x} y1={contY} y2={height} />
        {above.map((a, i) => <circle key={a.key} className="done" cx={x} cy={maraY - (above.length - i) * upStep} r={4} />)}
        {below.map((b, i) => <circle key={b.level} className="ahead" cx={x} cy={contY + 64 + i * downStep} r={4} />)}
      </svg>
      {above.map((a, i) => (
        <span key={a.key} className="j-rail-lv done" style={{ left: x + 18, top: maraY - (above.length - i) * upStep }}>
          {a.name}{a.legEnd && legStars(a.leg) && <> <em>{LEG_NAMES[LEG_IDS[a.leg]]}</em> <span className="g-stars">{legStars(a.leg)}</span></>}
        </span>
      ))}
      <span className="j-rail-lv here" style={{ left: x + 22, top: maraY }}>
        <b>Mara</b> {here ? here.name : "Surface ramp"}{here?.legEnd && legStars(here.leg) && <> <em>{LEG_NAMES[LEG_IDS[here.leg]]}</em> <span className="g-stars">{legStars(here.leg)}</span></>}
      </span>
      {below.map((b, i) => (
        <span key={b.level} className="j-rail-lv" style={{ left: x + 18, top: contY + 64 + i * downStep }}>{b.name}</span>
      ))}
    </div>
  );
}

export interface TrailRecordProps { log: TrailMapProps["log"]; choiceNames?: Record<string, string> }

/** The ending's trail: the whole descent as one line, Surface ramp down to the Deep clinic. Every leg attempt (stars, minutes) and camp choice sits on it in the order it happened; Mara's dot ends it, or marks where she stopped. */
export function TrailRecord({ log, choiceNames }: TrailRecordProps) {
  const rows = trailRows(log, choiceNames);
  const won = starsFromLog(log).findIndex((s) => s === null);
  const reached = won === -1 ? LEG_IDS.length : won;
  const { nodes, hereLevel } = trailModel(reached, log);
  const stopped = nodes.find((n) => n.level === hereLevel)?.name ?? "Surface ramp";
  const items = log.map((l, i) => ({ l, r: rows[i] })).filter(({ l }) => !(l.kind === "choice" && l.choiceId === "retry"));
  const full = reached === LEG_IDS.length;
  return (
    <ol className="j-rec" aria-label="Trail log">
      <li className="start"><i aria-hidden /><span>Surface ramp</span></li>
      {items.map(({ l, r }, i) => (
        <li key={i} className={`${r.kind}${r.failed ? " failed" : ""}`} style={{ "--i": i + 1 } as React.CSSProperties}>
          <i aria-hidden />
          {r.kind === "leg" && l.kind === "leg"
            ? <span><b>{r.title}</b><span className="g-stars" aria-label={`${r.stars} of 3 stars`}>{STAR_TEXT(r.stars ?? 0)}</span><em>{l.result.ticks} min{r.failed ? " · failed" : ""}</em></span>
            : <span><em>{r.title}</em>{r.detail}</span>}
        </li>
      ))}
      <li className="mara" style={{ "--i": items.length + 1 } as React.CSSProperties}><i aria-hidden /><span><b>Mara</b>{full ? "Deep clinic" : `stopped at ${stopped}`}</span></li>
      {!full && <li className="ahead"><i aria-hidden /><span>Deep clinic</span></li>}
    </ol>
  );
}

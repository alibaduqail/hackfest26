import { Fragment } from "react";
import { LEG_NAMES, LEG_IDS, trailModel } from "./helpers";
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

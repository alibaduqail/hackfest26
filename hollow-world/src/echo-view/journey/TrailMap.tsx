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

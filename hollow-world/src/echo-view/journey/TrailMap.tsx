import { Fragment, useEffect, useRef, useState } from "react";
import { ghostHead, ghostOutcome, type GhostPath } from "./ghosts";
import { LEG_NAMES, LEG_IDS, starsFromLog, stoppedAt, trailModel, trailRows } from "./helpers";
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

export interface TrailRecordProps { log: TrailMapProps["log"]; choiceNames?: Record<string, string>; ghosts?: GhostPath[] }

const COL = 64, DOT = 10; // ghost columns are COL px apart, left of the trail line; the line itself is the last column ("you")

/** The race down the shaft: one column per run, side by side with the real trail. Headers at the top, a dotted line down from the Surface ramp, a red cross on the row where that run died,
 * the outcome in one aligned row at the bottom. y comes from the measured rows (surface row, last row of each leg), so the cross lines up with the trail's own rows. */
function GhostLines({ ghosts, wrap }: { ghosts: GhostPath[]; wrap: React.RefObject<HTMLDivElement | null> }) {
  const [geo, setGeo] = useState<{ h: number; ys: number[] } | null>(null);
  useEffect(() => { // not a layout effect: the wrapper's ref attaches after its children's layout effects
    const el = wrap.current;
    if (!el) return;
    const read = () => {
      const mid = (n: Element) => { const e = n as HTMLElement; return e.offsetTop + e.offsetHeight / 2; }; // offset geometry, not rects: the rows are mid-rise (translated) when this first runs
      const mara = el.querySelector("li.mara"), start = el.querySelector("li.start");
      if (!mara || !start) return;
      const ys = [mid(start), ...[0, 1, 2].map((i) => { const all = el.querySelectorAll(`li[data-leg="${i}"]`); return all.length ? mid(all[all.length - 1]) : mid(mara); })];
      setGeo((g) => (g && g.h === el.offsetHeight && g.ys.every((y, i) => Math.abs(y - ys[i]) < 1) ? g : { h: el.offsetHeight, ys }));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wrap, ghosts]);
  if (!geo) return null;
  const { ys, h } = geo;
  const others = ghosts.filter((g) => !g.you).sort((a, b) => a.reached - b.reached || (a.id < b.id ? -1 : 1)); // the run that got least far sits furthest from the trail
  const you = ghosts.find((g) => g.you);
  const W = COL * others.length + 72, x0 = W + 7;
  const colX = (k: number) => x0 - COL * (others.length - k);
  const headY = 18, outY = h - 26;
  const deathY = (g: GhostPath) => ys[Math.min(g.reached, 2) + 1];
  const text = (x: number, y: number, lines: string[], cls: string, d: number) => (
    <text className={cls} x={x} y={y} textAnchor="middle" style={{ "--d": `${d}ms` } as React.CSSProperties}>{lines.map((t, i) => <tspan key={i} x={x} dy={i ? 14 : 0}>{t}</tspan>)}</text>
  );
  return (
    <svg className="j-ghosts" width={W + 8} height={h} aria-hidden>
      <defs><linearGradient id="gh-shade" x1="0" x2="1"><stop offset="0" stopColor="#070b0e" stopOpacity="0" /><stop offset=".22" stopColor="#070b0e" stopOpacity=".8" /><stop offset=".9" stopColor="#070b0e" stopOpacity=".8" /><stop offset="1" stopColor="#070b0e" stopOpacity="0" /></linearGradient></defs>
      <rect className="shade" x={0} y={0} width={x0 + 22} height={h} fill="url(#gh-shade)" />
      {others.map((g, k) => {
        const x = colX(k), dead = g.reached < 3, y1 = dead ? deathY(g) : ys[3];
        const n = Math.max(1, Math.floor((y1 - ys[0]) / DOT));
        return (
          <g key={g.id} className={`gh ${dead ? "dead" : "alive"}`}>
            {text(x, headY, ghostHead(g), "head", 0)}
            {Array.from({ length: n + 1 }, (_, i) => <circle key={i} cx={x} cy={ys[0] + (i / n) * (y1 - ys[0])} r={1.8} style={{ "--d": `${Math.round((i / n) * 650)}ms` } as React.CSSProperties} />)}
            {dead
              ? <path className="x" d={`M${x - 6} ${y1 - 6}l12 12m0 -12l-12 12`} style={{ "--d": "650ms" } as React.CSSProperties} />
              : <circle className="end" cx={x} cy={y1} r={4.5} style={{ "--d": "650ms" } as React.CSSProperties} />}
            {text(x, outY, ghostOutcome(g), "out", 700)}
          </g>
        );
      })}
      {you && <g className="gh you">{text(x0, headY, ghostHead(you), "head", 0)}{text(x0, outY, ghostOutcome(you), "out", 1500)}</g>}
    </svg>
  );
}

/** The ending's trail: the whole descent as one line, Surface ramp down to the Deep clinic. Every leg attempt (stars, minutes) and camp choice sits on it in the order it happened; Mara's dot ends it, or marks where she stopped. With `ghosts`, faint counterfactual paths run beside it. */
export function TrailRecord({ log, choiceNames, ghosts }: TrailRecordProps) {
  const rows = trailRows(log, choiceNames);
  const wrap = useRef<HTMLDivElement>(null);
  const won = starsFromLog(log).findIndex((s) => s === null);
  const reached = won === -1 ? LEG_IDS.length : won;
  const stopped = stoppedAt(log) ?? "the Deep clinic";
  const items = log.map((l, i) => ({ l, r: rows[i] })).filter(({ l }) => !(l.kind === "choice" && l.choiceId === "retry"));
  const full = reached === LEG_IDS.length;
  return (
    <div className={`j-recw${ghosts?.length ? " has-ghosts" : ""}`} ref={wrap}>
      {ghosts?.length ? <GhostLines ghosts={ghosts} wrap={wrap} /> : null}
      <ol className="j-rec" aria-label="Trail log">
        <li className="start"><i aria-hidden /><span>Surface ramp</span></li>
        {items.map(({ l, r }, i) => (
          <li key={i} data-leg={l.kind === "leg" ? LEG_IDS.indexOf(l.legId) : undefined} className={`${r.kind}${r.failed ? " failed" : ""}`} style={{ "--i": i + 1 } as React.CSSProperties}>
            <i aria-hidden />
            {r.kind === "leg" && l.kind === "leg"
              ? <span><b>{r.title}</b><span className="g-stars" aria-label={`${r.stars} of 3 stars`}>{STAR_TEXT(r.stars ?? 0)}</span><em>{l.result.ticks} min{r.failed ? " · failed" : ""}</em></span>
              : <span><em>{r.title}</em>{r.detail}</span>}
          </li>
        ))}
        <li className="mara" style={{ "--i": items.length + 1 } as React.CSSProperties}><i aria-hidden /><span><b>Mara</b>{full ? "Deep clinic" : `stopped at ${stopped}`}</span></li>
        {!full && <li className="ahead"><i aria-hidden /><span>Deep clinic</span></li>}
      </ol>
    </div>
  );
}

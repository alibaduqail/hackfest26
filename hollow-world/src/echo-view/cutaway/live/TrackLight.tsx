// "Light the track": the one placement vocabulary. Every section is dark; a beacon lights its own section along the rail; lit sections
// that hear each other (reach.ts) meet end to end and read as one line of light; an end with no lit neighbour fades out, cut off.
// Mara's route ahead is chevrons on the rail, the flood pulses red on its section, the warn-here chain is a dashed outline along the
// track, and flood news runs along the lit line one section per tick (the engine's own seal pulses).
// Performance: stroke and opacity only, no filters. The static layer re-renders per tick; the hover preview is attribute writes on
// pre-rendered paths (no React render per pointer move); the two looping/animated bits live in their own small composited SVG.
import { type CSSProperties, memo, useEffect, useRef } from "react";
import type { Pulse } from "../../../echo/types";
import { type Track, tracks } from "../run";
import { RAIL_HEIGHT as H, RAIL_WIDTH as W } from "./hit";
import { type Graph, previewReach } from "./reach";
import { chevrons, litEnds, pulseEntry } from "./track-light";
import "./track-light.css";

export interface TrackLightProps {
  graph: Graph;
  lit: ReadonlySet<string>; // live beacons
  pending: ReadonlyMap<string, number | null>; // queued (null) or building (minutes until live)
  route: readonly string[]; // Mara's sections still ahead, in order
  flood: { id: string; sealed: boolean } | null;
  chain: string[] | null; // warn-here chain while the flood is announced (null: none to show)
  pulses: readonly Pulse[];
  previousPulses: readonly Pulse[];
  tick: number;
  stepMs: number;
  preview: string | null; // a placeable section under the pointer or keyboard selection
  focus: string | null; // the keyboard selection when it cannot take a beacon
}

const px = (t: Pick<Track, "a" | "b">) => [t.a[0] * W, t.a[1] * H, t.b[0] * W, t.b[1] * H] as const;
const d = (t: Pick<Track, "a" | "b">) => { const [x1, y1, x2, y2] = px(t); return `M${x1} ${y1}L${x2} ${y2}`; };
function offset(t: Track, by: number) {
  const [x1, y1, x2, y2] = px(t);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / len) * by, ny = ((x2 - x1) / len) * by;
  return `M${x1 + nx} ${y1 + ny}L${x2 + nx} ${y2 + ny}`;
}
const plural = (n: number) => n + (n === 1 ? " beacon" : " beacons");

function TrackLightBody({ graph, lit, pending, route, flood, chain, pulses, previousPulses, tick, stepMs }: Omit<TrackLightProps, "preview" | "focus">) {
  const all = [...tracks.values()];
  const shown = new Set([...lit, ...pending.keys()]);
  const ends = litEnds(tracks, graph, shown);
  // Flood news so far this run: every section the engine's seal pulse has touched. Reset on a new run.
  const heard = useRef({ tick: 0, ids: new Set<string>() });
  if (tick < heard.current.tick || tick === 0) heard.current.ids.clear();
  heard.current.tick = tick;
  for (const p of pulses) if (p.kind === "seal") heard.current.ids.add(p.sectorId);
  const seal = pulses.filter((p) => p.kind === "seal" && tracks.has(p.sectorId));
  const before = previousPulses.filter((p) => p.kind === "seal" && tracks.has(p.sectorId));
  const chainLeft = chain ? chain.filter((id) => !lit.has(id) && !pending.has(id)).length : 0;
  const head = chain?.length ? tracks.get(chain[0]) : flood ? tracks.get(flood.id) : undefined;
  return (
    <>
      <svg className="tl-static" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {[...ends].map(([id, e]) => {
            const [x1, y1, x2, y2] = px(tracks.get(id)!);
            return (
              <linearGradient key={id} id={"tl-g-" + id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                <stop offset="0" stopOpacity={e.a ? 1 : 0} />
                <stop offset={e.a ? 0 : .34} stopOpacity="1" />
                <stop offset={e.b ? 1 : .66} stopOpacity="1" />
                <stop offset="1" stopOpacity={e.b ? 1 : 0} />
              </linearGradient>
            );
          })}
        </defs>
        <g className="tl-dark">
          {all.map((t) => <path key={t.sectorId} className="bed" d={d(t)} />)}
          {all.filter((t) => !shown.has(t.sectorId)).map((t) => <path key={t.sectorId} className={"rail" + (t.level >= 3 ? " deep" : "")} d={d(t)} />)}
        </g>
        {chain && chain.map((id) => {
          const t = tracks.get(id);
          if (!t) return null;
          const done = lit.has(id) || pending.has(id);
          return <path key={id} className={"tl-warn" + (done ? " done" : "")} d={offset(t, 14) + offset(t, -14)} />;
        })}
        {[...ends.keys()].map((id) => {
          const t = tracks.get(id)!;
          const soon = pending.has(id);
          return (
            <g key={id} className={"tl-lit" + (soon ? " soon" : "")} style={{ "--tl-g": `url(#tl-g-${id})` } as CSSProperties}>
              <path className="glow" d={d(t)} />
              <path className="core" d={d(t)} />
              {heard.current.ids.has(id) && !soon && <path className="news" d={d(t)} />}
            </g>
          );
        })}
        {flood?.sealed && tracks.has(flood.id) && <path className="tl-flood sealed" d={d(tracks.get(flood.id)!)} />}
        <g className="tl-route">
          {route.filter((id) => tracks.has(id) && !(flood?.sealed && flood.id === id)).flatMap((id) =>
            chevrons(tracks.get(id)!, W, H).map((c, i) => (
              <path key={id + i} className={lit.has(id) ? "on-lit" : ""} d="M-5 -6L2 0L-5 6" transform={`translate(${c.x} ${c.y}) rotate(${c.deg})`} />
            ))
          )}
        </g>
        {[...pending].map(([id, n]) => {
          if (n === null || !tracks.has(id)) return null;
          const [x1, y1, x2, y2] = px(tracks.get(id)!);
          return <text key={id} className="tl-count" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 16}>{n}</text>;
        })}
        <g className="tl-pv">
          {all.map((t) => <path key={t.sectorId} data-sec={t.sectorId} d={d(t)} />)}
        </g>
      </svg>
      <svg className="tl-anim" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        {flood && !flood.sealed && tracks.has(flood.id) && <path className="tl-flood warning" d={d(tracks.get(flood.id)!)} />}
        {seal.map((p) => {
          const t = tracks.get(p.sectorId)!;
          const from = before.filter((q) => q.sectorId !== p.sectorId && graph.get(p.sectorId)?.includes(q.sectorId)).map((q) => tracks.get(q.sectorId)!);
          const entry = pulseEntry(t, from);
          const [x1, y1, x2, y2] = px(t);
          const len = Math.hypot(x2 - x1, y2 - y1);
          const path = entry === "b" ? `M${x2} ${y2}L${x1} ${y1}` : `M${x1} ${y1}L${x2} ${y2}`;
          return (
            <path key={tick + p.sectorId} className={"tl-pulse" + (entry ? "" : " origin")} d={path}
              style={{ "--len": len + "px", "--ms": Math.max(240, stepMs * .9) + "ms" } as CSSProperties} />
          );
        })}
      </svg>
      {chain && head && (
        <span className={"tl-chip" + (chain.length && !chainLeft ? " done" : "")}
          style={{ left: Math.min(.8, (head.a[0] + head.b[0]) / 2 + .03) * 100 + "%", top: ((head.a[1] + head.b[1]) / 2) * 100 + "%" }}>
          {!chain.length ? "Mara sees this flood from the fork" : chainLeft ? `Warn here · ${plural(chainLeft)}` : "Warning chain lit"}
        </span>
      )}
    </>
  );
}
const Body = memo(TrackLightBody);

export function TrackLight({ preview, focus, ...rest }: TrackLightProps) {
  const root = useRef<HTMLDivElement>(null);
  const shownKey = [...rest.lit, ...rest.pending.keys()].sort().join(",");
  // Hover and keyboard preview: attribute writes on the pre-rendered preview paths, so moving the pointer never re-renders the layer.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll("[data-pv]").forEach((e) => e.removeAttribute("data-pv"));
    const set = (id: string, v: string) => el.querySelector(`.tl-pv [data-sec="${id}"]`)?.setAttribute("data-pv", v);
    if (preview) {
      const shown = new Set([...rest.lit, ...rest.pending.keys()]);
      const { linked } = previewReach(rest.graph, shown, preview);
      set(preview, linked.length ? "self" : "self-iso");
      for (const n of linked) set(n, "join");
    } else if (focus) set(focus, "focus");
  }, [preview, focus, shownKey, rest.graph]); // eslint-disable-line react-hooks/exhaustive-deps -- shownKey stands in for lit and pending
  return (
    <div className="track-light" ref={root}>
      <Body {...rest} />
    </div>
  );
}

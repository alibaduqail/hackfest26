// Blackout marks: everything drawn over the darkness (darkness.ts) that is not a pod. One vocabulary: dark, light pools, red flood, red ripple.
// - Warn here: dashed pool outlines on the chain sections still dark, and one chip with the count.
// - The flood: announced, its section flashes red under a siren with "Flood in N"; sealed, water fills the section and it reads FLOODED.
// - The warning: a red ripple runs pool to pool, one hop per tick (the engine's seal pulses), and breaks where the light ends.
// - Hover and keyboard preview: attribute writes on pre-rendered outlines, so the pointer never re-renders the layer.
// Performance: HTML boxes animated by transform and opacity only (compositor work), sized in container units; no filters, no SVG repaints.
import { type CSSProperties, memo, useEffect, useRef } from "react";
import type { Pulse } from "../../../echo/types";
import { tracks } from "../run";
import { type Fizzle, fizzles, poolOf, waterBox, WORLD_H, WORLD_W } from "./pools";
import { type Graph, previewReach } from "./reach";
import "./blackout.css";

export interface BlackoutProps {
  graph: Graph;
  lit: ReadonlySet<string>; // live beacons
  pending: ReadonlyMap<string, number | null>; // queued (null) or building (minutes until live)
  flood: { id: string; sealed: boolean; until: number; lead: number } | null;
  chain: string[] | null; // warn-here chain: the sections the flood news must cross to reach Mara, from the announcement until she hears (null: none)
  pulses: readonly Pulse[];
  tick: number;
  stepMs: number;
  preview: string | null; // a placeable section under the pointer or keyboard selection
  focus: string | null; // the keyboard selection when it cannot take a beacon
}

const pct = (x: number, of: number) => (x / of) * 100 + "%";
/** A rotated capsule the size of a section's pool, positioned in % and sized in world px (scaled by the container, see blackout.css). */
function capsule(id: string, grow = 0): CSSProperties {
  const p = poolOf(tracks.get(id)!);
  return { left: pct(p.cx, WORLD_W), top: pct(p.cy, WORLD_H), "--w": p.len + 2 * p.r + grow, "--h": 2 * p.r + grow, "--rot": p.deg + "deg" } as CSSProperties;
}
const plural = (n: number) => n + (n === 1 ? " beacon" : " beacons");

function BlackoutBody({ graph, lit, pending, flood, chain, pulses, tick, stepMs }: Omit<BlackoutProps, "preview" | "focus">) {
  const all = [...tracks.keys()];
  // Where the news died this run: kept until the run restarts, so the break stays on the map after the ripple has gone.
  const dead = useRef({ tick: 0, marks: new Map<string, Fizzle & { born: number }>() });
  if (tick < dead.current.tick || tick === 0) dead.current.marks.clear();
  dead.current.tick = tick;
  // Only where the news needed to go: a break toward a dark section of Mara's warning chain. A dark city beside the lit region is
  // not a break, because a pod waiting at that city still hears.
  for (const f of fizzles(tracks, graph, lit, pulses).filter((f) => chain?.includes(f.to))) {
    const k = f.to + "@" + f.at.join(",");
    if (!dead.current.marks.has(k)) dead.current.marks.set(k, { ...f, born: tick });
  }
  for (const [k, f] of dead.current.marks) if (lit.has(f.to) || pending.has(f.to)) dead.current.marks.delete(k); // lit since: no longer a dead end
  const seal = pulses.filter((p) => p.kind === "seal" && tracks.has(p.sectorId));
  const need = (chain ?? []).filter((id) => tracks.has(id) && !lit.has(id) && !pending.has(id));
  const head = chain?.length ? chain[0] : flood?.id;
  const headPool = head && tracks.has(head) ? poolOf(tracks.get(head)!) : null;
  const floodTrack = flood && tracks.get(flood.id);
  const water = floodTrack ? waterBox(floodTrack) : null;
  const ms = Math.max(260, stepMs * .95);
  // Announced: a little water already, rising each minute; sealed: the section fills.
  const fill = !flood ? 0 : flood.sealed ? 1 : .1 + .22 * (1 - Math.max(0, flood.until) / Math.max(1, flood.lead));
  return (
    <>
      <div className="bo-pv">{all.map((id) => <i key={id} data-sec={id} style={capsule(id, 8)} />)}</div>
      {need.map((id) => <i key={"n" + id} className="bo-need" style={capsule(id)} />)}
      {[...pending].map(([id, n]) => {
        if (n === null || !tracks.has(id)) return null;
        const p = poolOf(tracks.get(id)!);
        return <b key={"c" + id} className="bo-count" style={{ left: pct(p.cx, WORLD_W), top: pct(p.cy - 18, WORLD_H) }}>{n}</b>;
      })}
      {flood && water && (
        <div className={"bo-water" + (flood.sealed ? " sealed" : "")}
          style={{ left: pct(water.left, WORLD_W), top: pct(water.top, WORLD_H), width: pct(water.width, WORLD_W), height: pct(water.height, WORLD_H) }}>
          <i style={{ "--fill": fill } as CSSProperties} />
        </div>
      )}
      {flood && !flood.sealed && tracks.has(flood.id) && <i className="bo-flood" style={capsule(flood.id, 16)} />}
      {seal.map((p) => <i key={tick + p.sectorId} className="bo-ripple" style={{ ...capsule(p.sectorId), "--ms": ms + "ms" } as CSSProperties} />)}
      {[...dead.current.marks.values()].map((f) => (
        <i key={"f" + f.to + f.at.join(",")} className={"bo-fizzle" + (f.born === tick ? " now" : "")}
          style={{ left: pct(f.at[0] * WORLD_W, WORLD_W), top: pct(f.at[1] * WORLD_H - 34, WORLD_H), "--rot": f.deg + "deg", "--ms": ms + "ms" } as CSSProperties}>
          <svg viewBox="-40 -40 80 80" aria-hidden="true">
            <path d="M8 -30A31 31 0 0 1 8 30" />
            <path d="M22 -36A43 43 0 0 1 22 36" />
          </svg>
        </i>
      ))}
      {flood && floodTrack && water && (() => {
        const p = poolOf(floodTrack);
        const top = water.top + water.height * .42;
        return (
          <span className={"bo-flood-tag" + (flood.sealed ? " sealed" : "")} style={{ left: pct(water.left + water.width / 2, WORLD_W), top: pct(top, WORLD_H) }}>
            {!flood.sealed && (
              <svg className="bo-siren" viewBox="0 0 20 16" aria-hidden="true">
                <path className="dome" d="M5 13V8a5 5 0 0 1 10 0v5z" />
                <path className="base" d="M3 13h14v2H3z" />
                <path className="rays" d="M1 6l2 1M19 6l-2 1M10 0v2M3 1.5l1.5 1.5M17 1.5L15.5 3" />
              </svg>
            )}
            {flood.sealed ? "Flooded" : "Flood in " + Math.max(0, flood.until)}
          </span>
        );
      })()}
      {chain && headPool && (
        <span className={"bo-chip" + (chain.length && !need.length ? " done" : "")}
          style={{ left: pct(Math.min(WORLD_W * .8, headPool.cx + headPool.len / 2 + 40), WORLD_W), top: pct(headPool.cy + 20, WORLD_H) }}>
          {!chain.length ? "Mara sees this flood from the fork" : need.length ? `Warn here · ${plural(need.length)}` : "Warning chain lit"}
        </span>
      )}
    </>
  );
}
const Body = memo(BlackoutBody);

export function Blackout({ preview, focus, ...rest }: BlackoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const shownKey = [...rest.lit, ...rest.pending.keys()].sort().join(",");
  // Hover and keyboard preview: attribute writes on the pre-rendered outlines, so moving the pointer never re-renders the layer.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.querySelectorAll("[data-pv]").forEach((e) => e.removeAttribute("data-pv"));
    const set = (id: string, v: string) => el.querySelector(`.bo-pv [data-sec="${id}"]`)?.setAttribute("data-pv", v);
    if (preview) {
      const shown = new Set([...rest.lit, ...rest.pending.keys()]);
      const { linked } = previewReach(rest.graph, shown, preview);
      set(preview, linked.length ? "self" : "self-iso");
      for (const n of linked) set(n, "join");
    } else if (focus) set(focus, "focus");
  }, [preview, focus, shownKey, rest.graph]); // eslint-disable-line react-hooks/exhaustive-deps -- shownKey stands in for lit and pending
  return (
    <div className="blackout" ref={root}>
      <Body {...rest} />
    </div>
  );
}

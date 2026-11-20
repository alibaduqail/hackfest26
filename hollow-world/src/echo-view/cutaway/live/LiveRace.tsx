// The debrief's race down the shaft: the same run played by each baseline, one column each, beside the player's own. A dotted ghost column
// runs from the depot to where Mara stopped (a red cross) or to the clinic (a ring); the player's column is solid amber. Depth comes from the
// last rail Mara was logged on (its level 1..5 in the shared track map), so the cross sits as deep as she really got. Decorative: the
// debrief keeps an equivalent table for screen readers.
import type { CSSProperties } from "react";
import type { RunOutcome } from "../../../echo/baseline";
import { tracks } from "../run";

export interface RaceColumn { id: string; head: string[]; run: RunOutcome; you?: boolean }

const LEVELS = 5, TOP = 52, H = 300, COL = 88, DOT = 10;

/** 0 = never left the depot, 1..5 = the level she was last on, 6 = the clinic. */
export function depthOf(o: RunOutcome, nurseId = "MED-1"): number {
  if (o.mara !== null) return LEVELS + 1;
  const last = [...o.log].reverse().find((l) => l.podId === nurseId && l.sectorId && tracks.get(l.sectorId));
  return last ? tracks.get(last.sectorId!)!.level : 0;
}

export function LiveRace({ cols, from, to }: { cols: RaceColumn[]; from: string; to: string }) {
  const y = (d: number) => TOP + (d / (LEVELS + 1)) * H;
  const W = cols.length * COL + 112;
  const x = (k: number) => 36 + k * COL;
  const d = (ms: number) => ({ "--d": `${Math.round(ms)}ms` }) as CSSProperties;
  const lines = (cx: number, cy: number, t: string[], cls: string, delay: number) => (
    <text className={cls} x={cx} y={cy} textAnchor="middle" style={d(delay)}>{t.map((s, i) => <tspan key={i} x={cx} dy={i ? 15 : 0}>{s}</tspan>)}</text>
  );
  return (
    <svg className="lv-race" width={W} height={TOP + H + 76} aria-hidden="true">
      <line className="rung" x1={x(0) - 20} x2={x(cols.length - 1) + 20} y1={y(0)} y2={y(0)} />
      <line className="rung" x1={x(0) - 20} x2={x(cols.length - 1) + 20} y1={y(LEVELS + 1)} y2={y(LEVELS + 1)} />
      <text className="place" x={x(cols.length - 1) + 28} y={y(0) + 4}>{from}</text>
      <text className="place" x={x(cols.length - 1) + 28} y={y(LEVELS + 1) + 4}>{to}</text>
      {cols.map((c, k) => {
        const cx = x(k), depth = depthOf(c.run), y1 = y(depth), made = c.run.mara !== null;
        const n = Math.max(1, Math.floor((y1 - y(0)) / DOT));
        const ms = (i: number) => (i / n) * 650 + k * 120;
        return (
          <g key={c.id} className={"col" + (c.you ? " you" : "") + (made ? " made" : " dead")}>
            {lines(cx, 18, c.head, "head", 0)}
            {c.you
              ? <line className="path" x1={cx} x2={cx} y1={y(0)} y2={y1} style={d(k * 120)} />
              : Array.from({ length: n + 1 }, (_, i) => <circle key={i} cx={cx} cy={y(0) + (i / n) * (y1 - y(0))} r={1.8} style={d(ms(i))} />)}
            {made
              ? <circle className="end" cx={cx} cy={y1} r={c.you ? 6 : 4.5} style={d(ms(n))} />
              : <path className="x" d={`M${cx - 6} ${y1 - 6}l12 12m0 -12l-12 12`} style={d(ms(n))} />}
            {lines(cx, TOP + H + 32, [made ? `min ${c.run.mara}` : "never", c.run.medicine === null ? "med never" : `med ${c.run.medicine}`], "out", ms(n) + 80)}
          </g>
        );
      })}
    </svg>
  );
}

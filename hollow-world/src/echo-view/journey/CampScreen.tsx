import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { LIMIT } from "../../echo/journey";
import { MaraBubble } from "../characters/Bubble";
import { campLine } from "../characters/bubbles";
import { RelayButton } from "../relay/Relay";
import { applyEffect, consequenceOf, formatEffect, LEG_IDS, LEG_NAMES, retryCosts, trailModel } from "./helpers";
import { useEnterKey } from "./keys";
import type { CampScreenProps } from "./props";
import { SupplyLine } from "./ResourceBar";
import { TrailRail } from "./TrailMap";
import { useParallax } from "./useParallax";

interface Geo { sx: number; maraY: number; choiceY: number; mergeY: number; contY: number; xs: number[]; widths: number[]; route: string[] }

/** The fork, in the stage's pixels: Mara's dot on the trail line, one branch down to each choice, every branch rejoining at Continue down. */
function forkGeo(w: number, h: number, n: number, hereLevel: number): Geo {
  const sx = Math.round(w * 0.45);
  const maraY = Math.max(Math.round(h * 0.2), 64 + hereLevel * 40);
  const choiceY = maraY + 168, mergeY = choiceY + 104, contY = mergeY + 100;
  const gap = Math.min(300, Math.floor((w - 48) / n));
  const xs = Array.from({ length: n }, (_, i) => Math.round(sx + (i - (n - 1) / 2) * gap));
  const k = (choiceY - maraY) * 0.55, k2 = (contY - mergeY) * 0.6;
  // One unbroken path per route: Mara's dot, down to the choice's dot centre, straight down beside its text, then back to Continue down.
  // The dots are opaque, so a line ending at a dot's centre is hidden inside it at every scale (hover grows the ring, never the path).
  const route = xs.map((x) => `M${sx} ${maraY} C${sx} ${maraY + k} ${x} ${choiceY - k} ${x} ${choiceY} L${x} ${mergeY} C${x} ${mergeY + k2} ${sx} ${contY - k2} ${sx} ${contY}`);
  return { sx, maraY, choiceY, mergeY, contY, xs, widths: xs.map((x) => Math.max(120, Math.min(gap - 24, w - x - 24))), route };
}

/** What the pick did, drawn on its branch instead of told: a bad choice sends a short dotted red spur off the branch that dead-ends in a cross (a flood nobody announced);
 * a good one lights three beacon dots along the branch, the news hopping. Left branches spur outward left, the rest right, so it never crosses a neighbour. */
function Consequence({ g, i, c }: { g: Geo; i: number; c: ReturnType<typeof consequenceOf> }) {
  if (!c) return null;
  const x = g.xs[i], d = x < g.sx - 1 ? -1 : 1, y = g.choiceY + 60;
  const tag = (tx: number, ty: number) => <text x={tx} y={ty} textAnchor={d < 0 ? "end" : "start"} style={{ "--d": "620ms" } as React.CSSProperties}>{c.tag}</text>;
  if (c.tone === "good") {
    return (
      <g className="j-csq good" role="img" aria-label={c.tag}>
        {[0, 1, 2].map((k) => <circle key={k} cx={x} cy={y + 2 + k * 17} r={4.5} style={{ "--d": `${120 + k * 140}ms` } as React.CSSProperties} />)}
        {tag(x + d * 18, y + 40)}
      </g>
    );
  }
  const ex = x + d * 58, ey = y + 22, n = 6;
  return (
    <g className="j-csq bad" role="img" aria-label={c.tag}>
      {Array.from({ length: n }, (_, k) => <circle key={k} cx={x + (ex - x) * (k / n)} cy={y + (ey - y) * (k / n)} r={1.8} style={{ "--d": `${k * 70}ms` } as React.CSSProperties} />)}
      <path d={`M${ex - 5} ${ey - 5}l10 10m0 -10l-10 10`} style={{ "--d": "460ms" } as React.CSSProperties} />
      {tag(ex + d * 14, ey + 4)}
    </g>
  );
}

/** Camp: the situation on the left; on the right the trail line forks at Mara into the choices and rejoins at Continue down. Pick (click, 1-3, arrows), Continue (Enter). */
export function CampScreen({ event, res, limit = LIMIT, legIndex, attempt, log, onPick, onContinue }: CampScreenProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 920, h: 900 }); // SSR / first paint; the stage measures itself right after
  const stage = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => setPicked(null), [event.id, legIndex, attempt, log.length]); // log.length: Scavenge stays in camp, so the card must reset on any new choice
  useEffect(() => { if (picked) next.current?.querySelector<HTMLElement>(".rl-node")?.focus(); }, [picked]);

  const choice = event.choices.find((c) => c.id === picked);
  const pickIdx = event.choices.findIndex((c) => c.id === picked);
  const pick = (id: string) => { if (picked) return; setPicked(id); onPick?.(id); };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || !/^[1-9]$/.test(e.key)) return;
      const c = event.choices[Number(e.key) - 1];
      if (c) pick(c.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEnterKey(() => picked && onContinue(picked), !!picked);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => { const r = el.getBoundingClientRect(); setSize((s) => (s.w === Math.round(r.width) && s.h === Math.round(r.height) ? s : { w: Math.round(r.width), h: Math.round(r.height) })); };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { hereLevel } = trailModel(legIndex, log);
  const g = useMemo(() => forkGeo(size.w, size.h, event.choices.length, hereLevel), [size.w, size.h, event.choices.length, hereLevel]);
  const hot = picked ? null : hover ?? focus;
  const bg = useRef<HTMLDivElement>(null);
  const lean = useParallax(bg, stage);
  useEffect(() => { const n = event.choices.length; lean(hot === null || n < 2 ? 0 : (hot - (n - 1) / 2) / ((n - 1) / 2)); }, [hot, event.choices.length, lean]);

  const arrows = (i: number, e: KeyboardEvent<HTMLButtonElement>) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir || picked) return;
    e.preventDefault();
    btns.current[(i + dir + event.choices.length) % event.choices.length]?.focus();
  };

  const leg = LEG_NAMES[LEG_IDS[Math.min(legIndex, LEG_IDS.length - 1)]];
  const where = attempt > 0 ? `${leg}, retry ${attempt}` : legIndex === 0 ? "Before the first leg" : `After ${LEG_NAMES[LEG_IDS[legIndex - 1]]}`;
  const [camp, title] = event.title.includes(" · ") ? event.title.split(" · ", 2) : [null, event.title];
  const n = event.choices.length;

  return (
    <div className="g-screen j-camp2">
      <div className="j-title-bg j-camp-bg" ref={bg} aria-hidden />
      <section className="j-cl" aria-labelledby="j-event-title">
        <p className="j-where">{camp ? `${camp} · ${where}` : where}</p>
        <h2 id="j-event-title">{title}</h2>
        <SupplyLine res={res} limit={limit} preview={choice ? applyEffect(res, choice.effect) : undefined} />
        <p className="j-key">{picked ? "Enter to continue down" : n === 1 ? "Press 1 to choose" : `Press 1–${n} to choose`}</p>
      </section>

      <MaraBubble text={campLine(event.id)} resetKey={`${event.id}-${legIndex}-${attempt}`} />
      <div className="j-stage" ref={stage}>
        <TrailRail legIndex={legIndex} log={log} x={g.sx} maraY={g.maraY} contY={g.contY} height={size.h} />
        <svg className="j-fork" width="100%" height={size.h} aria-hidden>
          {g.xs.map((_, i) => {
            const state = pickIdx === i ? "lit" : pickIdx >= 0 ? "off" : hot === i ? "lit" : "";
            return (
              <g key={i} className={`j-branch ${state}`}>
                <path d={g.route[i]} />
              </g>
            );
          })}
          {choice && pickIdx >= 0 && <Consequence key={choice.id} g={g} i={pickIdx} c={consequenceOf(choice)} />}
        </svg>
        <span className="j-mara" style={{ left: g.sx, top: g.maraY }} aria-hidden />

        <div className="j-forks" role="group" aria-label="Choices">
          {event.choices.map((c, i) => {
            const state = picked === null ? "" : c.id === picked ? " picked" : " passed";
            const costs = c.id === "retry" ? retryCosts(log) : formatEffect(c.effect);
            return (
              <button
                key={c.id} ref={(el) => { btns.current[i] = el; }} type="button"
                className={`j-fk${state}`} style={{ left: g.xs[i], top: g.choiceY, width: g.widths[i] }}
                aria-pressed={picked === null ? undefined : c.id === picked} aria-disabled={picked !== null && c.id !== picked}
                onClick={() => pick(c.id)} onKeyDown={(e) => arrows(i, e)}
                onPointerEnter={(e) => { if (e.pointerType !== "touch") setHover(i); }} onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                onFocus={() => setFocus(i)} onBlur={() => setFocus((f) => (f === i ? null : f))}
              >
                <i className="j-fk-dot" aria-hidden />
                <span className="j-fk-label"><span className="j-fk-n" aria-hidden>{i + 1}</span>{c.label}</span>
                <span className="j-fk-cost">
                  {costs.map((k, j) => <span key={k.text} className={k.tone}>{j > 0 && <span className="sep"> · </span>}{k.text}</span>)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="j-go" ref={next} style={{ left: g.sx, top: g.contY }}>
          <RelayButton size="lg" label="Continue down" tone="primary" nav disabled={!picked} onSelect={() => picked && onContinue(picked)} />
        </div>
      </div>
    </div>
  );
}

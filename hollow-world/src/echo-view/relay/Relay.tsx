// Relay: the Echo button language. Buttons are beacon nodes (a dot and a mono label) on one hop line; a light packet travels to the
// hovered or focused node and rests on the current one. Primary = solid amber dot, secondary = hollow teal, danger = rust dot that
// needs a 600 ms hold, disabled = dashed broken dot with a broken hop line into it. Choices (speed, sound) park the packet on the value.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";

export type RelayTone = "primary" | "secondary" | "danger" | "quiet";
export interface RelayItem {
  key: string;
  label: string;
  onSelect?: (e?: MouseEvent<HTMLElement>) => void;
  tone?: RelayTone; // default secondary
  disabled?: boolean;
  hold?: boolean; // hold-to-confirm (Enter or Space too); use with tone "danger"
  nav?: boolean; // the click swaps the screen: ring sweeps out, the swap waits NAV_DELAY_MS
  href?: string; // renders an anchor; plain clicks run onSelect, modified clicks follow the link
  autoFocus?: boolean;
  title?: string;
}
export interface RelayBarProps {
  items: RelayItem[];
  value?: string; // choice mode: the selected key; packet parks on it and every node gets aria-pressed
  rest?: string | null; // where the packet rests in action mode (default: first primary; null = nowhere until hovered)
  size?: "lg" | "md" | "sm";
  label?: string; // aria-label of the group
  className?: string;
  pulseOnChange?: boolean; // choice mode: sonar pulse when the value changes (default true)
}

export const NAV_DELAY_MS = 250;
export const HOLD_MS = 600;
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let navBusy = false;

/** The activation ring. A plain DOM node on document.body, so it outlives the React tree that fired it (the screen swap unmounts that). */
export function fireRing(x: number, y: number) {
  if (reduced() || typeof document === "undefined") return;
  const el = document.createElement("span");
  el.className = "rl-ring";
  el.setAttribute("aria-hidden", "true");
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.addEventListener("animationend", () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/** For custom controls (mission cards): same ring and delay as a navigating node. Runs `go` after the delay, or at once with reduced motion. */
export function activate(from: HTMLElement, go: () => void) {
  if (reduced()) return go();
  if (navBusy) return;
  navBusy = true;
  const r = from.getBoundingClientRect();
  fireRing(r.left + r.width / 2, r.top + r.height / 2);
  setTimeout(() => { try { go(); } finally { navBusy = false; } }, NAV_DELAY_MS);
}

/** Focus ring only after a real keyboard event (autoFocus on first paint must not draw it). */
let kbdUsers = 0;
const onKbdKey = (e: globalThis.KeyboardEvent) => { if (["Tab", "Enter", " ", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) document.documentElement.dataset.kbd = "1"; };
const onPtr = () => { delete document.documentElement.dataset.kbd; };
function kbdModality() {
  if (typeof document === "undefined") return;
  if (kbdUsers++ === 0) { document.addEventListener("keydown", onKbdKey, true); document.addEventListener("pointerdown", onPtr, true); }
  return () => { if (--kbdUsers === 0) { document.removeEventListener("keydown", onKbdKey, true); document.removeEventListener("pointerdown", onPtr, true); } };
}

interface Geo { x: number; y: number }
interface Seg { x1: number; x2: number; y: number; broken: boolean; i: number }

export function RelayBar({ items, value, rest, size = "md", label, className = "", pulseOnChange = true }: RelayBarProps) {
  const choice = value !== undefined;
  const bar = useRef<HTMLDivElement>(null);
  const packet = useRef<HTMLSpanElement>(null);
  const nodes = useRef<(HTMLElement | null)[]>([]);
  const dots = useRef<(HTMLElement | null)[]>([]);
  const [geo, setGeo] = useState<Geo[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [tab, setTab] = useState(0);
  const [holding, setHolding] = useState<number | null>(null);
  const [pulse, setPulse] = useState<{ i: number; n: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastValue = useRef(value);

  const ok = (i: number) => !items[i]?.disabled;
  const restIdx = choice ? items.findIndex((it) => it.key === value)
    : rest === null ? -1 : rest !== undefined ? items.findIndex((it) => it.key === rest) : items.findIndex((it) => it.tone === "primary" && !it.disabled);
  const target = hover ?? focus ?? (restIdx >= 0 && ok(restIdx) ? restIdx : null);
  const tabIdx = ok(tab) ? tab : Math.max(0, items.findIndex((it) => !it.disabled));

  // Geometry comes from the dot rects, never from constants, so a label change cannot break the line or the packet.
  const measure = useCallback(() => {
    const b = bar.current;
    if (!b) return;
    const br = b.getBoundingClientRect();
    const next = dots.current.slice(0, items.length).map((d) => {
      const r = d?.getBoundingClientRect();
      return r ? { x: Math.round((r.left + r.width / 2 - br.left) * 10) / 10, y: Math.round((r.top + r.height / 2 - br.top) * 10) / 10 } : { x: 0, y: 0 };
    });
    setGeo((g) => (JSON.stringify(g) === JSON.stringify(next) ? g : next));
  }, [items.length]);
  const sig = items.map((i) => i.label + (i.disabled ? "!" : "")).join("|");
  useLayoutEffect(measure, [measure, sig, size]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (bar.current) ro.observe(bar.current);
    nodes.current.forEach((n) => n && ro.observe(n));
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure, items.length]);

  // The packet travels: WAAPI from wherever it is right now to the target dot. A geometry change alone snaps it (no travel).
  const placed = useRef<number | null>(null);
  const anim = useRef<Animation | undefined>(undefined);
  useLayoutEffect(() => {
    const el = packet.current, b = bar.current;
    if (!el || !b) return;
    const g = target === null ? null : geo[target];
    if (!g || (g.x === 0 && g.y === 0)) { el.style.opacity = "0"; placed.current = null; return; }
    const to = `translate(${g.x}px, ${g.y}px)`;
    const travel = placed.current !== null && placed.current !== target && !reduced() && el.style.opacity === "1";
    if (travel) {
      const cur = el.getBoundingClientRect(), br = b.getBoundingClientRect();
      const fx = cur.left - br.left + cur.width / 2, fy = cur.top - br.top + cur.height / 2;
      const dist = Math.hypot(g.x - fx, g.y - fy);
      anim.current?.cancel();
      el.style.transform = to;
      anim.current = el.animate([{ transform: `translate(${fx}px, ${fy}px)` }, { transform: to }], { duration: Math.min(460, 200 + dist * 0.45), easing: "cubic-bezier(.23, 1, .32, 1)" });
    } else {
      anim.current?.cancel();
      el.style.transform = to;
    }
    el.style.opacity = "1";
    placed.current = target;
  }, [target, geo]);

  // choice mode: a small sonar pulse where the value lands
  useEffect(() => {
    if (!choice || lastValue.current === value) return;
    lastValue.current = value;
    const i = items.findIndex((it) => it.key === value);
    if (pulseOnChange && i >= 0 && !reduced()) setPulse((p) => ({ i, n: (p?.n ?? 0) + 1 }));
  }, [value, choice, items, pulseOnChange]);

  const segs: Seg[] = [];
  for (let i = 0; i + 1 < geo.length && i + 1 < items.length; i++) {
    const a = geo[i], c = geo[i + 1];
    if (Math.abs(a.y - c.y) > 2 || c.x <= a.x) continue; // wrapped onto another row: no line across the gap
    segs.push({ x1: a.x + 11, x2: c.x - 11, y: a.y, broken: !!items[i].disabled || !!items[i + 1].disabled, i });
  }

  const startHold = (i: number) => {
    if (holding !== null || !ok(i)) return;
    setHolding(i);
    holdTimer.current = setTimeout(() => {
      setHolding(null);
      const r = dots.current[i]?.getBoundingClientRect();
      if (r) setPulse((p) => ({ i, n: (p?.n ?? 0) + 1 }));
      items[i].onSelect?.();
    }, HOLD_MS);
  };
  const cancelHold = () => { clearTimeout(holdTimer.current); setHolding(null); };
  useEffect(() => () => { clearTimeout(holdTimer.current); navBusy = false; }, []);
  useEffect(kbdModality, []);

  const click = (i: number, e: MouseEvent<HTMLElement>) => {
    const it = items[i];
    if (it.disabled) return e.preventDefault();
    if (it.hold) return e.preventDefault(); // hold nodes fire from the timer only
    if (it.href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return; // let the browser follow the link
    if (it.href) e.preventDefault();
    const el = e.currentTarget;
    const stub = it.href ? ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, button: 0, preventDefault() {}, currentTarget: el } as unknown as MouseEvent<HTMLElement>) : e;
    if (it.nav) {
      activate(dots.current[i]!, () => it.onSelect?.(stub));
    } else {
      if (!choice && !reduced()) setPulse((p) => ({ i, n: (p?.n ?? 0) + 1 }));
      it.onSelect?.(stub);
    }
  };

  const keyDown = (i: number, e: KeyboardEvent<HTMLElement>) => {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (dir || e.key === "Home" || e.key === "End") {
      const idx = items.map((_, k) => k).filter(ok);
      if (!idx.length) return;
      const at = idx.indexOf(i);
      const next = e.key === "Home" ? idx[0] : e.key === "End" ? idx[idx.length - 1] : idx[(at + dir + idx.length) % idx.length];
      e.preventDefault(); setTab(next); nodes.current[next]?.focus();
    } else if (items[i].hold && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (!e.repeat) startHold(i);
    }
  };

  return (
    <div ref={bar} className={`rl-bar ${className}`} data-size={size} role="group" aria-label={label}>
      {segs.map((s) => (
        <i key={s.i} className="rl-seg" aria-hidden data-broken={s.broken || undefined} data-lit={(target === s.i || target === s.i + 1) && !s.broken || undefined}
          style={{ left: s.x1, width: Math.max(0, s.x2 - s.x1), top: s.y }} />
      ))}
      <span ref={packet} className="rl-packet" aria-hidden />
      {items.map((it, i) => {
        const tone = it.tone ?? "secondary";
        const Tag = it.href ? "a" : "button";
        const selected = choice && it.key === value;
        return (
          <Tag
            key={it.key}
            ref={(el: HTMLElement | null) => { nodes.current[i] = el; }}
            className="rl-node"
            data-tone={tone} data-selected={selected || undefined} data-hot={target === i || undefined} data-holding={holding === i || undefined}
            {...(it.href ? { href: it.href } : { type: "button" as const })}
            aria-disabled={it.disabled || undefined}
            {...(!it.href && it.disabled ? { disabled: true } : {})}
            aria-pressed={choice ? selected : undefined}
            aria-description={it.hold ? "Hold to confirm" : undefined}
            title={it.title}
            tabIndex={i === tabIdx ? 0 : -1}
            autoFocus={it.autoFocus}
            onClick={(e: MouseEvent<HTMLElement>) => click(i, e)}
            onKeyDown={(e: KeyboardEvent<HTMLElement>) => keyDown(i, e)}
            onKeyUp={(e: KeyboardEvent<HTMLElement>) => { if (it.hold && (e.key === "Enter" || e.key === " ")) cancelHold(); }}
            onPointerEnter={(e: PointerEvent<HTMLElement>) => { if (e.pointerType !== "touch" && ok(i)) setHover(i); }}
            onPointerLeave={() => { setHover((h) => (h === i ? null : h)); if (it.hold) cancelHold(); }}
            onPointerDown={(e: PointerEvent<HTMLElement>) => { if (it.hold && e.button === 0) startHold(i); }}
            onPointerUp={() => it.hold && cancelHold()}
            onPointerCancel={() => it.hold && cancelHold()}
            onFocus={(e: React.FocusEvent<HTMLElement>) => { setTab(i); if (e.currentTarget.matches(":focus-visible")) setFocus(i); }}
            onBlur={() => { setFocus((f) => (f === i ? null : f)); if (it.hold) cancelHold(); }}
          >
            <span className="rl-label">{it.label}</span>
            <i className="rl-dot" aria-hidden ref={(el) => { dots.current[i] = el; }}>
              {it.hold && (
                <svg className="rl-hold" viewBox="0 0 32 32" aria-hidden><circle className="trk" cx="16" cy="16" r="13" /><circle className="fill" cx="16" cy="16" r="13" /></svg>
              )}
              {pulse?.i === i && <b key={pulse.n} className="rl-pulse" />}
            </i>
          </Tag>
        );
      })}
    </div>
  );
}

/** One node on its own (no line, no packet travel): for a lone action such as Continue or Skip. */
export function RelayButton(props: Omit<RelayItem, "key"> & { size?: RelayBarProps["size"]; className?: string }) {
  const { size, className, ...item } = props;
  return <RelayBar items={[{ key: "one", ...item }]} size={size} className={className} rest="one" />;
}

import { useCallback, useEffect, useRef, type RefObject } from "react";

/** Depth amounts in px: the far backdrop moves most, the trail layer less, the text column not at all. */
const FAR = { x: 16, y: 10 };
const MID = { x: 5, y: 3 };
const LEAN = 6; // extra far-layer shift toward a hovered or focused branch
const SCALE = 1.07; // the backdrop over-scans so its edges never show: margin >= pointer + lean + drift
const DRIFT = { px: 18, ms: 800 }; // enter: the backdrop starts this far up and settles down
const DAMP = 0.075; // per-frame lerp toward the target (about 60fps), so motion trails the pointer instead of tracking it

const prefersReduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Depth parallax for the journey screens: `far` (the backdrop art) and `mid` (the trail layer) drift against the pointer.
 * Refs and rAF only, so React never re-renders on a pointer move; transforms only; idle once settled; paused while the tab is
 * hidden. Reduced motion, touch and keyboard-only use get a static scene. Returns `lean(-1..1)` to tilt toward a branch.
 */
export function useParallax(far: RefObject<HTMLElement | null>, mid: RefObject<HTMLElement | null>): (dir: number) => void {
  const leanTo = useRef<(dir: number) => void>(() => {});
  useEffect(() => {
    const f = far.current, m = mid.current;
    if (!f || prefersReduced()) return;
    const tgt = { x: 0, y: 0, lean: 0 }, cur = { x: 0, y: 0, lean: 0 };
    const t0 = performance.now();
    let raf = 0, tab = true;
    f.style.willChange = "transform";
    if (m) m.style.willChange = "transform";

    const frame = (now: number) => {
      raf = 0;
      const k = Math.min(1, (now - t0) / DRIFT.ms);
      const drift = -DRIFT.px * Math.pow(1 - k, 4); // ease-out quartic, close to the house curve
      cur.x += (tgt.x - cur.x) * DAMP; cur.y += (tgt.y - cur.y) * DAMP; cur.lean += (tgt.lean - cur.lean) * DAMP;
      f.style.transform = `translate3d(${(-cur.x * FAR.x - cur.lean * LEAN).toFixed(2)}px, ${(-cur.y * FAR.y + drift).toFixed(2)}px, 0) scale(${SCALE})`;
      if (m) m.style.transform = `translate3d(${(-cur.x * MID.x).toFixed(2)}px, ${(-cur.y * MID.y).toFixed(2)}px, 0)`;
      const moving = k < 1 || Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) + Math.abs(tgt.lean - cur.lean) > 0.002;
      if (moving && tab) raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && tab) raf = requestAnimationFrame(frame); };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tgt.x = (e.clientX / window.innerWidth - 0.5) * 2;
      tgt.y = (e.clientY / window.innerHeight - 0.5) * 2;
      wake();
    };
    const onVis = () => { tab = !document.hidden; if (tab) wake(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    leanTo.current = (dir) => { tgt.lean = Math.max(-1, Math.min(1, dir)); wake(); };

    frame(t0);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      leanTo.current = () => {};
      f.style.transform = f.style.willChange = "";
      if (m) m.style.transform = m.style.willChange = "";
    };
  }, [far, mid]);
  return useCallback((dir: number) => leanTo.current(dir), []);
}

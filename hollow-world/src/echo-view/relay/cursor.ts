// The amber glow is the cursor. One small DOM node follows the pointer with light easing: refs and rAF only, translate3d only, no React.
// Fine pointer + hover + no reduced motion only; touch, coarse pointers and reduced motion keep the native cursor. It grows and
// brightens over clickable things, is a crisp 2px point over canvases (the maps need exact clicks), and gives way to the native I-beam
// over text fields. Install once per entry; returns an uninstall function.
import "./cursor.css";

const CLICKABLE = 'a[href], button, summary, select, label[for], [role="button"], [role="link"], [role="tab"], [role="switch"], [role="menuitem"], .rl-node, .g-card, .fp-rung, .j-fk';
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]';
const EASE = 0.38; // per 60fps frame; the dot lags the pointer by a hair

export function installGlowCursor(): () => void {
  if (typeof document === "undefined" || typeof matchMedia !== "function") return () => {};
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let teardown: (() => void) | null = null;

  const start = () => {
    const root = document.documentElement;
    const el = document.createElement("div");
    el.className = "gl-cursor";
    el.setAttribute("aria-hidden", "true");
    el.appendChild(document.createElement("i"));
    document.body.appendChild(el);
    root.dataset.glow = "1";

    const tgt = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let raf = 0, last = 0, seen = false, over: Element | null = null;

    const frame = (now: number) => {
      raf = 0;
      const k = 1 - Math.pow(1 - EASE, Math.min(4, (now - last) / 16.67 || 1));
      last = now;
      cur.x += (tgt.x - cur.x) * k; cur.y += (tgt.y - cur.y) * k;
      if (Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) < 0.1) { cur.x = tgt.x; cur.y = tgt.y; } else raf = requestAnimationFrame(frame);
      el.style.transform = `translate3d(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px, 0)`;
    };
    const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    const flag = (name: string, on: boolean) => { if (on) el.setAttribute(name, ""); else el.removeAttribute(name); };

    const classify = (t: Element | null) => {
      if (t === over) return;
      over = t;
      const hot = !!t?.closest(CLICKABLE) && !t.closest('[aria-disabled="true"], :disabled');
      flag("data-hot", hot);
      flag("data-precise", t?.tagName === "CANVAS");
      flag("data-text", !!t?.closest(TEXT));
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      tgt.x = e.clientX; tgt.y = e.clientY;
      if (!seen) { seen = true; cur.x = tgt.x; cur.y = tgt.y; el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`; flag("data-on", true); }
      classify(e.target as Element | null);
      wake();
    };
    const onDown = (e: PointerEvent) => { if (e.pointerType !== "touch") flag("data-down", true); };
    const onUp = () => flag("data-down", false);
    const onLeave = (e: MouseEvent) => { if (!e.relatedTarget) { flag("data-on", false); seen = false; over = null; } };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    document.addEventListener("mouseout", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("mouseout", onLeave);
      el.remove();
      delete root.dataset.glow;
    };
  };

  const sync = () => {
    const want = fine.matches && !calm.matches;
    if (want && !teardown) teardown = start();
    else if (!want && teardown) { teardown(); teardown = null; }
  };
  sync();
  fine.addEventListener?.("change", sync);
  calm.addEventListener?.("change", sync);
  return () => { fine.removeEventListener?.("change", sync); calm.removeEventListener?.("change", sync); teardown?.(); teardown = null; };
}

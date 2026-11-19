// The title's exit: a sonar burst from the activated node's dot while the screen fades to black; when it is fully black the swap runs and the
// next screen fades in from black. One fixed overlay on document.body (it outlives the screen swap), animated with WAAPI: no React renders per frame.
const FADE_MS = 950; // black reaches full opacity (ease-in); the swap runs here
const IN_MS = 400; // the next screen fades in from black
const RING_MS = 800;
const RING_STAGGER_MS = 140;
const RING_COLORS = ["#e8c48f", "#7ec8b3", "#d2a76a"]; // amberHi, teal, amber
const REDUCED_MS = 150;

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
let busy = false;

/** True while a transition runs: repeat activations (clicks, Enter) during it are ignored. */
export const transitionBusy = () => busy;

/** Play the burst from `from` (the dot, or any element; null = screen centre), then call `go` once, at full black. */
export function beginTransition(from: Element | null, go: () => void) {
  if (busy) return;
  busy = true;
  if (typeof document === "undefined" || typeof Element.prototype.animate !== "function") { try { go(); } finally { busy = false; } return; }
  const rm = reduced();
  const r = from?.getBoundingClientRect();
  const cx = r ? r.left + r.width / 2 : innerWidth / 2, cy = r ? r.top + r.height / 2 : innerHeight / 2;

  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.style.cssText = "position:fixed;inset:0;z-index:3000;pointer-events:auto;overflow:hidden;cursor:default";
  const black = document.createElement("div");
  black.style.cssText = "position:absolute;inset:0;background:#000;opacity:0";
  root.appendChild(black);

  const fadeMs = rm ? REDUCED_MS : FADE_MS, inMs = rm ? REDUCED_MS : IN_MS;
  const anims: Animation[] = [];
  if (!rm) {
    // radius beyond the farthest corner, so the ring has left the screen when it ends
    const far = Math.max(Math.hypot(cx, cy), Math.hypot(innerWidth - cx, cy), Math.hypot(cx, innerHeight - cy), Math.hypot(innerWidth - cx, innerHeight - cy)) * 1.15;
    RING_COLORS.forEach((c, i) => {
      const ring = document.createElement("span");
      ring.style.cssText = `position:absolute;left:${cx - far}px;top:${cy - far}px;width:${far * 2}px;height:${far * 2}px;border-radius:50%;box-sizing:border-box;` +
        `border:${i === 0 ? 3 : 2}px solid ${c};box-shadow:0 0 36px 2px ${c}55,inset 0 0 36px ${c}33;opacity:0;transform:scale(0);will-change:transform,opacity`;
      root.appendChild(ring);
      anims.push(ring.animate(
        [{ transform: "scale(0)", opacity: 0.95, offset: 0 }, { opacity: 0.7, offset: 0.55 }, { transform: "scale(1)", opacity: 0, offset: 1 }],
        { duration: RING_MS, delay: i * RING_STAGGER_MS, easing: "cubic-bezier(.15,.7,.2,1)", fill: "both" },
      ));
    });
  }
  document.body.appendChild(root);

  let done = false;
  const finish = () => { if (done) return; done = true; root.remove(); busy = false; };
  const fadeIn = black.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fadeMs, easing: "ease-in", fill: "forwards" });
  fadeIn.onfinish = () => {
    try { go(); } catch (e) { finish(); throw e; }
    root.style.pointerEvents = "none";
    // let the next screen mount and paint under the black, then fade the black out
    requestAnimationFrame(() => {
      const out = black.animate([{ opacity: 1 }, { opacity: 0 }], { duration: inMs, easing: "ease-out", fill: "forwards" });
      out.onfinish = finish;
      out.oncancel = finish;
    });
  };
  fadeIn.oncancel = finish;
  setTimeout(finish, FADE_MS + IN_MS + 2500); // safety net: never leave a black screen behind
  void anims;
}

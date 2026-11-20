import * as fx from "./fx";
import { RAIL_HEIGHT, RAIL_WIDTH } from "./hit";
import { createDarkness, type LitPool } from "./darkness";

/** The live map's two overlay canvases: the blackout (darkness.ts, below the scene art's marks, repainted only when its pools change)
 * and the effects canvas above the pods (particles, rings, screen shake), drawn every frame. */
export function mountEffects(darkCanvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
  const darkness = createDarkness(darkCanvas);
  const context = fxCanvas.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const world = fxCanvas.parentElement!;
  let pools: readonly LitPool[] = [];
  const reduced = () => {
    fx.setReducedMotion(motion.matches);
    darkness.set(pools, motion.matches);
  };
  reduced();
  motion.addEventListener("change", reduced);
  const resize = new ResizeObserver(() => {
    const { width, height } = fxCanvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    fxCanvas.width = Math.round(width * dpr);
    fxCanvas.height = Math.round(height * dpr);
    context?.setTransform(fxCanvas.width / RAIL_WIDTH, 0, 0, fxCanvas.height / RAIL_HEIGHT, 0, 0);
  });
  resize.observe(fxCanvas);

  let last = performance.now(), animationId = 0;
  function draw(now: number) {
    if (context) {
      fx.update(now - last);
      context.clearRect(0, 0, RAIL_WIDTH, RAIL_HEIGHT);
      fx.draw(context);
      const { x, y } = fx.getShakeOffset();
      world.style.translate = x || y ? x + "px " + y + "px" : "";
    }
    last = now;
    animationId = requestAnimationFrame(draw);
  }
  animationId = requestAnimationFrame(draw);
  return {
    /** The pools of light to show: live beacons at full strength, ones on their way and the hover preview fainter. */
    light(next: readonly LitPool[]) {
      pools = next;
      darkness.set(pools, motion.matches);
    },
    dispose() {
      cancelAnimationFrame(animationId);
      darkness.dispose();
      resize.disconnect();
      motion.removeEventListener("change", reduced);
      world.style.translate = "";
      fx.reset();
    },
  };
}

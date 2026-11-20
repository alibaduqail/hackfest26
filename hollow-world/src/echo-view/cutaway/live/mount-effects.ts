import type { Observation } from "../../../echo/types";
import { buildRoute, compileRoute, frameProgress, sampleRoute } from "../motion";
import { tracks } from "../run";
import { lamp } from "../scene";
import * as fx from "./fx";
import { RAIL_HEIGHT, RAIL_WIDTH } from "./hit";
import { createLightLayer } from "./light";

export function mountEffects(lightCanvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
  const lighting = createLightLayer(lightCanvas, { sectorIds: [...tracks.keys()], darknessAlpha: .38 });
  const context = fxCanvas.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const world = fxCanvas.parentElement!;
  const reduced = () => {
    lighting.setReducedMotion(motion.matches);
    fx.setReducedMotion(motion.matches);
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

  function prepare(obs: Observation, previous: Observation, duration: number, started: number) {
    const sectors = obs.sectors.map((s) => {
      const track = tracks.get(s.id)!;
      const [midX, midY] = lamp(track);
      const dx = (track.b[0] - track.a[0]) * RAIL_WIDTH;
      const dy = (track.b[1] - track.a[1]) * RAIL_HEIGHT;
      return {
        id: s.id,
        beacon: s.beacon !== false,
        midX,
        midY,
        angle: Math.atan2(dy, dx),
        length: Math.hypot(dx, dy),
      };
    });
    const headlamps = obs.pods.filter((p) => p.status === "moving").map((p) => {
      // The headlamp rides the same track polyline as the pod sprite (scene.ts), not a straight line between ticks.
      const route = compileRoute(buildRoute(previous.pods.find((old) => old.id === p.id)!, p), RAIL_WIDTH, RAIL_HEIGHT, false);
      return { route, x: route.x[route.x.length - 1], y: route.y[route.y.length - 1] - 12 };
    });
    return {
      sectors,
      headlamps,
      positions: headlamps.map((h) => ({ x: h.x, y: h.y })),
      duration,
      started,
    };
  }

  let current: ReturnType<typeof prepare> | undefined;
  let last = performance.now(), animationId = 0;
  const spot = { x: 0, y: 0, left: false };
  function draw(now: number) {
    if (current) {
      const t = motion.matches ? 1 : frameProgress(now, current.started, current.duration);
      for (const [i, pos] of current.positions.entries()) {
        const h = current.headlamps[i];
        sampleRoute(h.route, t, spot, false);
        pos.x = spot.x;
        pos.y = spot.y - 12;
      }
      lighting.draw({ sectors: current.sectors, pulses: [], headlamps: current.positions, t, now }); // news pulses run along the rail in TrackLight.tsx
    }
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
    sync(obs: Observation, previous: Observation, duration: number, started = performance.now()) {
      current = prepare(obs, previous, duration, started);
    },
    dispose() {
      cancelAnimationFrame(animationId);
      lighting.dispose();
      resize.disconnect();
      motion.removeEventListener("change", reduced);
      world.style.translate = "";
      fx.reset();
    },
  };
}

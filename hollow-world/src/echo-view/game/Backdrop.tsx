// A dimmed, live render of the Strata city (strata.html) behind the story screens, so the game reads as the same world.
// It reuses Strata's renderer and sim read-only: the sim runs on the main thread (cheap: ~1 ms per 30 ticks), the camera drifts slowly.
// Mounted only for the non-map screens; unmounting destroys the Pixi app.
import { useEffect, useRef } from "react";
import { HollowEngine } from "../../engine/engine";
import type { Scenario } from "../../engine/types";
import { WorldRenderer } from "../../world/render";

/** `deep` darkens the scene further, for the Prepare map that is drawn on top of it. */
export function Backdrop({ deep = false }: { deep?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current!;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let view: WorldRenderer | undefined, timer: ReturnType<typeof setInterval> | undefined, dead = false;
    fetch("/scenario.json")
      .then((r) => r.json() as Promise<Scenario>)
      .then(async (scenario) => {
        if (dead) return;
        const engine = new HollowEngine(scenario);
        engine.step(1800); // 30 sim minutes in, so the city is up and moving
        view = new WorldRenderer(el, scenario, () => {}, () => {});
        await view.init();
        if (dead) return;
        view.recenter(); view.zoomBy(1.7); // the city, filling the screen
        view.update(engine.state, true);
        view.app.ticker.maxFPS = 30;
        if (still) return void view.app.ticker.stop(); // reduced motion: one still frame
        timer = setInterval(() => { engine.step(36); view!.update(engine.state, true); }, 600);
        let n = 0;
        view.app.ticker.add(() => { n += 0.004; view!.pan(Math.cos(n) * 0.5, Math.sin(n * 0.7) * 0.25); }); // ponytail: slow Lissajous drift, ~120 px wide
      })
      .catch(() => {}); // no backdrop is fine: the page background shows
    return () => { dead = true; clearInterval(timer); view?.destroy(); };
  }, []);
  return <div className={`g-backdrop${deep ? " deep" : ""}`} ref={host} aria-hidden="true" />;
}

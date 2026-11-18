# Wiring sfx.ts + fx.ts into LiveScreen.tsx

World xy for a sector: `const [nx, ny] = along(tracks.get(id)!, .5); const x = nx * 1672, y = ny * 941;` (same W,H as scene.ts). For a pod, use `podPose(pod)` the same way.

1. Mount: call `sfx.unlockOnFirstGesture()` once. Add a third `<canvas>` layered above the existing one, same ResizeObserver/`setTransform` as scene.ts's canvases; each rAF do `fx.update(dtMs); fx.draw(fxCtx)`, and apply `fx.getShakeOffset()` as a CSS translate on `.world` (or `ctx.translate` before `scene.show`).
2. On mount and on `matchMedia("(prefers-reduced-motion: reduce)")` `"change"`: `fx.setReducedMotion(matches)`.
3. `tryPlace` success (after `play("place")`): `sfx.playPlaceThunk(); fx.spawnParticles(x, y, 8, T.amberHi); fx.ring(x, y, T.amberHi); fx.shake(0.15);` (x,y = that sector's lamp pos).
4. `tryPlace` failure (`play("empty")` branch): `fx.shake(0.08)`.
5. For each `obs.pulses` entry with `kind === "announce"` this tick: `sfx.playHopBlip()`.
6. New `credential-reject` log entry (first time per podId, like `rejected.current`): `sfx.playRejectBuzz(); fx.hitStop(60); fx.shake(0.35); fx.numberPop(x, y, "✕", T.redText);`.
7. Seal transition (alongside existing `play("seal")`): `sfx.playFloodSplash(); fx.shake(0.5);`.
8. Pod status becomes `"arrived"` (compare `previous` vs `obs`): `sfx.playArrivalChime(); fx.ring(x, y, T.good, { radius: 30 }); fx.numberPop(x, y, "+1", T.good);`.
9. Debrief mount, once per star earned (`i = 0..stars-1`): `sfx.playStarDing(i)`.
10. `restart()` (both Retry and Watch solution): `fx.reset()`.

# Wiring the beacon-light overlay (`light.ts`)

1. Mount an extra `<canvas>` absolutely positioned over the existing scene `<canvas>` (same box as
   `ground`/`canvas` in `LiveScreen.tsx`'s `.world`), z-index above it, `pointer-events: none`.
2. Once, in `useLayoutEffect`: `createLightLayer(lightCanvasRef.current, { sectorIds: [...tracks.keys()] })`.
   Keep `width`/`height` at the defaults (1672x941) — they must match `scene.ts`'s `W`/`H`.
3. Each render/tick, call `layer.draw(frame)` where `frame` is:
   - `sectors`: `obs.sectors.map(s => ({ id, beacon: s.beacon !== false, midX: lamps.get(s.id)[0], midY: ..., angle: Math.atan2(b[1]-a[1], b[0]-a[0]), length: Math.hypot((b[0]-a[0])*W,(b[1]-a[1])*H) }))` — reuse `run.ts`'s `tracks`/`along`, same as `scene.ts`'s own `lamp()`.
   - `pulses`: map `obs.pulses` the same way `scene.ts` already resolves `from` (previous-tick neighbor of the same kind) and `to` (`lamps.get(sectorId)`); give each a stable `id` like `` `${sectorId}-${kind}` ``.
   - `headlamps`: pod screen positions via `podPose(pod)` for every non-arrived pod, `[x*W, y*H]`.
   - `t`: the same tween fraction `scene.ts.show()` computes internally (`frameProgress`) — expose it or pass `0`/`1` if unavailable yet.
   - `now`: `performance.now()`.
4. Call `layer.setReducedMotion(matchMedia("(prefers-reduced-motion: reduce)").matches)` once and on `change`.
5. `layer.dispose()` in the `useLayoutEffect` cleanup, alongside `scene.current?.dispose()`.

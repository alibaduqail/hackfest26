# Illustrated cutaway implementation plan

**Goal:** Present the existing settlement as an original, dark industrial side cutaway while preserving simulation truth and every current control.

**Architecture:** Retain the worker, state and renderer's public API. Replace the isometric drawing and its coordinate mapping together, using authored room rectangles as the single source for art, routes, hit testing, camera and actor positions. Create static scenery once and update state-dependent layers from snapshots.

**Stack:** React, TypeScript and the existing PixiJS 8 installation. [Specification](../../specs/hollow-illustrated-cutaway/SPEC.md); [research](../../research/hollow-illustrated-cutaway.md).

## Constraints and handoff

- Work only in Muhammad's worktree. Obtain a board handoff from `@ali_codex1` before changing renderer, projection, UI or their focused tests; the board history records that ownership.
- Preserve scenario, engine, worker, saves and replay formats. Keep the `WorldRenderer` API and HTML controls and failure fallback.
- Art must be original or licensed, local, and credited. No new runtime dependency by default. Pause decorative animation and settle camera easing for reduced motion.
- Imported geometry and populations up to 300 rooms and 2,000 residents remain supported; never silently drop stateful entities.

## Sequence and evidence

1. **Geometry and first slice.** After handoff, establish side-view room bounds, route points, lift landings and selection geometry in `projection.ts`; adapt `fixtureSpot` in `presentation.ts` and drawing in `render.ts` together. Write focused assertions in `projection.test.ts` for authored room bounds, changed coordinates, lift boarding/travel/alighting, hit boundaries and zero-length paths; test crowded placement in `presentation.test.ts`. Build one pump or workshop, its on/off cue, rock, floor and a moving resident. Capture a room-scale still and live movement before expanding the art kit.
2. **Whole settlement.** Build reusable original room props for all 15 kinds and all authored room rectangles. Draw 180 residents and the cart using the same route geometry. Update powered, occupied, stock, flood, access and cart cues from actual snapshots; do not imply operation during outages. Check selections at multiple zoom levels and with the inspector open. Document art provenance and any limits as assets are made.
3. **Interaction and recovery.** Preserve pan, wheel/pinch, magnetic bounds, district and overview, Find, focus/follow, keyboard navigation, inspector, playback and reduced motion. Change the canvas description in `main.tsx` to side view. Exercise alternate imported room positions and overlapping rooms, narrow viewports, paused state, rapid resets, missing optional art and renderer startup failure. Test existing saves and replay imports without migration.
4. **Release verification.** Run `npm test` and `npm run build` in `hollow-world`. Run the README incident, blackout, pump recovery and delivery walkthrough. Capture overview, occupied room, blackout, flood, lift, cart and inspector at desktop and narrow widths. Record same-machine 1440 × 900 and 1920 × 1080 frame cadence at 60× and 300× alongside the existing baseline, and address visible regressions. Record results and limitations in the project QA documentation.

## Review focus

- Imported rooms with moved coordinates or different widths must agree visually with routes and hit regions.
- Crowded rooms must keep each resident visible and selectable rather than collapsing occupants onto one point.
- Lift transitions must stay on the source landing, shaft and destination landing through the entire traversal.
- Blackout, flood, blockage, cargo transfer and recovery must agree with inspector values after pause, reset and fast playback.
- Inspector exclusion and reduced-motion behavior must work at narrow widths as well as desktop sizes.

## Baseline

On 2026-11-16, `npm test` passed all 33 existing tests at worktree baseline `648673e`. These tests describe the current isometric view and do not prove the new cutaway requirements.

The same baseline passed `npm run build` on 2026-11-16. Vite reported its existing advisory for a minified entry chunk over 500 kB. The historical frame samples in `hollow-world/qa/DESKTOP_PASS.md` are not a same-machine comparison for the future cutaway; repeat the documented ten-second measurements before and after implementation.

## Prepared work

`src/world/cutaway-geometry.ts` is an unconnected side-view geometry candidate with focused tests for authored bounds, routes, lift traversal, reverse direction, narrow rooms and zero-length segments. It reuses the existing projection module's coordinate-independent path interpolation and lift timing. A lift link's shaft uses the midpoint of its rooms' horizontal overlap, or of the gap between them when they do not overlap. Different links can therefore have different shaft positions; the renderer must draw each link's own path rather than assume a single continuous shaft. Check this choice, the room-floor inset, and imported scenarios against the eventual illustrated rooms during integration. Drawing, hit testing and camera still use the existing isometric geometry. The original pump/resident asset candidates and their use notes are in `public/art/`.

`qa/cutaway-slice.html` is a standalone art-direction preview with sample power and motion controls. Vite served the page and referenced SVGs successfully; browser access was unavailable, so its appearance and controls have not yet been visually checked. It does not satisfy the live first-slice gate. Issue #21 is on branch `21-illustrated-cutaway`; renderer/UI handoff was requested from `@ali_codex1` on the board.

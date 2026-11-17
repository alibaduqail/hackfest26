# Illustrated cutaway verification

This is the verification checklist for issue #21. Check boxes only after observing the running application; the standalone `cutaway-slice.html` is an art preview and does not exercise simulation state or the renderer.

## Setup

- Start the app from this worktree with `npm run dev`. Capture the browser, build revision, CSS viewport, device scale and date alongside each result.
- Generate genuine engine states with `node --import tsx qa/capture-states.ts`. They are ignored under `qa/states/` and can be imported through Help. They are useful for repeatable inspection but do not replace the live walkthrough.
- Run `npm test` and `npm run build` after the final source changes. Record pass counts and warnings.

## Visual and interaction checks

- [ ] At 1440 × 900 and 1920 × 1080, capture overview with all 30 rooms across eight rows, a zoomed occupied room, the pump room powered and unpowered, the flooded crossing, a rider in a lift, the cart loaded and empty, and a room inspector. Record the state values shown by the inspector with each state-dependent image.
- [ ] At a narrow viewport, capture overview and an open inspector; check the inspector does not cover the focused subject. Pan, zoom and select a room and a person.
- [ ] Inspect each of the 15 room kinds at room scale. Check art is legible, fitted to authored room bounds, and state-dependent lights or machinery do not imply work during an outage.
- [ ] At minimum, default and maximum zoom, click visible room bounds and occupants; check the selected entity in the HTML inspector. Check repeat selection in a crowded room and deterministic selection where imported rooms overlap.
- [ ] Follow a resident through a real lift link at 1× and inspect the source landing, shaft and destination. Follow the cart through a delivery; compare payload, waiting and stock cues with the inspector and history.
- [ ] Exercise wheel, pinch or trackpad zoom, drag, magnetic bounds, district/overview, Find, focus/follow, arrow keys, Space, +/− and Escape. Check keyboard-only Find and inspector controls.
- [ ] Pause the simulation and enable the operating system's reduced-motion setting separately. Movement cues must settle while actual state changes remain visible.
- [ ] Import an existing pre-cutaway save and replay. Check people, rooms, cart cargo and incidents load without migration. Check an optional missing art asset falls back visibly; a renderer startup failure must retain the existing HTML Find/error path.

## Live incident walkthrough

1. Start a fresh run, find and follow a resident, then inspect the cart and a staffed room.
2. Trigger lower blackout and step five minutes; compare darkened rooms, flood level and the closed crossing with the inspector and affected households.
3. Cut communications and step another minute; verify the retained controller report is stale while live water rises and remote pump commands are disabled.
4. Restore communications, request pump backup, advance until drainage reopens access, then follow the cart to an actual delivery. Record the timestamps, water depth, route state and delivered stock from the UI.

## Performance comparison

Use the existing `/qa/desktop.html` meter for 10-second foreground `requestAnimationFrame` samples. Compare an unchanged baseline and the new build on the **same machine and browser**, with the same foreground state, Works scene, 180 residents and matching zoom. At each of 1440 × 900 and 1920 × 1080, reset, select 60×, resume and measure; repeat for 300×. Record FPS, p95 frame interval, frames over 33.34 ms, visibility and viewport as reported by the meter. Alternate baseline and candidate samples if presentation cadence changes; document visible regressions. The historical values in `DESKTOP_PASS.md` are useful context but cannot substitute for same-machine baseline samples.

## Current evidence and limits

The integrated candidate passed 41 tests and `npm run build` on 2026-11-16, with Vite's existing large-chunk advisory. The new tests cover geometry, narrow overview fit, pump/flood state and movement transitions; they do not verify the actual rendered scene. The browser access host was unavailable during setup. Computer use denied access to Helium, and another attempt reported concurrent user activity. No new screenshots, walkthrough or performance samples have been verified yet.

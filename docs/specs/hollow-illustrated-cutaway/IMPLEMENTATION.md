# Cutaway implementation notes

The renderer reads the same worker snapshots as the prior view. `cutaway-geometry.ts` maps authored room rectangles, floor positions and individual link paths into side-view coordinates; drawing, hit testing, following and camera bounds consume those coordinates. The original simulation, routing, scenario and persistence formats are unchanged.

Static room and rock graphics are built when the renderer starts. Power, staff, pump, water, blockage, residents and cart cargo are updated from snapshots. Actor movement follows link progress rather than interpolating straight across corners; a new route, run or backwards progress snaps to its new state. Residents in crowded rooms use spread positions, repeated-click selection and the existing HTML room list. Very narrow rooms cannot show every overlapping figure separately at normal zoom.

Pump SVGs load from the local art kit with a procedural fallback and a visible retry message if loading fails. Other fixtures and residents use original procedural graphics. Asset provenance and the unfinished standalone first-room preview are documented in `hollow-world/public/art/ART_KIT.md` and `hollow-world/qa/cutaway-slice.html`.

The [QA checklist](../../../hollow-world/qa/CUTAWAY_QA.md) tracks the full incident walkthrough, selection, save/replay, accessibility and same-machine frame comparisons. The browser host was unavailable during implementation; the visual direction, screenshots, live walkthrough, imported geometry and performance must be verified before the change is ready to merge. Automated tests alone do not establish those results.

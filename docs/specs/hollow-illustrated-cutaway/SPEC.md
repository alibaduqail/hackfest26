# SPARC specification: Hollow illustrated cutaway

Phase 1 · Specification · 2026-11-16 · Baseline `648673e` · **Proposed, not implemented**

Companion research: [implementation brief](../../research/hollow-illustrated-cutaway.md). This specification covers a new interactive world presentation for the existing Hollow application. The visual target is the approved dark, oppressive, hand-inked industrial side cutaway inspired by the composition and density of Oxygen Not Included, with original Hollow artwork.

## Objective and scope

A visitor can explore the existing settlement as readable stacked rooms in rock, see 180 persistent residents and the supply cart move through it, and recognize consequences of power loss, flooding and blocked access without losing any current simulation or controls. The first implementation gate is one polished room and one moving resident; the release gate is the full 30-room reference scenario and the current demo path.

The world view changes. Simulation rules, worker messages, scenario schema, routing results, save/replay formats, incident controls, and HTML information views remain the current contracts. A full application rewrite, physics changes, backend, animation framework, procedural map generator, and exact reproduction of Klei art are outside this phase.

## Functional requirements

| ID | Requirement | Release evidence |
| --- | --- | --- |
| F1 | Render authored room `x/y/w/h` as side-on cutaway rectangles with roof/floor/rock space and visible district/floor structure. Do not assume the reference coordinates are the only valid scenario. | All 30 reference rooms and annexes appear on the correct row, without hidden or mismatched hit regions. |
| F2 | Draw original, consistent art for rock, platforms, 15 room kinds, essential fixtures, residents and cart. Repeat a shared prop kit across rooms while preserving type identity. | Room-type gallery and 1440 × 900 and 1920 × 1080 world captures match the approved visual direction. |
| F3 | Map `WorldState` to visible truth: powered/unpowered, occupied/staffed, stock/cargo transfer, flood level, blocked link, lift use, and cart waiting/loading/traveling/unloading. Decorative art must never imply that a machine is running when state says it is off. | Live blackout, flood, cart and recovery captures agree with inspector/history values. |
| F4 | Place residents and cart along the same side-view route geometry used for links, with feet/floor and lift landings aligned. Preserve identity, pose and motion from current state. | Follow one real lift crossing and one cart delivery; no teleport or room/shaft misalignment at route changes. |
| F5 | Preserve drag pan, wheel/pinch zoom, magnetic bounds, district/overview navigation, Find, click selection, focus/follow, keyboard controls, inspector, playback dial and reduced-motion behavior. | Existing user walkthrough succeeds on desktop; selection works at multiple zooms and with inspector open. |
| F6 | Preserve loading and failure behavior: scenario validation, worker updates, graphics startup error messaging, save/load, replay import/export. Missing optional art must have a usable fallback and must not erase the world state. | Existing save and replay open in the new view; deliberate missing optional asset shows fallback and an actionable error. |
| F7 | Load art locally with no remote dependency and no new runtime package unless profiling or a specific art need proves it necessary. | Production build serves all required files offline after initial load. |

## Visual and information rules

- The room silhouette is a clean side section: horizontal concrete floors, visible walls/cavities, uneven surrounding rock, surface wear, industrial pipes and shafts. Depth reads through overlap, lighting and texture, not isometric extrusion.
- Use a subdued charcoal, dark olive, weathered teal and rust palette. Amber lamps and status lights are sparse, localized cues. A power outage visibly removes light while leaving enough contrast to navigate and select.
- Residents have expressive, readable silhouettes and role hints at normal room zoom. The cart reads as a distinct vehicle with visible payload difference. Avoid a tiny schematic icon look.
- Flood surfaces are tied to `waterL` and occupy the affected lower room/crossing only. Blocked paths and working devices have distinguishable cues that do not rely on color alone.
- Labels, Find, inspectors and numeric truth remain legible HTML. Canvas art is illustrative, not the only way to discover a person, room, state or command. The existing canvas description must be updated from “isometric.”
- Animation conveys movement or machine state; no decorative motion when simulation is paused or reduced motion is requested. Transition flashes and particles are optional only if they pass this rule.

## Constraints and invariants

1. `HollowEngine` and `engine/worker.ts` remain the sole simulation writers. The renderer may read snapshots and emit selection/camera callbacks, never mutate state to improve a picture.
2. Existing IDs, `WorldState`, `Scenario`, `SaveFile`, and replay versions remain valid. No migration for an art-only change.
3. World position, route drawing, hit testing, focus, follow, flood, and overlays share one side-view coordinate model. Do not mix the old isometric `local/project` values with new screen coordinates.
4. Keep `WorldRenderer`'s public contract used by `main.tsx`, or update every caller together: `constructor(host, scenario, onSelect, onCamera)`, `app`, `init`, `update`, `select`, `focus`, `setInspectorOpen`, `district`, `recenter`, `zoomBy`, `pan`, `destroy`, `followId`.
5. The existing reference world is 30 rooms / 180 residents, but imported scenarios are validated up to 300 rooms / 2,000 residents. Avoid per-tick scene reconstruction and cap or degrade purely decorative effects as needed; never silently omit stateful entities.
6. All shipped art must be original or have documented permission. Concept PNGs and game screenshots are references, not runtime assets.
7. Work remains isolated in Muhammad's worktree. Before later implementation in Ali-owned renderer/UI files, obtain a board handoff; `BOARD_AGENT` must be set before posting.

## Acceptance criteria (Given / When / Then)

1. **World geometry:** Given the bundled scenario, when the new view opens and Overview is selected, then all 30 rooms appear in three districts and eight floor rows, and each room's visible bounds agree with its clickable bounds at min, default and max supported zoom.
2. **State truth:** Given a powered pump and a running simulation, when a lower blackout is triggered, then the affected room loses its active-light/working cue, the inspector reports the same power state, and unaffected powered rooms keep theirs.
3. **Movement:** Given a resident traversing a lift link, when the view is followed at 1×, then the resident enters at the source landing, stays aligned to the shaft during travel, exits at the destination landing, and remains selectable throughout.
4. **Flood and access:** Given a rising `waterL` and the lower crossing, when the threshold blocks access, then the visible water and closed-link cue change in that crossing and do not claim a different route is closed; after pump recovery, the cue clears with the engine's state.
5. **Cart/stock:** Given a loaded cart, when it waits behind a closed route and later delivers, then its payload/waiting cues match `CartState`, and the destination inspector reflects the actual delivered stock. Pausing freezes cosmetic movement without changing cargo.
6. **Camera and input:** Given a selected room near the right edge and an open inspector, when focus or district navigation runs, then the room remains visible outside the inspector. Given wheel/pinch/drag or keyboard input, when the camera reaches the authored map edge, then it settles back as the current UI does.
7. **Persistence:** Given a saved snapshot or replay made by the current release, when it is imported after the art change, then the same resident, cart, room, incident and report states load with no format conversion or lost data.
8. **Accessibility:** Given keyboard-only use, when Find selects a room or person and playback is changed, then the HTML inspector and controls remain operable and informative. Given reduced-motion preference, when the simulation is running, then decorative loops and camera easing stop or settle immediately while state changes remain visible.
9. **Failure:** Given a missing noncritical sprite, when the world starts, then the affected object has a readable fallback and the rest of the settlement remains inspectable; given a critical renderer initialization failure, then the existing error and Find fallback remain available.
10. **Performance/build:** Given the bundled 180-resident world, when the same-machine 1440 × 900 and 1920 × 1080 QA samples run at 60× and 300×, then frame cadence is recorded alongside the existing baseline and any visible regression is addressed before merge. `npm test` and `npm run build` pass.

## Edge cases to design and test

- **Crowded room:** More residents than first-row art slots must remain visible/selectable; position slots may overlap artistically but cannot collapse every person to one unclickable point.
- **Imported geometry:** Different valid room positions, annex widths, and routes must drive art and hit areas. Overlapping valid rooms need a deterministic foreground selection order; zero-length link segments must not divide by zero.
- **Fast state changes:** A pause, save/load, reset, jump to 300×, blackout/restoration, or district switch must not leave stale lights, flood, cart cargo, or follow targets from a previous state.
- **Missing art/WebGL:** Optional asset failure uses fallback; renderer init error preserves the HTML path. Cleanup releases listeners/textures on scenario replacement to avoid duplicate canvases or memory growth.
- **Small screen:** Tools/inspector may shrink available canvas width. Focus and bounds must use the actual visible viewport; people and room selection remain possible after zoom.

## Integration and verification points

- Primary edit surface: `hollow-world/src/world/render.ts` and `projection.ts`; supporting placement helpers in `presentation.ts`, camera in `camera.ts` only if needed. New art in `hollow-world/public/art/`.
- Callers: `hollow-world/src/main.tsx` (construction, updates, selection, focus/follow, district navigation, camera commands, lifecycle) and the `WorldRenderer` public API above.
- Tests: replace isometric assertions in `projection.test.ts` with side-view room/route/lift/hit assertions; retain or update `presentation.test.ts` for poses/placement; keep `camera.test.ts` and engine/replay tests green. Add one state-to-visual test only for logic that is not already covered by route/pose tests.
- Fixtures and config: bundled `public/scenario.json` remains unchanged; save/replay fixtures continue to work. Add art paths to Vite's existing `public` directory, with no package change by default.
- Manual QA: use the existing README two-minute demo and `qa/DESKTOP_PASS.md` capture method, plus side-view screenshots of overview, occupied room, blackout, flooding, lift, cart, and inspector at desktop and narrow widths.

## Completion gate

The phase is complete when the full reference world looks and behaves like the approved dark cutaway, its state cues agree with the engine, the old save/replay and current controls still work, and the tests/build/demo QA pass. The first room slice is an art-direction checkpoint, not completion of this specification.

# Hollow illustrated cutaway: implementation research

Research date: 2026-11-16. Code baseline: `origin/main` at `648673e` (PR #8). Scope: implement the approved dark, hand-inked, side-on underground concept in Hollow's interactive world view. This is an implementation brief, not a code change.

## Decision

**Rebuild the visual renderer, not the application.** The current scenario already describes a side-view-friendly settlement: 30 rooms, 3 districts, 8 floor indices, 15 room kinds, 48 links, 180 residents, and a cart. Main rooms are 490 × 140 authored units on rows 178 units apart; annexes are 260 × 140. The isometric view is a projection of these same coordinates. A new side-on view can use the existing model and behavior. Rewriting the worker or state format would spend hackathon time on solved problems and risk the demo.

The old renderer is too tied to 2.5D drawing to restyle with a palette change: `render.ts` is about 2,000 lines of projected room geometry, fixtures, people, rock, flood, lift, and input. Its own `shortcut:` comment explicitly anticipates authored art. Replace that presentation layer behind the same `WorldRenderer` contract, or build a new renderer and swap the import in `main.tsx` only after a working vertical slice. Keep the old renderer available on its branch until the new one passes the demo walkthrough.

## Questions and findings

| Question | Finding | Evidence |
| --- | --- | --- |
| Can we retain the simulation? | Yes. The engine owns truth; the view receives copied `WorldState` snapshots and sends selection/camera events. No projection data is stored in saves. | [Architecture](../../docs/specs/hollow-living-world/ARCHITECTURE.md), [types](../../hollow-world/src/engine/types.ts), [main](../../hollow-world/src/main.tsx), [projection](../../hollow-world/src/world/projection.ts). |
| Can current coordinates form a side cutaway? | Yes for the reference scenario. `x/y/w/h` already form non-overlapping horizontal rooms and eight rows. Use each room's authored rectangle; treat `floor` and `district` as labels, not a second layout algorithm. Imports can move rooms, so do not hardcode the default coordinates. | [scenario](../../hollow-world/public/scenario.json), [validation](../../hollow-world/src/engine/validation.ts). |
| Can PixiJS 8 support the concept? | Yes. Its scene graph supports sprites, animations, vector geometry, masks, tint, and containers. Its asset loader handles PNG/WebP/SVG/spritesheets and caches loads. This is a supported rendering path, not a new framework choice. | [PixiJS scene objects](https://pixijs.com/8.x/guides/components/scene-objects), [assets](https://pixijs.com/8.x/guides/components/assets), [textures](https://pixijs.com/8.x/guides/components/textures). |
| How should art be made? | Make original transparent, layered sprites. The concept images are visual targets, not a source of separable production sprites. Use authored art for resident silhouettes, key machines, furniture, props, and rock tiles; use reusable Pixi graphics for room bounds, platforms, pipes, water fills, selection, and other simple geometry. | Implementation inference from the concept and [PixiJS Graphics guidance](https://pixijs.com/8.x/guides/components/scene-objects/graphics). |
| What is the main risk? | Art throughput and visual consistency, followed by selection/follow/hit mapping after the projection change. Performance is measurable with the existing QA harness. | [current renderer](../../hollow-world/src/world/render.ts), [projection tests](../../hollow-world/src/world/projection.test.ts), [desktop QA](../../hollow-world/qa/DESKTOP_PASS.md). |

### Renderer and asset plan

1. **Projection:** create one side-view geometry source for room rectangles, room centers, route points, lifts, and hit areas. In this coordinate system, positive y goes downward, room floor is near `room.y + room.h`, and room ceiling is `room.y`. A person in a room uses authored `room.x + localX`; their feet align near the room floor. Existing `fixtureSpot` values contain isometric depth (`z`), so they need a small side-view placement adapter or replacement; changing `project()` alone would leave fixtures and occupants misaligned. Routes, flood fill, camera bounds, click selection, focus, and following must all use the same geometry.
2. **Layers:** one world container with ordered background rock, structural platforms/rooms/links, room art, state overlays, residents/cart, and selection. Keep HTML tools and inspectors above the canvas. Static art should be created once per scenario; snapshot updates change power/light/flood/stock/occupancy states and movement targets, not rebuild every room.
3. **Assets:** export original transparent art at a consistent world-unit scale (suggested first pass: room interior 490 × 140 at 1×; resident about 36–48 units tall; 2× source pixels for crisp zoom). Use a small shared palette of charcoal/olive/dirty teal/rust/low amber, thick uneven outlines, worn concrete and rock, and sparse practical lights. Limit decorative brightness so blackouts remain visually obvious. Name sprites by function and pose, e.g. `resident/stand`, `resident/walk-1`, `machine/pump/off`, `machine/pump/on`; record source and usage rights. These dimensions are working assumptions to validate against a screenshot, not engine contracts.
4. **Loading:** place a small initial set under `hollow-world/public/art/` and load once with Pixi `Assets.load`. Vite serves `public` files unchanged at root paths. A future spritesheet can pack many animation frames behind a JSON atlas; Pixi's texture docs show spritesheet frames and shared texture sources. Avoid new runtime packages for this pass. If first-frame upload causes stutter, Pixi documents `renderer.prepare.upload` ([Vite assets](https://vite.dev/guide/assets), [PixiJS assets](https://pixijs.com/8.x/guides/components/assets), [textures](https://pixijs.com/8.x/guides/components/textures)).
5. **Motion and cost:** use simple two-to-four-frame walk and working loops only where they convey state. Pause decorative motion when paused or `prefers-reduced-motion` is active, matching current behavior. Pixi warns against clearing/rebuilding complex `Graphics` geometry every frame. Group stable art separately from moving actors; consider render groups or caching only after profiling, because Pixi cautions against overusing them ([Graphics](https://pixijs.com/8.x/guides/components/scene-objects/graphics), [render groups](https://pixijs.com/8.x/guides/concepts/render-groups), [performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips)).
6. **Interaction/accessibility:** preserve canvas pointer pan/zoom, person/cart/room/link selection, keyboard Find and inspector, and reduced-motion behavior. Pixi has event hit areas and optional DOM accessibility overlays, but the existing HTML Find/inspector is already the primary keyboard and screen-reader path. If interaction moves to Pixi objects, set intentional hit areas and verify keyboard equivalence ([PixiJS events](https://pixijs.com/8.x/guides/components/events), [accessibility](https://pixijs.com/8.x/guides/components/accessibility), [current UI](../../hollow-world/src/main.tsx)).

**Art rights:** use Oxygen Not Included as a mood and composition reference, not as a source of extracted sprites, screenshots used as game backgrounds, names, or copied characters. Klei's [player-creation guidelines](https://support.klei.com/hc/en-us/articles/360029880791-Player-Creation-Guidelines) discuss fan creations; they do not remove the need to track rights for the assets we ship. Original Hollow designs also make the result recognizably its own.

## Minimum art inventory

| Kit | First slice | Full demo coverage |
| --- | --- | --- |
| Structure | One tileable rock edge, concrete floor/ceiling, wall opening, one lamp, one pipe run. | Reuse across all rooms; vary wear, silhouette and light pools rather than painting 30 unique backgrounds. |
| People | One resident silhouette with stand and two walk frames; one role/accessory distinction. | Pose set for stand, walk, work, bend, sit, sleep, carry; palette and hair variants derive from existing `appearance` and role data. |
| Machines/rooms | Pump on/off, one workbench, a few crates and signs. | Distinct landmark fixture for each of 15 room kinds; paired active/inactive cues only where state supports them. |
| Mobility/state | One lift landing/shaft, one cart with visible load, one water surface. | Lift/crossing types, cart waiting/loading/unloading, blocked route, flood and selection overlays. |

Production order should follow the demo camera path, not the room list. Capture the first slice at the same zoom and viewport used for final QA; otherwise art that looks good close up may disappear in the normal overview.

## Integration map for implementation

| Surface | Preserve or change |
| --- | --- |
| `src/engine/{engine,worker,routing,types,validation,replay}.ts`, `public/scenario.json`, `src/persistence.ts` | Preserve contracts and formats. Existing room/person IDs and state are the inputs. No art fields are required in the scenario. |
| `src/world/render.ts` | Main replacement area: scene construction, room/person/cart visuals, state-driven overlays, selection, camera, hit testing, cleanup. Keep its public API expected by `main.tsx`: constructor, `app`, `init`, `update`, `select`, `focus`, `setInspectorOpen`, `district`, `recenter`, `zoomBy`, `pan`, `destroy`, `followId`. |
| `src/world/projection.ts`, `projection.test.ts` | Replace isometric mapping and related room/route/hit geometry together. Preserve route progress semantics, especially lift boarding/alighting; update tests to prove 2D alignment. |
| `src/world/presentation.ts`, `presentation.test.ts` | Keep state-to-pose, stock and identity helpers. Adapt `fixtureSpot` depth-based placement; test crowd overflow and room fitting. |
| `src/world/camera.ts`, `camera.test.ts` | Reuse camera clamping and elasticity, recalculate bounds from new room outlines. |
| `src/main.tsx`, `style.css` | Keep React worker lifecycle, controls, Find/History/Incidents/Help, inspector, save/replay and UI layout. Only adjust integration or visual styling if the cutaway requires it and file owner hands off. |
| `public/art/` (new), `README.md`, visual QA artifact | Add original production art and concise usage docs after artwork is approved. Reference paths from Vite's public root. |

`main.tsx` constructs and updates the renderer, catches graphics startup failure, and exposes Find if the canvas fails. It also calls every listed camera/selection method; replacing the class without that API would break core UI. Saves/replays hold scenario and simulation state, so the art change should load old saved runs without migration. Imported scenarios are validated up to 300 rooms and 2,000 residents, even though the demo fixture has 30/180; the view must fail gracefully or remain usable at those upper bounds.

## Recommended build order and gates

1. **Visual slice:** one representative room (pump or workshop), one resident with stand/walk, structural rock/platform, powered and unpowered lights. Show a still and a live capture at room zoom. Confirm art scale, darkness, and readability before multiplying assets.
2. **Functional slice:** use side-view geometry end to end for one route with lift, one room click, one person click, Find/focus/follow, pan/zoom, and inspector exclusion zone. Prove the vertical alignment and no selection offset at different zooms.
3. **World coverage:** render all 15 room kinds using a small shared prop kit; 30 room instances should feel distinct by type without requiring 30 unique paintings. Add cart payload, flood line, closed routes, power and occupancy cues driven by live state. Keep the entire 180-resident population visible and selectable.
4. **Demo verification:** reproduce the README's two-minute incident/blackout/comms/pump/delivery walkthrough, import a preexisting save/replay, run `npm test` and `npm run build`, then compare frame cadence at 1440 × 900 and 1920 × 1080 with `qa/desktop.html` against a same-machine baseline. The old [desktop QA](../../hollow-world/qa/DESKTOP_PASS.md) contains sample method and caveats; it is not a universal FPS guarantee.

## Open choices before art production

- Choose one approved concept crop as the visual reference and decide whether the image's room scale fits 490 × 140 world units at 1×. The current user preference is dark/depressing, hand-inked industrial cutaway.
- Decide the minimum original asset set for the first room and resident. An atlas/export workflow can wait until there are enough frames to justify it.
- Coordinate with the current renderer/UI owner on the board before editing their files. This research was performed in Muhammad's worktree; no shared source file was changed.

## Research limits

This pass used local source and official PixiJS, Vite, and Klei documentation. Ruflo memory, pattern, trajectory, and AIDefence tools were unavailable in this session, so no memory recall/store or automated source screening was performed. Web findings were checked against primary documentation and treated as implementation guidance; the art pipeline and workload estimates are recommendations to validate in the first slice.

# Strata: dystopian isometric experiment

Issue #5; experimental branch `5-strata-dystopian`. The user chose the spatial layout of the Strata concept and asked for a darker, dystopian implementation.

## Visual direction

The city is a sectional industrial model: excavated rock, open-front rooms, visible floor depth, worn fixtures, rusted rails and a continuous exposed lift shaft. Amber lamps provide local light against cold stone; an unpowered room loses its lamp glow. Homes, clinic beds, grow beds, stores, processing tanks, fans and checkpoints have distinct furnishings.

| Token | Color | Role |
| --- | --- | --- |
| Deep void | `#10191e` | Recesses and shadows |
| Excavated stone | `#39444b` | Rock sections and slabs |
| Worn steel | `#536973` | Industrial fixtures |
| Oxidized rails | `#8d6250` | Walkways and structural wear |
| Task light | `#d2a76a` | Lamps, selection and alerts |
| Reclaimed water | `#648c8e` | Tanks and flooding |

System sans typography keeps the controls quiet. District navigation sits to the left on desktop and becomes one row on narrow screens; the contextual inspector remains on the right. The first view opens near the Works rather than shrinking all thirty rooms to fit. Recenter/brand shows the broad city view; district shortcuts, panning and zooming expose every level.

## Implementation boundary

PixiJS draws procedural 2.5D geometry. This is an interactive projection of the current world, not a generated concept image used as a background. Fixtures, rock and lights are code-drawn; residents and the cart use the same projected routes. The engine, scenario schema, physical rates, worker protocol, command validation, saves and replay formats are unchanged. There are no new runtime dependencies or remote art/font requests.

The projection module owns the common room anchors, route interpolation and room hit regions. Clicks, focus, following, flood surfaces and closed-route markers use those coordinates. Lighting follows actual power state. Only the first decorative rotor formerly rotated; all visible rotors now animate while powered, playing and outside reduced-motion mode.

## Verification

- TypeScript and production build pass. The existing large-entry-chunk advisory remains (~573 kB main bundle minified).
- 21 tests pass: the existing 19 engine/replay checks plus projected room selection and reversible route checks, including unequal authored room widths and zero-length segments.
- Browser walkthrough: room directory focus, direct map room selection, named nurse discovery/following, pause/step, district navigation, zoom, cart focus, blackout, flooding and inspector display.
- Blackout plus six one-minute steps showed 48/60 households connected. The projected drainage hall became dark and flooded while the upper levels remained lit.
- Desktop and 320-pixel narrow layout inspected; narrow page scroll width equaled viewport width. Resize now retains the camera's world center.
- Browser console inspection found no errors in the tested development session.

Screenshots: [working district](qa/strata-world.jpg), [room inspector](qa/strata-inspector.jpg), [blackout](qa/strata-blackout.jpg), [narrow view](qa/strata-mobile.jpg).

## Limits

This is an art-direction experiment, not a match for every detail in the generated Strata concept. It uses projected primitives and billboard residents, with simulated light pools rather than a 3D lighting/shadow solver. Fixed viewpoint; no camera orbit. Formal frame-rate measurements, production-browser walkthrough, cross-browser parity, screen-reader use and touch/pinch on physical hardware were not repeated for this branch. The earlier headless engine benchmark remains relevant to engine timing, not proof of the new renderer's performance.

# Cutaway pump-room art slice

These original SVG illustrations were drawn for Hollow on 2026-11-16. They contain no external images, fonts, scripts or network references; no game art or concept image was copied into them. The files are available for use in this project. The artwork is a first-slice candidate and is not yet connected to the renderer.

| Asset | Canvas | Intended use |
| --- | --- | --- |
| `pump/off.svg` | 176 × 112 | Stationary pump with crossed dark indicator. |
| `pump/on.svg` | 176 × 112 | Same pump with lit arrow indicator; show only when the simulation says it is working. |
| `resident/stand.svg` | 48 × 64 | One technician-like resident, feet near y=60. |
| `resident/walk-1.svg`, `resident/walk-2.svg` | 48 × 64 | Alternating movement poses at the same anchor. |
| `structure/rock-edge.svg` | 128 × 48 | Repeating rock edge for the first cutaway room. |
| `structure/floor.svg` | 128 × 24 | Repeating concrete floor. |
| `structure/lamp-off.svg`, `structure/lamp-on.svg` | 44 × 32 | Ceiling lamp, with lit artwork only for a powered room. |

The SVG viewboxes leave transparent margins. Align the pump's base at y=100 and residents' feet at y=60; scale the resident to approximately 40 world units tall for the first room-scale check. The indicator is both a shape and color change; do not infer pump operation from power alone. Use snapshot state for the on/off choice, and freeze the walking frame when paused or reduced motion is requested. Preserve the existing HTML descriptions and use a readable fallback if optional art cannot load.

These drawings need a room-scale visual review, identity/role variations, and the other requested poses and fixtures before they cover the full specification. They make no change to simulation or rendering behavior on their own.

Rock and floor tiles align at their horizontal edges. The lamp's attachment is at x=22, y=0; any surrounding pool of light must be driven by the same powered state as the lit sprite. Room-scale tiling, seams, and readability remain to be checked in the renderer.

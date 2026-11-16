# Compact controls and camera edges

Issue #7 replaces the full-width header/footer with floating tools and a lower-left playback dial. Decorative headings, repeated explanations, irrelevant zero-stock fields, idle lift counters and district subtitles are removed. Room names, useful live values, actionable alerts, report freshness, command prerequisites and execution feedback remain. Secondary information uses disclosures; inspectors size to their content.

Dragging beyond the built settlement adds up to 80 screen pixels of resistance. Releasing eases to the nearest valid edge/corner using the existing interruptible 280 ms camera transition. Wheel zoom remains immediate and settles after the gesture. Reduced motion skips the transition. When the map fits in the available viewport it returns to the centered overview. The inspector is included in the camera's available space.

## Verification

- `npm test`: 33 tests pass, including five camera-boundary checks and a stock-summary check. Existing engine, conservation, routing, command validation, persistence and replay checks pass.
- `npm run build`: TypeScript and Vite pass. The existing large-entry-chunk advisory remains.
- Live desktop checks used the current pane (approximately 1075×605) and a fixed 1440×900 CSS viewport. The canvas covers the full viewport; there are no header/footer elements.
- Play/pause, speeds, one-minute stepping, person/cart discovery and following, district navigation, History and the shortened healthy-room inspector were exercised. A one-minute step advanced exactly 60 simulation seconds. A canvas click selected Mara after a magnetic return.
- In the paused overview, the release frame differed from the starting image, then the settled screenshot was byte-identical to the start. The opposite drag direction also returned to the identical view. Zoomed edge dragging and wheel zoom were exercised.
- The existing run was exported before testing. Import and local save/load restored its exact paused timestamp. Tests in the separate preview used a different origin from the original app.
- A blackout isolated 12 households (48/60 connected). Communications loss disabled pump backup and retained the 07:05:30 report at 90 seconds old while live water reached 0.42 m. Reconnection allowed acknowledgement, execution at 07:07:01, and recovery to 60/60 connected; History retained the outage, command and recovery events.

No engine, scenario, persistence format or world-art changes. No new runtime dependencies. OS reduced-motion toggling, touch hardware and a fresh FPS benchmark were not repeated.

## Captures

- [Full-window world and corner controls](compact-ui/world-1440.jpg)
- [Overview before dragging](compact-ui/overview-before.jpg)
- [Resisted release](compact-ui/edge-release.jpg)
- [Settled overview](compact-ui/overview-settled.jpg)

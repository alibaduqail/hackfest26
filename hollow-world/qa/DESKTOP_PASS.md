# Strata desktop pass

Implemented on `5-strata-dystopian`, beginning at reviewed commit `86369c4`. Source revision for final verification: `ec93508`. The user approved promoting this implementation to `main` through PR #6.

## Result

The service lift now occupies a rectangular bay at the right of each served Works room. Floor slabs end at the opening, a short threshold bridge meets the rider path, four projected posts stay upright, and a recessed rear/side face supplies depth. Riders and the cart carry visible platforms during the vertical portion of actual link traversal. Rear rails draw behind riders; near posts draw in front. Landing lamps and capacity labels use actual link occupancy and `blocked()` availability, including unpowered lower links during blackout. The existing capacity-limited edge model remains intact; this does not add shared-car dispatch.

Residents share role, skin, hair and clothing colors with their inspector portraits. Nurses have coats and marked satchels; growers have aprons and tools; technical workers have workwear and hard hats. Work, bend, sit, sleep, carry and directional walking poses follow actual state. Present staff enable the workshop job in progress. Twenty commons occupants have distinct seats, and room lists plus repeated overlapping clicks remain available for selection.

Workshop benches, vise and wall tools differ from freight shelving and a marked loading space. Reclamation uses broad treatment basins and filters; taps use a dispensing counter and containers; drainage uses a grated intake, motor and outlet. Homes have personal storage and bed spaces; clinics have medical markings and treatment/IV equipment; commons have tables and benches; feeder cabinets, relay racks and checkpoints have different forms. District floor finishes, wear and local light differ subtly.

The blue fleet cart has a continuous chassis, connected wheels and tow handle. Payload geometry comes from all positive onboard stock. Empty returns expose the deck. Brief load/delivery cues fire on real cargo changes, and blocked cargo remains visible.

Desktop navigation retains global tools, upper-left districts, right inspector and footer playback. Focus, following, hit testing, labels and flood geometry use the shared projection. Large camera jumps take 280 ms and can be interrupted by direct input; dragging and wheel zoom apply immediately. Following updates district and level, recenter fits all eight levels, and zoom controls remain reachable beside the open inspector. New panels/subjects start at the top; ordinary live updates preserve the drawer scroll. History defaults to incidents/deliveries and labels its all-events count.

The Drainage inspector puts live flooding/access information beside the backup action before household details. The action preserves communication, battery, power-limit and pending-request checks, with acknowledgement and executed-state feedback. Retained controller samples are marked stale while observer data continues live.

No engine, worker protocol, scenario, persistence, report schema or save-format changes. No runtime dependencies or remote fonts/art were added.

## Running desktop verification

- Production preview and live development app exercised at **1440×900** and **1920×1080**, with JPEG dimensions checked on disk.
- From the Works, directory search found **Mara Vale**. Follow reached the Upper clinic and changed the highlight to **The Exchange / Level 2**. Her initial run seeks care; the artwork reflects her nurse role without inventing a work task.
- A real **1×** traversal followed **Milo Khan** from Level 6 to Level 5 between **07:00:20 and 07:00:32**. Both viewport sequences are included. Clicks selected Milo on the moving platform at 1920, and again after dragging, zooming and keyboard panning at 1440. Adjacent landings remained aligned.
- The cart was directly selectable with its ring off. A shipment carried **30 food + 3 medicine**, unloaded into household stores, then returned with **0 food + 0 medicine**, with **30 food delivered**. Real loading and unloading cues were captured. Following crossed the Exchange, Works and Sump and updated level/highlight.
- Lower blackout at tick 60 plus nine minute steps reached tick 600: **one flooded crossing, 48/60 homes connected**, and a later loaded shipment waited with **30 food + 3 medicine retained**. The first shipment had already delivered before flooding; the blocked shipment is a subsequent run.
- During communications loss, live water rose from **0.54 m to 0.60 m** while the controller retained its **07:09:30 / 0.51 m** sample, then **90 seconds old**. The pump request was disabled with **Command channel disconnected**.
- After reconnecting, the pump request acknowledged the next tick and executed at **07:11:01**. Nine minute steps produced **0.06 m** water and **60/60 homes connected**. History showed the backup execution and **07:16** crossing recovery. Lower lifts still correctly remained unpowered while the feeder was offline.
- Drawer scroll remained **1416.386 px** through a live update; opening History reset it to **0**. Outage, flooded crossing, blocked cart, command execution and recovery were present in its filtered view.
- Space pause/resume, arrow pan, Escape, wheel zoom, zoom buttons, one-minute step and recenter were exercised. Overview shows all 30 rooms across eight levels. No warnings/errors from the production origin were observed.

## Automated checks

`npm test`: **27 passing tests**. Added coverage includes projected lift footprint/upright posts, reversible staged traversal, role/task poses, fixture bounds and crowd spacing, distinct full-capacity commons seats, stock totals/blocked cargo, district following and incident filtering.

`npm run build`: passes TypeScript and Vite. The existing large-entry-chunk advisory remains; final main entry is about **591 kB minified / 183 kB gzip**. No bundle splitting or dependency changes were introduced for this visual pass.

## Measured responsiveness

Each sample records **10 seconds of requestAnimationFrame intervals** around the actual React + Pixi application with the reset Works scene, default zoom **1.15**, and all **180** persistent residents. One browser tab was active. These measure frame presentation, not renderer CPU cost or input latency.

The browser's presentation cadence changed during the session. Initial reviewed-build samples were **99.6–120 FPS**; an intermediate pass measured **120 FPS** in all four samples (p95 **9.7–9.9 ms**). A later final-only repeat measured **60 FPS**, prompting a fresh comparison that alternated a clean archive of `86369c4` and final `ec93508` in the same browser. **Both builds then presented at 60 FPS**, with no frames over 33.34 ms. No cause for the cadence change was established; the data do not establish a performance improvement or a new rendering regression.

| CSS viewport | Speed | Reviewed FPS / p95 interval | Final FPS / p95 interval | Frames >33.34 ms, before / after |
| --- | --- | --- | --- | --- |
| 1440×900 | 60× | 60.0 / 16.9 ms | 60.0 / 16.8 ms | 0 / 0 |
| 1440×900 | 300× | 60.0 / 18.6 ms | 60.0 / 18.6 ms | 0 / 0 |
| 1920×1080 | 60× | 60.0 / 18.6 ms | 60.0 / 18.5 ms | 0 / 0 |
| 1920×1080 | 300× | 60.0 / 18.6 ms | 60.0 / 18.5 ms | 0 / 0 |

Raw initial and final paired readings, frame counts, durations and visibility are in [performance.json](desktop-pass/performance.json). These are short local samples, not a sustained benchmark.

## Evidence and reproduction

Open [the screenshot gallery and clips](desktop-pass/index.html). Every primary scene has matched 1440×900 and 1920×1080 captures. The clip is a **14-second frame sequence sampled every two seconds**, assembled from real screenshots rather than continuous high-frame-rate video. Individual frames and clock/level metadata remain in the folder.

| Scene | 1440×900 | 1920×1080 |
| --- | --- | --- |
| Lift crossing | [Open](desktop-pass/lift-1440-02.jpg) | [Open](desktop-pass/lift-1920-02.jpg) |
| Occupied workshop / growers | [Open](desktop-pass/workshop-1440.jpg) | [Open](desktop-pass/workshop-1920.jpg) |
| Mara at the clinic | [Open](desktop-pass/mara-clinic-1440.jpg) | [Open](desktop-pass/mara-clinic-1920.jpg) |
| Stores | [Open](desktop-pass/stores-1440.jpg) | [Open](desktop-pass/stores-1920.jpg) |
| Water systems | [Open](desktop-pass/water-systems-1440.jpg) | [Open](desktop-pass/water-systems-1920.jpg) |
| Occupied commons | [Open](desktop-pass/commons-1440.jpg) | [Open](desktop-pass/commons-1920.jpg) |
| Loaded cart | [Open](desktop-pass/cart-loaded-1440.jpg) | [Open](desktop-pass/cart-loaded-1920.jpg) |
| Unloading cart | [Open](desktop-pass/cart-unloading-1440.jpg) | [Open](desktop-pass/cart-unloading-1920.jpg) |
| Empty return | [Open](desktop-pass/cart-empty-1440.jpg) | [Open](desktop-pass/cart-empty-1920.jpg) |
| Blocked loaded cart | [Open](desktop-pass/cart-blocked-1440.jpg) | [Open](desktop-pass/cart-blocked-1920.jpg) |
| Blackout inspector | [Open](desktop-pass/blackout-inspector-1440.jpg) | [Open](desktop-pass/blackout-inspector-1920.jpg) |
| Lift outage | [Open](desktop-pass/lift-outage-1440.jpg) | [Open](desktop-pass/lift-outage-1920.jpg) |

[1440 lift clip](desktop-pass/lift-crossing-1440.mp4) · [1920 lift clip](desktop-pass/lift-crossing-1920.mp4).

Initial timing screenshots: [reviewed 1440](before-1440.jpg), [reviewed 1920](before-1920.jpg); [later final 1440](after-1440.jpg). These were taken during different timing rounds; the alternating comparison above is the current before/after result.

`node --import tsx qa/capture-states.ts` recreates validated, genuine engine snapshots in ignored `qa/states/` for repeatable UI checks through Import. It never fabricates person tasks or cart inventories. `npm run dev` and `/qa/desktop.html` expose the passive ten-second frame meter around the real app. Reset the run, choose speed, resume and measure; use the displayed CSS viewport dimensions.

## Unverified or limited

- The referenced “Hollow | Sector 07” attachment was not present in this chat. The pass follows the written brief and existing repo imagery; exact visual matching to that attachment could not be checked.
- OS-level reduced-motion preference changes were not emulated in the browser. Its code paths were inspected: camera jumps become immediate, walking/fan animation stops, and actor smoothing is skipped while actual run state remains visible.
- Sustained FPS/thermal behavior, cross-browser parity, screen-reader operation and mobile/touch use were not verified in this desktop-only pass.
- Procedural 2.5D figures/fixtures and the existing fixed viewpoint remain. Lift links are independent powered traversals, not a newly simulated shared lift car.

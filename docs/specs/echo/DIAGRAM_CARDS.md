# Echo video: diagram cards

_v1 · for VIDEO.md v3 section 3 (cards 1 to 6) plus the proof and close cards (7, 8) · owner `@m_opus` · to be built as HTML and rendered to PNG/MP4 later._

## Common spec

- **Size:** 1920x1080, safe margin 96 px. One idea per card. Text is large enough to read on a phone: title 72 px, lines 44 px, labels 30 px.
- **Palette (`hollow-world/src/echo-view/theme.ts`):** page `#10191e`, panel `#15242c` (hi `#1c303a`), borders `#4a5c61`, text `#ddd8c1`, headings `#e9e0c8`, secondary text `#b4c4ba`, accent amber `#d2a76a` (selected, beacons, key words), good `#7ec8b3` (Echo, success), red `#e0634f` (the Directorate, seals, alerts), red panel `#3a1a18` with border `#7a3029`, blue `#6fb0d8` (pods), ghost purple `#b565d6` (a forged pod, if used).
- **Type:** headings Aptos / Segoe UI / system sans, labels in the mono stack, as in the app.
- **Look:** flat dark slate, thin 2 px outlines, rounded 10 px panels, no gradients, no icons from other sets. Dots and lines only. Match the Strata map look so the cards sit beside the gameplay without a jolt.
- **Motion:** items build in on their spoken beat (fade 200 ms), nothing moves after that. If rendered to MP4, hold the final state at least 1 s past the end of the sentence. Provide a static PNG of the final state as well.
- **Each card has:** a small step tag top left in mono amber (`1/6`), the title, 1 to 3 lines max, the diagram, a thin footer with the Echo wordmark in dim `#6f857f`.
- **Words:** say "pods" and "beacons". Never CTAF, mutex, protocol stack.

## Card 1: Beacons (3a)

- **Title:** Beacons
- **Lines:**
  1. Battery radios, installed trackside by residents.
  2. Each talks only to its neighbors.
  3. No center. No internet.
- **Layout:** A horizontal chain of 5 amber dots (beacons) joined by thin lines across the middle of the card, with a faint tunnel drawn as two parallel grey lines behind them. Under each dot a tiny radio-ring (two concentric arcs) that reaches only the dot on each side. Top of the chain, crossed out in red `#e0634f` with a thin line: a small tower glyph labeled `central server` and a cloud labeled `internet`. A small caption under the chain in muted `#90a59f`: `each beacon hears only its neighbors`.
- **Colors:** amber beacons and rings, red struck-out tower and cloud, text cream.

## Card 2: Rule 1, announce and one pod per sector (3b)

- **Title:** Rule 1: announce, then one pod per sector
- **Lines:**
  1. A pod announces before it moves.
  2. Only one pod holds a sector at a time.
- **Layout:** Left: a tunnel drawn as a horizontal bar split into 3 sectors. Pod A (blue rounded rectangle) is inside sector 2, which is outlined in amber. Pod B waits at the boundary on the left of sector 2 with a small label `waits`. Above pod A a speech-bubble chip in mono: `A: entering S2`. Right side: a small 2-step list `1 announce`, `2 enter when clear`. No controller anywhere in the picture; the empty space where a tower would be is intentional.
- **Colors:** blue pods, amber sector outline, cream text.

## Card 3: Rule 2, who goes first (3c)

- **Title:** Rule 2: who goes first
- **Lines:**
  1. Medical, then supply, then passenger.
  2. Supply means water, food and medicine.
  3. The order is set in advance, not by the Directorate.
- **Layout:** Three horizontal stacked bars, widest at the top, like steps descending left to right: `1 MEDICAL` in good green `#7ec8b3`, `2 SUPPLY · water · food · medicine` in amber, `3 PASSENGER` in blue. A down-arrow along the left side labeled `yields to the one above`. Bottom right, in muted text: `#2 fair sharing, decided before the crisis`.
- **Colors:** green, amber, blue bars on panel `#15242c`; text ink `#16262b` on the bars.

## Card 4: Rule 3, only credentialed nurses file medical (3d)

- **Title:** Rule 3: only credentialed nurses file medical
- **Lines:**
  1. A clinic issues the credential before any outage.
  2. Each beacon checks it locally.
- **Layout:** Left: a clinic glyph (a plain rectangle with a cross) with an arrow labeled `issues credential` to a nurse badge (rounded rectangle labeled `Nurse · signed`). Middle: an arrow into a beacon dot with a green check and `valid: medical priority`. Below, a second smaller path: a purple (ghost) badge labeled `no credential` with a red X at the beacon and `rejected: ordinary priority`. Footer note in dim text: `signature simulated in the demo`.
- **Colors:** green check, red X, ghost purple for the fake claim, amber beacon.

## Card 5: News hops, pods reroute (3e)

- **Title:** News hops. Pods reroute.
- **Lines:**
  1. A sealed or flooded tunnel is passed beacon to beacon.
  2. Pods re-plan around it.
- **Layout:** A small network of 6 nodes (sectors) joined by lines; one direct line between the left node (`Sector 07`) and the right node (`Lagos Deep`) is drawn in red with a red X. Amber pulse rings step along the beacons next to the seal, left to right, to show the news spreading (3 frames of build-in). A blue pod's path is drawn as a dashed line detouring through a middle node labeled `São Paulo`. Caption under: `#5 a blocked tunnel does not cut off a neighborhood`.
- **Colors:** red seal, amber pulses, blue dashed reroute.

## Card 6: Real-world anchor (3f)

- **Title:** This is already how towerless airports work
- **Lines:**
  1. Pilots announce on a shared frequency and take turns.
  2. Echo does it for a whole network.
- **Layout:** Split vertically. Left panel `Towerless airport today`: a runway line with three small plane glyphs, each with a bubble: `Cessna 4 miles out, landing 27`. Right panel `Echo in the Hollow`: the same three-bubble idea with pods in a tunnel: `MED-1 entering S2`. A thin arrow between the panels labeled `same idea, bigger network`. A line at the bottom in amber: `The Directorate can't switch off what it doesn't run.`
- **Colors:** blue plane and pod glyphs, amber bottom line.

## Card 7: Proof numbers (4e, held into 5)

- **Title:** Same scenario, same seed
- **Layout:** A table with three columns (`Directorate alone`, `Echo`, `Normal day`) and six rows. Left column of the table is red-tinted `#3a1a18`, middle green-tinted, right neutral.
  - Nurses arrived: 0/8, 8/8, 8/8
  - Supplies delivered: 0/10, 10/10, 10/10
  - Flights moving: 5 of 84, 40 of 84, 40
  - Passenger delay: 31.7x, 2.4x, 1.0x
  - Network capacity: 5%, 94%, 100%
  - Mara arrives: never, t+137, t+80
  Highlight rows in order as spoken (nurses, supplies, flights moving); in shot 5 pulse the delay, capacity and Mara rows. Footer in mono: `deterministic simulation · npm run harness · seed 20261117`.
- **Colors:** red for the left numbers, green `#7ec8b3` for Echo numbers, muted for Normal day.

## Card 8: Close (6)

- **Title:** Build the backup first
- **Lines:**
  1. Echo: battery beacons, three rules, no center.
  2. Play it: `https://hollow-world-eight.vercel.app/`
  3. Code: `https://github.com/alibaduqail/hackfest26`
- **Layout:** Centered on a dimmed still of the Echo map. The title large in cream, the two links in mono amber on panel chips with a thin border, big enough to read paused (44 px minimum). Small Echo wordmark top left. Nothing else.
- **Colors:** amber links, cream text, dim map behind (40 percent opacity over `#10191e`).

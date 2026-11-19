# Hollow theme: design plan (#113 follow-up)

## Concept
Everything you press in Sector 07 is bolted to rock. The controls are **painted steel plates** like the ones on a lift-shaft call panel or a feeder-control cabinet: cut corners, a rim, a lamp that lights when something is armed. The Strata backdrop supplies the world (pipes, geothermal hall signage, sodium lamps); the UI is the hardware bolted into it. Boldness is spent on **buttons and switches**. Everything else is quiet: flat steel panels, wayfinding-style type, no glass.

## Palette (additive tokens in theme.ts)
| Name | Hex | Role |
|---|---|---|
| Rock | `#0a1115` | wells, disabled plates, deepest shadow |
| Plate | `#243840` / lit `#31464e` | button and panel faces |
| Rim | `#506a72` | plate edges (existing `line2` is `#4a5c61`) |
| Lamp | `#f2b65a` (deep `#c99654`) | the one accent: armed, hovered, primary, focus |
| Signal red | existing `#e0634f` | Directorate, danger, seals |
| Cream | existing `#ddd8c1` / `#e9e0c8` | text, as printed on sign enamel |

## Type
- **Barlow Condensed** (500-800) is the signage face: buttons, headings, numerals, labels. DIN-like wayfinding type, what a shaft sign would carry. Sentence case, no tracking games.
- **Barlow** (400-600) for reading text (briefings, log lines, panel copy).
- Google Fonts `<link>`; fallback stack is `Arial Narrow` / `Roboto Condensed` / system sans, so an offline demo is still narrow and legible.
- Scoped to the game shell and split screen (`.g-screen`, `.echo-screen`); journey screens keep `--sans`.

## What a Hollow button is
A plate: a 1.5px rim around a face, two opposite corners cut at 45 degrees (top-left, bottom-right).
- **Secondary**: steel face (top-lit gradient), cream text.
- **Primary**: sodium-enamel face (amber to deep amber), dark ink, bright rim. One per screen.
- **Danger** (e.g. Dispatch): oxide-red rim and text on a dark red face; fills red on hover.
- **Hover**: rim lights to lamp amber, face lifts slightly.
- **Press**: plate sinks 1px, face gradient inverts, inner shadow.
- **Latched (toggle, `aria-pressed`)**: face goes dark like a recessed switch and a lamp strip glows along the top inside edge. Speed buttons and the sound switch use this, so "on" is a lit lamp, not a colour swap.
- **Disabled**: bare-rock face, dim rim, faint diagonal hatch (out of service), no hover.
- **Focus-visible**: rim turns cream and thickens to 3px inside the plate (clip-path would crop an outside outline).

## Bars and panels
- Bars (prepare bar, split-screen bottom bar, pane captions) are one continuous **steel rail**: flat gradient, 1px top highlight, dark underside. No rounded glass.
- Panels are **bulkhead plates**: same rim-and-cut-corner construction but one corner cut, near-square, no soft drop shadows. Different roles get different edges: red rim for Tower, lamp rim for Echo.
- Gauges: the beacon budget is a **segmented cell gauge** (ten cells), not a smooth bar.
- Switches: the log's "all events" checkbox is a latch switch.

## Principles
1. One bold place: the control plates. Panels echo the construction but stay flat.
2. Lamp amber is the only warm accent and always means "armed / chosen / lit".
3. Structure carries meaning: rims and lamps show state; nothing is chrome.
4. Hazard stripe appears once (the title rule), where a Hollow would actually paint one.
5. Copy: sentence case, plain verbs, no middle-dot meta, no arrows on links.

## Review against the brief and the skill's generic list
First draft vs. what changed:
- Draft had ALL-CAPS stencil labels on every plate (sign-like) -> **dropped**: that is the skill's "all-caps label" tell. Sentence case Barlow Condensed gets the signage feel from the letterforms.
- Draft had a rivet dot on every plate and panel -> **cut** ("remove one accessory"); the cut corners and lamp already say hardware.
- Draft kept mono data labels with tracking for the meter and legend -> **replaced** with condensed numerals and plain-case labels.
- Draft kept "Echo · campaign / Mission 1 · briefing" eyebrows -> **removed or reduced** to plain "Mission 1"; headings carry the meaning.
- Draft proposed amber glow around the primary -> **dropped** (clip-path crops it anyway, and a cheap glow is the neon default); the lit rim and enamel face do the work.
- Kept the near-black teal base from the existing Strata palette (it is the world's colour, not an acid-accent default); the accent is a sodium lamp tied to the scene's lamps, not a vermilion-on-black.

## After-build critique (iteration 1)
- Mission lock text wrapped to two lines on the cards -> shortened to "Needs a star in mission N".
- The bottom bar's time readout ran into the city-sim link and the sound plate crowded Abort -> added spacing and 72px right padding.
- Run/Replay was one more grey plate among five -> made primary (the one lit plate in the bar).
- Pane captions carried a 4px top rail and a kicker plate -> rail thinned to 3px so the kicker plate is the single accent.
- Screenshots: qa/echo/ui-theme-before-*.png vs ui-theme-after-*.png (title, missions, briefing, prologue, prepare, run, debrief, split).

# Open-source games and libraries worth borrowing from

_Research for `@m_opus`, Tue Nov 17, 2026. Deadline Fri Nov 20. Sizes were measured today with `npm pack` plus `gzip -9`; licenses come from the GitHub API and the repos' LICENSE files. Builds on `INDIE_GAME_RESEARCH.md` (juice, audio plan) and does not repeat it._

## 0. What we already have (so we don't re-add it)

`hollow-world` already ships a seeded `mulberry32` (`src/echo/missions.ts`), a synthesized Web Audio layer with a mute toggle and a guarded `localStorage` (`src/echo-view/game/audio.ts`, `progress.ts`), keyboard beacon placement, and a debrief with star pings. Dependencies are only `pixi.js`, `react`, `react-dom`. **So the honest answer to "which libraries?" is: almost none.** Most of the value below is mechanics and patterns, and the libraries are tiny optional extras. The engine uses an explicit sector graph, so grid pathfinders do not apply.

## 1. Top 8, sorted by value / effort

| # | Pick | License | Borrow | Effort |
|---|---|---|---|---|
| 1 | **Trauma-based screen shake** (Eiserloh GDC 2016 talk; Bevy `2d_screen_shake` example as reference code) | Talk = idea only; Bevy example is MIT/Apache | `trauma` 0..1, decays over time, offset = `trauma^2 * noise`. Add 0.6 on seal, 0.2 on beacon-empty. Apply to the Pixi stage position. About 15 lines, no dependency | S |
| 2 | **Simon Tatham's Net: "lit" reachability** | MIT | Net colors every tile connected to the power source. Do the same on Prepare: BFS from the tower through beaconed sectors and light every sector that will "hear" news. That is the beacon rule made visible, and it replaces a text-only preview | S |
| 3 | **Tatham-style game IDs** | MIT (idea) | Every Tatham puzzle has a short ID that recreates a layout. Encode a beacon layout as a short string (`#m2:07,12,31`), restorable from the URL. Gives replay, a "best layout" ghost, and one-line bug reports from testers | S |
| 4 | **Mindustry placement UX** | GPL-3 (ideas only) | Placement ghost tinted red when invalid, range ring while placing, wave countdown plus incoming-wave preview. Use: ghost under the cursor, a faint ring for hop range, and a "tower goes dark in 0:20" strip during Prepare | S |
| 5 | **pixi-filters** (`ShockwaveFilter`, `GlowFilter`) | MIT | Shockwave ring when a beacon is placed or the seal hits; glow on amber beacons. Import per filter (`pixi-filters/shockwave`): about 1.5 KB gz each. Needs Pixi 8 (we have 8.23) | S-M |
| 6 | **OpenTTD path signals** | GPL-2 (ideas only) | A train reserves its path before entering a block; red is the default; deadlock is shown, not hidden. Mirror in the Run view: color claimed sectors per pod, flash a "waiting for claim" marker on a yield. Gives the medical > supply > passenger rule a visual | M |
| 7 | **ZzFX** | MIT | Replace hand-built oscillator blips if they sound thin. 872 B gz, one `zzfx(...params)` call, and the ZzFX Sound Designer web page exports the params. Keep our drone code | S |
| 8 | **2048 + Flexbox Froggy shell patterns** | MIT | 2048: a fake-storage fallback when `localStorage` throws, best score persisted. Froggy: instruction panel plus a live check, per-level pass message, level list with completion marks. Both are tiny enough to read in 10 minutes | S |

Why this order: items 1 to 4 add the "feel and legibility" the juice research asked for with no new dependency and no engine change, so they cannot break `main`.

## 2. Games: what mechanic is worth borrowing

### 2.1 Simon Tatham's Portable Puzzle Collection (MIT)

- URL: <https://www.chiark.greenend.org.uk/~sgtatham/puzzles/>. MIT, with browser (JS/WebAssembly) builds of every puzzle. The code is C; port ideas, not code.
- **Net** (connect a network): tiles connected to the source are lit. Maps to pick #2.
- **Untangle**: crossing lines turn red live, and the puzzle completes the moment none cross. A live validity cue while dragging. Echo analog: the budget meter and dead-sector warning change color while placing, not only on Begin.
- **Flood** (fill in few moves): shows "moves / par". Analog: stars as "beacons used vs. par" (for example 3 stars at 9 beacons or fewer) alongside the delay thresholds in `campaign.ts`. Cheap and makes the budget a score.
- **All games**: undo/redo, a game ID you can paste, and a "Solve" or hint. Undo of a beacon placement is a free usability win if not already there.
- Not a fit: Loopy and Map (pure logic puzzles with no placement scarcity).

### 2.2 OpenTTD (GPL-2.0; do not copy code)

- URL: <https://github.com/OpenTTD/OpenTTD>; rules in the [signals manual](https://wiki.openttd.org/en/Manual/Signals); write-up on [self-regulating networks](https://sha256.net/openttd-srnw.html).
- Path signals: a train reserves its route up to the next signal before entering, and block signals refuse entry when the block is occupied even if the paths do not collide. Our "claim then enter" rule is the same idea, so the vocabulary is proven.
- The pathfinder treats a red two-way signal as an effectively infinite penalty, so trains take another route. This is the model for Echo's reroute-on-seal. We already do it in the engine; use it as the explanation line in the debrief.
- Tutorial pacing: one new signal type at a time. Matches "one hint per first event".
- Nothing here is worth the license risk to copy.

### 2.3 Mindustry (GPL-3.0; ideas only)

- URL: <https://github.com/Anuken/Mindustry>. Strongest open-source reference for placement-under-pressure: placement ghost, range overlay, wave timer shown before the wave, a "launch" confirm. See pick #4.
- Budget feel: resources shown as a bar plus number, flashing when a build is rejected for cost. Same as the "no beacons left" tick.

### 2.4 Others checked

| Game | License | Note |
|---|---|---|
| shapez.io <https://github.com/tobspr-games/shapez.io> | GPL-3.0 | Goal-gated unlocks: one new tool per level plus a short hint. Pacing idea for missions 2 to 4. Ideas only |
| A Dark Room <https://github.com/doublespeakgames/adarkroom> | MPL-2.0 (file-level copyleft) | Text log that appears line by line sets mood in a text-only UI. Safe to learn from; do not paste files |
| Hextris <https://github.com/Hextris/hextris> | GPL-3.0 per its LICENSE.md | Title / game-over / share shell. Ideas only |
| Untrusted <https://github.com/AlexNisnevich/untrusted> | No license file | Treat as all-rights-reserved. Level pacing is a good model; read only |
| Freeciv <https://github.com/freeciv/freeciv> | GPL-2.0 | Data-driven rulesets (missions as data) is the one idea, which we already do. Skip |
| Mini Metro-likes | MIT to unlicensed | GitHub search found only tiny hobby clones (for example `ralucado/TinySubway`, MIT, C#, 3 stars). Nothing usable. Skip |

## 3. Libraries (permissive, drop-in, sizes are min+gzip)

| Library | License | Size (gz) | Verdict |
|---|---|---|---|
| **ZzFX** `zzfx` 1.4.0, <https://github.com/KilledByAPixel/ZzFX> | MIT | 872 B | Optional, see pick #7. Needs the same first-click resume as our `audio.ts` |
| **jsfxr** <https://github.com/chr15m/jsfxr> | Unlicense (npm field is blank) | not measured | The sfxr.me page is a good sound designer, but ZzFX is smaller. Use only to design a sound, then hardcode params |
| **pixi-filters** 6.1.5 | MIT | about 1.5 KB per filter (shockwave 1526 B, glow 1356 B, CRT 1437 B, measured) | Pick #5. CRT on the Directorate panel fits the "propaganda screen" look. Peer: `pixi.js >= 8` |
| **@tweenjs/tween.js** 25.0.0 <https://github.com/tweenjs/tween.js> | MIT | 7.0 KB (ESM) | Only if you want chained tweens. For a pop, a pulse, or a counter bounce, 5 lines of `easeOutBack` in the Pixi ticker or a CSS transition is enough. Skip by default |
| **seedrandom** 3.0.5 | MIT | 948 B | Not needed: `mulberry32` already exists. Keep sim randomness out of the view |
| **@pixi/sound** 6.0.2 | MIT | n/a (1 MB unpacked) | Plays audio files. We have none by design. Skip |
| **howler** 2.2.4 | MIT | 9.7 KB | Same reason. Skip |
| **@pixi/particle-emitter** 5.0.10 | MIT | n/a | **Does not work with our Pixi 8**: its peers are `@pixi/* >=6 <8`. Do a 12-particle burst by hand with `Graphics` if wanted. Skip |
| **GSAP** | Custom, not OSI | n/a | Skip: not an OSI license and not needed |
| **ngraph.path** / **easystarjs** | MIT | n/a | Skip: the engine owns routing on its sector graph; both are for generic graphs or grids and would duplicate it |
| **pure-rand** 8.4.2 | MIT | n/a | Skip, same as seedrandom |

Audio assets, if sound files are ever wanted: Kenney's packs (kenney.nl) are CC0. Not needed while we synthesize.

## 4. Implementation notes for the three cheapest wins

1. **Shake.** Keep `trauma` in the map module. Per frame: `trauma = max(0, trauma - dt / 1.5)`; `shake = trauma * trauma`; offset the stage by `shake * 12 * (noise(t), noise(t + 100))`. Cap at 12 px. Disable under `prefers-reduced-motion`. Use a sum of two sines for noise, not a library. The sim stays untouched because only the view moves.
2. **Lit reachability.** In Prepare, run BFS over `world.ts` sectors where `beacon !== false`, starting at the tower's sector, using the same adjacency the engine uses for news hops. If that adjacency is exposed from `engine.ts` or `world.ts`, reuse it so the preview cannot disagree with the sim. Lit sectors get the amber glow; the rest stay dim. A test can assert lit set equals the set the engine reports as hearing a broadcast.
3. **Layout code.** `layout = sectors.filter(s => s.beacon).map(s => s.id).join(",")`, put it in `location.hash`, and parse with validation (ignore unknown ids, clamp to budget). Never trust the hash: unknown input falls back to the default layout.

## 5. License warnings

- **GPL (ideas only, do not copy code):** OpenTTD (GPL-2.0), Mindustry (GPL-3.0), shapez.io (GPL-3.0), Hextris (GPL-3.0), Freeciv (GPL-2.0). Copying even a function would put our repo under GPL.
- **MPL-2.0:** A Dark Room. File-level copyleft; only an issue if you paste its files.
- **No license:** Untrusted has no license file, so by default no reuse rights.
- **Unclear packaging:** `jsfxr` npm shows no license field, though GitHub reports Unlicense; `seedrandom` shows none on GitHub but its npm license is MIT. Not an issue unless we add them.
- Tatham puzzles are **MIT** (not GPL, which people often assume), but the code is C, so we borrow ideas only.

## 6. Gaps

- GitHub search found no good open-source Mini Metro-like; I did not search itch.io or js13k, which may have more.
- I did not run a bundle build to measure the real delta of pixi-filters in our Vite config. Do one `vite build` before and after if adopting it.
- The trauma formula comes from secondary sources (the Bevy example, a Godot plugin doc) as I could not find the talk's slides. Check the [GDC Vault listing](https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing) if exact details matter. The `^2` exponent is the common choice, not a requirement.
- Hextris license read from its LICENSE.md header only. Untrusted: GitHub reports no license.

## 7. Sources

- Tatham puzzles: <https://www.chiark.greenend.org.uk/~sgtatham/puzzles/>
- OpenTTD signals: <https://wiki.openttd.org/en/Manual/Signals>; <https://sha256.net/openttd-srnw.html>
- Eiserloh talk: <https://gdcvault.com/play/1023146/Math-for-Game-Programmers-Juicing>; Bevy example: <https://bevy.org/examples/camera/2d-screen-shake/>
- ZzFX: <https://github.com/KilledByAPixel/ZzFX>
- pixi-filters: <https://github.com/pixijs/filters>
- Repos checked via the GitHub API: Mindustry, shapez.io, A Dark Room, Hextris, Untrusted, 2048, Flexbox Froggy, tween.js, howler.js, particle-emitter, ngraph.path, easystarjs, seedrandom

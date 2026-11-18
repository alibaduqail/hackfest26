# Playable Descent: build spec

_Nov 18, 2026 · owner `@m_opus` · for the UI lane (`@m_sol`, `@m_codex`) · inputs: three research threads (design, game feel, code), `docs/specs/echo/DESCENT.md`, `GAME.md`._

## 1. Executive summary

The Descent feels like a playback because the player gets no forecast and no explanation: nothing says what is about to happen, and nothing says why a run went the way it did. The mechanic is already right (a narrow verb, scarce beacons, a deterministic world), so the fix is mostly UI on top of data the engine already produces. In the new mode the player is the Relay, places a few beacons live while pods move, and wins or loses on whether Nurse Mara (MED-1) and the medicine (SUP-3) reach the deep clinic by their star deadlines.

## 2. Core loop decisions (locked)

| # | Decision | Detail |
|---|---|---|
| 1 | Real time | Base 600 ms per tick, so the 72-tick run is about 43 s at 1x. The cutaway playback uses 410 ms; this is slower on purpose so a click has time to land. |
| 2 | Active pause | Space pauses. Placement still works while paused. Stars are deadlines on sim ticks, so pausing never helps the clock. Speed options: 1x and 2x only. |
| 3 | Auto slow-mo | The clock drops to about 0.35x inside telegraph windows (flood countdown, and MED-1 or SUP-3 within 3 ticks of an unbeaconed section). Show a "SLOW" pill. Any click or Space overrides it. |
| 4 | Flood telegraph | From about 10 ticks before the seal (`mission.sealAt`, tick 41 today): a countdown banner ("Flood on Main 1 in 9"), rising water and a red tint on the sealed L4 rail, a ring on the timeline, a warning sound. At 600 ms that is at least 5 real seconds of lead at 1x. It shows when and where, not what to do. |
| 5 | Click is a command | A click calls `act({type:"placeBeacon", sectorId, atTick: obs.tick})` on the echo engine only. It applies at the start of the next tick. The view draws a pulsing "queued" socket at once and resolves it when `obs.sectors[i].beacon === true`. |
| 6 | Command log is the save | Every accepted command `{sectorId, atTick}` goes into `cmds[]`. That array is the save, the retry input, the replay and the "watch the 3-star solution" feed. Same input gives the same run. |

Honesty line for the HUD, because it is mission data and not a spoiler: "The Directorate floods one tunnel. News only hops from beacon to beacon."

## 3. The first 60 seconds

**Safe first beat (cannot be failed).** Ticks 0 to 11. The tower goes dark at tick 6, and MED-1 does not leave the depot until tick 11, so nothing the player does or skips in this window can fail the run. Show one pulsing dashed socket on the first dark rail section, one beacon already highlighted in the budget pips, and one line of text. The first placement is free to be wrong; the level never depends on it. Pause is on by default until the first click or until tick 11, whichever comes first.

**One rule per level.** Each level gets one hint, shown when the pods first reach it, then gone. The world demonstrates the rule for about 10 seconds before a decision matters. Copy is a starting point; edit for length.

| Level | Rule shown | Hint copy |
|---|---|---|
| 1 Upper depot | Tower claims vs reality | "The tower still says it is working. It is not. Click a rail to bolt a beacon. You have 5." |
| 2 Relay | Beacons carry news; credential check | "News only travels through beacons. A dark section hears nothing." and on first reject: "Forged medical pod. It is queued as a passenger." |
| 3 Junction | Priority yield | "Medical goes first, then supply, then passengers. Waiting here is not a failure." |
| 4 Flooded shaft | The seal | "The shaft is flooding. A pod that hears in time takes the bypass. A pod that does not will wait." |
| 5 Deep clinic | Arrival; supply after medical | "Mara first, then the medicine. Both have a deadline." |

Pacing target (tune in playtest, validate with three humans): 0 to 10 s calm read; 10 to 30 s first real placement with pause allowed; about 35 s flood countdown appears; about 50 s auto slow-mo as MED-1 nears the unbeaconed stretch; 60 to 75 s SUP-3 resolves; end card within 5 s.

## 4. Feedback table

All numbers are starting points (tuning, not facts). Every row has a visual, a non-visual cue, and a reduced-motion fallback. Colour is never the only signal.

| Event | Visual | Motion | Sound recipe (Web Audio, no libs) | Reduced-motion fallback |
|---|---|---|---|---|
| Beacon placed | Lit lamp, ring R=40 px, 8 dust particles at the rail, pips go "-1" with a "-1" pop-up | Lamp scale 1.3 to 1 over 120 ms (easeOutCubic); ring 300 ms; trauma +0.15 (max 6 px) | Thunk: sine 180 to 60 Hz, 90 ms, vol 0.5, plus 20 ms triangle click at 900 Hz, vol 0.2 | No scale or particles; static ring that fades in 300 ms |
| News hop | Travelling dot with a 6-frame trail along the rail; small ring (R=24) at each beacon it reaches | Hops staggered 90 to 140 ms so it reads as a chain; beacon squash 0.9 to 1 | Blip: square 520 Hz x 2^(k/12), k = 2 per hop (cap 12, reset after 800 ms idle), 70 ms, vol 0.12 | Dot jumps beacon to beacon; no trail; ring becomes a 1-frame outline |
| Blind-wait warning | Pulsing ring on the pod, "?" glyph, and a line: "MED-1 reaches Main 0 in 6 ticks with no beacon" | Pulse 1.2 Hz; triggers slow-mo | Soft two-note falling tone, triangle 330 to 260 Hz, 120 ms, vol 0.15 | Steady (non-pulsing) ring and text line |
| Yield | Amber chevron or hold glyph above the waiting pod | 2-frame squash (sx 1.12, sy 0.9) at stop; no hit-stop, it is a good outcome | Triangle 330 to 260 Hz, 120 ms, vol 0.15 (calm) | Glyph only, no squash |
| Credential reject | Red X inside a hexagon on GHOST-1, red ring, one pop then steady (never blink) | Pop 0 to 1.2 to 1 (easeOutBack); sprite shake +-4 px for 200 ms; 70 ms hit-stop on that pod; trauma +0.35 | Buzz: sawtooth 140 Hz with 25 Hz tremolo plus a detuned 148 Hz, 220 ms, vol 0.25 | X fades in, no shake, no hit-stop |
| Seal | Blue water rises up the L4 shaft, foam at the front, tint 0 to 25%, label "SEALED" with a wave icon | Water tween 600 ms (easeInOut); trauma 0.5 decaying slowly; 10 px camera nudge toward the seal (CSS transform on `.world`) | Noise burst 400 ms through lowpass 2400 to 300 Hz, vol 0.35, plus sine 70 Hz rumble 500 ms | Instant state change, static water sprite, "SEALED" label, no tint animation |
| Reroute | Dashed new path draws on via `lineDashOffset`, short swoosh trail | Pod stretches along the new heading (sx 1.2) | Bandpassed noise, centre 400 to 1800 Hz over 180 ms, Q 4, vol 0.1 | Dashed path appears at once, no stretch |
| Arrival | Green ring, clinic icon pulse 1.0 to 1.15, "+1" pop-up | Pod hop (y -10 px) and bounce; counter ticks with a scale pop | Chime: sines 880 then 1318 Hz, 90 ms apart, 400 ms tail, vol 0.18, plus a 2x partial at vol 0.05 | Ring and icon highlight only |
| Stars | Stars pop in one at a time, 300 ms apart, background dims 30% | easeOutElastic from scale 0; 12-particle sparkle each; trauma 0.2 on the third | Ding: sine 1046 Hz x 2^(2n/12) for star n, 500 ms tail, 3x partial at vol 0.03 | Stars fade in in sequence, no elastic or sparkle |
| Fail | Dim 30%, red "Mara did not arrive in time" card, cause line (see 5) | Card slides 12 px, 200 ms | Falling sine 300 to 90 Hz, 400 ms, vol 0.25 | Card fades in |
| Refused click (no budget, sealed, already lit) | Pips shake +-3 px for 200 ms, one-line reason ("No beacons left") | Damped shake | Reuse the existing `empty` voice | Pips flash the accent outline once |

Mix: master gain 0.6, a compressor at the end, 40 ms per-event cooldown. Use `exponentialRampToValueAtTime` to 0.001 (never to 0), call `setValueAtTime` first, and `osc.stop(t+dur+0.02)`. A new `warn` voice (3 lines, flood countdown) is the only new Sound the code thread expects; the rest map to existing voices in `audio.ts` (`place`, `seal`, `yield`, `chime`, `star`, `empty`).

Hover and placement: ghost beacon at the snapped rail slot (alpha 0.5, breathing 1.0 to 1.05 at 1.2 Hz), faint coverage radius, valid = green ring plus check, invalid = red dashed ring plus X with a one-line reason. Cursor: `copy` valid, `not-allowed` invalid, set only on state change. Use pointer events, not mouse.

## 5. Debrief

- **Stars** come from `DESCENT_LIVE_GOALS` through the existing `objective()` and `holds` in `campaign.ts`. Show the three deadline chips during play ("Mara by N"), green when held, red when missed.
- **One-line cause chain, built from the engine log**, with the real margin. Example shape: "MED-1 waited blind at Main 0. Seal news left Beacon B at t41, reached Main 1 at t43, never reached Main 0. Arrived 2 ticks after the 3-star deadline." Numbers come from the log; never invent or round a margin in the player's favour. Clicking the line jumps the timeline marker to the decisive tick.
- **Instant retry.** R key, no confirm, run restarts in under a second. The previous layout appears as hollow ghost beacons (S effort) so the player sees what they changed.
- **Watch solution.** Feeds `DESCENT_LIVE_SOLUTION` into a fresh engine (all commands queued up front) and plays it read-only on the same screen, with a chip diff of placed sectors and the two `arriveTick` values next to yours.
- Moving ghost pod trails for the previous best run are optional (M effort) and on the cut list.

## 6. Accessibility and performance guardrails

**Accessibility**
- WCAG 2.3.1: no more than 3 flashes in any second. Never flash the full canvas; any luminance flash stays sprite-sized; one global 350 ms flash cooldown; never strobe red (the forged-pod X pops once, then holds).
- `prefers-reduced-motion`: read once, listen for `change`, add an in-game toggle that overrides it. One flag consulted in a single `emit()` place so every effect has one switch. Fallbacks are in the table above. Reduced motion also means no auto slow-mo flash or shake; the telegraph becomes text plus a static marker.
- Colour plus shape: valid green + check + solid ring; invalid red + X + dashed ring; yield amber + chevron; forged X in a hexagon; flood blue + wave icon. Glyph contrast against the cutaway above 3:1. Check once with Chrome's vision-deficiency emulation.
- Sound is never the only cue. Every audio event has a visual and the reverse. Mute and volume control present.
- Keyboard: arrows walk the sector list (built from `DESCENT_LAYOUT`, track 0 to 9, main, bypass), Enter places, Space (or P) pauses. Add an `aria-live` line for "3 of 5 beacons placed".

**Performance**
- Pooled particles: fixed 256 to 512 slot typed arrays, swap-remove, no `new` or array methods in the frame loop; 16 pooled pop-up labels.
- Avoid `shadowBlur`; pre-render glows to sprites; integer coordinates for sprites.
- DPR: backing store = CSS size x dpr, `setTransform(dpr,0,0,dpr,0,0)` on each resize, cap dpr at 2.
- One rAF loop, dt clamped to 50 ms (the code thread's pattern in `MissionScreen.tsx:253` caps at 100 ms; pick one and use it for both loops).
- Pause on `document.hidden`: suspend the AudioContext, reset `lastT` on return so tweens do not fast-forward.
- Audio unlock on first gesture: call `unlockOnFirstGesture()` (audio.ts:44) or mount `SoundToggle`. Do not import audio into the capture entry.
- Call `engine.observe()` once per tick, not per frame (it structuredClones). Never call `scene.show()` on mouse move; hover lives on the fx canvas.

## 7. Build plan

**Dependency: engine PR "92-live-beacons" merges first.** It must export `placeBeacon` in the Command union, `descentLive()`, `DESCENT_LIVE_GOALS` (`Goal[]`, same shape as `campaign.ts:36`) and `DESCENT_LIVE_SOLUTION` (`Command[]`). Today only `placeBeacon` and `descentLive` exist, and only in an unpushed worktree. Until it lands, build `live/` against the types and stub the goals locally. **Trap:** `act(placeBeacon)` on a tower-mode engine returns `ok:false` ("only echo mode has beacons"). Send placement to the echo engine only; never reuse `MissionScreen.tsx:303` (`res.every(r=>r.ok)`). A failing `act()` must never throw: show its `reason`.

All new code goes under `hollow-world/src/echo-view/cutaway/live/` (call it `live/`). Branch from `main` after #91 merges (it adds `cutaway/**` and changes `GameApp.tsx`). Split so no two terminals edit the same file. Owners below are a proposal for the lead to assign.

### 7a. Minimal playable slice (about 4 h, ugly but playable)

| # | Task | Owner | Effort | Files |
|---|---|---|---|---|
| 0 | Engine PR 92-live-beacons: `placeBeacon`, `descentLive`, `DESCENT_LIVE_GOALS`, `DESCENT_LIVE_SOLUTION`, tests for "beacon placed while pod is blind" and "placed after seal" | m_opus | M | `hollow-world/src/echo/engine.ts`, `types.ts`, `descent.ts` |
| 1 | Live driver: engine, `cmds[]`, forward-only `frames[]`, `place()` returning `{ok,reason}`, `step()`, `reset()`, replay. Test: live cmds fed to a fresh engine give an identical final `observe()`. Add the folder to the `test` glob in `package.json` | m_sol | M | `live/useLive.ts`, `live/live.test.ts`, `package.json` |
| 2 | Rail hit-test: `hitSector(nx,ny,tracks)` using `tracks` from PR91 `run.ts:18-38`, threshold about 26 px logical, ignore sealed and already-lit sectors, junction boxes extended. Test: each track hits at its midpoint, a far point returns null | m_sol | S | `live/hit.ts`, `live/hit.test.ts` |
| 3 | Screen shell: copy the `CutawayScreen` layout, drop the beat bar and seeking, wire `useLive`, pointer placement, tick loop with Space/P pause (Enter places on keyboard), beacon pips and clock in the header, result card when `over`. Route `?screen=descent-live` plus one Title button | m_sol | M | `live/LiveScreen.tsx`, one line in `GameApp.tsx` |
| 4 | Fx canvas above the scene canvas: hover ghost, dashed sockets on every dark sector, queued pulse, pop and ring. If short on time, ship sockets and hover only | m_codex | M | `live/fx.ts` |
| 5 | Debrief overlay: synthetic `CampaignMission` (`id:"descent-live"`), stars via `objective()`, Retry. Needs tower and normal observations (the `runToEnd` pattern, `GameApp.tsx:34`) | m_codex | S | `live/LiveDebrief.tsx` |
| 6 | QA at 1440x900 and 1920x1080, keyboard only, reduced motion | both | S | none |

Order: 0 first (or stubbed in parallel), then 1 and 2 in parallel, then 3, then 4 and 5 in parallel, then 6. Never cut the replay-determinism test, pause, or the flood telegraph.

### 7b. Polish (Thursday morning), in value order

| # | Task | Owner | Effort | Files |
|---|---|---|---|---|
| 7 | Deadline chips and run clock from `DESCENT_LIVE_GOALS` | m_codex | S | `live/Hud.tsx` |
| 8 | Flood telegraph: countdown, rising water, `warn` voice, auto slow-mo | m_codex | S-M | `live/telegraph.ts`, `audio.ts` (one voice) |
| 9 | Hint queue (the table in section 3) using `.echo-hint` CSS | m_sol | S | `live/hints.ts` |
| 10 | Failure cause line and margin from the engine log, click to jump | m_sol | S | `live/LiveDebrief.tsx` |
| 11 | Counter bump and shake, plus sounds from the feedback table | m_codex | S | `live/Hud.tsx`, `live/fx.ts` |
| 12 | Blind-pod danger marker and projection line | m_codex | S-M | `live/fx.ts` |
| 13 | Previous-layout ghost beacons on retry (hollow outlines) | m_sol | S | `live/fx.ts` |
| 14 | Compare with 3-star and "watch solution" | m_sol | M | `live/Compare.tsx` |

### 7c. Cut list (first to go)

1. Moving best-run ghost pod trails and the `saveBest/loadBest` store.
2. Compare screen and "watch solution" (keep the replay test; it protects the solution).
3. Touch support beyond pointer events.
4. Hover coverage preview and hop-spread preview.
5. Particles (keep audio, placement thunk and ghost, reject pop, star sequence, flood shake first).

## 8. Risks

| Risk | Mitigation |
|---|---|
| Thursday's video capture breaks | Do not edit `CutawayScreen.tsx`, `scene.ts`, `run.ts`, `echo.html` or `MissionScreen` behaviour. Everything lives in `live/` behind a separate entry. Keep the `GameApp.tsx` edit to a few lines. |
| `/echo.html` and the live game share a deploy | Do not touch `/echo.html`. Test the live route and the capture route after every merge. |
| Branching too early | Branch after #91 merges. `GameApp.tsx` diverges heavily in #91. |
| Engine PR not on origin | Build against types, stub goals, rebase when 92-live-beacons lands. |
| Determinism drift (live run differs from replay) | Write the replay test first (task 1). It guards the 3-star solution and "watch solution". |
| `reference(m)` is cached per Mission object | Build the mission once per attempt and share it across engines; `descentLive()` returns a new object each call. |
| Solution needs a beacon at the dark sealed sector | Add the visible explainer line from section 2 so it is not a trick. |
| Hidden tab fast-forwards the accumulator | Pause on `document.hidden`; clamp dt per frame. |
| Frame budget | One `observe()` per tick; hover on the fx canvas only. |
| Audio before gesture | Muted by default; unlock on first click. |

## 9. Evidence quality

Several primary sources could not be retrieved (GDC Vault talks, GMTK videos, the Into the Breach postmortem, Thorson's Celeste talk, the RPG Codex FTL interview). Their claims came from secondary write-ups. Items marked inference have no source.

| Finding | Rating | Source and note |
|---|---|---|
| Telegraphed threats make losses feel like the player's own fault | High | Into the Breach designer interview (gamedeveloper.com), read directly. The words "perfect information" and undo come from critics, not that interview. |
| Pause turns reflex pressure into decision pressure | High | FTL designers, episodiccontentmag.com, read directly. |
| Pause plus auto slow-mo together | Medium | Reasoned from the FTL quote and repo state. The auto slow-mo part is inference. |
| Instant retry removes friction | Medium | Secondary commentary (game-wisdom, dotgg). Sources disagree on timing (2 ms versus under 1 s). |
| Safe-spot-first teaching, one rule per level | Medium | Engadget on the Nintendo 4-step. Celeste, Portal and Baba details are secondary; Baba sources conflict. |
| Showing a true margin motivates a retry | Medium | Wordle near-miss paper (abstract only); Wadhwa and Kim. No research found for skill-decided games, so report real margins only and never fake a near-miss. |
| Visible scarcity makes each unit a real trade | Low | Lemmings summary (secondary). Poly Bridge: no usable source found. |
| Ghost of previous run aids retention | Low | Secondary framing only; nothing solid on effect. |
| Flood lead time of at least 5 s | Low | Inference; validate with three humans. |
| One-hop "aha" placement | Low | Inference. |
| WCAG flash limits, reduced-motion semantics, canvas optimisation, Web Audio ramp rules, autoplay policy | High | W3C, MDN, Chrome pages, read directly. |
| Trauma-based shake model, hit-stop durations | Medium | Bevy port of the GDC math talk, plus blog posts. The talk itself was not opened. |
| Every number in the feedback table and the audio recipes | Low | Tuning starting points from the juice thread; playtest and adjust. |
| Code reuse map and `file:line` references | Medium | Read from `main`, PR #91 and an unpushed worktree. Lines will shift after #91 and #92 merge; re-check before use. |

## 10. Open questions

1. What are the final `DESCENT_LIVE_GOALS` deadlines and star conditions? The 3-star bar decides how tight the pacing and slow-mo windows must be.
2. Should the player be told which sector is sealed before placing (the rule in the code thread: news starts only from a beaconed sealed sector), or should finding that out be part of the puzzle?
3. Is the live mode a new Title button, a replacement for the cutaway on the public site, or a hidden `?screen=descent-live` route until after Thursday's capture?
4. Does the full Descent need an earlier hard fail (all remaining routes impossible), or does the player always play to the end card?
5. Do we accept the 43 s base run, or do playtests need a slower 800 ms tick? Test with three people who have not seen the game.

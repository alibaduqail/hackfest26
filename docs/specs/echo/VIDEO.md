# Echo demo video: script and shot list

_v3.1 · Wed Nov 18, 2026 (system first; replaces the game-first v2.0 from #69) · target 3:00 (judges allow 2:00 to 4:00) · owner `@m_opus` with M and Ali · numbers come from `npm run harness` (seed 20261117). Re-run it before recording and update any number that changed._

## What changed in v3.1

Card 5 ("News hops, pods reroute") is no longer a diagram card. It now cuts to real gameplay from the playable Descent (`/?screen=descent-live`): two flood-warning beacons going in live and a pod rerouting around the seal, with a one-second glimpse of **Watch the solution**. Same slot, same 8 seconds, same caption; total runtime is unchanged. Everything else in v3.0 below still applies.

## What changed in v3.0

The video now pitches the **system** (the Echo protocol), not the game. Judges reward one connected solution that addresses several track problems, so the video names them (#7, #9, #10 up front, then #5 and #2 inside the system section) and spends its longest block, 58 seconds, on how Echo works, drawn as diagram cards. The game is evidence and a planning tool: it shows up as the proof run (`/echo.html`) and as the Prepare screen ("where do we put the radios?"). No title-screen tour, prologue or story beats. Sim ticks are unchanged: tower dark t+20, seal t+30, MED-1 departs t+31 and PAX-1 yields at about t+31 to t+43, Mara arrives t+137.

## Rules for the whole video

- **Voiceover names:** the Hollow, the Directorate, Echo, beacons, pods, Mara. Never say CTAF, protocol stack, sector claim, mutex, contract or "MED-1". Say "tunnels," never "airspace." The banner on screen says "flights" (the Directorate's own word), so the voiceover quotes it once.
- **Never state or imply a cause for the FAA halt.** Shot 1 shows the headline, cropped, with no subhead, URL bar or web address, and says only that departures were halted. The next line moves straight to the Hollow. No caption names a reason. Do not capture the game's epilogue.
- **On-screen labels are the build's own.** Crop and caption; do not edit out story text, city names or pod IDs.
- **Honest framing, said out loud:** it is slower (2.4x delay, Mara 137 min vs 80), it is a fallback not a replacement, beacons must exist before the crisis, the numbers come from a deterministic simulation (the signature check is simulated too; the write-up says so).
- Nothing mocked: every gameplay frame is the real build. The diagram cards are explanation and look like cards, not UI.
- Sound off in the game. Voiceover (and optional music) added in the edit. Captions on every line.
- Word budget: about 150 wpm. Recount with `grep '^VO:' docs/specs/echo/VIDEO.md | sed 's/^VO: //' | wc -w`.

## Shot list

Cards are in `docs/specs/echo/DIAGRAM_CARDS.md`. Capture owners are proposals for the lead to confirm: **M** screen recordings, **Ali** voiceover and fact cross-check, **card builder** whoever the lead assigns to render the HTML cards.

### 1. Hook (0:00 to 0:12)

VO: Last week, every departure in America was halted for over four hours. Now go underground.

- **On screen:** black, then the real headline, cropped to the headline only (editorial screenshot, Nov 13 FAA ground stop, "FAA lifts ground stop at U.S. airports, leaving travel chaos"). Hold about 6 s after the first sentence so the headline reads, then a hard cut on "underground."
- **Caption:** `Nov 13, 2026 · every US departure halted`
- **Visual source:** news screenshot (take E). No cause, no subhead, no URL.
- **Captures:** M.

### 2. The problem in the Hollow (0:12 to 0:37)

VO: In the Hollow, two billion people live in underground cities, and one Directorate tower clears every pod between them. It can go dark. It can lie: this banner says eighty-four flights authorized, and five are moving. That is tracks seven, nine and ten. A network the Directorate controls. Numbers that don't match reality. And medicine that runs out in the deep levels first.

- **Visual source:** `/echo.html?t=22&run=1&speed=1` (take A), Tower Down split screen at 1x, left pane cropped to the tower panel: "84 flights authorized / 5 actually moving". `?t=N` alone loads paused at 10x; `run=1` starts it and `speed=1` sets 1x. Record t+22 to t+45 so the panel flips from "tower online" to the claim and the log line "Directorate tower offline" appears first (t+20).
- **Captions (chips beside the cropped panel, in this order):** `84 authorized · 5 actually moving`, then `#7 The Directorate controls the network`, `#9 Directorate numbers don't match reality`, `#10 Medicine runs out in the deep levels first`. Each chip appears on its voiceover beat; build them in the edit.
- **Captures:** M.

### 3. The system (0:37 to 1:35, 58 s, the core)

One card per beat. Each card holds for the whole sentence plus about 1 s. Items on a card may build in as spoken.

**3a. Beacons (0:37 to 0:47).** Card 1.
VO: Our answer is Echo. Residents install battery radios, beacons, along the tunnels. Each beacon talks only to its neighbors. No center. No internet.
- **Caption:** `beacons · battery radios · neighbors only`

**3b. Rule 1 (0:47 to 0:54).** Card 2.
VO: Rule one: announce before you move, and one pod per sector. Safety, with no controller.
- **Caption:** `Rule 1 · announce · one pod per sector`

**3c. Rule 2 (0:54 to 1:05).** Card 3.
VO: Rule two: medical goes first, then supplies, then passengers. When there isn't enough to go around, the order is already decided, and the Directorate isn't the one deciding.
- **Caption:** `Rule 2 · medical, then supply, then passenger` (ties to #2, fair sharing)

**3d. Rule 3 (1:05 to 1:13).** Card 4.
VO: Rule three: only a nurse with a clinic credential can file a medical claim, so nobody can fake the priority.
- **Caption:** `Rule 3 · only credentialed nurses file medical`

**3e. News hops, pods reroute — live gameplay (1:13 to 1:21).** Take F, real build, not a card.
VO: News of a sealed or flooded tunnel hops from beacon to beacon, and pods route around it.
- **Visual:** `/?screen=descent-live`, take F. 0:00 to 0:03 (of the take): click the two `+` sockets on the flooded shaft (`main1`, then `main0`) to bolt the flood-warning beacons; the `N / 5 beacons left` pips count down. 0:03 to 0:06: cut to MED-1 nearing the fork as the seal news reaches it over the new beacons and it takes the bypass (the alert panel reads `Flooded`). 0:06 to 0:08: hard cut to a one-second flash of the **Watch the solution** button, then the `Solution replay` status in the header over the same shaft.
- **Caption:** `news hops beacon to beacon · pods reroute` (ties to #5), then a 1 s `Watch the solution · 3★ replay`
- **Captures:** M (gameplay, take F); Ali checks the beat against `docs/specs/echo/DESCENT.md`.

**3f. Real-world anchor (1:21 to 1:35).** Card 6.
VO: Pilots at airports with no control tower already do this. They announce on a shared frequency and take turns. Echo does it for a whole network. The Directorate can't switch off what it doesn't run.
- **Caption:** `Already real: towerless airports run on announce and yield`

- **Visual source:** cards 1 to 4 and 6; card 5 is take F, live gameplay (see the Thursday capture checklist). **Captures:** card builder renders cards 1 to 4 and 6; M captures take F; Ali checks every claim against `SPEC.md` (and `DESCENT.md` for the live beat).

### 4. Proof (1:35 to 2:15)

One continuous take, `/echo.html?t=10&run=1&speed=1` at 1x, then 10x (take B). The right pane is Echo; the left is the Directorate alone. Do not press Dispatch: Mara departs on her own at t+31.

**4a. Setup (1:35 to 1:42).**
VO: Same scenario, run twice, side by side. The Directorate alone on the left, Echo on the right.
- **Visual:** full split screen, t+10 to t+19, both panes.
- **Caption:** `Same scenario, same seed · Directorate alone | Echo`

**4b. Dark and seal (1:42 to 1:50).**
VO: At minute twenty, the tower goes dark. At thirty, they seal the tunnel to Lagos.
- **Visual:** t+19 to t+32. Log lines "Directorate tower offline" (t+20) and "Directorate seals s07-lagos-f0" (t+30); red X on the Sector 07 to Lagos tunnel on both maps.
- **Captions:** `t+20 tower dark`, then `t+30 Lagos tunnel sealed`

**4c. Yield (1:50 to 1:58).**
VO: At thirty-one, a passenger pod yields to Mara's. The rules decide, not the tower.
- **Visual:** crop to the right pane, t+31 to t+43 at 1x. Log line and map tag for PAX-1 yielding to MED-1 at the Sector 07 to São Paulo junction, reroute drawn in red. Highlight the log line (the engine's text reads "PAX-1 · Passenger yields s07-sao-f0 to MED-1 · Nurse Mara Vale"; the map tag reads "PAX-1 yields to MED-1").
- **Caption:** `t+31 PAX-1 yields to MED-1`

**4d. Arrival (1:58 to 2:03).**
VO: Nurse Mara arrives at minute one thirty-seven.
- **Visual:** switch to 10x at t+60; Mara reaches Lagos Deep at t+137 (about 8 s real time), Echo log scrolling.
- **Caption:** `Mara arrives · t+137`

**4e. Result card (2:03 to 2:15).**
VO: Nurses: zero of eight, against eight of eight. Supplies: zero of ten, against ten of ten. Flights moving: five against forty. All from a deterministic simulation. Run it yourself with npm run harness.
- **Visual:** Card 7 (the numbers, from the verified table below). Alternative: capture `/?screen=debrief&mission=tower-down` (take B2, the game plays the mission to the end and opens its debrief) and crop to the numbers. Use the card if the crop is hard to read at 1080p.
- **Caption:** `deterministic simulation · npm run harness`
- **Captures:** M (take B, optionally B2); card builder (Card 7).

### 5. Honest cost and planning (2:15 to 2:40)

VO: It has a cost. Passengers wait two point four times longer than on a normal day, and Mara's trip takes a hundred and thirty-seven minutes instead of eighty. Echo is a fallback, not a replacement, and the beacons have to exist before the crisis. That is what the Prepare screen is for: where do we put the radios? The campaign, Dead Zones, the Grounding, Ghost Flight, is how people learn it and test it.

- **2:15 to 2:25** Card 7 stays up, rows highlighted: delay `31.7x vs 2.4x`, capacity `5% vs 94%`, Mara `never vs t+137 (80 on a normal day)`. Caption: `Slower: 2.4x delay · Mara 137 min vs 80`
- **2:25 to 2:34** Prepare screen: `/?screen=prepare&mission=dead-zones` (take C1). Place a few beacons so the counter goes 0/40 to 3/40. Caption: `Prepare (Mission 2): where do we put the radios? · 40 beacons, 114 tunnels`
- **2:34 to 2:40** Missions screen, four mission cards: `/?screen=missions` (take C2). Caption: `Dead Zones · The Grounding · Ghost Flight`. Card states (locked or starred) depend on the browser profile; leave them as they are.
- **Caption (whole shot, small):** `fallback, not a replacement · beacons first`
- **Captures:** M.

### 6. Close (2:40 to 3:00)

VO: Any network run from one center has the same weakness, and the same fix. Build the backup first. Play it, or read the code, with the links on screen.

- **Visual:** Card 8 (title, hosted link, repo link) over a dimmed loop of `/` (take D). Hold the card for the last 8 s so the links can be read and paused.
- **Caption:** `Echo · build the backup first` + `https://hollow-world-eight.vercel.app/` + `https://github.com/alibaduqail/hackfest26`
- **Captures:** card builder; M for take D.

**Timing check:** 12 + 25 + 58 + 40 + 25 + 20 = 180 s = 3:00. Hard cap 4:00, so there is a minute of margin if a beat needs to breathe.

## Numbers used (from `npm run harness`, seed 20261117; verified, re-run before recording)

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Passenger delay | 31.7x normal | 2.4x normal (550 min) | 1.0x |
| Network capacity | 5% | 94% | 100% |
| Real / claimed flights | 5 / 84 | 40 / 84 | 40 / n/a |
| Mara arrives | never | t+137 (rerouted) | t+80 |

If the harness output changes, update this table, Card 7, and the voiceover lines in shots 2, 4e and 5.

## Thursday capture checklist

All screen recordings: Chrome, window 1440x900, zoom 100%, no extension bar, dark OS theme, QuickTime or OBS at 60 fps (30 fps is acceptable). Build: `npm run build && npm run preview`, or the hosted build. Sound off. Use a fresh profile or incognito for each take so progress state is known. Record 5 s of handle at each end. Capture after the 8 PM freeze.

| Take | URL | Setup | Duration | Feeds |
|---|---|---|---|---|
| A | `/echo.html?t=22&run=1&speed=1` | Loads running at 1x. Play to about t+45. Do not press Dispatch. | 25 s | shot 2 |
| B | `/echo.html?t=10&run=1&speed=1` | Loads running at 1x. Record to t+60 without touching anything. At t+60 click 10x until Mara arrives (about t+137), then record 3 s more. If the yield tag at t+31 to t+43 is missed, Reset, Run at 10x, switch to 1x shortly before t+28 and record to t+45. | about 60 s plus 10 s | 4a to 4d |
| B2 | `/?screen=debrief&mission=tower-down` | Optional, only if used instead of Card 7. Hold the tower vs Echo numbers for 20 s. | 25 s | 4e |
| C1 | `/?screen=prepare&mission=dead-zones` | Click a few tunnels (or Tab to the map, arrow keys, Enter). Counter goes 0/40 to 3/40. | 15 s | shot 5 |
| C2 | `/?screen=missions` | Hold the four mission cards still. For starred cards, finish Tower Down once in that profile first. | 10 s | shot 5 |
| D | `/` | Title screen, beacons pulsing. Background for the close card. | 15 s | shot 6 |
| E | news article | Screenshot or recording of the FAA headline. Crop to the headline only: no subhead, URL bar or web address. | still | shot 1 |
| F | `/?screen=descent-live` | Fresh run. Click the two `+` sockets at the flooded shaft (`main1`, then `main0`) to place the flood-warning beacons as MED-1 nears the fork, let MED-1 take the bypass, then press **Watch the solution** for one second and cut. Re-take if the bypass isn't visible in frame. | 8 s | shot 3e |

Query params (from `GameApp.tsx` and `MissionScreen.tsx`): `?screen=missions|prepare|run|debrief|briefing|title`, `&mission=<tower-down|dead-zones|grounding|ghost-flight>`, `&t=N` (starts the run at tick N, paused), `&run=1` (start running), `&speed=1|10|60` (default 10x), `&story=0` (no in-run story beats; `/echo.html` has none anyway). On `/echo.html`, `?t=N` loads paused at 10x unless `run=1` and `speed=1` are added (verified in `MissionScreen.tsx`). Test every link once on the hosted build before recording.

**Voiceover notes.** Quiet room with soft furnishings, mic about a hand-width from the mouth, a pop filter. 48 kHz WAV. Record each of the six sections as a separate take, three reads each, with a one-second gap before and after. Read at about 150 wpm, slower in section 3. Keep the numbers flat and clear. Re-take a flubbed line instead of fixing it later. Name the files `vo-1-hook.wav` through `vo-6-close.wav`.

## Friday edit plan (ffmpeg)

Deadline: export by 5 PM. Cap 4:00, target 3:00.

1. **Prepare assets.** Render the seven remaining cards (card 5 is take F, live gameplay, not a card) to 1920x1080 PNG (and a short build-in MP4 each if the card builder made one). Crop screen takes to 16:9 and scale to 1920x1080 (`-vf "crop=...,scale=1920:1080"`). Pick the best voiceover read per section.
2. **Assemble in order:** 1 hook, 2 problem, 3a to 3f cards, 4a to 4e, 5, 6. Cut each segment (`ffmpeg -ss -to -i take.mp4 -c:v libx264 ...`), then join with the concat demuxer, or `xfade` for 0.3 s dissolves between cards. Hard cuts on the hook and between the proof beats.
3. **Voiceover:** place the section takes on one audio track at the shot start times above (`adelay`, or concatenate with silence). Normalize to about -16 LUFS (`loudnorm`).
4. **Captions:** burn in the caption lines under each shot with `drawtext`, plus a voiceover transcript as `.srt` through `subtitles=`. Chips and call-outs use the Strata palette: cream text on slate, amber for emphasis, red for the Directorate.
5. **Music:** optional. A quiet drone under shots 3 and 5 at about -26 dB, ducked under the voice with `sidechaincompress`. Royalty-free only.
6. **Export:** 1080p, H.264 (`-c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p`), AAC 192 kbps, `-movflags +faststart`. Check it plays muted, runs about 3:00 (never over 4:00), and watch it once on a phone.
7. **Final checks:** no cause for the FAA halt anywhere (screen or voice), no personal info, links readable and correct on the close card, every number matches the table above.

## Schedule

- **Wed night:** scratch voiceover plus a rough cut with placeholder cards. Show it to one outsider cold and ask: "What does Echo do, and what does it fix?"
- **Thu night:** final footage capture after the 8 PM freeze; voiceover takes.
- **Fri until 5 PM:** edit, captions, export (1080p, about 3:00).

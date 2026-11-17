# Echo demo video: script and shot list

_v2.0 · Tue Nov 17, 2026 (leads with the game, #69; builds on the #62 dry run fixes) · target 2:45 · owner `@m_opus` with M and Ali · numbers come from `npm run harness` (seed 20261117). Re-run it before recording and update any number that changed. Capture after the Strata reskin (#71, merged) so every screen has the final look._

## What changed in v2.0

The video now opens on the game: title, prologue, briefing, mission select, Prepare (placing beacons), then the Tower Down run on `/echo.html`, then the game's debrief stars and end card. All sim ticks are unchanged (tower down t+20, seal t+30, MED-1 departs t+31 and yields around t+31–43, arrives t+137). The old Strata cut-away is now an optional insert. Total stays 2:45.

## Rules for the whole video

- **Voiceover uses four names:** the Hollow, the Directorate (the tower), Echo, and Nurse Mara Vale (say "Mara," not "MED-1"). Never say CTAF, protocol stack, sector claim, mutex or contract. The few place names in the lines (Lagos, São Paulo) are fine.
- **On-screen labels are the build's own, so crop and caption instead of hiding them.** The game screens show story text ("the Relay", "2087"), mission names, city labels (São Paulo Deep, Lagos Deep), pod IDs (MED-1, PAX-1) and other nurses' names. Do not edit them out. Crop to the pane or area the shot is about, and let the caption name what matters.
- Say "pods" once, then "flights." Say "tunnels," never "airspace."
- Each claim on screen must be visible in the build at that moment. Nothing is mocked in the final cut.
- **Honest framing:** Echo is a fallback, not a replacement. Name its cost (passengers wait longer). The signature is simulated. Never state a cause for the FAA outage: shot 1 shows the headline and says only that departures were halted. Crop the screenshot to the headline, with no subhead, URL bar or web address on screen, and do not say or caption any reason for the halt. Do not capture the game's epilogue.
- **Whose footage is whose:** Prepare (shot 4) is Mission 2, Dead Zones. Everything from shot 5 on is Mission 1, Tower Down. The caption on shot 4 says so, and no voiceover claims otherwise. The numbers below are Mission 1's.
- Sound stays off (the game's default). Voiceover and any music are added in the edit.
- Captions on every line (judges may watch muted).

## Shot list

| # | Time | Screen | Voiceover (read slowly) | On-screen text |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Black, then the real headline, cropped (editorial screenshot of a news article, Nov 13 FAA ground stop, "FAA lifts ground stop at U.S. airports, leaving travel chaos"). Not an in-game state; no cause on screen | "Last week, every departure in America was halted for over four hours." | `Nov 13, 2026 · every US departure halted` |
| 2 | 0:10–0:22 | **Game, `/`.** The ECHO title ("when the tower goes dark") with beacons pulsing on the tunnel map for about 4 s, then click **Begin**: the prologue types out over the next ~8 s (click the text to finish it early) | "Now imagine that tower never comes back, and the people running it want it that way. This is the Hollow: two billion people, in cities underground. Pods run the tunnels between them. Everyone still calls them flights, and one Directorate tower clears every one." | `The Hollow · one tower clears every flight` |
| 3 | 0:22–0:32 | **Game.** Click Continue: Mission 1 briefing, "Tower Down". The text types, then the Directorate's BROADCAST ("ALL FLIGHTS REMAIN AUTHORIZED...") and the three star objectives appear | "Mara Vale is a nurse in Sector 07. Her patients are in Lagos, where a lung sickness is spreading." | `Nurse Mara Vale · Sector 07 → Lagos Deep` |
| 4 | 0:32–0:44 | **Game, take 2.** Missions screen (four mission cards, Mission 1 starred) for ~3 s, click **Dead Zones**, briefing, **Place beacons**: the tunnel map with the beacon counter. Place a few beacons, counter ticks 0/40 → 3/40 | "Later missions hand you forty beacons for a hundred and fourteen tunnels, and you choose where each one goes." | `Mission 2 · you place the beacons` |
| 5 | 0:44–0:58 | `/echo.html`, 1× take from t+8: Run is already going. At t+20 the Echo log shows "Directorate tower offline" and the left tower panel changes from "tower online" to "84 flights authorized / 5 actually moving". The panel never says "offline": that word comes from the log line, so highlight the log line, then the panel | "Tonight, in Mission 1, every tunnel already has a beacon. At minute twenty, the tower goes dark." (beat) "On the left, the Directorate alone. Nothing new moves. And the tower keeps announcing: eighty-four flights authorized." | Highlight the panel: `84 flights authorized` vs `5 actually moving` |
| 6 | 0:58–1:08 | Same take, t+24 to t+34. Seal at t+30: log line "Directorate seals s07-lagos-f0" and a red X on the Sector 07–Lagos tunnel, on both maps. Do not press Dispatch: Mara's pod departs on its own at t+31 | "Then they seal the tunnel to Lagos." | `Directorate seals the Lagos tunnel` |
| 7 | 1:08–1:36 | Same take, t+31 to t+59, crop to the right pane (crop in the editor, there is no in-app zoom). Beacon pulses hop; MED-1's old path fades, the reroute through São Paulo draws in red; at the Sector 07–São Paulo junction the log line (t+31) and map tag (around t+33, brief, so use the close-up take if the main one misses it) show `PAX-1 yields to MED-1`, then MED-1 passes. Highlight the log line | "With Echo, every pod is its own navigator. It carries the tunnel map, it talks only to the radio beacon beside it, and it follows three rules: announce before you move, one pod per tunnel, medicine first. The news of the seal hops beacon to beacon, and Mara's pod re-plans through São Paulo. At the junction, a passenger pod yields. The rules decide, not the Directorate." | `announce · one per tunnel · medicine first`, then `PAX-1 yields to MED-1` |
| 8 | 1:36–1:50 | Same take, switch to 10× at t+60 so Mara arrives at Lagos Deep around t+137 (about 8 s real time), echo log scrolling | "No towers, no network, just a battery radio in every tunnel that talks to its neighbors. Mines already run this way. The Directorate can't switch off what it doesn't run." | `Mara arrives · t+137` |
| 9 | 1:50–2:02 | **Game, take 1.** The run ends on its own at t+360 and the game's debrief opens: the three stars pop in one by one and the verdict appears ("Mara made it, and every nurse and every crate with her. The passengers waited. That was the price.") | "Three stars. Mara made it, and every nurse and every crate with her. The passengers waited. That was the price." | `Mission 1 · 3 of 3 stars` |
| 10 | 2:02–2:30 | Same debrief screen, tower vs Echo side by side (hold the screen, crop to the numbers) | "Directorate alone: zero of eight nurses arrive, zero of ten supply runs. With Echo: eight of eight, ten of ten. The cost is honest: passengers wait about two and a half times longer than on a normal day. Echo is slower. But nurses arrive, medicine arrives, water arrives." | End card as built |
| 11 | 2:30–2:45 | Closing title card with the hosted link and repo link, added as an editing overlay (the game's title screen at `/` can sit behind it; the URLs are not an in-app screen) | "Echo is a fallback for when the center fails, or is turned against you. We built the Hollow to prove it works. Try it yourself." | `Echo · a fallback that keeps essential movement going` + hosted URL + repo |

Sum check: 10 + 12 + 10 + 12 + 14 + 10 + 28 + 14 + 12 + 28 + 15 = 165 s = 2:45.

Optional, only if time allows (do not let it push the total past 2:45):
- A 5-second insert in shot 8 of the ESP32 board in hand, with the caption `a beacon is this small`.
- A 5-second Strata cut-away at the end of shot 3 (steps below).

## Capture settings

- **Browser:** Chrome, window 1920×1080, zoom 100%, no extensions bar, dark OS theme. Use a **fresh profile or an incognito window** for takes 1 and 2 (the prologue only plays once, and Dead Zones unlocks from Mission 1's stars; both are kept in that browser's local storage).
- **Build:** `npm run build && npm run preview`, or the hosted build.
- **Take 1, the game (shots 2, 3, 9, 10):** open `/`. Click **Begin** (prologue, then Continue to the Mission 1 briefing), click **Begin** on the briefing. The run screen opens paused at t+0: click **60×** then **Run** and let it play to the end. Do not press Dispatch Nurse Mara Vale (she departs at t+31). At t+360 the debrief opens by itself; leave it on screen for 30 s so the stars and the numbers are both captured. Mission 1 gives 3 of 3 stars.
- **Take 2, Prepare (shot 4):** same window, straight after take 1 so Dead Zones is unlocked. From the title click **Missions** (or press Esc from the debrief), click **Dead Zones**, click **Place beacons**. On the map either click a tunnel or Tab to the map, press an arrow, then Enter (the counter goes 0/40 to 1/40).
- **Take 3, the split screen (shots 5–8):** open `/echo.html`, the bare Tower Down split screen with no story overlays or hint cards. Click **1×**, then **Run** at t+0 and record to about t+60. Do not press Dispatch: Mara departs automatically at t+31, and the yield and reroute shots rely on that. Then switch to **10×** until she arrives at about t+137. At 10× the sim moves 10 ticks a second, so the seal-to-yield beats (t+30 to t+43) pass in about 1.3 s: that is why the first 60 ticks are recorded at 1×. If the yield tag is missed, Reset and record t+28 to t+40 again at 1× (Run at 10×, switch to 1× shortly before t+30) and crop to the right pane.
- **Optional Strata insert (shot 3):** open `/strata.html` (or click "Sector 07 city sim →" on `/echo.html`). The sim starts at 60×, so select 1× immediately. Choose Explore (magnifying glass), pick "Mara Vale, Nurse", then "Follow Mara Vale". **Walking is not guaranteed:** in the dry run (07:03–07:06) she was working in the upper clinic. Scrub to a time when she is commuting, or follow a different nurse who is moving, and only claim "walks" if the take shows it.
- **Recording:** QuickTime screen recording or OBS at 60 fps. Voiceover is recorded separately, then laid over in the editor.

## Numbers used (from `npm run harness`, seed 20261117; re-run on current main after the reskin, unchanged)

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Passenger delay | 31.7× normal | 2.4× normal (550 min) | 1.0× |
| Network capacity | 5% | 94% | 100% |
| Real / claimed flights | 5 / 84 | 40 / 84 | 40 / — |
| Mara arrives | never | t+137 (rerouted) | t+80 |

Mission 1 stars with these numbers (checked against the game's own star rules): 3 of 3. Mara arrives, every nurse arrives, every supply run arrives, and the passenger delay is 2.4×, under the 3× limit.

If the harness output changes after tuning, update this table and the voiceover lines in shots 5, 8, 9 and 10 before recording.

## Schedule

- **Wed night:** rough cut using these shots, even with rough audio. Show it to one outsider cold and ask: "What does Echo do?"
- **Thu night:** final footage capture after the 8 PM freeze.
- **Fri until 5 PM:** voiceover, edit, captions, export (1080p, under 3:00).

# Echo demo video: script and shot list

_v1.1 · Tue Nov 17, 2026 (fixes from the #62 dry run) · target 2:45 · owner `@m_opus` with M and Ali · numbers come from `npm run harness` (seed 20261117). Re-run it before recording and update any number that changed._

## Rules for the whole video

- **Voiceover uses four names:** the Hollow, the Directorate (the tower), Echo, and Nurse Mara Vale (say "Mara," not "MED-1"). Never say CTAF, protocol stack, sector claim, mutex or contract. The few place names in the lines (Lagos, São Paulo) are fine.
- **On-screen labels are the build's own, so crop and caption instead of hiding them.** The maps and log show city labels (São Paulo Deep, Lagos Deep), pod IDs (MED-1, PAX-1) and other nurses' names. Do not edit them out. Crop to the pane or area the shot is about, and let the caption name what matters. Shots 6–8 deliberately show São Paulo Deep, Lagos Deep, MED-1 and PAX-1.
- Say "pods" once, then "flights." Say "tunnels," never "airspace."
- Each claim on screen must be visible in the build at that moment. Nothing is mocked in the final cut.
- **Honest framing:** Echo is a fallback, not a replacement. Name its cost (passengers wait longer). The signature is simulated. Never state a cause for the FAA outage: shot 1 shows the headline and says only that departures were halted. Crop the screenshot to the headline, with no subhead, URL bar or web address on screen, and do not say or caption any reason for the halt.
- Captions on every line (judges may watch muted).

## Shot list

| # | Time | Screen | Voiceover (read slowly) | On-screen text |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Black, then the real headline, cropped (editorial screenshot of a news article, Nov 13 FAA ground stop, "FAA lifts ground stop at U.S. airports, leaving travel chaos"). Not an in-game state; no cause on screen | "Last week, every departure in America was halted for over four hours." | `Nov 13, 2026 · every US departure halted` |
| 2 | 0:10–0:22 | `/echo.html` paused at t+0: both maps, Run and 10× controls visible | "Now imagine that tower never comes back, and the people running it want it that way. This is the Hollow: two billion people, in cities underground. Pods run the tunnels between them. Everyone still calls them flights, and one Directorate tower clears every one." | `The Hollow · one tower clears every flight` |
| 3 | 0:22–0:37 | Hard cut to the Strata city sim (`/strata.html`) with Mara Vale selected and followed at 1× (steps in Capture settings). Title card over it. Show her walking only if the take actually has her moving; otherwise show her at work in the clinic and keep the voiceover as is | "Mara Vale is a nurse in Sector 07. Her patients are in Lagos, where a lung sickness is spreading." | `Nurse Mara Vale · Sector 07 → Lagos Deep` |
| 4 | 0:37–0:55 | Back to `/echo.html`, press **Run** at 10×. At t+20 the Echo log shows "Directorate tower offline" and the left tower panel changes from "tower online" to "84 flights authorized / 5 actually moving" (the claimed number gets struck through later). The panel itself never says "offline": that word comes from the log line, so highlight the log line, then the panel | "At minute twenty, the tower goes dark." (beat) "On the left, the Directorate alone. Nothing new moves. And the tower keeps announcing: eighty-four flights authorized." | Highlight the panel: `84 flights authorized` vs `5 actually moving` (caption wording matches the panel) |
| 5 | 0:55–1:10 | Seal at t+30: log line "Directorate seals s07-lagos-f0" and a red X on the Sector 07–Lagos tunnel, on both maps. Do not press Dispatch: Mara's pod departs on its own at t+31 | "Then they seal the tunnel to Lagos." | `Directorate seals the Lagos tunnel` |
| 6 | 1:10–1:35 | Right pane only (crop in the editor, there is no in-app zoom): beacon pulses hop; MED-1's old path fades, the reroute through São Paulo draws in red | "With Echo, every pod is its own navigator. It carries the tunnel map, it talks only to the radio beacon beside it, and it follows three rules: announce before you move, one pod per tunnel, medicine first. The news of the seal hops beacon to beacon, and Mara's pod re-plans through São Paulo." | `announce · one per tunnel · medicine first` |
| 7 | 1:35–1:50 | At the Sector 07–São Paulo junction (log line at t+31, map tag seen around t+33, so use the slow 1× close-up take, the tag is brief): PAX-1 stops, `PAX-1 yields to MED-1` tag, MED-1 passes. Log line highlighted | "At the junction, a passenger pod yields. Water, food and medicine go before passengers. The rules decide, not the Directorate." | `PAX-1 yields to MED-1` |
| 8 | 1:50–2:05 | Echo log scrolling; 60× speed; MED-1 arrives at Lagos Deep around t+137 | "No towers, no network, just a battery radio in every tunnel that talks to its neighbors. Mines already run this way. The Directorate can't switch off what it doesn't run." | `Mara arrives · t+137` |
| 9 | 2:05–2:30 | End card (tower vs Echo, side by side) | "Directorate alone: zero of eight nurses arrive, zero of ten supply runs. With Echo: eight of eight, ten of ten. The cost is honest: passengers wait about two and a half times longer than on a normal day. Echo is slower. But nurses arrive, medicine arrives, water arrives." | End card as built |
| 10 | 2:30–2:45 | Closing title card with the hosted link and repo link, added as an editing overlay (the app's Echo title screen at `/` can sit behind it; the URLs are not an in-app screen) | "Echo is a fallback for when the center fails, or is turned against you. We built the Hollow to prove it works. Try it yourself." | `Echo · a fallback that keeps essential movement going` + hosted URL + repo |

Optional, only if time allows: a 5-second insert in shot 8 of the ESP32 board in hand, with the caption `a beacon is this small`.

## Capture settings

- **Browser:** Chrome, window 1920×1080, zoom 100%, no extensions bar, dark OS theme.
- **Echo screen:** `npm run build && npm run preview`, then open `/echo.html` (or the hosted `/echo.html`). `/` now opens the game (title screen); `/echo.html` is the bare Tower Down split screen with no story overlays, use it for shots 4–9. Shots 4–9 are one continuous run. Do not press Dispatch Nurse Mara Vale: she departs automatically at t+31, and the yield and reroute shots rely on that. Press Run at t+0, 10× until t+45, then 60× to the end. Record the whole run once and cut from it.
- **Close-ups:** record a second take of shots 6–7 at 1× from t+28 to t+40 (Reset, Run at 10×, switch to 1× shortly before t+30), for the yield and reroute close-ups. Crop in the editor to the right pane.
- **Strata shot (3):** open `/strata.html` (or click "Sector 07 city sim →" on `/echo.html`). The sim starts at 60×, so select 1× immediately. Choose Explore (magnifying glass), pick "Mara Vale, Nurse", then "Follow Mara Vale". The inspector shows her as a nurse and centers the camera on her. 15 seconds is enough. **Walking is not guaranteed:** in the dry run (07:03–07:06) she was working in the upper clinic. Before recording, scrub to a time when she is commuting, or follow a different nurse who is moving, and only claim "walks" if the take shows it. Otherwise use the clinic take; the voiceover and title card still hold.
- **Recording:** QuickTime screen recording or OBS at 60 fps. Voiceover is recorded separately, then laid over in the editor.
- **Optional extra shot (10 s):** the game's Prepare screen in Dead Zones, placing beacons, to show it's a playable game (research tip). From the title: Missions, Dead Zones, Place beacons; focus the map, press an arrow then Enter to place one (the counter goes 0/40 to 1/40). Dead Zones must be unlocked first in that browser's campaign progress.

## Numbers used (from `npm run harness`, seed 20261117)

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Passenger delay | 31.7× normal | 2.4× normal (550 min) | 1.0× |
| Network capacity | 5% | 94% | 100% |
| Real / claimed flights | 5 / 84 | 40 / 84 | 40 / — |
| Mara arrives | never | t+137 (rerouted) | t+80 |

If the harness output changes after tuning, update this table and the voiceover lines in shots 4, 8 and 9 before recording.

## Schedule

- **Wed night:** rough cut using these shots, even with rough audio. Show it to one outsider cold and ask: "What does Echo do?"
- **Thu night:** final footage capture after the 8 PM freeze.
- **Fri until 5 PM:** voiceover, edit, captions, export (1080p, under 3:00).

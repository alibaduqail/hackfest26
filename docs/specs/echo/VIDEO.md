# Echo demo video: script and shot list

_v1 · Mon Nov 16, 2026 · target 2:45 · owner `@m_opus` with M and Ali · numbers come from `npm run harness` (seed 20261117). Re-run it before recording and update any number that changed._

## Rules for the whole video

- **Four names only, on screen and in the voiceover:** the Hollow, the Directorate (the tower), Echo, and Nurse Mara Vale. Never say CTAF, protocol stack, sector claim, mutex or contract.
- Say "pods" once, then "flights." Say "tunnels," never "airspace."
- Each claim on screen must be visible in the build at that moment. Nothing is mocked in the final cut.
- **Honest framing:** Echo is a fallback, not a replacement. Name its cost (passengers wait longer). The signature is simulated. Never state a cause for the FAA outage (shot 1 says only that departures were halted).
- Captions on every line (judges may watch muted).

## Shot list

| # | Time | Screen | Voiceover (read slowly) | On-screen text |
|---|---|---|---|---|
| 1 | 0:00–0:10 | Black, then the real headline (screenshot of a news article, Nov 13 FAA ground stop) | "Last week, every departure in America was halted for over four hours." | `Nov 13, 2026 · every US departure halted` |
| 2 | 0:10–0:22 | `echo.html` paused at t+0: both maps | "Now imagine that tower never comes back, and the people running it want it that way. This is the Hollow: two billion people, in cities underground. Pods run the tunnels between them. Everyone still calls them flights, and one Directorate tower clears every one." | `The Hollow · one tower clears every flight` |
| 3 | 0:22–0:37 | Hard cut to the Strata city sim (`strata.html`), follow one nurse walking. Title card over it | "Mara Vale is a nurse in Sector 07. Her patients are in Lagos, where a lung sickness is spreading." | `Nurse Mara Vale · Sector 07 → Lagos Deep` |
| 4 | 0:37–0:55 | Back to `echo.html`, press **Run** at 10×. Tower banner flips to offline around t+20 | "At minute twenty, the tower goes dark." (beat) "On the left, the Directorate alone. Nothing new moves. And the tower keeps announcing: eighty-four flights authorized." | Highlight the banner: `84 flights authorized` vs `5 actually flying` |
| 5 | 0:55–1:10 | Seal at t+30: red X on the Sector 07–Lagos tunnel, on both maps | "Then they seal the tunnel to Lagos." | `Directorate seals the Lagos tunnel` |
| 6 | 1:10–1:35 | Right pane only (zoom/crop): beacon pulses hop; MED-1's old path fades, the reroute through São Paulo draws in red | "With Echo, every pod is its own navigator. It carries the tunnel map, it talks only to the radio beacon beside it, and it follows three rules: announce before you move, one pod per tunnel, medicine first. The news of the seal hops beacon to beacon, and Mara's pod re-plans through São Paulo." | `announce · one per tunnel · medicine first` |
| 7 | 1:35–1:50 | At the Sector 07–São Paulo junction (t+31, use the 1× close-up take): PAX-1 stops, `PAX-1 yields to MED-1` tag, MED-1 passes. Log line highlighted | "At the junction, a passenger pod yields. Water, food and medicine go before passengers. The rules decide, not the Directorate." | `PAX-1 yields to MED-1` |
| 8 | 1:50–2:05 | Echo log scrolling; 60× speed; MED-1 arrives at Lagos Deep around t+137 | "No towers, no network, just a battery radio in every tunnel that talks to its neighbors. Mines already run this way. The Directorate can't switch off what it doesn't run." | `Mara arrives · t+137` |
| 9 | 2:05–2:30 | End card (tower vs Echo, side by side) | "Directorate alone: zero of eight nurses arrive, zero of ten supply runs. With Echo: eight of eight, ten of ten. The cost is honest: passengers wait about two and a half times longer than on a normal day. Echo is slower. But nurses arrive, medicine arrives, water arrives." | End card as built |
| 10 | 2:30–2:45 | Title card, hosted link, repo link | "Echo is a fallback for when the center fails, or is turned against you. We built the Hollow to prove it works. Try it yourself." | `Echo · a fallback that keeps essential movement going` + hosted URL + repo |

Optional, only if time allows: a 5-second insert in shot 8 of the ESP32 board in hand, with the caption `a beacon is this small`.

## Capture settings

- **Browser:** Chrome, window 1920×1080, zoom 100%, no extensions bar, dark OS theme.
- **Echo screen:** `npm run build && npm run preview`, then open `/` (also `/echo.html`). Shots 4–9 are one continuous run. Press Run at t+0, 10× until t+45, then 60× to the end. Record the whole run once and cut from it.
- **Close-ups:** record a second take of shots 6–7 at 1× from t+28 to t+40 (Reset, Run, switch to 1× at t+28), for the yield and reroute close-ups.
- **Strata shot (3):** the `strata.html` city at 1×. Follow a nurse with the follow tool. 15 seconds is enough.
- **Recording:** QuickTime screen recording or OBS at 60 fps. Voiceover is recorded separately, then laid over in the editor.

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

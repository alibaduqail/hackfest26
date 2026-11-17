# Making Echo feel like an indie game

_Research for `@m_opus`, Tue Nov 17, 2026. Inspiration only: no art, names, or levels from any game are to be reused. Many sources below are secondary write-ups; claims are marked where only a blog supports them._

## 1. Executive summary

- **Feel comes from feedback, not features.** Layering small reactions (shake, pause, sound, easing) on an unchanged mechanic is the core "juice" idea ([Jonasson/Purho talk summaries](https://roblog.co.uk/2024/03/juicy-games/); [Nijman's 30 tricks](https://infovore.org/?p=5275)). We have the mechanic already; the missing layer is reaction.
- **Telegraph, then let the player own the outcome.** Into the Breach made enemy attacks readable so "every death felt like your own fault" ([Game Developer](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)). Echo's Prepare phase should show consequences before Run, so a blind wait reads as the player's choice.
- **Scarcity plus a human face makes pressure.** Papers, Please and Frostpunk land because consequences hit individuals, not totals ([Game Developer](https://gamedeveloper.com/design/ethically-designing-unethical-worlds); [Papers, Please analysis](https://mechanicsofmagic.com/2026/05/14/the-moral-checkpoint-how-papers-please-gamifies-ethical-resistance/)). Our beacon budget vs. Mara plus named pods is exactly that.
- **Sound is the cheapest "game" signal.** Mini Metro ties sound to game state and pauses to ambient ([Designing Sound](https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace)). Pure Web Audio synthesis gets us that with zero assets.
- **Judges decide on the first minutes and the video.** A game-jam rubric weights engagement and polish and treats a crash in the first ten minutes as disqualifying ([itch.io jam rubric](https://itch.io/jam/rpg-maker-2025-game-jam/topic/4685664/judging-criteria)); generic guides say the video is reviewed first ([Reskilll](https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/)). Stability and a strong opening beat extra content.

## 2. Techniques

| Technique | Why it works | Echo mapping | Cost | Priority |
|---|---|---|---|---|
| Screen shake with decay + hit pause | Nijman: kick camera ~6px, add 4 to shake value, freeze briefly on impact ([infovore](https://infovore.org/?p=5275)) | Seal event on map: 250 ms shake, red flash, 80 ms freeze | S | now |
| Easing on every state change | Timing and easing matter more than complexity (blog opinion: [gamejuice](https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons)) | Beacon pop (ease-out 120 ms), pulse rings, budget counter tick, panel slides | S | now |
| Audio tied to game state | Mini Metro music scales with network size, goes ambient on pause ([Designing Sound](https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace)) | Drone gets thinner as beacons die; Run speed changes tempo; pause = low hum | M | now |
| Minimal transit-map visual language | Bold colour, simple geometry, shape/motion/sound unity ([Wikipedia](https://en.wikipedia.org/wiki/Mini_Metro_(video_game))) | Dim dead sectors, amber beacon lights, one accent colour per state | S | now |
| Telegraphed consequence preview | Readable intent turns failure into the player's decision ([Game Developer](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)) | Prepare: live line "Mara's route crosses N dead sectors (+X blind ticks)" | M | now |
| Individual consequences | Frostpunk shows choices as events for individual characters ([Game Developer](https://gamedeveloper.com/design/ethically-designing-unethical-worlds)) | Debrief names who waited, who arrived | S | now |
| Scarcity as a visible meter | Money vs. compassion pressure in Papers, Please ([analysis](https://mechanicsofmagic.com/2026/05/14/the-moral-checkpoint-how-papers-please-gamifies-ethical-resistance/)) | Beacon budget "7 / 12" that shakes when empty | S | now |
| Diegetic text/UI | Citizen Sleeper shows story state in its dice ([NPR](https://www.npr.org/2025/01/30/g-s1-45425/citizen-sleeper-2-gareth-damian-martin)) | Directorate BROADCAST frame, log lines in-world voice, lying "84 authorized" number | S | now |
| Tutorial inside mission 1 | World 1-1 teaches by forcing interaction, no text ([Medium analysis](https://medium.com/swlh/the-perfect-game-tutorial-analyzing-super-marios-level-design-92f08c28bdf7)) | Tower Down is the tutorial: one auto-dismissing hint per first event | S | now |
| Typewriter briefing | Pacing and voice | Already in GAME.md §4 | S | now |
| Particles / muzzle-flash style effects | Common in juice lists | Pulse ring only; no particle system | M | skip |
| Generative music | Mini Metro serialism | One drone + sparse blips is enough | L | skip |
| Branching narrative (Inkle-style) | Story depth | Fixed briefings only | L | skip |
| Counterpoint: over-juicing hurts immersion ([GDC Indie Summit talk](https://gdcvault.com/play/1020937/contactUs)) | | Keep effects short and on events only | | |

## 3. Top 8 to build before Friday

1. **Sound toggle plus event sounds** (section 4). *Accept:* default muted, a speaker button persists in `localStorage` (try/catch), first click unmutes with no console errors, seal/arrival/place/yield each play a distinct sound.
2. **Seal impact.** Shake, red tunnel flash, low thud, brief freeze at the seal event. *Accept:* visible at 10x; under 300 ms; `prefers-reduced-motion` disables shake; sim state unaffected.
3. **Beacon place/remove feedback.** Pop ease, ring pulse, tick sound, budget counter bounce; at zero budget the meter shakes and a "no beacons left" tick plays. *Accept:* every click has visible and audible response within one frame.
4. **Prepare preview line.** Live count of dead sectors on Mara's route and the expected extra wait. *Accept:* updates within 100 ms of each placement; text at least 18 px.
5. **Mission 1 as tutorial.** One hint at a time, triggered by first tower-down, first seal, first yield (copy: "News hops from beacon to beacon."). *Accept:* a cold tester reaches Mara's arrival without any help, and hints never cover the map.
6. **Debrief that names people.** One verdict line plus who waited and who made it ("Mara made it. 31 passengers waited 2.4x longer."). *Accept:* line varies by outcome; retry works with one click or Enter.
7. **Arrival beat.** Mara's arrival: 400 ms slow-down, chime, brief highlight of her route. *Accept:* fires once per arrival, doesn't block fast-forward.
8. **Dead-zone readability.** Dim unbeaconed sectors, "?" tick on blind pods, amber beacon glow with slow idle pulse. *Accept:* in a muted screenshot, a stranger can say which sectors are dead.

## 4. Audio plan (Web Audio synthesis only)

One `AudioContext`, created or resumed inside the first click, because the autoplay policy requires a user gesture ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)). A master `GainNode` at 0.25, muted by default, with a toggle in the HUD. Per-sound pattern: oscillator into gain, exponential ramp to near zero, stop ([SitePoint](https://www.sitepoint.com/web-audio-api-add-sound-to-web-page)).

| Moment | Sound |
|---|---|
| Ambient (Run) | Two detuned sines at 55 and 55.5 Hz, slow LFO on gain. Lowpass cutoff falls as live beacons fall |
| Beacon placed | 880 Hz triangle, 80 ms; removed: 440 Hz, 60 ms |
| Beacon pulse hop | 1320 Hz sine, 30 ms, quiet; cap to a few per second (Mini Metro caps interactions the same way) |
| Tower goes dark | Falling saw sweep 220 to 40 Hz over 600 ms, then drone drops |
| Seal | Noise burst through lowpass, plus 60 Hz sine thump |
| Yield | Two quick 660 Hz blips |
| Mara arrives | Rising major triad, 3 sine notes, 120 ms apart |
| Blind wait | Soft 200 Hz square tick per tick, rate-limited |
| Pause | Ramp drone to near-silent hum (ambient on pause, per Mini Metro) |

Rules: every sound under 600 ms except the drone; no sound during the video voiceover unless ducked; the video should work muted.

## 5. Video-specific tips

- **First 10 seconds** (VIDEO.md shot 1 is a headline screenshot): add a 2-second glimpse of the live dark map pulsing before the headline, or make the first caption a question the map answers. The hook should show the game, not a slide.
- **Text size:** at 1080p, captions and HUD numbers at least 28 px; log lines at least 20 px; zoom the browser to 125% for capture. Test by viewing the clip at phone size.
- **Pacing:** one new idea per 15 seconds; cut dead time; use 60x for the wait, 1x for yield and reroute. Put one effect beat (seal shake) in shot 5 and one sound beat in shot 8.
- **Show play, not only watching:** include 10 seconds of the Prepare phase, placing beacons with the preview line changing. It proves a game, not a dashboard.
- **Muted-safe:** captions on every line; effects readable without audio.
- **Honest framing stays:** Echo is a fallback; show the cost. Generic guides also say to explain why you built it ([Reskilll](https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/)).

## 6. Sources

- Juice it or Lose It summary: https://roblog.co.uk/2024/03/juicy-games/
- What the talk teaches (blog opinion): https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons
- Art of Screenshake notes: https://infovore.org/?p=5275
- Counterpoint talk listing: https://gdcvault.com/play/1020937/contactUs
- Mini Metro audio interview: https://designingsound.org/2016/02/18/the-programmed-music-of-mini-metro-interview-with-rich-vreeland-disasterpeace
- Mini Metro overview: https://en.wikipedia.org/wiki/Mini_Metro_(video_game)
- Into the Breach (Subset Games interview): https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-
- Frostpunk / This War of Mine morality: https://gamedeveloper.com/design/ethically-designing-unethical-worlds
- Papers, Please moral mechanics: https://mechanicsofmagic.com/2026/05/14/the-moral-checkpoint-how-papers-please-gamifies-ethical-resistance/
- Citizen Sleeper (NPR interview): https://www.npr.org/2025/01/30/g-s1-45425/citizen-sleeper-2-gareth-damian-martin
- Mario 1-1 tutorial design: https://medium.com/swlh/the-perfect-game-tutorial-analyzing-super-marios-level-design-92f08c28bdf7
- Web Audio best practices (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- Web Audio beep tutorial: https://www.sitepoint.com/web-audio-api-add-sound-to-web-page
- Game-jam judging rubric: https://itch.io/jam/rpg-maker-2025-game-jam/topic/4685664/judging-criteria
- Hackathon judging guide: https://blogs.reskilll.com/what-hackathon-judges-look-for-complete-judging-criteria-breakdown-2026/

_Gaps:_ Papers, Please first-day tutorial and the full 30-trick Nijman list were not found. Several sources are blogs or aggregators. The Citizen Sleeper claim is about on-screen dice, not a documented diegetic-UI philosophy.

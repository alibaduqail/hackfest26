# Echo: the game layer

_v1 · Tue Nov 17, 2026, overnight · owner `@m_opus` · builds on `PLAN.md` (engine, contract, Tower Down) · M's direction: "a video game, indie game format"; the current Echo screen is the sample UI until the Strata/visual rework lands Wednesday._

## 0. The pitch in one breath

You are **the Relay**: the residents' quiet organizer. The Directorate is about to pull the plug on the network. You get a handful of battery beacons and a few minutes to bolt them into the tunnels. Then the tower goes dark, and the pods have to get Mara and the medicine through on their own, using only what you built.

That is the whole game. It is also the whole argument: Echo works only where people built the radios beforehand.

## 1. Core loop (every mission)

| Phase | What the player sees | What the player does |
|---|---|---|
| **Briefing** | Story card: Mara, the city, what the Directorate just announced. A Directorate broadcast line in propaganda voice. Objectives with star thresholds. | Read, then "Prepare" |
| **Prepare** | The world map with every tunnel sector. Beacon budget counter ("7 / 12 beacons"). Pre-placed beacons on missions that give them. | Click sectors to place or remove beacons, then "Begin" |
| **Run** | The existing split screen. Directorate alone on the left, Echo on the right. Dead (unbeaconed) sectors drawn dim. Pods waiting blind show a "?" tick. | Run/pause/speed, "Dispatch Nurse Mara Vale" (where the mission allows) |
| **Debrief** | The existing end card, plus stars and a one-line verdict ("Mara made it. The Sump waited 3× longer."). | Retry, Next mission, Back to missions |

Progress (stars per mission, unlocked missions) is saved in `localStorage` and wrapped in try/catch. The game must also run with storage blocked.

## 2. The beacon mechanic (contract v2, engine rules)

A `Sector` gets `beacon?: boolean`. Missing means `true`, so Tower Down and v1 behaviour don't change.
- **News hops only through beaconed sectors.** Through a city, it passes between any beaconed sectors touching it. An unbeaconed sector neither hears nor relays.
- **A pod in or at an unbeaconed sector hears nothing.** It learns of a seal only by standing at the sealed boundary (the existing "sees" rule).
- **Fail-safe entry:** before an Echo pod enters an unbeaconed sector, it waits **3 ticks blind** at the boundary (log `blind`, once per pod and sector). Then it claims and enters under the normal rules. This is the honest cost of a dead zone.
- **Tower and normal modes ignore beacons.** The Directorate has its own network, until it doesn't.
- **Multiple seals:** `Mission.seals` lists further seals after `sealAt/sealSectorId`. Every seal follows the same news and reroute rules.
- **Ghost pods:** `Pod.ghost` marks a Directorate-injected fake with a forged signature. The engine already treats forged medical as passenger and logs `credential-reject`. The view reveals it.
- **Beacon budget:** `Mission.beaconBudget` is a number, or null/missing for a fixed layout. Placement happens in the UI before the engines are created, by setting `sector.beacon` on the mission's world. No engine command is needed.

## 3. Campaign (missions)

| # | Mission | Teaches | Setup | Stars (★ / ★★ / ★★★) |
|---|---|---|---|---|
| 1 | **Tower Down** (exists) | The split screen, the yield, the reroute | All beacons pre-placed; dispatch Mara | Mara arrives / all 8 nurses / all supplies with delay ≤ 3× normal |
| 2 | **Dead Zones** | Beacons matter | Same world. Budget of about 40 beacons for 114 sectors. Seal at t30 on the Lagos tunnel | Mara by min 160 / Mara by 145 / Mara by 148 and last supply by 172 |
| 3 | **The Grounding** | Weeks, not hours; the Directorate keeps cutting | Long run (endTick about 1440, time-lapse at 300×). A second wave of pods. Three seals over time (Lagos, then Cairo–Lagos, then London–Lagos). Budget about 50 | Mara by 160 / Mara by 148 and half the supplies by 145 / also delay ≤ 3.2× |
| 4 | **Ghost Flight** (stretch) | Trust without a center | Tower Down plus one ghost medical pod with a forged signature that tries to jump the queue | Forged pod rejected and Mara arrives / all nurses / all supplies with delay ≤ 3× |

Star thresholds live in the view's campaign catalog (`src/echo-view/game/campaign.ts`), not in the engine. They are computed from the final `Score` plus the normal-day run.

## 4. Look and feel (indie, not a dashboard)

- **Title screen:** "ECHO", subtitle "when the tower goes dark", a slow beacon pulse animation on the dark map, "Begin" / "Missions".
- **Mission select:** cards with a number, name, one-line hook, stars earned, and a lock state.
- **Briefing:** typewriter text (skippable with a click), with the Directorate broadcast in a distinct red monospace "BROADCAST" frame.
- **Prepare:** sectors glow on hover, and placed beacons show as small amber lights. A budget meter and a "clear all" button.
- **Typography and palette:** reuse the current Echo CSS tokens. No new dependencies, no new font downloads.
- **Inspiration (only for feel; don't recreate any game):** minimalist transit-map puzzle games, scarcity-decision survival games, and propaganda "paperwork" games. Big readable numbers, one decision at a time, a short session per mission.

## 5. Files and ownership (overnight)

`@m_opus` runs the overnight work with its own subagents. Board workers keep their current issues (`m_codex` #31, `m_claude` WRITEUP), and nobody else edits these files tonight.

| Lane | Files | Built by |
|---|---|---|
| Contract v2 | `hollow-world/src/echo/types.ts` | m_opus (PR #43) |
| Engine v2 | `src/echo/engine.ts`, `protocol.ts`, `tower.ts`, `missions.ts` (+ `deadZones()`, `grounding()`), `echo.test.ts` (+ beacon/seal tests), `scenarios/tower-down.ts` (+ all missions) | m_opus engine subagent |
| Game shell | NEW `src/echo-view/game/*` (App/router, Title, MissionSelect, Briefing, Prepare, Debrief, campaign.ts, progress.ts, game.css). Minimal props added to `MissionScreen.tsx` (mission in, onEnd out); `echo-main.tsx` mounts the game | m_opus view subagent |
| Map | `src/echo-view/map.ts`: dim unbeaconed sectors, beacon lights, hover/select for Prepare | m_opus view subagent |

## 6. Review and merge rules (overnight)

- Every PR is built and tested by its author: tsc, `npm test`, `npm run build`, and the harness where relevant.
- Then an **independent reviewer subagent** reads the diff and runs the checks. It comments `APPROVED` or `CHANGES`.
- `@m_opus` merges only after `APPROVED`, then redeploys Vercel.
- If a merge is blocked, the PR waits for M in the morning.
- `main` must stay deployable at every merge. If the build or tests are red, don't merge.

## Parked ideas

- **Pods carry news** (engine proposal, Nov 17): a pod that knows of a seal relays it when it enters a beaconed sector. Cheap (~30 lines) and v1-identical, but it softens Dead Zones and The Grounding right after calibration. Parked until after judging.

## Overnight checklist

- [x] 1. Contract v2 (#43): types.ts additive + this GAME.md (#43 merged)
- [x] 2. Engine v2: beacons, blind wait, multi-seals, ghost; missions deadZones() + grounding(); tests; harness for all missions (#44, #46 merged)
- [x] 3. Game shell: title → missions → briefing → prepare → run → debrief, progress saved (#45, #47 merged; prologue/epilogue in #47; STORY text in #50)
- [x] 4. Map v2: beacon lights, dim dead sectors, Prepare interaction (#45, #47 merged)
- [x] 5. Wire campaign missions 1–3 with star thresholds; tune so each mission is winnable but not free (harness numbers) (thresholds tuned from npm run harness:search; see campaign.ts STARS)
- [x] 6. Review + merge + Vercel redeploy; screenshots in `hollow-world/qa/echo/game-*.png` (live at https://hollow-world-eight.vercel.app/)
- [x] 7. Stretch: Ghost Flight mission; sound off by default (Ghost Flight shipped as mission 4; sound is off by default)
- [x] 8. Morning report on the board for `@mshaaf`: what's live, what's left, decisions needed (posted by `@m_opus`)

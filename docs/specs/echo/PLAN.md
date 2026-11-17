# Echo build plan

_v1.1 · Mon Nov 16, 2026 · adds beacons, sealed-track reroute, originality · supersedes the build sections of `SPEC.md` (skiffs, in-Strata lift) · source of decisions: `docs/council/council-report-2026-11-16.html`_

Every agent reads this file before taking an issue. If this file and an issue disagree, ask `@m_opus` on the board.

## 0. What we are building (one screen)

The Hollow is a worldwide network of underground cities. Pods run through deep tunnels between them. Everyone still calls them **flights**, and one Directorate tower clears every one. When the tower goes dark, every flight on Earth stops.

**Echo keeps essential movement going when the Directorate cuts control.** Nurses, medicine, water and food keep moving between cities when the central network is down, or is switched off on purpose to punish a city.

**How Echo works.** Every pod becomes its own navigator:
- **It carries the tunnel map.** Tunnels are physical and don't move.
- **It talks only to its neighbors** over **trackside beacons.** These are small battery radio relays that residents install, one per sector. Each one talks only to the next beacon, never to the Directorate's network.
- **It follows three rules:**
  - Announce before you move.
  - One pod per sector.
  - Medical first, then supply (water, food, medicine), then passengers.

When a pod finds a sealed track, the news hops beacon to beacon and every pod re-plans its own route around it. Pods carry news through dead zones. If a pod can't hear whether the next sector is clear, it waits. A dead beacon makes Echo slower, never unsafe. Only clinic-credentialed nurses can file medical.

**Real precedents:**
- Underground mines run node-to-node and leaky-feeder radio, required in US coal mines after the 2006 Sago disaster.
- Airports without a tower: pilots announce intent on a shared frequency.
- Phone mesh apps people used during internet shutdowns, such as Hong Kong in 2019.

**The demo is one mission: Tower Down.**
- Same seed on a split screen.
- **Left side, the Directorate alone.** Pods freeze, and the banner claims "84 flights authorized" while 6 actually move.
- **Right side, Echo.** Beacon pulses hop along the tunnels. The Directorate seals the direct tunnel to Lagos. Nurse Mara Vale's pod reroutes through São Paulo, and a passenger pod yields to her. She reaches the outbreak city.
- The mission ends on a scoreboard, including one number where Echo is worse than a normal day: network capacity.

**Real-world hook (optional):** on Nov 13, 2026 the FAA halted every US departure for over four hours, after one central system failed. Use it as a 5-second hook and never state a cause. Echo must stand without it.

**Why ours is different.** Other teams may pitch a mesh network or a routing app. Ours:
- **Proves the claim in a playable world** instead of pitching it: same seed, Echo off vs on, honest numbers, including where Echo is worse.
- **Has people in it:** 180 named residents and one nurse with a route.
- **Can be played by judges** from a hosted link.
- **Makes the lore a mechanic:** the Directorate visibly lies about its numbers.

Say "playable simulation" or "indie-game feel," never "based on a game." Strata is our own world and art. Keep the line "Echo is a fallback protocol, and this sim proves it works," so judges leave thinking "solution," not "game."

**One-liner:** "We didn't just design a backup network for the Hollow. We built the Hollow and let you watch it survive the Directorate."

**Problems claimed:**
- #7 is the core.
- #2: water, food and medicine reach the deep cities, shared by need.
- #9, partial: nurses and supplies reach the outbreak city. No outbreak tracking.
- Lore: the Directorate controls movement and fakes its numbers.
- Not #8, not #10.

**Not built:** Ghost Flight, live peers between devices, real crypto, family messaging, illness sim, hardware, the Strata zoom code. Strata appears in the video through a hard cut, plus a plain link from the map.

## 1. How the agents coordinate

### 1.1 Roles (from `AGENTS.md`)

| Handle | Role in this plan | Owns (only these paths) |
|---|---|---|
| `@m_opus` | Lead. Issues, contract, gates, board status, video script and write-up with the humans | `docs/specs/echo/**`, `hollow-world/src/echo/types.ts` (the contract) |
| `@ali_sol` | Reviewer for every PR | none |
| `@m_codex` | Engine lane: simulation core | `hollow-world/src/echo/engine.ts`, `tower.ts`, `protocol.ts` |
| `@m_claude` | Engine lane: data, mock, insurance map | `hollow-world/src/echo/world.ts`, `missions.ts`, `credential.ts`, `mock.ts`, and later `src/echo-view/SvgMap.tsx` (tripwire only) |
| `@m_claude1` | Engine lane: tests, harness | `*.test.ts` in `src/echo/`, `hollow-world/scenarios/tower-down.ts`, the `package.json` test script |
| `@ali_codex1` | View lane: map and mission screen | `hollow-world/src/echo-view/map.ts`, `MissionScreen.tsx`, `echo-main.tsx`, `hollow-world/echo.html` |
| `@ali_codex2` | View lane: panels, hosting, entry points | `hollow-world/src/echo-view/panels.tsx`, `echo.css`, `vite.config.ts`, deploy config, `index.html` / `strata.html` swap (Phase 3, needs Ali's OK) |

**Extra terminals.** Numbered handles follow `AGENTS.md`: `m_claude1`, `m_claude2`, `m_codex1`, and so on. The Lead splits a base handle's paths across them by issue. Each terminal works in its own worktree, and no file has two owners. The current setup is 1 Codex (`m_codex`) and 2 Claude terminals (`m_claude`, `m_claude1`), as in the table above. If M adds a third Claude terminal:

| Handle | Issues | Files |
|---|---|---|
| `m_claude` | 1.A1, then mock | `world.ts`, `missions.ts`, `credential.ts`, `mock.ts` |
| `m_claude1` | 1.A4, 1.A5 | `echo.test.ts`, `scenarios/tower-down.ts`, the `package.json` test glob |
| `m_claude2` | 1.A2, 1.A3 (when Sonnet fills the engine-core slot instead of `m_codex`) | `engine.ts`, `tower.ts`, `protocol.ts` |

Nobody touches `hollow-world/src/engine/**`, `src/world/**`, `src/main.tsx` or `public/scenario.json`. That is the existing 33-test city. The one exception is the Phase 3 entry swap, which only renames `index.html`.

### 1.2 Rules that make the parallel lanes work

1. **The contract is the only coupling.** The engine lane and the view lane talk only through `src/echo/types.ts` (section 3). The view codes against `mock.ts` until the integration step in Phase 2.
2. **Contract changes go through the Lead.** A worker who needs a change posts `@m_opus CONTRACT? <field> <why>`. The Lead bumps `CONTRACT_VERSION`, merges, and posts `@all CONTRACT vN: <diff>`. Engine and view each fix their side in their own PRs. No one else edits `types.ts`.
3. **One issue, one branch, one PR, under about 300 changed lines.** Branch `<issue#>-<slug>` from fresh `main`, as `AGENTS.md` requires.
4. **Tests come with the code.** An engine PR must keep `npm test` green: all 33 city tests plus the Echo tests. View PRs must pass `npm run build`.
5. **Review service level.** `@ali_sol` aims to turn a PR around within 45 minutes during work blocks. After the Thu 4 PM PR cutoff, only fixes listed on the board fix list get reviewed.
6. **Board cadence.**
   - Workers post `done #N` or `blocked #N: <what> @who`.
   - The Lead posts a status at each checkpoint listed in section 5, and whenever a gate passes or fails.
   - Keep one background `tools/board wait` running, as `AGENTS.md` says.
7. **Gates are binary.** At each gate the Lead checks the criteria and posts `G<n> PASS` or `G<n> FAIL: <blockers>`. If a gate fails, the tripwire actions in section 5 apply automatically. There is no third council.

### 1.3 Dependency graph (what can run at the same time)

```
P0 lock ──┬─► A1 world data ─┐
          ├─► A2 engine core ─┼─► A3 Echo protocol ─► A5 harness numbers ─┐
          ├─► A4 tests (TDD) ─┘                                           ├─► P2 integrate ─► P3 polish ─► P4 ship
          ├─► B1 map on mock ─────────────────────────────────────────────┤
          ├─► B2 panels on mock ──────────────────────────────────────────┤
          ├─► B3 hosting ─────────────────────────────────────────────────┘
          └─► S1 video script ─► S2 rough cut (Wed) ─► S3 final (Thu/Fri)
```

There are four lanes, and each one runs on a different person or agent:
- **Engine:** `m_codex` and `m_claude`.
- **View:** `ali_codex1` and `ali_codex2`.
- **Review:** `ali_sol`.
- **Story:** the Lead plus the humans.

No two agents edit the same file in the same phase.

## 2. SPARC phases mapped to the calendar

| SPARC phase | Where it lives | Gate |
|---|---|---|
| Specification | Section 0, section 4 (acceptance criteria) | G0 |
| Pseudocode | Section 3.3 | G0 |
| Architecture | Sections 1 and 3 | G0 |
| Refinement | Build phases P1–P3 | G1, G2, G3 |
| Completion | P4 ship, traceability in section 4 | G4 |

## 3. Architecture

### 3.1 Files

```
hollow-world/
  echo.html                     # new Vite entry (P1). Becomes index.html in P3
  src/echo/                     # headless, deterministic, no DOM, no Pixi
    types.ts                    # CONTRACT (Lead)
    world.ts                    # 12 cities, routes, sectors (data)
    missions.ts                 # Tower Down (+ Grounding stretch)
    credential.ts               # deterministic signature stand-in
    engine.ts                   # EchoEngine: step / observe / act
    tower.ts                    # Directorate tower policy (throttle, lie, fail)
    protocol.ts                 # Echo claim / yield / enter / release
    mock.ts                     # scripted Observation frames for the view lane
    echo.test.ts                # node:test, same style as src/engine/*.test.ts
  src/echo-view/                # React + Pixi (or SVG), reads Observation only
    echo-main.tsx               # entry, mounts MissionScreen
    MissionScreen.tsx           # split screen, run/pause, dispatch, end card
    map.ts                      # dark equirectangular map: dots, route lines, sector ticks, pods
    panels.tsx                  # tower banner, Echo log, scoreboard
    echo.css
  scenarios/tower-down.ts       # headless harness: prints the scoreboard for off / on / normal day
```

`package.json` change: add `src/echo/*.test.ts` to the `test` script. `m_claude` makes this one-line change in A4.

The engine is small (12 cities, about 40 pods), so it runs on the main thread. No worker is needed, so the city's worker protocol stays untouched. One tick is one sim minute.

### 3.2 Contract: `src/echo/types.ts` (frozen in P0)

**The source of truth is [`hollow-world/src/echo/types.ts`](../../../hollow-world/src/echo/types.ts)** (CONTRACT_VERSION 1). If this section and the file disagree, the file wins.

It defines:
- `City`, `Sector` and `World`. Sectors carry travel `minutes`, a `holder` and a `sealed` flag.
- `Pod`, which carries `sig` (the simulated credential), `credentialOk`, `rerouted` and `cargo` (medicine, water or food).
- `LogEvent` and `Pulse`. Pulses are the beacon hops the view animates.
- `Score`, with nurses, supplies, passenger delay, capacity %, real flights and tower-claimed flights.
- `Observation`, everything the view reads.
- `Command`: `dispatchMedical { podId, atTick }`, applied to both engines.
- `Mission`, which includes its `world`, the timing of the tower failure and the seal, and the pods.
- `EchoEngineApi` (`step` / `observe` / `act`) and `CreateEngine = (mission, mode) => EchoEngineApi`, exported from `engine.ts`.


### 3.3 Rules (pseudocode, owned by `m_codex`; tests by `m_claude`)

Each `step()` runs these in this fixed order: commands, tower, movement, Echo claims, score, then tick++. There is no `Math.random` anywhere. The mission seed feeds a mulberry32 generator, used only when `missions.ts` generates pods.

```
departures:    a scheduled pod at its origin with departTick <= tick becomes "waiting"
tower (mode tower|echo|normal), while towerUp:
               grant up to towerRatePerHour/60 waiting pods per tick (FIFO by departTick, then id); log "grant"
               a granted pod may enter its next sector when that sector's holder == null
at towerDownAt (modes tower|echo): towerUp = false; log "tower-down"
at sealAt (modes tower|echo): sector.sealed = true; log "seal"; no pod may enter it (a pod inside finishes it)
tower mode after down:
               zero new grants; a pod finishes its current sector, then "holding" at the boundary; log "hold" once
               towerClaimed = round(grantsEver * towerInflation); realFlights stays the true count
echo mode after down (protocol.ts):
               beacons: each sector has one; news moves ONE beacon hop per tick (to the next sector on the route,
                 and through a city to every sector touching it); each hop emits a Pulse
               seal news: starts at the sealed sector; a pod learns it when the news reaches its sector/terminal,
                 or on arriving at the sealed boundary itself (then it starts the news); log "seal-heard"
               on learning: if a sealed sector is ahead in path → shortest path by sector count over unsealed sectors
                 from the next boundary (BFS, tie → lower sector id); log "reroute"; rerouted = true;
                 no path → "holding" (Echo can't open a seal)
               every pod at a boundary or terminal "announce"s its next sector (that sector's beacon arbitrates)
               per free sector, winner = max by (priority rank, credentialOk for medical, waitedMin, -id)
               a medical claim with credentialOk == false is treated as passenger; log "credential-reject"
               winner "claim"s, spends 1 tick announcing (the honest throughput cost), then "enter"s
               losers log "yield" once per (pod, sector) contest
               an occupied sector is never preempted, medical included
               on exit: "release"; the sector becomes free next tick
               fail-safe: a pod never enters a sector whose state its beacon hasn't reported this tick
movement:      a pod in a sector advances progress by 1/sectorMinutes; at 1 → next boundary
arrive:        at the end of path → "arrived", arriveTick = tick; log "arrive"
score:         computed every tick from pods; capacityPct uses the cached normal-day run of the same mission
```

**No deadlock, by construction.** Each sector has one direction. Pods hold at most one sector. Every path ends in a city terminal, and terminals have unlimited capacity. So a chain of pods waiting on each other always ends at a terminal and can drain. Test AC-10 checks this.

**Credential stand-in** (`credential.ts`): `sign(id) = fnv1a(id + CLINIC_KEY)`, and `verify(pod) = pod.sig === sign(pod.id)`. It is labelled "simulated signature" in the UI and in the write-up.

### 3.4 Mission: Tower Down (draft data for `m_claude`)

**Cities (12):**
- New York Deep
- Sector 07 (under Washington; `strata: true`)
- São Paulo Deep
- London Deep
- Lagos Deep (`outbreak: true`)
- Cairo Deep
- Moscow Deep
- Mumbai Deep
- Beijing Deep
- Tokyo Deep
- Jakarta Deep
- Sydney Deep

**Routes:** 16 bidirectional routes, built as 2 one-way sector chains each, with 3–6 sectors per direction depending on map distance.

**Pods:** 40 in transit or scheduled at tick 0.
- 8 medical pods. Each carries a nurse, and most head to Lagos Deep. MED-1 is **Nurse Mara Vale** from Sector 07, a real Strata resident.
- 10 supply pods carrying medicine, water or food (about 4, 3 and 3), headed to the deep cities and Lagos.
- 22 passenger pods.

**Timing:** the tower is up from minute 0 to minute 20, at 18 grants per hour, which makes 6 grants. Then the tower goes down, and the mission ends at minute 360. Tower inflation is ×14, so 6 × 14 gives the "84 authorized" headline.

**Seal:** at minute 30 the Directorate seals the first sector of the direct Sector 07 → Lagos Deep route. MED-1 learns it from beacon news a few minutes later and reroutes through São Paulo Deep. Tune the timing so that happens on screen at 10× speed. The normal-day run has no seal.

**Target shape at G1** (the harness prints this; the exact numbers are whatever falls out honestly):

| Run | Nurses arrived | Supplies | Passenger delay | Capacity |
|---|---|---|---|---|
| Tower, failed | low (only pods past their last boundary) | low | huge | ~0% after down |
| Echo | most | most | high | ~60–75% |
| Normal day | all | all | low | 100% |

If the Echo row doesn't beat the failed-tower row on nurses and supplies, the rules are wrong. If it beats the normal day on capacity, the rules are also wrong.

## 4. Acceptance criteria and traceability

| AC | Criterion | Test (in `src/echo/echo.test.ts` unless noted) | Owner |
|---|---|---|---|
| AC-1 | The same mission and the same commands give an identical observation sequence | `deterministic: two runs deep-equal` | m_claude |
| AC-2 | Before `towerDownAt`, the tower and echo runs are identical | `echo == tower before down` | m_claude |
| AC-3 | Tower mode after down: zero new grants, and pods hold at the next boundary | `failed tower grants nothing` | m_claude |
| AC-4 | `towerClaimed = round(grantsEver × inflation)`, and `realFlights` is the true count | `tower lies, log tells truth` | m_claude |
| AC-5 | Never two pods in one sector, at any tick, in any mode | `sector exclusivity invariant` | m_claude |
| AC-6 | A contested sector goes to medical > supply > passenger > waited > id, and the loser logs exactly one yield | `priority and yield log` | m_claude |
| AC-7 | An occupied sector is never preempted, even by medical | `no preemption` | m_claude |
| AC-8 | A medical pod with a bad credential is treated as passenger and logged | `credential reject` | m_claude |
| AC-9 | Tower Down: Echo beats the failed tower on nurses and supplies, and Echo's capacity is below the normal day | `tower-down shape` + `scenarios/tower-down.ts` | m_claude |
| AC-10 | The mission reaches `endTick` with no stuck chain: every pod either arrived or is moving or waiting with a free path | `no deadlock` | m_claude |
| AC-11 | The 33 existing tests are untouched and green | `npm test` | everyone |
| AC-12 | `npm run build` passes, and the hosted URL opens on Tower Down, paused, with a Run button | manual check at G3, by the Lead | ali_codex2 |
| AC-13 | The split screen runs both engines in lockstep, and a dispatch applies to both at the same tick | manual + `act applies at atTick` | ali_codex1 / m_claude |
| AC-14 | No pod enters a sealed sector. A pod that hears of a seal ahead reroutes if a path exists, otherwise it holds | `seal reroute and hold` | m_claude |
| AC-15 | Seal news travels one beacon hop per tick, and a pod doesn't reroute before the news reaches it | `news latency` | m_claude |

## 5. Phases, subphases, owners, gates

Times are ET. Each subphase is one GitHub issue. The "‖" column marks subphases that run in parallel with each other.

### Phase 0: Lock (Mon Nov 16, tonight)

| # | Subphase | Owner | ‖ | Done when |
|---|---|---|---|---|
| 0.1 | M and Ali call (30 min): confirm worldwide Echo, this ownership table, and a hosting account (Vercel or Netlify; the repo is private, so GitHub Pages is out) | humans | a | Ali says yes on the board |
| 0.2 | Repo hygiene. M's checkout: stash the leftover PR #6 staging, rebase onto `origin/main`, PR the local `AGENTS.md` commit, and fill in the `AGENTS.md` §4 ownership table from §1.1 above | m_opus with M | a | `main` is clean, and `AGENTS.md` with ownership is merged |
| 0.3 | Contract freeze: `src/echo/types.ts` (§3.2) merged | m_opus | b | Merged, plus a board post `CONTRACT v1` |
| 0.4 | File issues P1–P4 from this file, then assign on the board | m_opus | b | Every subphase below has an issue and an owner |
| 0.5 | Video script v1: shot list, timed to 2:45, written before any UI code | m_opus + humans | c | `docs/specs/echo/VIDEO.md` exists |
| 0.6 | Host the current Strata build at the hosting URL (proves the pipeline) | ali_codex2 | c | Public URL loads Strata |

**G0 (Mon 11:59 PM):** 0.1–0.4 are done. 0.5 and 0.6 may slip to Tue noon.

### Phase 1: Build in parallel (Tue Nov 17)

Engine lane (M):

| # | Subphase | Owner | ‖ | Needs | Done when |
|---|---|---|---|---|---|
| 1.A0 | `mock.ts`: 12 scripted `Observation` frames (tower up, tower down, seal, a yield, a reroute, an arrival). Ships first so the view lane can start | m_claude | A | 0.3 | Exports `Observation[]` that type-checks |
| 1.A1 | `world.ts` cities, routes, sectors, plus `missions.ts` Tower Down, `credential.ts` | m_claude | A | 0.3 | Data validates (sector ends meet, paths are contiguous) |
| 1.A2 | `engine.ts` + `tower.ts`: departures, movement, tower grants, tower failure, the lie, score, `normal` mode | m_codex | A | 0.3 | AC-1–AC-5 pass |
| 1.A4 | `echo.test.ts` with all AC tests written first (red), and the `package.json` test glob | m_claude1 | A | 0.3 | Tests run (red until the engine lands) |
| 1.A3 | `protocol.ts`: beacon news (one hop per tick, pulses), seal and reroute, announce, claim, yield, enter, release, credential check | m_codex | after A2 | A2 | AC-6–AC-8, AC-10, AC-14, AC-15 pass |
| 1.A5 | `scenarios/tower-down.ts` harness: prints the §3.4 table for tower, echo and normal | m_claude1 | after A1, A3 | A1, A3 | The table prints and AC-9 passes |

View lane (Ali), entirely against `mock.ts`:

| # | Subphase | Owner | ‖ | Needs | Done when |
|---|---|---|---|---|---|
| 1.B1 | `echo.html` + `echo-main.tsx` + `map.ts`: dark map, city dots and labels, route lines with sector ticks, pods moving along sectors, medical pods red, holding pods dimmed, small beacon dot on each sector tick, sealed sector shown as a red X | ali_codex1 | B | 0.3 | Mock frames animate at `/echo.html` |
| 1.B2 | `panels.tsx`: tower banner ("84 flights authorized" vs the real count), Echo log (newest at the bottom, yields highlighted), scoreboard card | ali_codex2 | B | 0.3 | Panels render from mock |
| 1.B3 | Hosting serves `echo.html` too, with a multi-page Vite config | ali_codex2 | B | 0.6 | Hosted `/echo.html` loads |

Story lane: the Lead turns 0.5 into the on-screen text list (banner wording, label names) and posts it on the board so B1 and B2 use the exact words.

**Checkpoint, Tue 6 PM:** the Lead posts status, A2 merged, and B1 renders mock.

**G1 (Tue 11 PM):** AC-1–AC-10 and AC-14–AC-15 green, the harness table has the right shape, B1 and B2 render mock, and the 33 city tests are still green.
- **If the engine misses G1:** `m_claude` pairs on A3 Wed morning, and the Lead cuts AC-8 (the credential check) to a constant.
- **If the view misses G1:** start the tripwire insurance (2.T) Wed morning instead of Wed 6 PM.

### Phase 2: Integrate (Wed Nov 18)

| # | Subphase | Owner | ‖ | Needs | Done when |
|---|---|---|---|---|---|
| 2.1 | Swap mock for `createEngine` in `MissionScreen.tsx`: two engines (tower, echo), same mission, stepped in lockstep by one clock, plus a cached normal run | ali_codex1 | C | G1 | Live split screen at 1×, 10× and 60× |
| 2.2 | Visible protocol: pulses hopping beacon to beacon, yield stop with a small "yield → MED-1" tag, MED-1's old path fading and its rerouted path drawn, medical pod trail | ali_codex1 | after 2.1 | 2.1 | A yield is readable in a screen recording at 1080p |
| 2.3 | Controls: Run/Pause, speed, "Dispatch Nurse Mara Vale" (calls `act` on both engines), and an end card with the scoreboard in big type | ali_codex2 | C | G1 | AC-13 holds |
| 2.4 | Sector 07 city links to `strata.html`, the existing sim, in the same tab, with a back link | ali_codex2 | C | 1.B3 | Click-through works |
| 2.5 | Engine support: fix any contract-gap bugs found in 2.1, tune the mission so the timeline shows each visual beat at 10×. Deadline to raise gaps: 2 PM | m_codex + m_claude | C | G1 | Board fix list empty by 6 PM |
| 2.T | **Tripwire insurance:** at the 6 PM checkpoint, if 2.1 isn't drawing live data, `m_claude` starts `SvgMap.tsx` (plain SVG against the same `Observation`) | m_claude | C | contract | Swappable by changing one import |
| 2.6 | Rough-cut video from the live build (ugly is fine) and a cold viewer test with one outsider: "what does Echo do?" | humans + m_opus | after 2.1–2.3 | | Notes posted on the board |

**Checkpoint, Wed 6 PM:** the tripwire check.

**G2 (Wed 11 PM):** the hosted build shows the live split screen with the toggle, dispatch and scoreboard. If not, switch to `SvgMap.tsx` tonight. The idea doesn't change.

### Phase 3: Polish and freeze (Thu Nov 19)

| # | Subphase | Owner | ‖ | Done when |
|---|---|---|---|---|
| 3.1 | Lead triages rough-cut notes into ≤6 fix issues by 10 AM | m_opus | | Issues assigned |
| 3.2 | Fix issues (visual readability first, numbers second) | whoever owns the file | D | Merged by 4 PM PR cutoff |
| 3.3 | Entry swap: `index.html` opens Tower Down (paused, Run button), Strata moves to `strata.html`. Needs Ali's OK on the board | ali_codex2 | D | AC-12 holds |
| 3.4 | Write-up draft: problem, FAA hook, how Echo works, honest claims, what is simulated, judge one-liners (§6) | m_opus | D | `docs/specs/echo/WRITEUP.md` |
| 3.5 | Judge README section: one-line run, hosted link, the "what is simulated" box | m_claude | D | Merged |
| 3.6 | Stretch, only if G2 passed with no tripwire: The Grounding as a 20-second time-lapse (a second `Mission` in `missions.ts`, same engine, 300×) | m_codex + ali_codex1 | D | A mission picker shows both. Otherwise cut |

**4 PM:** feature PR cutoff. After that only board fix-list items are reviewed.

**8 PM:** feature freeze. Tag `v1-freeze`.

**G3 (Thu 10 PM):** AC-1–AC-15 hold on the hosted build, `npm test` and `npm run build` are green, and final footage is captured.

### Phase 4: Ship (Fri Nov 20)

| # | Subphase | Owner | Done when |
|---|---|---|---|
| 4.1 | Voiceover and edit to 2:45 (script beats in §7) | humans | Video exported by 5 PM |
| 4.2 | Final write-up and repo README pass | m_opus + humans | 7 PM |
| 4.3 | Submit: video, repo, write-up, hosted link | humans | **8 PM** (3 h buffer before 11 PM) |

**G4:** submission confirmed. The Lead posts the final status.

## 6. Judge-defense one-liners (for the write-up and Q&A)

- **Why not just a lock?** "One pod per sector is a lock. The tower is the lock server. Echo grants those locks when the server is gone, with priority, announce and yield."
- **Who verifies nurses?** "Clinics issue credentials before any outage, and pods check them locally with no network. In this build the signature is simulated."
- **What carries the broadcasts, if the network is down?** "Trackside radio beacons. They're battery-powered, installed by residents, and each one talks only to its neighbors. Mines already use this. Pods relay too, and if a pod hears nothing, it waits. The Directorate can't switch off what it doesn't run."
- **What if they seal a tunnel?** "Echo can't open it. Every pod carries the tunnel map, and the news hops beacon to beacon, so pods route around it."
- **What is Echo, without the FAA?** "A way for nurses, medicine, water and food to keep moving when the Directorate cuts control, or uses it as a weapon."
- **Where is Echo worse?** "It has lower throughput than a working tower, and passengers wait longer. The scoreboard shows it."
- **Is it real?** "Airports without towers already run this way: pilots announce intent and follow right-of-way rules. Medical flights already get priority from air traffic control. Echo is a fallback, not a replacement."
- **Why flights underground?** "The Hollow's tunnel pods are still called flights, and one tower clears them all, the way the FAA clears US airspace. One tower, one point of failure."

## 7. Video beats (detail goes in `VIDEO.md`, task 0.5)

| Time | Beat |
|---|---|
| 0:00 | (Optional) Real headline: Nov 13, every US departure halted. Otherwise open on the Hollow: "Every pod between its cities waits on one Directorate tower." |
| 0:10 | The Hollow world map. One line on flights underground. |
| 0:25 | Hard cut to Strata: Nurse Mara Vale walks to the terminal (existing sim footage). |
| 0:40 | Tower Down. Left side: pods freeze, the banner says "84 authorized", 6 moving. |
| 1:05 | The Directorate seals the tunnel to Lagos (red X). "No clearance. No navigation." |
| 1:15 | Right side, Echo: beacon pulses hop. "Each pod carries the map, talks to its neighbors, follows three rules." The seal news spreads, MED-1 reroutes through São Paulo, a passenger pod yields, MED-1 passes. Optional 5-second shot: the ESP32 board, "this is a beacon." |
| 1:50 | Mara arrives in Lagos Deep. Water, food and medicine reach the deep cities. |
| 2:15 | Scoreboard: nurses, medicine, and capacity versus a normal day (the honest cost). |
| 2:35 | "Echo is a fallback protocol. This sim proves it works when the tower fails or lies." Hosted link. |

## 8. Risks and cuts, in order

| Risk | Signal | Action |
|---|---|---|
| The map becomes an art project | B1 is not animating mock by Tue 6 PM | Dots, lines and ticks only. Tripwire 2.T |
| The engine numbers don't move | The harness table at G1 has the wrong shape | Tune mission data first (rate, timing). Change rules only through the Lead |
| A review backlog builds Thu | More than 3 open PRs at noon | PRs stay small. The Lead merges docs-only PRs after `@ali_sol` APPROVED |
| The contract drifts | Someone edits `types.ts` outside the Lead | Revert, then use the board CONTRACT flow |
| Video time gets squeezed | No rough cut by Wed 11 PM | Record the rough cut from mock frames if needed. Friday is for editing only |
| Other teams use the FAA hook | n/a | The nurse story and the honest scoreboard carry it. The hook is 5 seconds |

**Cut order if time runs short:**
1. 3.6, The Grounding.
2. 2.4, the Strata link (the video cut stays).
3. Beacon pulse animation. Keep the seal, the reroute and the red X; pulses become a plain log line.
4. 2.2 trails (keep the yield tag).
5. The credential check (make it a constant).
6. The normal-day capacity number. Last resort: it's the honesty proof.

## 9. Human decisions still open

- **Ali's yes** on the worldwide form and the ownership table (0.1).
- **A hosting account,** Vercel or Netlify (0.1).
- **The entry swap** making Tower Down the landing page (3.3).
- **The nurse.** Mara Vale is proposed; any of the 15 Strata nurses works.

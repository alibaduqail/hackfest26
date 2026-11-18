# Echo: keep the Hollow flying when the tower goes dark

_Spec v1 · Sun Nov 15, 2026 · from the LLM Council run in `docs/council/`_

> **Superseded (Mon Nov 16):** the build is now the worldwide tunnel-pod version in [`PLAN.md`](PLAN.md), per council round 2. This file is kept as the round 1 record. Skiffs, the in-Strata lift version and its engine changes are no longer planned.

## One breath

When the Directorate's tower goes dark, every skiff in the Hollow is grounded. Echo lets the skiffs talk to each other instead, like pilots at an airport with no tower or drivers at a dead traffic light, so nurses, medicine and people keep moving.

**Emotional core: essential workers.** When everything is grounded, healthcare workers still have to get to patients. Echo puts nurses and medical flights first, so the people who keep everyone alive can always travel. (Real-world parallel to verify before using on camera: medical flights flagged "Lifeguard" get priority handling from air traffic control.)

## Real-world framing (use these words, not stronger ones)

- On Nov 13, 2026 every US departure was halted for over four hours. One central system stopped, and everything stopped.
- Small airports already run without a tower: pilots announce position and intent on a shared frequency (CTAF) and follow right-of-way rules.
- Echo is that contingency protocol for a world where the center fails, or is used as a weapon. It is a **fallback**, not a replacement for the tower.
- Do **not** state a cause for the FAA outage (still unconfirmed and may be public by judging). Do not claim signatures prove data is correct; they prove who sent it.

## Problems claimed (only these)

| # | Claim | What's on screen that proves it |
|---|---|---|
| 7 | Organize and call for help without the Directorate's network | Comms cut → Echo takes over, skiffs keep flying |
| 2 | Share fairly when there isn't enough | Priority yield: medical > supply > passenger, not "upper floors first" |
| 9, 10 | Get supplies and care where they're needed | Nurses reaching the deep aid station; medicine runs reaching the deep floors |
| Lore | Directorate controls movement between levels; its numbers are fake | Ground order seals levels; tower panel "flights authorized" vs Echo's real log |

Mention #8 only as "people stuck on the wrong level". No family messaging, no illness. **No flood**: the grounding itself is what cuts people off.

## Verified facts about the current world (origin/main)

- The lift (`lift-0..6`) runs only in the Works district (`d1-f0..f7`), capacity 3 per segment, each segment on its floor's feeder.
- Stairs connect every level in every district, so today nobody depends on the lift. **Grounding skiffs only hurts anyone if the ground order also seals the stairs between levels.**
- One Directorate checkpoint (`cross-0-5`) already supports `lockdown`; that is the model for the ground order.
- Comms cut targets the relay room `d0-f2-annex`; the engine then rejects remote commands ("Command channel disconnected").
- 15 residents are Nurses. There is an upper clinic (`d0-f1`) and a lower aid station (`d2-f2-annex`).

## What to build

### Scenario (`hollow-world/public/scenario.json`)

- Add link kind `skiff`: the lift shaft segments become skiff airspace, plus short skiff hops from the Works shaft into the Exchange and the Sump on a few floors (e.g. `d1-f2 → d2-f2` near the lower aid station, `d1-f1 → d0-f1` near the upper clinic), capacity 1, on the floor's feeder.
- Add incident kinds `ground` / `unground` (the Directorate's ground order). While grounded: skiff links need tower clearance, and **stairs between levels are sealed** except to permit holders (generalizing the existing checkpoint `lockdown`). Corridors on the same level stay open.
- Add settings: `towerClearancesPerHour` (baseline throttle), `towerReportInflation` (e.g. 6×), `echoEnabled` (run flag).
- Flight requests come from real needs the sim already has: a nurse's shift at another level's clinic, a household's medicine/food from a depot on another level, a resident's work trip.

### Engine (`hollow-world/src/engine/`)

1. **Tower clearance (baseline).** A traversal of a `skiff` link needs a clearance from the tower in `d0-f2-annex`. The tower grants at most `towerClearancesPerHour`. With comms down, it grants none. It publishes `authorizedFlights` = real granted × `towerReportInflation`. This is the throttling, lying tower, so the baseline is not a rigged 0.
2. **Echo local authority.** When `echoEnabled` and comms are down, skiff links clear locally. This is a new engine rule inside `step()`, not an `act()` command (act is rejected during the comms cut). It must be deterministic and replay-safe.
3. **Segment claims.** Before entering a `skiff` link or lift segment, a mover claims it. Capacity is the lock. Conflicts are settled by priority: medical, then supply, then passenger, then lower id. Every yield writes a History event (`"Skiff S-2 yielded to medical flight M-1"`) so the UI can show it.
4. **Essential workers first.** Only Nurses (and the clinic/aid station) can file a medical flight. A nurse commuting to a shift counts as medical. Everyone else files as supply or passenger. This puts healthcare workers first and stops everyone claiming medical.
5. **Power.** A skiff/lift segment with no feeder power holds its movers. Blackouts hit the deep floors first, so Echo reroutes or waits.
6. **Signatures.** Each beacon carries a deterministic signature stand-in (e.g. a hash of mover id + secret seed). An unsigned or wrongly signed beacon is ignored and logged as a ghost. **No WebCrypto inside `step()`** (it's async). Real ECDSA can run in the UI only for the ghost-skiff beat.
7. **Cart rides skiffs.** The supply cart may traverse `skiff` links when cleared, so medicine physically reaches the deep floors.

Tests to add (keep all 27 existing green):
- Ground order + comms cut, `echoEnabled=false`: only throttled skiff traversals; nurses miss shifts on other levels; people stuck off their home level.
- Same seed, `echoEnabled=true`: more flights, nurses reach the lower aid station, medicine reaches the deep floors.
- Two movers request one segment: medical goes first and a yield event is logged.
- A non-nurse can't file medical.
- Unpowered segment holds movers.
- Replay of an Echo run reproduces the same final state.

### Harness (`hollow-world/scenarios/grounding.ts`)

One seed. Events: ground order + comms cut at T, optional bottom-floor blackout. Run headless with Echo off and on. Print:
- nurse shifts reached vs missed (essential workers)
- medicine runs reaching the deep floors
- real flights vs tower-claimed flights
- (secondary) people stuck off their home level

These three numbers are the scoreboard. "Collisions: 0" is **not** a headline metric (a lock can't collide in either run).

### UI (`hollow-world/src/world/`, `src/main.tsx`)

- Skiff sprite on any mover crossing a `skiff` link or lift segment. GROUNDED stamp when blocked by the tower.
- Yield callout over the shaft: "medical has priority".
- Directorate panel ("Shafts unsafe · 12 flights authorized") beside the Echo log (real, signed flights).
- One red ghost skiff, rejected on screen.
- Same-seed split-screen scoreboard with the three numbers in big type.
- One playable button: **Dispatch medical skiff** (from a Nurse inspector).
- One named nurse to follow in the video (lives up top, works the deep aid station).

## Cut (don't build)

Pad seizure, shaft jamming, multi-week escalation, family messaging, illness, ESP32, 500-seed statistics, "Play the Directorate" mode.

## Demo video (~3:00)

| Time | Beat |
|---|---|
| 0:00 | Real headline on screen: Nov 13, every US departure halted |
| 0:15 | The Hollow. Ground order: skiffs grounded, stairs sealed. Meet a nurse whose patients are five levels down |
| 0:40 | Directorate run: tower says "12 flights authorized", 2 fly, the nurse misses her shift, medicine sits at the depot |
| 1:10 | Comms cut, Echo takes over. Near-miss, a passenger skiff yields: "essential worker has priority". The nurse flies down |
| 1:50 | Red ghost skiff rejected. Bottom-floor blackout holds deep skiffs, Echo reroutes |
| 2:20 | Split screen, three numbers |
| 2:50 | "Airports without a tower already work this way." Hosted link |

## Schedule

| Day | Done when |
|---|---|
| **Sun 15** | Idea locked. Issues filed. `grounding.ts` stub with the `skiff` link |
| **Mon 16** | Skiff link kind, tower clearance, Echo local authority, tests green |
| **Tue 17** | Priority + medical signer + throttling/lying tower + split-run harness. **Gate 9 PM:** if numbers don't move, drop ghost skiff, power rule and playable button; ship rules 1–3 only |
| **Wed 18** | Sprites, panels, scoreboard. **Record a rough cut** |
| **Thu 19** | Ghost-skiff beat, hosted build (Vercel/Pages), write-up |
| **Fri 20** | Final recording. Freeze 6 PM. Submit before 11 PM ET |

## Risks

- New link kind breaks routing or the 27 tests → write the harness first, run tests daily.
- Signing breaks determinism → stand-in inside the engine, real crypto UI-only.
- Other teams use the same FAA hook → the essential-worker story (nurse grounded vs nurse flying), the yield moment and the no-tower-airport precedent carry originality.
- Scope creep → anything not in this file waits for after the Tue gate.

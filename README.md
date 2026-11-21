# Echo

**Echo is a mesh relay for the Hollow.** Residents bolt battery beacons along the tunnels. Each beacon only talks to its neighbors, so news about floods, seals and who goes first hops from beacon to beacon. Pods carrying nurses, medicine and supplies read that news and route themselves, so they keep moving when the Directorate's central tower goes dark.

You play the relay: place a few beacons and get Nurse Mara and her medicine down five levels to the Deep Clinic before the shaft floods.

**Play it:** https://hollow-world-eight.vercel.app/

## The problems Echo solves

These come from the HackFest "Life underground" brief. Echo answers several of them with one connected system.

| # | Problem in the Hollow | |
|---|---|---|
| 7 | **The Directorate controls the network and can shut it down whenever it wants.** People have no way to organize or call for help without it. | Core |
| 10 | **Medicine runs out in the deep levels first, and the clinic can be levels away.** Care doesn't reach the people who need it. | Core |
| 5 | **One flooded tunnel can cut off a whole neighborhood.** Pods drive into sealed shafts. | Core |
| 1 | **No one gets warned before the next cut-off hits.** | Core |
| 9 | **The Directorate's numbers don't match what people see.** The tower claims pods are moving when they aren't. | Shown |
| 2 | **When there isn't enough capacity, the deep levels always lose.** | Shown |

## How Echo solves them

| Problem | How Echo solves it |
|---|---|
| **The network gets shut down (#7)** | There is no central server. Each beacon talks only to the beacons next to it, so switching off the tower doesn't switch off the relay. Residents build and run it themselves. |
| **Medicine can't reach the deep levels (#10)** | Medical pods go first. Every pod follows three rules: announce before you move, one pod per tunnel section, and medical, then supply, then passengers. Clinic-credentialed nurses get priority, and a forged "medical" pod is rejected and joins the passenger line. |
| **Floods cut off neighborhoods (#5)** | When a tunnel floods or is sealed, the news hops beacon to beacon ahead of the pods, and each pod re-plans around the closed section on its own. |
| **No warning before a cut-off (#1)** | The warning travels down the chain of lit beacons. A pod hears it in time only if the chain reaches it, and the game shows exactly which sections must be lit ("Warn here · N beacons"). |
| **The official numbers lie (#9)** | Every run is compared against the tower's own story. In Tower Down, the tower keeps claiming 84 pod runs while only 5 actually move. |
| **The deep levels always lose (#2)** | Priority is a shared rule every pod follows, not a decision the tower makes for them. |

The proof is in the run itself. Each level's debrief replays the same disaster four ways: **the tower alone, the tower with a backup, no beacons, and your beacons.** Only a connected chain of beacons gets Mara through. The tower with a backup still fails, because the tower never learns about the flood.

**The honest cost.** Echo is a fallback, not a replacement. In the Tower Down benchmark (`npm run harness`), passengers wait 2.4× longer than on a normal day and the network runs at 94% capacity. The alternative is a tower failure, where 0 of 8 nurses arrive and capacity drops to 5%.

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0 / 8 | 8 / 8 | 8 / 8 |
| Supplies delivered | 0 / 10 | 10 / 10 | 10 / 10 |
| Passenger delay | 31.7× normal | 2.4× normal | 1.0× |
| Network capacity | 5% | 94% | 100% |
| Pods moving / claimed by tower | 5 / 84 | 40 / 84 | 40 / – |

## How to play

1. **The opening:** the Director shuts the tower down, the levels go dark, and Mara calls for help.
2. **Begin:** the journey alternates **camps** (spend supplies on choices) and three **Descent** levels.
3. **In each Descent level:**
   - **Plan:** the clock is stopped. Place beacons on the dark track, and each one casts a pool of light. Pools that touch form a chain.
   - **Run:** press Space. When a flood is announced, the run holds and shows the **Warn here** chain. Light it, then resume.
   - **Watch:** the warning ripples pool to pool. If it reaches Mara, she reroutes around the flood.
4. **The debrief:** see how your run compares with the tower, the tower plus backup, and no beacons.

Sound is off by default; turn it on with the gear at the top right.

## Run locally

```bash
cd hollow-world
npm install
npm run dev          # http://127.0.0.1:4174
```

```bash
npm test             # engine, world, Echo and game tests
npm run harness      # Tower Down numbers: tower down vs Echo vs normal day
npm run harness:all  # every mission
```

## What is simulated

- Pods, beacons and the radio hop are a deterministic model. There is no hardware and no live network. News moves one beacon hop per simulated minute.
- The nurse credential is a simulated signature (a deterministic hash), not real cryptography.
- Tunnel lengths, timings and the tower's inflated claims are authored assumptions. Every number above comes from `npm run harness`.

## Repo map

| Path | What is there |
|---|---|
| `hollow-world/src/echo/` | The engine: pods, beacons, seals, reroutes, credential check, missions. Headless and deterministic. |
| `hollow-world/src/echo-view/` | The view: the journey (title, intro, camps, ending), the Descent cutaway levels, and the Tower Down split screen. |
| `hollow-world/scenarios/` | Harness scenarios, the beacon-placement search and the difficulty data. |
| `hollow-world/src/engine/`, `hollow-world/src/world/` | The Strata city simulation Echo is built on. |
| `docs/specs/echo/` | [`PLAN.md`](docs/specs/echo/PLAN.md), [`GAME.md`](docs/specs/echo/GAME.md), [`STORY.md`](docs/specs/echo/STORY.md), [`VIDEO.md`](docs/specs/echo/VIDEO.md), [`WRITEUP.md`](docs/specs/echo/WRITEUP.md). |

## Team

Built by **Muhammad and Ali**

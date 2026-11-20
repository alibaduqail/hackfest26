# Echo

> **You are the Relay.** Underground pods carry nurses, medicine and supplies between the cities of the Hollow, and one Directorate tower clears every flight — until it goes dark. You place the beacons; the pods get through on their own, using only what you built.

## Play

- **Game:** https://hollow-world-eight.vercel.app/ — four missions, prologue and epilogue, stars, sound off by default.
- **Tower Down only:** https://hollow-world-eight.vercel.app/echo.html — the bare split screen for the video.

## How to play

Every mission runs in four phases: **Briefing → Prepare → Run → Debrief**.

1. **Tower Down.** Every beacon is already in place. Dispatch Nurse Mara Vale, watch the Directorate seal her tunnel, and see her reroute.
2. **Dead Zones.** 114 sectors, about 40 beacons. A pod that enters a silent sector waits blind; your placement decides who waits.
3. **The Grounding.** The outage lasts a season, shown as one day in time-lapse. Three tunnels are sealed.
4. **Ghost Flight.** The Directorate sends a fake medical pod with a forged signature. The beacons check it and reject it.

In **Prepare** you click sectors on the map to place or remove beacons within the mission's budget; in **Run** the split screen shows the Directorate on the left and Echo on the right. Stars (★ / ★★ / ★★★) score how fast Mara and the supplies arrive — thresholds and per-mission detail are in [`docs/specs/echo/GAME.md`](docs/specs/echo/GAME.md).

### The Descent

Want to place beacons yourself, live, while the pods move? Choose **Play the Descent** on the title screen, or go straight to `/?screen=descent-live`. You get five beacons: two have to warn the flood before the pods reach it, or both are trapped for good; the rest buy speed. **See how Echo works** (`/?screen=descent`) plays the same five levels read-only, with no clock. Details are in [`docs/specs/echo/DESCENT.md`](docs/specs/echo/DESCENT.md).

## Run locally

```bash
cd hollow-world
npm install
npm run dev      # http://127.0.0.1:4174
```

```bash
npm test           # engine, world, Echo and game tests
npm run harness    # Tower Down numbers: tower down vs Echo vs normal day
npm run harness:all  # every mission
```

The game itself lives at `/`; `/echo.html` is the Tower Down split screen.

## Repo map

| Path | What is there |
|---|---|
| `hollow-world/src/echo/` | The engine: pods, beacons, seals, reroutes, credential check, missions. Headless and deterministic. |
| `hollow-world/src/echo-view/` | The view: the map, the game shell (title, briefing, prepare, debrief), the split-screen mission screen. |
| `hollow-world/scenarios/` | Harness scenarios and the beacon-placement search. |
| `hollow-world/src/engine/`, `hollow-world/src/world/` | The Strata city simulation Echo is built on. |
| `docs/specs/echo/` | [`PLAN.md`](docs/specs/echo/PLAN.md) (contract and engine), [`GAME.md`](docs/specs/echo/GAME.md), [`STORY.md`](docs/specs/echo/STORY.md), [`VIDEO.md`](docs/specs/echo/VIDEO.md), [`WRITEUP.md`](docs/specs/echo/WRITEUP.md). |

## Team

Built by **Muhammad and Ali**

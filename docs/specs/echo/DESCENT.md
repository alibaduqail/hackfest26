# The Descent (UI brief)

A five-level vertical cutaway. Each level shows one protocol rule, and the page is **driven by the engine's observations**, not a scripted animation. Engine data lives in `hollow-world/src/echo/descent.ts`. It is not in `MISSIONS`, so the campaign is unchanged. Import `descent`, `DESCENT_LAYOUT`, `DESCENT_BEATS` from it directly.

## Levels and sectors

| Level | Name | Cities | Sectors (shaft, order) | Shows |
|---|---|---|---|---|
| 1 | Upper depot | `depot` | `ramp0`, `ramp1` (track 0-1) | The tower: claimed vs actual |
| 2 | Relay level | `relay` | `ramp2` (track 2), `link0`, `link1` (track 3-4) | Beacons, credential check |
| 3 | Junction | `jun`, `fork` | `link2` (track 5), `trunk0-2` (track 6-8), `byp0` (bypass 0) | Contention, priority yield |
| 4 | Flooded shaft | none | `main0`, `main1` (main 0-1) | The seal |
| 5 | Deep clinic | `clinic` | `main2` (main 2), `byp1-3` (bypass 1-3) | Arrival |

Topology: `depot -ramp-> relay -link-> jun -trunk-> fork`, then `fork -main-> clinic` (L3 to L4 to L5) or `fork -byp-> clinic` (L3 straight to L5, one sector longer, so main is the default). Every sector has a beacon. `main0` is the sealed one. Sectors are one-way, downward. `DESCENT_LAYOUT.sectors[]` gives `{ sectorId, level, shaft: "track"|"main"|"bypass", order }` for every sector; `order` is unique per shaft. Sector `a`/`b` coordinates are on the shared 0..1 map; use the layout for the cutaway.

## Beats (echo mode)

| # | Tick | Rule | Caption | Observation signal |
|---|---|---|---|---|
| 1 | 6 | Claimed vs actual | The tower goes dark... | `log` `tower-down`; `score.towerClaimed` vs `score.realFlights` |
| 2 | 11 | Dispatch | Nurse Mara Vale's medical pod leaves the depot... | `log` `enter`, `podId` MED-1 |
| 3 | 34 | Priority yield | A passenger pod yields the shaft... | `log` `yield`, PAX-1 yields `trunk0` to MED-1 |
| 4 | 37 | Credential check | A forged medical pod fails the beacon check... | `log` `credential-reject`, GHOST-1 (`pod.ghost`) |
| 5 | 41 | Seal and reroute | The flooded shaft is sealed... | `log` `seal` on `main0`, then `seal-heard` and `reroute` (MED-1 at t43) |
| 6 | 62 | Arrival | The nurse reaches the deep clinic... | `log` `arrive`, MED-1 |
| 7 | 67 | Rule 2 · supply after medical | Medicine delivered to the deep clinic | `log` `arrive`, SUP-3 (`cargo: "medicine"`): the UI's "Out of medicine" becomes "Medicine delivered" |

Full captions are in `DESCENT_BEATS` (`{ beat, tick, rule, caption }`). A test asserts these ticks equal the real run, so they are safe to sync rule chips to. `GHOST-1` repeats `credential-reject` at each later announce, so the UI should dedupe by `podId`; the beat is the first. Run length: 72 ticks.

## Pods

| Pod | Priority | Cargo | Route | Notes |
|---|---|---|---|---|
| SUP-1 | supply | water | depot to relay | Cleared by the tower before it dies; arrives t10 |
| SUP-2 | supply | food | depot to relay | Same; arrives t15 |
| SUP-3 | supply | medicine | depot to clinic | Departs t12, trails MED-1 by about 5 ticks. Enters `trunk0` at t40 (MED-1 t35, PAX-1 t45), so the junction shows medical, then supply, then passenger. Hears the seal at t44, reroutes onto the bypass, arrives t67 (after MED-1 at t62) |
| MED-1 | medical | none (carries Nurse Mara) | depot to clinic | Reroutes at t43, arrives t62 |
| PAX-1 | passenger | none | junction to clinic | Departs t34; its one `yield` log (to MED-1 at t34) is deduplicated per pod and sector, so the later wait behind SUP-3 is not logged again |
| GHOST-1 | medical (forged) | none | relay to clinic | Rejected, queued as passenger |

`pod.cargo` (`"water" | "food" | "medicine"`, optional) labels supply pods. In tower mode neither MED-1 nor SUP-3 arrives.

## How to drive it

```ts
const e = createEngine(descent(), "echo"); // and a second engine with "tower" for the split-screen contrast
e.step();                                   // one tick = one sim minute
const o = e.observe();                      // fresh snapshot each call
```

- **Pods:** `o.pods[]` gives `status`, `path[at]` (sector id, or `at === -1` = at the origin city), `progress` 0..1 within it, `rerouted`, `ghost`, `credentialOk`. Place a pod by looking its sector up in `DESCENT_LAYOUT`.
- **Beacons and news:** every sector has a beacon. `o.pulses[]` is this tick's beacon hops: `announce`, `release`, and the `seal` news front moving one hop per tick away from `main0`.
- **Log:** `o.log` is capped at 60, newest last. Keep your own list keyed on `(tick, kind, podId, sectorId)` if you need the full history.
- **Tower mode:** same world, same pods. MED-1 waits at the depot and never arrives (`score.nursesArrived === 0`). Do not predict this; just observe it.
- Replays are deterministic: same mission, same ticks.

## Honesty note

The numbers (grants, claimed flights, capacity) are simulated, and so is the credential: `sig` is a deterministic stand-in (`credential.ts`), not cryptography. Label it "simulated signature" on screen. The Descent is a teaching model of the rules, not a measurement of any real network.

## Live play

`descentLive()` (same file) is the Descent played in real time: the player is the Relay and bolts beacons in **during** the run. Same world and pods as `descent()`; only `ramp0`, `ramp1`, `ramp2` (the depot ramp and the first relay sector) have a beacon, every other sector is a dead zone (a pod waits 3 minutes blind before entering one), and the run is 120 ticks so slow runs still arrive late. The flood seals **`main1`** at t41 (not `main0`). `descent()` and `DESCENT_BEATS` are unchanged.

**Why the warning matters.** The engine never backs a pod out. A pod that has not heard the seal goes into `main0`, reaches `main1`, finds it sealed with no way around, and holds there for good: it never arrives. Seal news travels only over beacons, one hop per tick: it starts at a beaconed `main1`, passes through a beaconed `main0`, and reaches pods standing at the fork, who then take the bypass. So the flood warning costs two beacons (`main1` and `main0`), and with no warning Mara and the medicine are lost whatever else you build. The rest of the budget buys speed: each beacon on Mara's route (`link*`, `trunk*`, `byp*`) saves her the 3-minute blind wait. Place the warning before the pods reach the fork; the telegraph is the seal at t41, so lay it before then.

**Command.** `engine.act({ type: "placeBeacon", sectorId, atTick })`. It is queued and applies at the start of tick `atTick`, before the protocol steps, in the order (`atTick`, `sectorId`). It sets `sector.beacon = true` and rebuilds the seal-news reach: news hops through the new beacon from that tick on (a beacon that goes live at tick T relays from T, not retroactively). A pod already waiting blind at that sector goes in on the next claim. Pass `atTick = observe().tick` to place "now". Echo mode only: tower and normal modes return `ok: false`.

**Rejected (no log line, no budget spent, never throws):** `ok: false` with a `reason` for an unknown sector, a sector that already has (or has queued) a beacon, `atTick` in the past or at/after `endTick`, no beacons left, or a mode other than echo.

**Budget.** `mission.beaconBudget` caps live placements (applied plus queued); beacons already in the mission data are the free starting layout. `descentLive()` has `beaconBudget: 5`: 2 for the warning plus 3 for speed. With 4 the best play is Mara 86 / medicine 91, so 5 is the smallest budget that reaches 3 stars.

**Stars** (`DESCENT_LIVE_GOALS`, `descentLiveStars(o.pods)`; each star includes the one below). The flood warning is the gate to any star; route efficiency decides how many:

| Stars | Mara (MED-1) arrives by | SUP-3 medicine arrives by | What it takes |
|---|---|---|---|
| 0 | | | no warning: both pods are trapped |
| 1 | minute 92 | any | warning (`main1` + `main0`), any route |
| 2 | minute 86 | minute 91 | warning + 2 good route beacons |
| 3 | minute 83 | minute 88 | warning + 3 good route beacons: the best possible |

Calibration (`npx tsx scenarios/live-search.ts`, every set of up to 5 beacons placed at tick 0): zero beacons, or any set without both `main1` and `main0`, is 0 stars. Warning only: Mara 92 / medicine 97 (1 star). Warning plus 1 route beacon: 89 / 94 (1 star). Plus 2: 86 / 91 (2 stars). Plus 3: 83 / 88 (3 stars). 99 distinct layouts tie for 3 stars, all containing the warning (any three of `link0-2`, `trunk0-2` and `byp0-3` that Mara actually passes: some pairs overlap a queue and save less).

**A trapped pod, for the UI and the debrief.** An unwarned pod does not get a special event; read it from the observation. It enters `main0`, reaches the sealed boundary and logs `seal-heard` (`sectorId: "main1"`, "hears main1 is sealed") and then `hold` ("holds: no way around the seal"), both with its `podId`. From then on `pod.status === "holding"`, `path[at] === "main0"` and `path[at + 1] === "main1"` (the sealed sector) until the run ends. So "stuck at the flood" = `status === "holding"` and the next sector is `sealed`; the debrief cause line can name the pod and say no beacon carried the warning. Stuck pods keep their sector (`main0`) occupied but nothing else needs it; the run still ends at tick 120 with `over: true`.

**Solution.** `DESCENT_LIVE_SOLUTION` is a replayable command list worth 3 stars (Mara t83, medicine t88): `link0@16, link1@20, link2@24, main1@30, main0@34`. Route beacons go in just ahead of Mara, then the warning before the seal at t41. A late warning also works while pods are still before the fork (a stale-claim bug that a late warning could trigger is fixed in `protocol.ts`). Apply it with `act` before stepping, or at the listed ticks; the run is identical.

**Animate.** Log kind `beacon-placed` (`sectorId` set, no `podId`) is the placement event: flash the sector and flip its dead-zone look to a beacon. Also `blind` (a pod waits at a dark sector; it stops once the sector is lit), `seal` (t41, `main1`), and `pulses` of kind `seal` (the news front, one hop per tick through lit sectors), then `seal-heard` and `reroute` for each warned pod. A pod that never heard the seal ends in a `hold` at `main1`.

## Live play — levels 2 and 3

Two more live levels, each its own `Mission` and its own new world (`descent2.ts`, `descent3.ts`); `descent()`, `descentLive()` and `DESCENT_LAYOUT` (level 1) are unchanged. All three share one shape — `{ id, title, lesson, build, goals, solution }` — in `DESCENT_LEVELS` (`descent-levels.ts`). Calibration scripts: `npx tsx scenarios/live-search2.ts`, `npx tsx scenarios/live-search3.ts` (exhaustive search over every placement set within budget, same method as level 1's `live-search.ts`).

**Level 2 — Two Floods** (`descentLive2()`). A new world, twice level 1's shape: `depot2 -> relay2 -> forkA -> (mainA sealed / bypA) -> mid2 -> trunk -> forkB -> (mainB sealed / bypB) -> clinic2`. Only the depot ramp starts beaconed; `beaconBudget: 7`. Flood A seals `mainA1` at t30, flood B seals `mainB1` at t55 — both well before the fastest possible (fully-beaconed) commit tick into either shaft, so no amount of route speed out-runs either flood. Each flood needs its own beacon on its sealed sector (news only seeds from a beaconed seal) plus a connecting relay hop to its fork; losing either one traps the pod it covers for good. **The lesson:** the budget must be split across both warnings, and the order in which they take effect matters — the earlier flood (A) has to be covered before the pod reaches it, or it never lives to reach the second. Stars (`DESCENT_LIVE_GOALS_2`): no warning on either flood = 0 stars (confirmed by exhaustive search: no 3★, 2★ or even 1★ set skips either sealed-sector beacon). Warning only (4 beacons, no speed) = Mara 120 / medicine 125 (1★). Plus 2 good route beacons = 114/119 (2★). Full budget (7), best of 364 tied layouts = 111/116 (3★); `DESCENT_LIVE_SOLUTION_2` is one of them.

**Level 3 — Forged Rush** (`descentLive3()`). A new world: three approaches (`depot3`/Mara, `ghostSrc`/the forged pods, `paxSrc`/passengers) converge on `jun3`, funnel through a single-lane junction sector (`trunk0`), then `fork3 -> (main sealed / byp) -> clinic3`. The ramp, the forged pods' spur and the passenger line are always beaconed (so their travel time is fixed); only the junction trunk and everything past the fork are dark. A forged pod (`GHOST-1`) starts the run already inside `trunk0`, holding it; `beaconBudget: 6`, flood seals `main1` at t48. **The lesson:** medical always outranks a forged or passenger pod (`protocol.ts`'s `rank`), but rank only decides who wins among pods already *announced* in the same tick. A dark junction gates each pod behind its own 3-tick blind clock, started the tick it first waits there — so whichever pod's clock clears first takes the junction's one slot the instant it frees, priority or not. Mara's own rank cannot save her if she is still blind when a lower-priority pod (`PAX-1`) is already past its clock. Light the junction and there is no clock to gate on: both are "waiting" from the moment they arrive, so priority correctly puts her through. Confirmed by exhaustive search: no beacon on the flood's sealed sector reaches any star; no beacon on the junction reaches at most 2 stars (99/123, by routing speed alone) however the rest of the budget is spent — it is specifically required for 3★. Warning only (1★): 111/135. Full budget without the junction (2★): 99/123. Full budget with the junction but no bypass speed (2★): 81/105. Full budget with both (3★), best of 20 tied layouts: 78/102; `DESCENT_LIVE_SOLUTION_3` is one of them.

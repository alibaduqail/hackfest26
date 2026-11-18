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

Full captions are in `DESCENT_BEATS` (`{ beat, tick, rule, caption }`). A test asserts these ticks equal the real run, so they are safe to sync rule chips to. `GHOST-1` repeats `credential-reject` at each later announce; the beat is the first. Run length: 72 ticks.

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

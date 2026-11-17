# The Hollow · A world below

An explorable isometric underground world, built with React, TypeScript and PixiJS. The reference scenario has three connected districts, eight depth levels, 30 furnished rooms, 180 persistent people and 60 households. Ordinary life runs autonomously; choose when to introduce an incident.

The Strata view uses a full-window canvas with floating tools and a compact corner playback dial. See the [desktop visual checks](STRATA_EXPERIMENT.md) and [compact UI checks](qa/COMPACT_UI.md).

## Echo: keeping the Hollow moving when the tower fails

The Hollow is a network of underground cities joined by tunnel pods, and one Directorate tower clears every flight. **Echo** is a fallback protocol for when that tower goes dark or is switched off to punish a city: every pod carries the tunnel map, talks only to its neighbors over trackside beacons, and follows three rules: announce before you move, one pod per sector, medical first then supply then passengers. When the Directorate seals a tunnel, the news hops beacon to beacon and pods re-plan around it. This repo contains a playable simulation that runs the same seeded mission with the tower alone and with Echo, side by side.

**Run it** (Node 22.12+):

```sh
cd hollow-world
npm ci && npm run dev    # then open http://127.0.0.1:4174/echo.html  (the Strata city sim stays at /)
```

Press **Run**. At t+20 the tower goes dark, at t+30 the Directorate seals the direct Sector 07 to Lagos tunnel, and **Dispatch Nurse Mara Vale** sends nurse Mara Vale (a Strata resident) toward the outbreak city. On the left the Directorate banner keeps claiming flights it no longer clears; on the right Echo's beacons pulse, a passenger pod yields to her, and her pod re-plans through São Paulo.

**Headless numbers** (`npm run harness`, the source for every figure here; it exits non-zero if the shape breaks):

```
                                  Tower failed          Echo                      Normal day
Nurses arrived                    0/8                   8/8                       8/8
Supplies delivered                0/10                  10/10                     10/10
Passenger delay (min)             7161 (31.7x normal)   548 (2.4x normal)         226 (1.0x normal)
Network capacity vs normal day    5%                    94%                       100%
Flights: real / claimed by tower  5 / 84                40 / 84                   40 / -
MED-1 Nurse Mara Vale             waiting, not arrived  arrived t+137 (rerouted)  arrived t+80
```

Echo is worse than a normal day on purpose and the scoreboard shows it: passengers wait 2.4 times as long, the network runs at 94% of a normal day, and Mara's trip takes 137 minutes instead of 80. It is a fallback, not a replacement for the tower.

**What is simulated**

- The credential check is a **simulated signature** (a deterministic hash of the pod id and a clinic key), not cryptography. Only clinic-credentialed nurses can file medical, and a forged one is treated as a passenger.
- Pods, beacons and the radio hop are a model: no hardware, no real network, no live peers. News moves one beacon hop per simulated minute. A dead beacon would make Echo slower, never unsafe, but that case is not simulated.
- One tick is one simulated minute. Tunnel lengths, sector times, the 18 flights per hour the tower clears and the x14 banner inflation are authored assumptions.
- All numbers come from one seeded mission (Tower Down, seed 20261117). They show how the protocol behaves in that scenario, not a forecast.
- Capacity is the share of sector entries delivered compared with the same mission on a normal day, averaged over the busy period. The tower-alone run has no way to reroute: it only holds.

**What Echo claims**

- Core: organize movement without the central network (problem #7).
- Water, food and medicine reach the deep cities, shared by need rather than by who is first in line (#2).
- Partly: nurses and supplies reach the outbreak city (#9). There is no outbreak tracking.
- Lore: the Directorate controls movement and its numbers are fake. The banner says 84 flights authorized while 5 are actually moving.
- Not claimed: #8 and #10.

The engine is headless and deterministic in `src/echo/` (contract in `src/echo/types.ts`; tests in `src/echo/echo.test.ts`, run by `npm test`). The map and mission screen are in `src/echo-view/`. The plan and acceptance criteria are in [`docs/specs/echo/PLAN.md`](../docs/specs/echo/PLAN.md).

## Start locally

Use Node 22.12+ (or Node 24/26) and npm:

```sh
cd hollow-world
npm ci
npm start
```

Open [http://127.0.0.1:4174](http://127.0.0.1:4174). For a production static build, run `npm run build`; deploy `dist/`, or run `npm run preview`. The application bundles all art and uses local system fonts. No API keys or remote services are needed.

## Explore

- Drag to pan; scroll/pinch to zoom. Dragging past a map edge adds resistance and eases back on release; wheel zoom settles after the gesture. Arrow keys pan, `+`/`−` zoom, Space pauses, Escape closes the inspector.
- The floating tools at the upper left provide Find, History, Incidents, Help/saves, Cart and Overview. District shortcuts and zoom sit in the same panel. Find supports room, person and duty searches; **Follow** and its small stop chip track residents or the cart.
- Find the supply cart from the cart icon in the floating tools. Stock is loaded, carried, retained during obstruction, then unloaded into household inventories.
- **Incidents** introduces a lower blackout, communication loss, or checkpoint closure. These are explicitly scenario-author controls.
- The lower feeder keeps the upper clinic lit. Battery backup initially prioritizes a lower ventilation fan; seepage eventually floods the only crossing to twelve households. A pump assignment drains it at the cost of cooling service. You can request backup from the selected pump/fan inspector while communications work.
- Inspect **History** for deliveries, staff arrivals, care, harvests, disruptions and household access intervals. The 12-household fixture accrues 60 household-minutes for each five minutes of complete isolation, counting each household once.
- The lower-left dial groups play/pause and 1×, 10×, 60×, 300× speeds. Its clock row contains **+1m** for exactly 60 simulated seconds. Going to the background pauses the world intentionally.

## A two-minute demonstration

1. Search for a nurse, grower or recycler operator. Follow their commute, then inspect a staffed room and its finite stock/output.
2. Find the supply cart. Trigger a lower blackout and step five minutes. Select the flooded crossing; twelve households lose their depot route.
3. Cut communications and step another minute. Open the pump inspector's **controller report**: the reported water/time remain old while the actual water continues rising. Remote commands are rejected during that cut.
4. Restore communications, request pump backup and advance time. Watch drainage reopen access and permit delivery; inspect cooling loss and access intervals for the same homes.

## Author the world

Edit [`public/scenario.json`](public/scenario.json), reload, or import an edited JSON file through **⋯ → Import**. Export the current scenario there too. Validation runs before replacement; rejected imports leave the current world intact.

The scenario defines room coordinates/dimensions/types, districts and depth, bed spaces, feeders and demand, inventory, machine condition, residents, household membership/stores, work locations, shift offsets, permits, navigation connections/capacities/travel times, ventilation zones, water pipes, generation/battery ratings, drainage rates/area/threshold, reporting delays, growth and human-need rates, and timed incidents. Navigation uses those room positions; no SVG or renderer edit is required to move an existing room or connection. The three named districts and eight levels are the reference application's supported authoring envelope.

All numbers and behavioral/health rules are fictional assumptions. Power is W, battery energy Wh, water L, reservoir area m², water depth m, and time integer seconds. Food/medicine/parts are declared scenario units. Air burden and water contamination are model indices, not measured pollutant concentrations or disease probabilities.

Timed incident example:

```json
{"id":"feeder-trip","tick":300,"kind":"blackout"}
```

Supported incident kinds: `blackout`, `restore`, `comms`, `reconnect`, `lockdown`, `unlock`. External incidents are distinct from operator requests.

## Connect future solution code

The same headless engine used by the worker is exported from [`src/engine/engine.ts`](src/engine/engine.ts). Use it in a local TypeScript test/adapter:

```ts
const engine = new HollowEngine(scenario);
engine.step(60);
const observation = engine.observe();
const receipt = engine.act({
  commandId: 'team-request-1',
  actorId: 'district-operator',
  expectedRunId: observation.runId,
  requestedAtTick: observation.nowTick,
  type: 'assignBackup',
  targetId: 'd2-f5',
  value: 'pump',
});
engine.step(); // execute accepted request on the next tick
```

Observations expose only delivered reports, with original sample/delivery timestamps and `fresh`, `stale`, or `unknown` status. The cutaway shows live observer state; controller-report disclosures are separately marked with their freshness and sample age. Manual operator buttons use the same `act()` validation. Commands reject unknown targets, unauthorized actors, old run IDs, lost communications, infeasible power ratings, and conflicting queued actions; accepted command IDs are idempotent. An acknowledgement schedules a request; execution/failure appears separately in history.

The worker protocol is in [`src/engine/types.ts`](src/engine/types.ts). Future controller integration should use observations and requests, not direct mutation of `engine.state` or author incidents. This release supplies the world and interface; it does not select or optimize the team's solution.

## Save and replay

**⋯** provides transactional IndexedDB save/load, portable full-snapshot JSON export/import, and deterministic event/command replay export/import. A snapshot continues in-flight movement, cargo, needs, report queues, decisions and deficit intervals. Replays regenerate from the same initial scenario through the saved ending tick; same-tick inputs keep their acceptance order. Import limits: 10 MB, 2,000 residents, 300 rooms; command replay is bounded to seven simulated days and 10,000 inputs.

The reference world is deterministic and currently uses authored identities/schedules rather than random behavior. The seed is metadata reserved for future seeded rules. Scenario checksums detect version/content mismatch; they are not cryptographic signatures. No arbitrary uploaded JavaScript is evaluated.

## Checks and design

```sh
npm test             # headless behavioral and conservation checks
npm run build        # TypeScript check and production static build
npm run benchmark    # 30 simulated days, hourly save validation and final ledgers
```

See [validation results](VALIDATION.md), [pseudocode](../docs/specs/hollow-living-world/PSEUDOCODE.md), [architecture](../docs/specs/hollow-living-world/ARCHITECTURE.md), and the [specification](../docs/specs/hollow-living-world/SPEC.md).

The old `hollow-simulator/` remains the earlier narrow blackout demo. This world adds real resident/routing/inventory state and the explorable view.

## Fidelity and next phases

This implements the living-world foundation with simplified utility balances and explicit task rules. There is one drainage reservoir, feeder-level allocation, authored air zones, capacity-limited water links, and one supply cart. Family courier messaging, deliberately biased official reports, chronic illness progression, surface expeditions, advanced hydraulic/electrical networks, and the baseline/intervention comparison UI remain later specification phases. A lift is a capacity-limited powered navigation link rather than a shared-car dispatch scheduler. Descriptive history retains the latest 2,000 events; deficit and input records remain complete. These limits are recorded in [VALIDATION.md](VALIDATION.md).

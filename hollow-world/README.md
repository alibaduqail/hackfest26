# The Hollow · A world below

An explorable isometric underground world, built with React, TypeScript and PixiJS. The reference scenario has three connected districts, eight depth levels, 30 furnished rooms, 180 persistent people and 60 households. Ordinary life runs autonomously; choose when to introduce an incident.

The Strata view uses a full-window canvas with floating tools and a compact corner playback dial. See the [desktop visual checks](STRATA_EXPERIMENT.md) and [compact UI checks](qa/COMPACT_UI.md).

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

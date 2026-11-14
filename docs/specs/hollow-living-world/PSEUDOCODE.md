# Pseudocode: The Hollow living world

SPARC phase 2. The user's implementation request advances the specification gate. Ruflo tools are unavailable; this artifact and the phase record are local repository tracking.

## Tick and ownership

```text
ON simulation interval, owned by exactly one worker:
  apply exogenous incidents scheduled at tick T
  dequeue accepted commands in acceptance order
  count present residents and working staff
  allocate finite grid watts in ascending floor / stable ID order
  allocate allowed battery watts and debit Wh through a residual accumulator
  for each resident in stable scenario order:
    advance hunger, thirst, fatigue and exposure by one second
    if traveling:
      if link is blocked: retain current progress and enter interrupted state
      else: advance by 1 / authored travel seconds
    otherwise:
      periodically choose a task from needs, household stocks and shift schedule
      plan a path using known closures and permit rules
      on encountering an unknown physical closure: learn it and reconsider
      reserve a finite link/service position or queue
      complete stock-consuming needs or transfer collected cargo to household
  recalculate present staff
  transfer capacity-limited water along authored utility links
  process staffed, powered recycling and crop growth
  advance the loaded cart or retain cargo at a blocked crossing
  integrate the drainage reservoir and room heat / air burden
  derive next-interval route closures and household access transitions
  integrate each previously isolated household once for the elapsed second
  publish timestamped reports only through the available channel
  emit immutable snapshots and causal events
  advance clock to T+1
```

Camera/render operations cannot call this function. One-minute stepping executes 60 ticks. Requested speed changes the number of ticks, not their contents. Offscreen people use the same logic.

## Paths, tasks, and conservation

```text
ROUTE(source, destination, permissions, known closures, topology revision):
  use cached result when possible
  run weighted shortest-path search over authored navigation links
  exclude known blocked and forbidden links
  return ordered link IDs or explicit no-route result

TRANSFER(source, destination, item, requested quantity):
  actual = min(source quantity, requested quantity)
  debit source by actual
  credit destination by actual
  retain three-decimal inventory precision

CHOOSE_TASK(person):
  urgent care -> low household food collection -> return carried supplies
  -> thirst -> hunger -> sleep -> scheduled work -> errands / rest
  assign destination and reason
  do not teleport if no permitted route exists

CART:
  load finite stock at source after loading time
  plan a valid route; traverse links over time
  if closure: wait at current progress with cargo intact
  unload at target after unloading time
  increment delivered only by committed transferred food
  return to source and repeat
```

The router uses O(V²+E) search and O(V+E) space over the small room graph, with a bounded topology-keyed cache. A tick updates O(P+R+L+H) records plus triggered route searches. Environment zone checks are O(RZ); the reference world has 30 rooms and 2 air zones. Rendering is O(visible scene objects + P), independent of engine ownership.

## Boundaries and error paths

```text
IMPORT(input):
  enforce file-size budget
  parse as data, never executable code
  validate version, dimensions, rates, inventories, references and state
  build replacement engine fully before replacing active one
  if any error: report field/reason; preserve active run

ACT(request):
  deduplicate command ID and return original receipt
  reject stale run, unauthorized actor, disconnected command channel,
    unsupported action, unknown target, infeasible rating or conflicting request
  enqueue accepted intent for next tick
  record execution or failure as an event

SAVE:
  transact complete scenario and snapshot into IndexedDB
  retain previous save if transaction fails
  allow portable JSON export even when local storage fails

RESET:
  create same initial scenario state with a new run ID
  reject requests carrying old run ID
```

## Acceptance-criterion algorithm map

| Criteria | Satisfying mechanism |
| --- | --- |
| AC-01–02 | Scenario-derived Pixi scene, independent camera transform, compact contextual controls |
| AC-03–04 | Persistent resident task/route state, census, staff-limited production |
| AC-05–06 | Conserved inventory transfers, load/unload states, retained cargo |
| AC-07 | Knowledge-aware weighted routing, topology invalidation, explicit blocked state |
| AC-08–09 | Feeder assignments, upper-first watts allocation, separate Wh/W constraints |
| AC-10–11 | Volume balance, depth threshold, gradual heat and air integration |
| AC-12–14 | Household reserves, crop cycle, policy-permitted edges |
| AC-15–16 | Sample/delivery timestamps, channel-dependent delivery, null unknown values |
| AC-17–18 | Half-open household deficit intervals and one counter per household |
| AC-19 | Render/path geometry from room coordinates and connection endpoints |
| AC-20–22 | Fixed ticks, no camera inputs to engine, full-state serialization |
| AC-23 | Atomic scenario/save validation and replacement |
| AC-24–26 | Shared action validation, acceptance ordering, idempotent IDs, run identity |
| AC-27 | Daily routines and inventory/resource ledgers |
| AC-28 | Headless benchmark plus browser performance inspection; formal multi-browser FPS gate remains open |
| AC-29 | Accessible HTML directory, keyboard camera/time commands, reduced-motion rendering |
| AC-30–32 | Future P1/P2 phases: family-message propagation, biased summaries, solution comparison |

The validation report distinguishes implemented mechanisms, checked examples, and remaining specification limits. This mapping does not claim every criterion has passed a formal acceptance test.

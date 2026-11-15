# Validation — living Hollow implementation

Checked November 14, 2026. This is an implementation record, not a claim that every requirement in the larger specification is complete.

## Automated checks

`npm run build` passes TypeScript validation and produces the Vite static build. The build reports a non-blocking initial-chunk advisory (~567 kB minified, ~174 kB gzip for the main entry including React/Pixi); production assets remain well below the proposed 25 MB budget. No external images or fonts are loaded.

`npm test`: **19 tests passed**. Checks cover the reference world counts/connectivity; autonomous travel/work and staffed production; clinic power during lower blackout; twelve isolated households; battery/pump drainage; committed delivery and food/water/medicine/parts/waste conservation; stale and unknown reports; full snapshot continuation; render-independent tick batching; invalid scenario/save rejection; permissions, old-run requests, command conflicts/idempotency, exact-machine backup targeting and W limits; interrupted traversal without teleporting; exact 60 household-minutes for twelve homes over five minutes; one-day fractional-flow conservation; alternative paths; utility-reference validation; deterministic event/command replay; and same-tick input ordering across communication loss.

The conservation test exposed a fractional-water rounding error during implementation. Quantities are now quantized before both sides of a transfer/production/consumption operation. A one-day regression and the long-run ledger check pass with that fix.

## Long-run check

See [`benchmark-results.json`](benchmark-results.json) for the actual recorded run. On this Apple M2 / macOS arm64 / Node 26 host:

| Measurement | Recorded result |
| --- | --- |
| Simulation length | 30 days / 2,592,000 fixed ticks |
| Population / rooms | 180 persistent people / 30 rooms |
| Wall runtime | 40.55 seconds |
| p95 of hourly **mean** tick costs | 0.0164 ms |
| Hourly save/state validation | Passed |
| Final resource conservation | Passed |
| Drainage inflow/removal balance | Passed |

The run includes a scheduled blackout, a communications cut, restoration, and reconnection. This is a headless engine result. The hourly-mean timing is **not** a per-tick p95 measurement and does not establish the specification's two-minute browser FPS targets.

## Browser walkthrough

Used the in-app browser at its default desktop viewport against both development and the production static preview.

- The cutaway renders furnished rooms, visible residents, work areas, the cart, district shortcuts, eight levels, lighting differences, water surfaces and the vulnerable crossing.
- Directory search selected a named nurse and displayed their actual household, route, needs and current task. Follow mode and room/camera navigation were exercised.
- Pause and one-minute steps worked. Keyboard panning while paused preserved the displayed simulation time.
- IndexedDB save, stepping forward, and local load returned the world to its saved time, paused.
- Production blackout plus six minute steps left **48/60 households connected**, with the upper clinic independent and lower rooms unpowered.
- Cutting before any delivered sample displayed **unknown**. After reconnecting long enough for a sample, a second cut retained a **07:06:30** reading at **07:08:00**, marked **90 seconds old**, while actual flooding continued.
- A pump request during communications loss returned **Command channel disconnected**. After reconnection, the same type of request was accepted.
- After nine further minute steps, the pump drained the reservoir, **60/60 households had access again**, and affected households showed **6 minutes access lost** and **9 minutes cooling lost** in that walkthrough.
- Browser console error inspection returned no errors in the tested production session.

Screenshots: [ordinary world](qa/living-world.jpg), [drainage recovery](qa/drainage-restored.jpg).

## Specification coverage and material limits

The world, population, basic coupled infrastructure, constrained requests, data-driven geometry, information freshness, persistence and replay mechanisms are implemented. The implementation deliberately keeps the model small and explicit; these specification details remain simplified or unverified:

- Power is a finite feeder-priority allocator; air is delivered through authored fan zones; water pipes have fixed throughput; one drainage reservoir controls the vulnerable crossing. There is no circuit/pressure/CFD solver.
- A lift is a capacity-limited powered graph edge. Multi-stop shared-car scheduling and boarding/alighting animations are not implemented.
- The cart is a modeled vehicle with a timed loading/delivery route; a separately scheduled driver/vehicle assignment system is not implemented. Other residents carry ration/water bags to their homes.
- Workstations require present staff for recycler/farm/clinic throughput. Deep pumps/fans are automatic powered machines. Repair requests are a minimal workshop/parts operation; general crew-based repairs and degradation-driven failures remain future work.
- Need/heat/air exposure is simulated; initial care needs and staffed medicine-limited visits are supported. Contamination is an informational treatment-condition index. Clinical disease, contagion, waterborne illness, and chronic health progression are not calibrated or implemented.
- Service and link capacities create deterministic queues. Household low-stock collection is a simple entitlement-free errand rule; detailed ration budgets, quota disputes and emergency exemptions remain future policy work.
- Family identities and homes persist, but person-to-person messaging, courier check-ins and official report suppression are P1 work.
- Snapshot saves include full state. Event/command replay is supported up to seven days/10,000 inputs. History keeps the latest 2,000 descriptive events; historical deficits and inputs remain complete. A long-term event archive is not implemented.
- Separate baseline/intervention comparison UI and a proposed solution are P2, intentionally deferred by the user's direction to build the world first.
- The seed is authored metadata; current behavior has no random sampling. No claim of full physical, medical or social validity is made.
- Formal 1920×1080 FPS/p95 measurements, cross-browser state-hash parity, touch/pinch on hardware, screen-reader testing, GPU-context-loss recovery and concurrent-tab save-conflict behavior remain unverified. Local save transactions protect against partial writes; two tabs may still overwrite the shared “latest” slot.

The next SPARC phase should use these gaps and the specification acceptance criteria for focused refinement, rather than treating unchecked requirements as already passed.

## Strata branch follow-up

The original browser walkthrough above documents the previous side-view renderer. The current isometric branch passes 21 checks (the original 19 plus two projection checks). See [Strata experiment verification](STRATA_EXPERIMENT.md) for its browser checks, screenshots, and unmeasured rendering limits. No new engine benchmark was necessary because engine behavior is unchanged.


### Desktop interaction and visual follow-up

The subsequent desktop pass passes 27 tests and the production build. [Desktop verification](qa/DESKTOP_PASS.md) records matched 1440×900 / 1920×1080 captures, actual lift/cart movement, outage/request/recovery feedback, selection and camera checks, and alternating reviewed/final frame samples. Its short browser timings supplement the earlier engine benchmark and do not establish sustained FPS.

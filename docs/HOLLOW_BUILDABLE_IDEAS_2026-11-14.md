# Eight Hollow ideas: what we would actually build

Prepared November 14, 2026. Research and proposed scope only. No app, hardware demonstration, or operational result has been built or tested. These are fresh directions relative to the earlier shortlist; global originality is not established.

## How a working project relates to a fictional track

The Hollow is a fictional client with an explicit set of engineering problems. Its brief supplies requirements; the team supplies clearly labeled scenario inputs; working software produces a result that can be inspected and changed. The demonstration can prove a computation, a scan, or an offline transfer. The eventual benefit to residents is a proposed causal effect, rather than a measured outcome.

For example, an inventory of five fictional broken machines can be stored in a small file. A real planner checks available components and produces a feasible repair list. A judge removes the only motor and the result changes. In an operational version, a technician enters the inspected inventory instead. Sample inputs are acceptable for demonstrating the mechanism; claimed real-world impact requires appropriate inputs and validation.

The [official Life underground brief](https://docs.google.com/document/d/1sz_UdwRzvyL1dVbcbqLnUdJwVHvOUWARg4B79VmKgaE/edit?tab=t.g3ixdrcdfya4) permits sustaining life underground or supporting a return to the surface. It explicitly connects infrastructure, rationing, crowding, communication, health, food, and migration. No numerical judging rubric is supplied there.

## 1. Second Life — rebuild useful machines from retired donors

**Problem:** Aging fans and water recyclers fail while compatible parts are scarce.

**Distinctive decision:** Which repairs can this crew actually complete with the available donor components, and which declared services would those repairs restore?

**Build:** A small browser interface plus a planner operating on a catalog of five failed machines, retired donors, manually verified compatible part IDs, quantities, tools, repair durations, and affected services. Enumerate the small candidate repair sets. Reject sets that allocate a component twice or exceed the shift. Show each required component and the work sequence. Begin with already-retired donors so the first version cannot recommend stripping active essential equipment.

**Inputs:** Fictional labeled catalog for the demo; an inspected inventory and technician-approved compatibility table for a practical version. A camera does not establish interchangeability.

**Demo/check:** Two repairs need the only available motor. The app selects a feasible combination under a visible objective. Remove that motor and recompute. A fully stocked control must work; an impossible case must identify missing parts. Count overlapping service coverage once.

**Hollow effect:** A coordinator sends a crew with an achievable work list and the required parts. The tool supports restoring equipment; it does not itself fix a machine or validate water quality.

**Existing foundation:** [InvenTree documents component lists, substitutes, and inventory allocation](https://docs.inventree.org/en/1.6.x/manufacturing/bom/). The proposed contribution is service-aware salvage choice. See [the detailed mechanism research](HOLLOW_NEW_MECHANISMS_RESEARCH_2026-11-14.md).

## 2. One Sample Left — choose the next water test

**Problem:** Residents report bad water, but a neighborhood has too few test kits to sample every tap.

**Distinctive decision:** Which reachable sampling point would best distinguish the remaining possible sources of a problem?

**Build:** A small declared water-network model, several candidate source faults, and entered observations. For the smallest version, assume one persistent source, known one-way flow, a known sampling period, and perfect synthetic positive/negative tests. For each possible next site, compare predicted outcomes across remaining hypotheses; select a site that splits them most evenly. Clearly leave unresolved hypotheses unresolved. Show the model assumptions beside the result. Advanced hydraulic modeling is optional.

**Inputs:** A fictional pipe diagram and synthetic observations. A practical version requires an accurate network, appropriate measurements, timing, and error modeling.

**Demo/check:** A judge hides a source fault in a prepared scenario and enters each result. The app suggests the next sample and narrows the candidate set. Include two indistinguishable causes, an unreachable sampling point, and contradictory observations that match no modeled fault. Do not force a unique answer.

**Hollow effect:** A coordinator can spend scarce tests on useful follow-up measurements and direct an inspection. The software does not measure contaminants or establish drinkability.

**Existing foundation:** [EPA WNTR supports water age, tracer, and chemical concentration simulation](https://usepa.github.io/WNTR/waterquality.html). [EPA's pilot report describes sensor placement optimization](https://www.epa.gov/sites/default/files/2015-12/documents/wsi_pilot_summary_report_102715.pdf). Source inference and sensor placement are existing fields; the proposed contribution is a small next-test workflow for severe test scarcity.

## 3. Relay Receipts — messages move with people

**Problem:** The Directorate shuts down the network, but some people can still move between levels.

**Distinctive decision:** Can a neighborhood tell the difference between a request that left, arrived, and was acknowledged?

**Build:** Two preloaded offline apps. Each stores compact supply requests with IDs, destinations, expiry metadata, and receipt events. A person carries the actual request data in a small file or raw-data QR. Importing the same request twice must not create two jobs. Acknowledgment travels back separately. Keep conflicts visible and assign one depot responsibility for each request; disconnected apps cannot promise globally reserved stock.

**Inputs:** A coordinator types requests; demonstration supplies and locations are fictional. Transfers between disconnected devices can be real. A QR containing only a web URL is insufficient.

**Demo/check:** Disable network connections, carry a request between devices, import it twice, then bring a receipt back. Show expiry, conflicting updates, and the undelivered state when the carrier never arrives.

**Hollow effect:** Existing movement becomes a limited communication channel for aid coordination. It relies on powered devices and actual movement; it does not cross a sealed passage by itself.

**Existing foundation:** [RFC 9171 describes store-carry-forward and physical movement of data](https://www.rfc-editor.org/rfc/rfc9171.html); [Briar already provides offline synchronization](https://briarproject.org/how-it-works/). Our prototype would demonstrate a focused request workflow, without claiming to implement Bundle Protocol or invent offline networking.

## 4. Breadcrumb Home — navigate without GPS or a live server

**Problem:** A blackout and changing closures make it difficult to reach a clinic, shelter, or family meeting point across levels.

**Distinctive workflow:** A resident scans a fixed checkpoint to establish their current location, then receives the next instruction from a preloaded map.

**Build:** An Android app with bundled QR scanning, a small offline graph, checkpoint IDs, entered closures and their timestamps, and routing that respects entered access constraints. Printed markers identify junctions. Instructions can use large text and speech. Location is known at a scan; the app should not pretend to continuously track a person between checkpoints. Old observations remain visibly old.

**Inputs:** Tape six printed checkpoint codes around the room and map the connections. A practical version needs surveyed junctions, maintained signage, current condition reports, phone power, and enough illumination to scan.

**Demo/check:** Preload the app, disable networking, scan a marker and calculate a route. Change a local closure and recompute. Include a code absent from the map and a destination with no known usable route. Demonstrate that a stale map cannot establish current safe passage.

**Hollow effect:** Residents can navigate the known network despite an Internet outage and see where information needs updating.

**Existing foundation:** [ML Kit supports on-device barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning). Its [Android guide distinguishes bundled from downloaded models](https://developers.google.com/ml-kit/vision/barcode-scanning/android); bundle the scanner and map for this offline claim. QR wayfinding and shortest-path routing are established techniques.

## 5. Silent Floor — reveal gaps in outbreak reporting

**Problem:** Sparse or interrupted reporting can make a lower level appear healthy while its status is unknown.

**Distinctive decision:** Where should an outreach team collect the next report, given limited staff and incomplete coverage?

**Build:** An offline report form and a small coverage view that keeps positive counts, explicit zero reports, and missing reports distinct. Preserve report time and the population actually covered. Use a visible policy such as visiting the longest-unreported reachable area first. Show reported counts and reporting coverage separately; do not extrapolate an actual outbreak total or diagnose residents.

**Inputs:** Synthetic aggregate reports with no real patient details. An operational version needs legitimate community reporting, definitions, access permissions, deduplication, and public-health oversight.

**Demo/check:** Begin with a zero report from one floor and a missing report from another. Add a late report from the silent floor and update the outreach queue without rewriting when that report was observed. Include duplicate and stale reports.

**Hollow effect:** Coordinators can investigate neglected areas and collect information needed for supply decisions. Missingness alone cannot establish deliberate suppression or fabrication.

**Existing foundation:** [WHO EWARS supports emergency surveillance under unreliable Internet and electricity](https://www.who.int/emergencies/surveillance/early-warning-alert-and-response-system-ewars/). [WHO information-service standards explicitly include reporting completeness and timeliness](https://www.who.int/docs/default-source/documents/publications/standards-for-public-health-information-services.pdf). Reporting-gap analysis is established; this proposal emphasizes the next outreach action.

## 6. Room Relay — share rooms across time

**Problem:** Overcrowding coexists with rooms that are usable only at certain hours or for certain activities.

**Distinctive decision:** Can existing shared rooms provide usable quiet, cooling, and meeting access around residents' shifts?

**Build:** One neighborhood's room list and a timetable. Inputs include capacity, availability, step-free access, permitted uses, quiet requirements, preparation time, group size, and requested windows. A small constraint scheduler allocates slots, exposes the priority rule, and lists unmet requests. Focus on community rooms and voluntary use; housing allocation is a larger separate problem. Room suitability is entered by a responsible operator rather than inferred by the app.

**Inputs:** A fictional room/shift schedule or volunteers' non-sensitive demonstration requests. The practical version needs authorized access and verified suitability.

**Demo/check:** Add a night-shift group seeking a daytime quiet slot, then close a room. Recompute without overlapping bookings, breaking capacity, or assigning an inaccessible room. Insufficient capacity must leave requests unserved.

**Hollow effect:** A coordinator can offer access to existing suitable space at useful times. The software cannot create physical space or supply cooling to an uncooled room.

**Existing foundation:** [OR-Tools documents local scheduling with coverage requirements and preferences](https://developers.google.com/optimization/scheduling/employee_scheduling). Applying that mechanism to these room constraints is a proposed adaptation, rather than a verified new optimization method.

## 7. First Harvest Gap — plan the transition to local food

**Problem:** A neighborhood may have days of stored food while a new farm takes longer to produce a useful harvest.

**Distinctive decision:** How much food must be obtained or reserved to bridge the period before local production contributes?

**Build:** A daily stock-balance simulator for a small crop catalog. Track starting edible energy, entered demand, planting dates, delayed harvests, scenario yields, crop edible energy, limited growing area, water, and electricity requirements. Keep scenario assumptions editable and compute any cumulative shortfall. Show crop weight separately from edible energy. A few vegetables cannot silently count as a nutritionally complete food supply.

**Inputs:** Clearly labeled crop assumptions and food inventory, with published crop material providing context rather than guaranteed local yields. An operational model needs measured production and appropriate nutrition expertise.

**Demo/check:** Start with a scenario in which stored food ends before the first harvest. Increase the reserve or shift planting earlier and observe the recomputed gap. Delay harvests, reduce yields, or remove required power and check that the plan no longer promises the same food output.

**Hollow effect:** Organizers can see when local growing is insufficient and arrange the remaining supplies before a cutoff. The app does not speed up plants or establish self-sufficiency.

**Existing foundation:** [NASA's Veggie fact sheet reports 33-day lettuce crops in specific experiments](https://science.nasa.gov/wp-content/uploads/2023/04/veggie_fact_sheet_508.pdf). [Virginia Tech's hydroponics guide describes crop-specific environmental, light, water, nutrient, and management requirements](https://spes.vt.edu/content/pubs_ext_vt_edu/en/SPES/spes-462/spes-462.html). Those are evidence for modeling delays and constraints, not Hollow yield forecasts.

## 8. Leave the Lights On — phase a return without abandoning essential work

**Problem:** A surface migration could remove the people who operate the systems that residents remaining underground still need.

**Distinctive decision:** Which voluntary departure waves preserve minimum essential staffing while respecting family and transport constraints?

**Build:** A small scheduler with fictional consenting households, departure availability, confirmed skill coverage, required underground shifts, transport seats, and entered surface-outpost capacity. Keep family groups together if requested. Maintain essential shifts through explicit volunteering/availability constraints; flag missing training or replacement staff. Do not infer who deserves to leave or compel workers to remain. If no voluntary plan satisfies the constraints, show that conflict.

**Inputs:** Scenario households and staffing rules. Surface suitability is an explicit scenario assumption, not an output of the migration planner.

**Demo/check:** Let a judge propose the departure of the only available pump operator. Identify the uncovered shift and find an alternative consenting wave if one exists. Add an available qualified replacement and recompute. Include an infeasible case.

**Hollow effect:** Coordinators can negotiate a phased move with visible staffing and capacity gaps, reducing the chance of leaving a service unstaffed during the transition.

**Existing foundation:** [OR-Tools scheduling examples](https://developers.google.com/optimization/scheduling/employee_scheduling) establish the underlying constraint technique. Combining voluntary departures, family groups, outpost capacity, and minimum services is the proposed workflow.

## Smallest implementation path

For decision tools, begin with one browser interface and a small editable scenario file. Use straightforward computation for small cases; introduce a Python constraint solver only when the constraints warrant it. Persist data only if the selected workflow requires history. For the QR and courier ideas, a preinstalled Android app with local storage and bundled scanning provides a direct route to a physical demonstration. A Jetson is optional, and a local server still needs power and a local connection for other devices to reach it.

The first deliverable for any choice should demonstrate one success, a judge-changed input, and a legitimate failure/unknown state. Add interface polish after the mechanism works. No cloud service, trained model, new sensor purchase, or city-scale simulation is necessary for the smallest versions described here.

## Suggested shortlist

- **Second Life:** strongest fresh software-only decision, provided compatibility stays explicit.
- **Relay Receipts:** strongest physical offline interaction, provided the team proves the actual transfer path and handles duplicate/pending states.
- **One Sample Left:** strongest investigation mechanism, provided the simple model's assumptions and ambiguous outcomes stay visible.
- **Breadcrumb Home:** easiest physical illustration of how fictional locations can be represented by real objects and real app behavior; existing wayfinding prior art is substantial.

Focused primary-source checks establish existing building blocks. They do not establish unique market gaps, operational demand, medical effectiveness, underground radio coverage, or a competitive judging outcome.

# Fresh Hollow mechanisms: feasibility and prior art

Researched November 14, 2026. These are proposed prototypes, not tested implementations, validated health systems, or proven original inventions. This note supplements the earlier Hollow shortlist rather than changing it.

## How a real build relates to fictional people

The fictional brief specifies the users, constraints, and desired behavior. The team supplies a clearly labeled sample inventory, tunnel map, or request history; the software actually computes a plan or transfers a real record. A judge changes an input, scans a code, or disconnects devices and observes whether the mechanism works. The demonstrated result is a correct computation or successful transfer under those conditions. An eventual service improvement in the Hollow is a causal proposal, not a measured outcome.

The initial inputs can be invented without inventing the software's response. Keep numbers and records editable and mark them as scenario data. A plausible operational version replaces those inputs with a technician's inventory, coordinator's request, or clinician's record. This is different from playing a scripted animation whose outcome never depends on inputs.

## 1. Second Life — choose what retired machines can repair

**Problem and user:** A maintenance coordinator has broken fans and recyclers, plus already-retired equipment that may contain useful parts. Buying replacements is unavailable in this scenario.

**Minimum build:** A small catalog of machines, checked component IDs, available spare/donor quantities, the parts each repair needs, repair time, and declared service coverage. Enumerate a small set of repair combinations; reject combinations that reuse one component, require unavailable tools, exceed the shift, or use an unverified substitute. Show an ordered work list and which declared services it restores. Use only retired donors initially; trading away an active essential machine adds a separate policy problem.

**Fictional inputs, real behavior:** Enter five invented failed machines and two invented donor machines. The real algorithm allocates actual inventory records consistently. Compatibility comes from the entered catalog or technician approval; the app does not infer mechanical interchangeability from a photo. A physical demonstration can use labeled safe tabletop components, but is optional.

**Judge demo:** Two jobs compete for one motor. The app cannot promise both. Remove a donor component or shorten the shift and watch the computed plan change. Control: a fully stocked repair can be scheduled. Failure: no feasible repair leaves a clear missing-parts list. Count overlapping service coverage once if claiming households reached.

**Plausible Hollow effect:** Helps a crew spend its limited shift on feasible repairs that restore useful service, rather than starting an impossible repair. It does not itself repair equipment or prove water is safe.

**Prior art and feasibility:** InvenTree already defines bills of materials, substitutes, stock allocation, CSV imports, and nested assemblies. The proposed distinction is selecting salvage repairs by a visible service objective, not inventing parts inventory. [InvenTree BOM documentation](https://docs.inventree.org/en/1.6.x/manufacturing/bom/).

**Build risk:** Model correctness depends on verified compatibility, donor condition, tools, and repair estimates. A small explicitly entered catalog is credible; automatic recognition of arbitrary components is a separate, unvalidated feature.

## 2. Relay Receipts — send an actionable request by carrying data

**Problem and user:** A neighborhood cannot reach the Directorate network but residents or couriers still move between some levels. A coordinator needs to know whether a supply request merely left the neighborhood, reached the depot, or was fulfilled.

**Minimum build:** Two genuinely disconnected local apps and a compact export/import bundle. Each request has an ID, source, destination, creation/expiry metadata, and an append-only history of receipts. Move the small file on removable storage, or encode one compact request into an onscreen QR that another preloaded device scans. Store imported IDs to avoid duplicates. Preserve conflicting updates for review rather than silently choosing whichever clock is newest. The first build need not implement an entire standardized network protocol.

**Fictional inputs, real behavior:** The item names, tunnel labels, and quantities are scenario data; the transfer between devices is real. A third phone can carry the request from one station to the other. A returned receipt is a separate journey, so there is no instant read indicator while the stations remain disconnected.

**Judge demo:** Disable network connections, transfer a request, scan/import it twice, and show one request with two observed transfers. Carry a receipt back. An expired request must be visibly expired; conflicting cancellations must remain unresolved. Test the app's declared clock assumptions.

**Plausible Hollow effect:** A limited human-carried route could coordinate requests even while network service is shut down. It works only where someone or some medium can physically move; it does not bypass a completely sealed passage.

**Prior art and feasibility:** The Internet Standard Bundle Protocol explicitly describes store-carry-forward, movement of data by physical mobility, and expiry/lifetime. Briar already synchronizes offline through Bluetooth, Wi-Fi, or memory cards. The proposed contribution is a request-and-receipt workflow with explicit uncertainty, not new offline messaging. [RFC 9171, introduction and lifetime/expiration](https://www.rfc-editor.org/rfc/rfc9171.html); [Briar](https://briarproject.org/how-it-works/).

**Build risk:** A local log cannot guarantee globally unique fulfillment across disconnected depots. Use one depot as the authority for each inventory/request and show unacknowledged claims as pending. Encryption, signer trust, lost-device recovery, and censorship resistance require actual implementation and testing before they can be claimed. QR carries data here, not a link to an inaccessible server.

## 3. Pocket Handoff — a referral that survives the patient's journey

**Problem and user:** A clinic visit is interrupted by a blackout or transfer between levels. The receiving clinic cannot read the first clinic's server.

**Minimum build:** A local form produces a short human-readable handoff and matching QR/file containing the actual compact record: pseudonymous patient ID, record time, responsible clinic, documented care, and follow-up information. The patient carries the record. The receiving app displays its source, age, and version, keeps the original, and can append another handoff. Use synthetic records in the demo. No diagnosis, drug selection, or invented clinical guidance is needed.

**Fictional inputs, real behavior:** The patient and visit are fictional. Generating, physically carrying, reading, and preserving the record are real. A printed code can be read by a powered receiving device even if the patient's own phone has died. The readable text provides a fallback if scanning fails.

**Judge demo:** Create the record, disconnect the first app, and scan the printed or onscreen code on another device. Show a stale copy and a contradictory newer handoff without silently overwriting either. If signatures are included, pre-trust the test clinic key and show that a modified record fails verification.

**Plausible Hollow effect:** Preserves relevant information across clinic and power interruptions, reducing the need to reconstruct the previous encounter. It does not increase the available medicine or establish that an old record is medically current.

**Prior art and feasibility:** WHO EMT standards call for relevant clinical records, patient treatment records, and referral/follow-up information. SMART Health Cards already encode signed health records in downloadable files and printable/scannable QR codes. The proposed distinction is a deliberately narrow interrupted-care handoff, not inventing portable medical records. [WHO EMT standards](https://extranet.who.int/emt/sites/default/files/BlueBook2021.pdf); [SMART Health Cards specification](https://spec.smarthealth.cards/).

**Build risk:** A QR is an encoding, not confidentiality. Printing or showing sensitive data exposes it to whoever sees the record. A signature authenticates the issuing key and detects modification; it does not certify the truth or clinical relevance of its content. Keep the hackathon record minimal and synthetic, and do not claim production clinical use or standard compliance without implementing it.

## 4. Clinic Comes Down — place one temporary care stop

**Problem and user:** A coordinator has one clinician, one portable kit, and a limited shift; some households cannot reach the fixed upper-level clinic.

**Minimum build:** A small tunnel graph with closures, walking times, step-free access, candidate temporary clinic rooms, declared room capacities, household mobility constraints, staff availability, and available kit contents. Choose one reachable stop and appointment window to cover the most eligible requests under those explicit constraints. An optional next step schedules one courier loop. Keep clinical priority entered by a qualified person or explicitly fictional; the app should not infer urgency from symptoms.

**Fictional inputs, real behavior:** The graph and requests are test data. Computing who can reach the selected stop, whether staff can get there, and which appointments fit is real. A judge can change closures, visit durations, or kit availability and obtain a new result.

**Judge demo:** The geographically nearest room has stairs and cannot serve two entered mobility-limited requests. Another reachable room covers more of the eligible requests. Close its access tunnel and recalculate. Control: all requests fit in a simple open network. Failure: no accessible candidate or insufficient shift time leaves requests explicitly unserved.

**Plausible Hollow effect:** Helps bring existing care and supplies to people separated by distance and access barriers. Computed coverage is not evidence of completed visits or improved health.

**Prior art and feasibility:** OR-Tools documents travel-time matrices, route time windows, pickup/delivery ordering, and scheduling constraints. Applying these tools to a small underground outreach workflow is a proposed adaptation. A single-stop version can be much smaller than a fleet optimizer. [OR-Tools time-window routing](https://developers.google.com/optimization/routing/vrptw); [OR-Tools pickup/delivery routing](https://developers.google.com/optimization/routing/pickup_delivery).

**Build risk:** Access restrictions and unknown corridors must be modeled explicitly. Display which requests are omitted and why; optimizing a coverage count alone can systematically neglect difficult-to-reach people. The policy deciding minimum service or priority belongs in visible inputs.

## Recommendation for the larger shortlist

Second Life is the strongest genuinely fresh fit relative to the existing notes: a clear constrained computation, little hardware dependency, and a direct connection to aging infrastructure. Relay Receipts offers a memorable physical demonstration, but it expands an offline-board direction already mentioned in the technical notes. Pocket Handoff is tangible and understandable but faces substantial existing prior art. Clinic Comes Down is buildable but should remain one decision, not a full hospital or emergency-routing system.

No prototype, device transfer, QR payload sizing, hardware benchmark, practitioner interview, exhaustive competitor search, clinical evaluation, or operational deployment was performed.

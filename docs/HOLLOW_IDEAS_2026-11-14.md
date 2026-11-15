# HackFest: ideas for Life underground

Reviewed November 14, 2026. Product judgments and proposed builds, not implementation results or predictions of judging outcomes.

## Recommendation

**Lead: One Tunnel Back**, adapting the earlier One Road Back to the actual Hollow setting. **Alternative: Last Shift**, a focused version of auditable rationing. **Hardware experiment: Hear the Failure**, only if a short test supports its core claim. The earlier signed-audio broadcast also deserves consideration because network shutdown is an explicit problem in this brief.

The [event information document](https://docs.google.com/document/d/1sz_UdwRzvyL1dVbcbqLnUdJwVHvOUWARg4B79VmKgaE/edit) has four tabs. Its Theme & Build Instructions describes failing underground infrastructure and supports both sustaining life underground and returning to the surface. It explicitly says a well-connected solution addressing several problems can strengthen a project. This supports connecting two problems through one useful decision; it does not require building a complete city-management platform. No numerical judging rubric appears in the document.

The document lists building ending November 20 at 11:00 PM but calls November 20 a Saturday; November 20, 2026 is Friday. It also calls November 21 Sunday, although that date is Saturday. The timezone is unspecified. Confirm the deadline from the submission platform or organizer update. Team size is 1–4, AI tools are allowed, and the rules prohibit pre-coding and coding during judging. This review writes planning notes only.

## 1. One Tunnel Back — strongest overall candidate

**Pitch:** One repair crew can reopen one tunnel before the next blackout. Which repair restores access to supplies for the most households?

**User:** A neighborhood coordinator choosing where to send a crew.

**Small build:** A fictional tunnel graph with homes, a supply depot, a clinic, reported closures, and repair durations. Evaluate reachable repairs within the time budget. Count newly connected households once and show the actual restored paths. Unknown conditions remain unknown. Start with one repair, rather than multi-crew scheduling or a complete evacuation model.

**Demo:** The nearest blockage is tempting, but another reachable connector restores more access before the deadline. A judge changes a closure or repair duration; the recommendation updates. Include a case where no single repair restores access.

**Why pursue it:** It connects flooding, movement restrictions, and supply access with one understandable decision. Data can be clearly labeled fictional scenario inputs, so there is no dependency on collecting a real underground map.

**Differentiation and limits:** Network routing is established; [QGIS already computes service areas and shortest paths](https://docs.qgis.org/3.40/en/docs/user_manual/processing_algs/qgis/networkanalysis.html). The proposed contribution is a focused repair-choice workflow with understandable constraints. A connected path establishes modeled access, not safe passage or successful deliveries. Jetson is optional; its GPU adds no necessary capability to this first build.

**First proof:** Hand-check small graphs with an unreachable repair, an already-connected neighborhood, and a pair of closures where either repair alone is insufficient.

## 2. Last Shift — refine auditable rationing into a concrete schedule

**Pitch:** This neighborhood has one battery until morning. Plan when fans, pumps, and shared lighting can run while meeting explicitly chosen minimum service requirements.

**Small build:** One battery, several devices, a fixed planning horizon, and hourly slots. Model usable energy in Wh and simultaneous power in W separately. Inputs include required windows and explicitly entered or simulated loads. Show the schedule, projected battery level, missed requirements, and the policy deciding who gets extra service.

**Demo:** Reduce battery capacity or add a required pumping window. Recompute the schedule and explain which optional service was delayed. If the requirements cannot all be met, return that result clearly. Include a peak-power bottleneck even when total energy is sufficient.

**Why pursue it:** It links power shortages, cooling, water, and unfair rationing without requiring sensors or ML. The resource-rationing theme is explicit, so specificity matters for differentiation.

**Feasibility:** Standard constraint scheduling is available; [OR-Tools provides a documented scheduling example](https://developers.google.com/optimization/scheduling/employee_scheduling). Applying it to the proposed energy model is an inference, not a tested implementation. Fairness is an exposed policy choice, not an objective answer discovered by AI. Keep the first build advisory and simulated; it does not validate a life-support policy. Jetson can host it locally but is optional.

## 3. Hear the Failure — strongest new Jetson experiment

**Pitch:** A local station listens to a ventilation fan and flags an unfamiliar sound for inspection.

**Small build:** One machine type, a normal-sound baseline, an anomaly score, and short reviewable audio clips. Begin on the laptop; deploy to the Orin Nano after the core works. A microphone is separate hardware whose availability and compatibility remain unconfirmed.

**Demo:** Compare held-out normal and anomalous recordings, then test harmless background speech and a changed microphone position. A live fan is useful only if transfer from the baseline actually works; a dataset replay must be labeled accordingly.

**Why pursue it:** It connects failing ventilation or pumping equipment with a physical local-computing demonstration. It is a more purposeful Jetson use than hosting a calculator solely to include hardware.

**Main uncertainty:** [DCASE 2026 Task 2](https://dcase.community/challenge2026/task-first-shot-unsupervised-anomalous-sound-detection-for-machine-condition-monitoring) establishes acoustic anomaly detection as an existing field and identifies noise and changes in operating conditions as challenges. An unfamiliar sound is not a fault diagnosis or a prediction of blackout timing. New background noise can trigger false alarms. This is a conditional choice, not the safest default for finishing.

## 4. Trusted Broadcast — revive the signed-audio alert

**Pitch:** A phone with no network connection hears a short neighborhood alert and checks whether it came from a pre-trusted signer.

**Small build:** A preloaded receiver and trust key, a compact signed message, and explicit freshness handling. Use a small set of alert codes rather than long text. Demonstrate a valid message, a forged one, and an old replay.

**Demo:** Receive a short alert through a speaker and microphone while network links are disabled, then reject a forged message. Test on actual devices before building the polished UI.

**Why pursue it:** The Directorate shutting down communications is directly in the prompt. It offers an inspectable physical payoff without needing LoRa radios or a robot.

**Feasibility and limits:** [ggwave](https://github.com/ggerganov/ggwave) provides small data transfers through sound, with a documented rate of roughly 8–16 bytes per second. Its [variable-length payload constant is 140 bytes](https://github.com/ggerganov/ggwave/blob/master/include/ggwave/ggwave.h). Message, signature, and metadata must fit and be measured on the chosen transport. The receiver and keys must exist before the outage; a signature establishes signer/integrity, not truth. Noise, microphone permission, range, and freshness remain implementation risks. Jetson is unnecessary for the first version.

## 5. Surface Evidence — new evidence workflow, conditional on sensor access

**Pitch:** Before sending a scouting team upward, show exactly what was measured at each candidate exit and what remains unknown.

**Small build:** Import readings for a few locations, preserving measurement time, source, sensor identity, calibration notes, and missing values. Compare repeated observations and flag stale records. Start with explicitly labeled recorded or simulated data if live sensors are unavailable.

**Demo:** An exit looks promising from its latest reported value, but the underlying measurements are old or incomplete. Fresh readings change which location should be surveyed next. Keep the output about evidence coverage and follow-up measurements.

**Why pursue it:** It fits the surface-return branch and the user's research experience. An Orin Nano could log available sensors locally. It is weaker as a standalone dashboard unless the evidence-to-next-measurement decision is clear.

**Limit:** The [EPA air-sensor guidebook](https://www.epa.gov/air-sensor-toolbox/how-use-air-sensors-air-sensor-guidebook) covers study planning, measurement, interpretation, and sensor performance evaluation. Limited sensor readings do not establish that an environment is generally safe. Camera imagery alone does not measure atmospheric hazards. Suitable sensors and a credible collection plan remain unverified.

## Reassessment of the earlier ideas

| Earlier idea | Judgment against this brief |
| --- | --- |
| One Road Back | Keep as the tunnel-repair lead above. |
| Auditable rationing | Keep, narrowed to Last Shift. A generic ration calculator would have less distinction. |
| Signed-audio / Fake the Broadcast | Reconsider; network shutdown is an explicit problem. Device feasibility comes first. |
| Second Angle | Still viable if framed around a concrete ventilation or tunnel incident. Shared sounds can propose a timeline, but cannot authenticate footage. Existing [Skelly Synchronize](https://github.com/freemocap/skellysync) already aligns recordings, so the value must be an inspectable incident-review workflow. Higher uncertainty than the graph planner. |
| Wrong Block | Demote. The [congressional incident report, printed page 7](https://robertgarcia.house.gov/sites/evo-subsites/robertgarcia.house.gov/files/evo-media-document/false-alerts-final-report-5.10.pdf#page=8) reports safeguards overlapping the proposed core. The present brief also has a less direct fit than infrastructure survival. A narrower outgoing-file checker would require representative artifacts and a confirmed gap. |
| Find family without a list | Strong problem fit. Keep the question; narrow the prototype before committing to fuzzy private matching. Low-entropy names create security challenges. A coded check-in board is simpler but sacrifices the original privacy mechanism and is a different product. |
| Leak scrubber / fingerprint detector | Buildable, but lower priority for this brief. Comparing copies reveals differences; identifying a recipient requires a known mapping. Its survival contribution needs a specific use case. |
| Memory-hole detector | Could watch changes to ration or maintenance notices, but needs a user action beyond showing that a page changed. Lower priority than a direct resource/access decision. |
| Drone sentry | The machines on the surface provide a story connection, but reliable acoustic detection and a useful response remain separate technical risks. Keep off the main shortlist without an existing working detector. |
| Money without banks | Could support local exchange; offline double-spending and reconciliation make a convincing bounded build harder. Not a lead for this week. |
| Proof of human | Anonymous membership does not establish that a person is trustworthy or exclude informants. Weak direct survival payoff for the prototype effort. |
| Statistical lie detector | Could flag data anomalies, but cannot establish fabrication or truth from statistical tests alone. Not a lead. |
| Underground price index | Requires adequate comparable data and a time baseline. A few current receipts support a price snapshot rather than inflation claims. Not a lead. |
| Audit denied allocations | Scarce real denial/decision data remains a blocker to demonstrating meaningful inference; invented rules should not be presented as uncovered rules. |
| Writing-style cloak | Hard to validate protection across unseen authorship classifiers within the available time. |
| Seized-phone preview | Complex data ingestion, privacy burden, and indirect fit. |
| Civilization reboot planner | Could support neighborhood independence, but accurate content and useful feasibility constraints dominate the work. An offline recipe tree by itself is less compelling. |
| Witness ledger | Could preserve independent readings or ration records. Hashes establish recorded integrity after capture, not the truth of an observation. More useful as part of a focused evidence workflow than a broad ledger. |

Generic offline chat already has capable predecessors: [Briar](https://briarproject.org/how-it-works/) supports direct offline communication, while [Meshtastic](https://meshtastic.org/docs/introduction/) uses compatible LoRa radios. A family-status prototype should emphasize last-confirmed status, stale updates, and conflicts. A board on a local Wi-Fi network can operate without Internet, but does not demonstrate communication between disconnected tunnel networks.

## How the Jetson affects the decision

[NVIDIA's Orin Nano hardware guide](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/hardware_layout.html) and [JetPack documentation](https://docs.nvidia.com/jetson/jetpack/introduction/index.html) support local inference and peripheral-connected applications. The board is optional for every proposed app. A powered local network is still needed for a shared local server; camera, microphone, air sensors, thermal imaging, and LoRa are separate capabilities.

Do not choose a robot, a large local language model, or a new sensor stack just because the board is available. Establish the core result on the laptop, then deploy the useful local capability. Exact board variant, software, peripherals, throughput, power draw, and compatibility have not been tested.

## First decision

Choose One Tunnel Back if finishing a useful interactive prototype is the priority. Choose Last Shift if the team prefers scheduling and policy tradeoffs. Give Hear the Failure or Trusted Broadcast a short real-input feasibility test before committing to either. Pick one core; add another problem only when the same mechanism solves it.

See [technical feasibility notes](HOLLOW_TECH_FEASIBILITY_2026-11-14.md) and the [earlier review](IDEA_REVIEW_2026-11-13.md) for supporting context. No prototype, practitioner interview, exhaustive novelty search, or hardware benchmark was performed.

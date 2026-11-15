# Hollow: six bolder directions

November 14, 2026. Proposed concepts and focused primary-source feasibility checks. These replace the conservative framing of the earlier shortlist; no prototype or operational result is claimed. Hardware availability, device compatibility, and global novelty remain unverified.

## 1. Daylight Heist — send a scout where people cannot yet go

**Hook:** A small scout must leave a tunnel, observe one surface location, avoid abandoned-machine patrols, and make it home before its battery budget runs out.

**Track connection:** Directly addresses the machine-controlled surface and the need to collect evidence before sending people upward.

**Small real build:** A 2D test world, an observation-limited scout controller, explicit moving obstacles, and a return-energy reserve. A time-expanded route planner compares moving, waiting, retreating, and abandoning a goal. If patrol prediction is used, learn it from the same observations available to the scout; do not secretly provide future obstacle paths. Replan on each observation. Score completed observations, returns, collisions, and depleted-budget failures across changed layouts. Recorded surface images and simulated readings must be labeled accordingly.

**Demo:** A judge changes a patrol's speed or blocks the return route mid-mission. The scout changes its timing, retreats, or explicitly fails rather than replaying an animation. A simulator is a legitimate controller test; it does not establish physical navigation capability. An overhead camera and toy rover on a tabletop city is an optional extension if the team already has suitable hardware. A camera image does not establish air safety.

**Foundation:** [Georgia Tech's Robotarium Python simulator](https://github.com/robotarium/robotarium_python_simulator) documents a real robotics simulation/API workflow, obstacle/sensor examples, and controllers. It is a precedent and possible reference, not evidence that the proposed patrol-avoidance or battery-return controller already works.

## 2. Pipe Telegraph — turn the plumbing into a signal channel

**Hook:** Type a short help code at one end of a pipe; coded vibrations travel to a receiver at the other end.

**Track connection:** Residents need a communication channel when the controlled network is unavailable.

**Small real build:** A short isolated metal pipe, a tapping actuator or human operator, a contact piezo pickup and compatible audio interface, and a decoder for four fixed message codes. Define a preamble, symbol timing, checksum, and duplicate handling. Begin with a receiver for intentionally spaced knocks rather than general speech or open chat. Receiver power is still necessary.

**Demo:** Send a hidden message through a 1–2 m test pipe. Add random knocks, loosen the pickup, and disconnect the pipe. Verify that reception depends on structural coupling rather than ordinary airborne microphone pickup. Range and joints are measurements to establish, not promises.

**Foundation:** [A 2013 experimental paper demonstrated metal-pipe communication using piezoelectric transducers](https://www.mdpi.com/1424-8220/13/7/8352). Its ultrasonic laboratory apparatus does not validate a cheap audible-knock version. This is the highest uncertainty first-test candidate. Detailed source checks are in [the physical mechanism research](HOLLOW_OUT_THERE_PHYSICAL_RESEARCH_2026-11-14.md).

## 3. Air Graffiti — read ventilation from moving physical marks

**Hook:** Lightweight ribbons become passive visual probes, and a camera turns their motion into an overlay showing what the air is doing locally.

**Track connection:** The deep levels are hot, ventilation is failing, and there may be few electronic instruments.

**Small real build:** A cardboard room/tunnel model, one or two low-voltage fans, marked lightweight tufts or flags, a fixed camera, and OpenCV tracking. Use known marker positions and tracked orientation/motion to display local movement and direction. Establish a baseline and compare the same setup before/after a blockage or fan change. A stationary tuft can mean insufficient flow, a stuck probe, or poor visibility, so show uncertainty. Calibration is required before claiming speed; do not turn tuft motion into an invented ventilation rate or gas measurement.

**Demo:** Block one branch of the tabletop model. The overlay changes from observed ribbon behavior. Rearrange the inlet and see whether the visible local movement changes. Compare with a hand-reviewed video and retain an occluded-marker failure state.

**Foundation:** [NASA describes inexpensive tuft flow visualization and its interpretation limits](https://www.grc.nasa.gov/www/k-12/airplane/tunvsmoke.html). [NASA's recent tuft-tracking research](https://ntrs.nasa.gov/citations/20250005725) establishes that camera-based analysis is a real technique. Applying it to low-speed ventilation with this material and camera remains an experiment. Prefer tufts for the demo; smoke is unnecessary.

## 4. The Wall Remembers — record a flood with no powered sensor

**Hook:** A flood leaves an irreversible physical record that a phone can read after the water drains and power returns.

**Track connection:** Sewage and flooding can isolate neighborhoods during long blackouts.

**Small real build:** A vertical series of isolated direct-water-contact indicator patches, height labels, camera alignment marks, and a phone reader that classifies the changed patches. Keep patch substrates isolated so water cannot wick upward and simulate a higher flood. Appropriate material must be acquired or a clearly labeled proof-of-principle surrogate tested. Include readable marks for manual inspection.

**Demo:** Switch electronics off, flood a tabletop tunnel, drain it, and scan the remaining record. Report a highest-contact interval based on patch spacing, rather than exact flood height or a timestamp. Splash and humidity controls matter. Reading needs power and light, although recording does not.

**Foundation:** [3M's 5557 datasheet](https://multimedia.3m.com/mws/media/1007611O/3m-water-contact-indicator-tape-5557-tds.pdf) describes permanent white-to-red change under direct water contact and humidity resistance. [USGS crest-stage gauges](https://pubs.usgs.gov/tm/03/a24/tm3a24.pdf) establish passive maximum-water-height recording as existing practice. The proposed contribution is a compact camera-readable post-blackout witness. It does not detect pathogens, prove sewage contact, date the event, or establish current passage safety.

## 5. No Control Room — let a neighborhood's devices coordinate locally

**Hook:** Remove the central display or coordinator, and the remaining local controllers continue operating within declared fallback rules.

**Track connection:** The Directorate controls services and communications; neighborhood-scale autonomy could reduce dependence on a central server when local equipment and power remain available.

**Small real build:** Three independent controller processes, or ESP32 boards if available, each representing a room with a low-voltage fan/LED and local demand. Start with explicitly simulated service budgets. Nodes exchange demand and negotiate optional allocations, while each has a preassigned fallback share. A partition triggers fallback rather than unsafe duplicate spending. Keep the visual display an observer, not the hidden authority. Real electrical load limits require independent hardware protection and verified control behavior.

**Demo:** Increase one room's entered demand and observe the visible allocation rule. Remove the monitoring app, then a node or radio connection. Surviving nodes continue locally and expose reduced/unknown coordination. Test a partition where both groups cannot silently assume the full shared budget.

**Foundation:** [Espressif ESP-NOW documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/network/esp_now.html) establishes connectionless peer-to-peer device communication, plus acknowledgment and loss-handling requirements. It does not supply a resource-allocation protocol or validate underground range. Physical power remains necessary, and local autonomy does not imply resistance to confiscation, interference, or physical disconnection.

## 6. Scrap-to-Shape — fabricate the missing connection

**Hook:** Two salvaged components almost fit. The software generates the adapter that makes a modest repair physically possible.

**Track connection:** Aging infrastructure and incompatible generations of salvaged equipment make missing brackets, couplings, and duct adapters consequential.

**Small real build:** Pick one low-risk part family: a small fan-to-duct adapter or mounting bracket. Collect dimensions with a ruler/caliper or a constrained image with a scale reference. Populate a parametric CAD template, preview it, and export a printable model. Validate minimum wall thickness, fit clearances, and supported ranges. A printer is needed to demonstrate fabricated fit; CAD output alone is a narrower result. Avoid claiming arbitrary-object recognition or universal part invention.

**Demo:** Present a fan and mismatched duct. Enter measured dimensions, generate the adapter, print it if a printer is available, and demonstrate physical fit plus airflow through the tabletop duct. Change a dimension and produce a different output. Include an unsupported geometry and a tolerance-mismatch case.

**Foundation:** [OpenSCAD documentation](https://openscad.org/documentation.html) provides parameterized geometry, extrusion, Boolean modeling, and export. [NASA's Apollo 13 account](https://www.nasa.gov/image-article/apollo-13-launch/) illustrates why adapters can be consequential. That historical life-support repair is inspiration, not validation for a printed life-support component. The hackathon target is ordinary low-pressure demonstration hardware.

## Choice

Daylight Heist is the strongest bold software-first story: the artifact is a controller that a judge can challenge in a changing simulation. Air Graffiti gives a low-cost physical result using a camera and visible air probes. Pipe Telegraph is a compelling first experiment with substantial channel/hardware uncertainty. The other concepts offer different ways to embody the Hollow's failures in real materials and interactions.

No prototype, procurement, hardware inventory, fit test, sensor calibration, practitioner interview, exhaustive originality search, or safety validation was performed.

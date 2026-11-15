# Hollow ideas: technical feasibility

Checked November 14, 2026. Research and proposed scope only; no prototype, hardware benchmark, camera/sensor inventory, or user validation. This supplements the earlier idea review rather than replacing it.

## Main recommendation

Keep the Jetson optional. The strongest reason to use it is a visible local capability: a camera/sensor workflow or a small server that keeps working after the Internet connection is removed. Hosting a graph or allocation calculator on it is feasible in principle but does not establish a need for its GPU.

The parent review found a prior chat identifying the board as a Jetson Orin Nano. Its variant, RAM, connected peripherals, and installed JetPack remain unconfirmed; check those before selecting packages or promising model performance.

## What the official sources establish

| Source | Verified capability | Implication for this project |
| --- | --- | --- |
| [NVIDIA Orin Nano hardware guide](https://docs.nvidia.com/jetson/orin-nano-devkit/user-guide/latest/hardware_layout.html) | The Orin Nano developer kit has USB, Ethernet, two CSI camera connectors, storage options, and a 40-pin expansion header. | Connecting a supported camera or external sensor is possible. This does not mean one is included or currently available. CSI compatibility and cables must be checked. |
| [NVIDIA JetPack introduction](https://docs.nvidia.com/jetson/jetpack/introduction/index.html) | JetPack includes TensorRT, CUDA, camera/multimedia APIs, and OpenCV support for edge applications. | Local camera inference is a plausible implementation route after model and software setup. No frame rate, accuracy, model size, or battery life is established by this review. |
| [Briar: how it works](https://briarproject.org/how-it-works/) | Briar synchronizes messages directly between devices and supports Bluetooth, Wi-Fi, and memory cards when the Internet is unavailable. | “Messaging without Internet” already exists. A new project needs a focused task beyond reproducing chat. |
| [Meshtastic introduction](https://meshtastic.org/docs/introduction/) | Meshtastic provides off-grid text messaging using LoRa radios, with rebroadcasting between nodes. | LoRa is an optional transport only if compatible radio hardware is already available. A Jetson or phone alone does not supply that transport. Published outdoor range does not establish underground coverage. |
| [Google OR-Tools scheduling example](https://developers.google.com/optimization/scheduling/employee_scheduling) | The example uses local constraint programming to satisfy coverage requirements and balance assignments. | A small resource schedule is technically approachable using standard optimization methods; the specific power model and fairness rule below are our proposal, not an existing feature in this example. |
| [EPA air-sensor guidebook overview](https://www.epa.gov/air-sensor-toolbox/how-use-air-sensors-air-sensor-guidebook) | The guide covers study planning, sensor selection, collection, interpretation, and performance evaluation. | Environmental measurements require a credible collection and evaluation plan. A colorful sensor dashboard alone does not establish a trustworthy assessment. |

## Laptop-first refinement of auditable rationing: Last Shift

**Pitch:** One neighborhood has a limited battery supply until the next recharge. Decide when to run shared services so each level receives its agreed minimum service.

**Small first build:** One battery, several devices, hourly slots, a fixed planning window, and explicitly entered minimum service requirements. Inputs are usable battery energy in Wh, the maximum simultaneous load in W, each device's measured or clearly simulated load, and required operating windows. Use an energy balance as well as a simultaneous-power constraint. Keep every number labeled as scenario data unless actually measured.

The output is an editable schedule, the projected battery level, requirements that were met or missed, and a short explanation of why one optional activity was delayed. Fairness is a transparent rule chosen by the team, such as meeting each level's minimum before distributing extra service. It is not something an AI can discover as a single objective truth.

**Demo:** A judge removes part of the battery capacity or adds a required pumping window. The app recalculates. When essential requirements exceed capacity, it explicitly reports that the constraints cannot all be met. Changing the policy reveals who receives less extra service.

This connects blackout preparation, rationing, cooling, and water-system operation through one concrete decision. It does not need AI, a GPU, custom sensors, or actual electrical switching. A Jetson can host the app locally as an optional deployment proof. Do not label a computed schedule a validated life-support policy.

**First proof:** Hand-check two small schedules, one impossible case, and one case limited by peak W despite sufficient total Wh. Runtime estimates need usable capacity, load variability, and losses; the prototype should expose entered assumptions.

## Refinement of the earlier family-matching idea

**Proposed contribution:** Last-confirmed family status plus supply requests, rather than another messenger. Each update carries a timestamp, source, and explicit stale/conflict state. Use household codes rather than a public directory of real names and locations.

**Small first build:** Two phones and a local Wi-Fi network with no Internet. A laptop or Jetson hosts the board. This proves local operation, not independent cross-tunnel communication. A later import/export or carry-and-forward exchange between disconnected local boards is a separate feature requiring explicit duplicate and conflict handling.

**Demo:** Disconnect Internet access, submit status from both phones, then show an old status becoming visibly stale. If disconnected exchange is implemented, demonstrate it using two genuinely disconnected instances; do not represent two tabs on one server as a mesh.

Briar and Meshtastic make generic offline messaging a weak originality claim. The board's proposed advantage is an understandable reconciliation workflow. User demand and superiority to existing tools remain unverified.

## Where the Jetson actually earns a role

A local camera can estimate a queue or count entries into a particular passage, with manual correction and no face recognition. Those estimates could inform the route/repair concept, but counting performance must first be tested under the demo's lighting, occlusion, and camera placement. An ordinary webcam does not establish performance in darkness or through smoke; a thermal camera is separate hardware.

A sensor-quality board is another possible hardware direction if sensors already exist: preserve raw readings, show missing/stale measurements and calibration status, and distinguish observations from interpretations. Without suitable sensors and evaluation time, it remains a recorded-data demonstration. Avoid treating limited air measurements as proof that the surface is safe.

## New hardware candidate: Hear the Failure

**Proposed contribution:** A local station learns a fan or pump's normal sound, flags a departure from that baseline, and saves the short audio segment for a person to inspect. It fits failing ventilation and water infrastructure without needing a camera. A USB microphone is still separate hardware, and a laptop can run the initial proof.

[DCASE 2026 Task 2](https://dcase.community/challenge2026/task-first-shot-unsupervised-anomalous-sound-detection-for-machine-condition-monitoring) defines unsupervised machine-sound anomaly detection and explicitly treats machine operating changes and environmental noise as sources of domain shift. The field is established; a useful hackathon contribution would be a small, inspectable local workflow for one machine, not a claim to invent acoustic monitoring.

**First proof:** Use a normal operating baseline and held-out normal/anomalous recordings; include harmless background speech and a changed microphone position. An increased score indicates an unfamiliar sound, not a diagnosed fault, predicted breakdown time, or guaranteed blackout warning. Do not physically damage, obstruct, or overheat a machine to create demo failures. A labeled dataset replay is honest if live transfer fails, but it is not evidence of performance on the team's actual fan.

## Limits

Sources establish available platform capabilities and prior art, not our implementation performance or an unmet market need. No radio, camera, sensor, power-supply, software-version, or model-compatibility test was performed. No live power control, health judgment, or deployment recommendation is supported.

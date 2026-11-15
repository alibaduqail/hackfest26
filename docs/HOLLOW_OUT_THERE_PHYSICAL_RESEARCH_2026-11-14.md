# Hollow: three physical mechanisms beyond administrative software

Researched November 14, 2026. Proposed experiments only; no materials, electronics, robot, or software were tested. These concepts have prior art. Their interest is the physical interaction and Hollow-specific use, not a claim to invent the underlying science.

## 1. The Wall Remembers

**Pitch:** When the power dies, the walls keep a physical memory of the flood. A phone reads that memory after the water has gone.

**Hollow connection:** Floods and sewage can isolate neighborhoods while the deep levels are blacked out. Electronic sensors can miss the whole event if they lose power. A passive witness can preserve evidence at the affected place without a battery or working network.

**Mechanism:** Mount separate water-contact indicator patches at known heights on a non-absorbent backing, with readable height labels and camera reference marks. Water permanently alters contacted patches. Afterward a phone identifies the installed card and reads the highest changed patch, or asks the user to confirm an ambiguous reading. Report a contact-height interval under the card's assumptions, rather than an exact flood depth. Physically isolate the patches: a continuous absorbent strip could wick above the actual waterline.

**What primary sources establish:** 3M's 5557 technical sheet describes a permanent white-to-red response on direct water contact and resistance to humidity-induced indications. The sheet describes electronics water-contact detection; it does not validate a tunnel flood recorder. Separately, USGS crest-stage gauges use floating granulated cork in a protective pipe to leave a persistent maximum-water mark on a staff. Battery-free maximum-water recording is therefore established. Our proposed phone-readable distributed witness is an adaptation. [3M 5557 technical sheet](https://multimedia.3m.com/mws/media/1007611O/3m-water-contact-indicator-tape-5557-tds.pdf?fn=WCI-Tape-5557-TDS_R2.pdf); [USGS crest-stage gauge explanation](https://www.usgs.gov/water-science-school/science/crest-gage-a-quick-way-measure-river-stage?qt-science_center_objects=0).

**Small honest hackathon version:** A clear tabletop container, a vertical card with several isolated test patches, and a phone reader. Use commercial water-contact material only if obtainable. Otherwise first bench-test a washable-ink or water-triggered paper pattern and label it a prototype material with unmeasured durability. Alternatively build the proven cork/staff principle and read its line. The manufactured patch's documented humidity behavior cannot be attributed to homemade ink.

**30-second demonstration:** Show a dry card. Switch off all sensing electronics. Raise and lower the water around the model. Turn the phone on and scan the surviving marks. The judge chooses a different water height for a fresh card; the result changes through the physical mechanism. A dry control stays untriggered. Include an unreadable/damaged mark that returns uncertain.

**Core uncertainty:** Splash, condensation, capillary rise, dirty water, patch aging, mounting displacement, and lighting can change what the marks mean. A witness records contact since installation/reset; it gives no event timestamp, duration, contamination test, structural assessment, or guarantee that the tunnel is currently safe. No changed patch can mean no contact, failed material, or a bad installation. A shielded, calibrated mounting needs testing before depth claims.

**Why this is a strong direction:** Its central promise can be shown physically even when the computer is off. The Hollow is the scenario; the water, persistent record, and phone interpretation are real.

## 2. Pipe Telegraph

**Pitch:** The Directorate can shut off the network. It cannot switch off the fact that metal carries a knock.

**Hollow connection:** Metal pipes or rails could provide a short local channel between reachable ends when conventional network service is unavailable. The first demonstration is one pipe, not an entire city's unknown infrastructure.

**Mechanism:** Encode four fixed messages as framed tap patterns. A ready-made contact microphone/piezo pickup with a compatible audio interface captures vibration at the other end. The decoder detects pulse timing, checks the message framing/check bits, and either displays a message or rejects it. Start with manual taps; automatic transmission is another step. The receiver still needs power. A tap channel does not supply encryption or authentication.

**What primary sources establish:** Jin, Ying, and Zhao experimentally transmitted data through steel pipe specimens using PZT transducers and guided elastic waves. Their system used ultrasonic excitation and laboratory acquisition equipment; it is evidence for the physical channel, not validation of cheap audible knocks, ordinary phone microphones, city-scale range, or our decoder. Dispersion, multiple propagation modes, and ambient noise are explicit difficulties in the paper. [Experimental primary paper, Sensors 2013](https://www.mdpi.com/1424-8220/13/7/8352).

**Small honest hackathon version:** A roughly one- to two-meter isolated pipe or metal bar on a tabletop, a contact pickup and audio interface, a laptop, and four messages. Use safe loose test hardware rather than real building plumbing. Test whether the particular pickup and coupling can distinguish taps before building an attractive receiver screen. A regular airborne microphone that hears the sender does not prove structure-borne transmission.

**30-second demonstration:** The sender secretly selects and taps a help message at one end. The receiver displays the decoded message at the other. A judge sends a second pattern. Random knocks or an invalid pattern produce no message. Decouple the pickup or break the mechanical path as a control; characterize airborne pickup rather than claiming the source is inaudible merely because it is hidden.

**Core uncertainty:** Coupling, bends, joints, supports, water flow, machinery, and echoes may make a real pipe network unusable. A one-pipe success does not establish reliable routing through a building. Interference and hostile injected taps are unsolved by a simple checksum. Do not promise reliable emergency communications until the channel is measured.

**Why consider it:** It has an immediately visible physical trick and directly addresses network control. Its first technical proof is riskier than the flood witness.

## 3. Send a Shadow Up

**Pitch:** Residents move a small token across a projected table, and a real scout moves through the dangerous space on their behalf.

**Hollow connection:** The first trip toward the surface need not put a person in the tunnel. A small remotely controlled machine can return images from a place a resident cannot yet enter. The projected physical controller makes a remote machine tangible to several people gathered around a table.

**Mechanism:** A tabletop camera tracks a marked physical target token. Calibrate the tabletop coordinates against a small robot test area. Moving the token specifies a goal; a real wheeled base drives toward it while its current position and intended motion appear in the projection. If the marker disappears or the control link expires, stop. A robot-mounted camera can send a real view if that hardware already works. Keep the first version to one robot and a bounded indoor test area.

**What primary sources establish:** The authors of an open projected-AR system published a ROS implementation and hardware configuration for projecting robot navigation intent. Their example requires a ROS robot and projector and was tested with ROS Melodic/Ubuntu 18.04, so modern compatibility must be checked. Kato's primary research describes a top-down camera interface controlling real robots, fiducial tracking, and human-specified motion fields. These establish pieces of a tangible control system, not a ready-made surface scout. [Projected navigation primary paper](https://arxiv.org/abs/2112.05172); [authors' code and hardware requirements](https://github.com/umhan35/arrow_projection); [Kato's robot-interface research](https://digitalmuseum.jp/research/multir/).

**Small honest hackathon version:** Use an already-functional programmable wheeled robot, webcam, projector, and cardboard obstacle area. The new work is token tracking, coordinate mapping, one-goal control, projected intent, and a stop condition. Do not start by manufacturing a rover, deploying full SLAM, or creating a general autonomous agent. Without an available working base, a simulation can explain the interaction but cannot be presented as a physical robot demonstration.

**30-second demonstration:** The judge moves a physical puck on the projected table; the real scout moves to the corresponding spot in a cardboard tunnel. Move the puck again and the goal changes. Remove tracking or interrupt the command link and the robot stops. If obstacle avoidance is implemented, place a new obstacle and demonstrate rejection/stop; a preloaded route is not proof of avoidance.

**Core uncertainty:** Existing hardware and working motor control dominate feasibility. Projection/tracking calibration can drift, and the tabletop's overhead camera is a test rig rather than a sensor magically available on the actual surface. A deployment needs onboard localization and an actual control/data link, possibly tethered. Camera images do not test atmospheric safety, and a working toy rover does not establish navigation through rubble or hostile autonomous machines.

**Why consider it:** The most theatrical demonstration, conditional on already having suitable hardware. It is a physical control interface for a scout, not proof of full autonomy or safe reoccupation.

## Choice

Start with The Wall Remembers for the strongest balance of strangeness, direct problem fit, and a bounded physical test. Pipe Telegraph is the bolder communications experiment. Send a Shadow Up is appropriate only if a functional robot and projector are already on hand. None requires claiming that the fictional Hollow actually exists: the test rig supplies the conditions, while the mechanism performs a real action.

No material availability, DIY indicator stability, tap transmission, pickup compatibility, robot integration, projected tracking, real underground deployment, or exhaustive novelty search was checked experimentally.

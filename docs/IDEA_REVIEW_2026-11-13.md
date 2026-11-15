# HackFest idea review

Reviewed November 13, 2026. This is a research and product judgment, not an implementation or a prediction of judging results.

## Recommendation

For the latest three ideas, prioritize an improved **One Road Back**, keep **Second Angle** as the higher-risk option with more cinematic demo potential, and demote **Wrong Block as currently pitched**. The earlier signed-audio alert also deserves a short feasibility check; its disappearance from the shortlist was not supported by a clear comparison.

These are judgments under the transcript's assumptions: two developers, classes/jobs during the week, a need to finish, and the supplied dystopian track. There is no confirmed final team selection or current official judging rubric here.

## Gaps in the selection process

1. **The numerical rankings imply more certainty than the evidence supports.** The repository's Python scorer adds seven subjective 1–5 ratings. It has no explicit originality, input-data access, theme-fit, or user-validation dimension. Its README uses a different seven-factor scorecard. A score of 30 versus 29 is a prompt for discussion, not evidence of superior winning odds. Frequency also needs interpretation for a disaster tool: a rare but consequential incident can justify a useful product. Sources: [scorer](https://github.com/udaysharmadev/Hackathon-Starter-Pack-Complete-Guide-Roadmap/blob/main/tools/idea-scorer.py), [problem selection guide](https://github.com/udaysharmadev/Hackathon-Starter-Pack-Complete-Guide-Roadmap/blob/main/03-problem-selection-engine/README.md).

2. **A real incident proves consequences, not an unmet current need.** The team needs to identify what existing products still leave difficult. Wrong Block is the clearest example of this distinction.

3. **Easy to understand is being confused with small in substance.** Keep a simple user-facing decision and put the technical work underneath it. Several earlier proposals lost their interesting mechanism when simplified. Conversely, a large animation does not establish a useful capability.

4. **A judge should change an input and get a defensible new result.** Counts, matches and geographic effects must be computed from inputs. Prepared fictional scenarios are legitimate test cases; an exclusively scripted success is weak evidence. Include a correct control and a case where the app cannot conclude anything.

5. **Each concept needs one explicit claim and boundary.** Road connectivity is not proof of supplies delivered; audio alignment is not footage authentication; alert configuration is not actual handset receipt. These limits should guide the product, rather than appear only in a disclaimer after an exaggerated reveal.

6. **Sponsor preference remains speculation.** Technology should earn its place through a visible capability or real time savings. Do not infer a prize, scoring bonus, or sponsor's political preferences from its presence on the event page. Runtime's Playwright integration is real, but running development tests there does not establish that a product itself is valuable. Source: [Runtime integration](https://withruntime.com/integrations/playwright).

7. **Validation is the missing next step.** The conversation reports no practitioner interview or technical trial for these concepts. One specific recent workflow from a potential user and one successful test of the risky mechanism would change the ranking more than another set of model scores. No one was contacted during this review.

## One Road Back

**Improved pitch:** A town has one repair crew and six hours before dark. Find which reachable road blockage to clear to restore supply access for the most households.

**Why this is worth considering:** The effect is understandable, can be computed honestly from a small graph, and directly supports survival after infrastructure damage. NCDOT documented roads isolating communities after Helene and aerial supply missions. That demonstrates the real stakes, not demand for this specific app. Source: [NCDOT recovery account](https://www.ncdot.gov/news/press-releases/Pages/2024/2024-10-14-ncdot-hurricane-helene-recovery.aspx).

**Existing capabilities:** QGIS can calculate reachable road-network service areas. USDOT's RDR suite supports resilience-investment prioritization under hazard scenarios. Do not claim to invent road-network accessibility or disaster repair planning. The proposed contribution is a fast, constrained decision workflow for one coordinator. Sources: [QGIS network analysis](https://docs.qgis.org/3.40/en/docs/user_manual/processing_algs/qgis/networkanalysis.html), [USDOT RDR](https://github.com/VolpeUSDOT/RDR-Public).

**The gaps to fix:**

- The original example treats every repair as equally feasible. Distinguish clearing debris from rebuilding a bridge; use explicitly entered or simulated repair durations.
- A candidate repair is useless if the crew cannot reach it. Limit the first version to reachable candidate blockages and one repair within the available time.
- Access must mean a road path to a supply depot using the selected vehicle and network assumptions. Count newly connected households once; do not label them people saved.
- Road condition and population inputs need provenance. Use a preloaded network with clearly marked scenario closures and household estimates. Do not present invented numbers as an assessment of an actual disaster.
- Unknown roads must not silently count as open. Let a coordinator change an uncertain edge and see whether the recommendation changes.
- Some communities require multiple repairs. A one-repair prototype should show when no individual repair restores access, rather than inventing a useful winner. Multi-repair optimization can remain outside the first build.

**Demo:** Give the judge three candidates. A big highway repair misses the deadline. One feasible minor connector restores more access than the nearest blockage. Let the judge close another road or change a repair duration; the recommendation and highlighted paths must update. All numerical examples are scenario values.

**Validation gate:** Compare the result against hand-checked small networks, including an unreachable repair, an already-connected neighborhood and a pair of closures where either repair alone is insufficient. Then let a teammate change inputs without telling the author. Do not build a second GIS platform around this core.

## Second Angle

**Improved pitch:** Put three witnesses' videos on one timeline so everyone can inspect what happened before the official clip begins.

**Originality gap:** Skelly Synchronize already aligns recordings through audio cross-correlation and other cues. AudioAlign already offers audio/video synchronization, a visual multitrack timeline and perspective switching. Adding a timeline to synchronization is therefore insufficient differentiation. Forensic Architecture also describes synchronization as an established investigative method. Sources: [Skelly Synchronize](https://github.com/freemocap/skellysync), [AudioAlign](https://github.com/protyposis/AudioAlign), [Forensic Architecture](https://forensic-architecture.org/methodology/synchronisation).

**A more focused contribution:** Build a short incident-review experience for a person who does not want to learn a video editor. Preserve each clip's coverage, show the actual shared sound used to propose an alignment, permit correction, and visibly leave unplaceable clips outside the timeline. This is a proposed user/workflow advantage, not a verified market gap.

**The gaps to fix:**

- A matching sound is a candidate alignment, not proof of authenticity or even a unique time offset. Repeated alarms, noise, edits and different recording locations can produce ambiguity.
- A common clock or shared event is needed to relate recordings. A middle clip can connect two others, but the app must not place a disconnected clip merely because the UI expects three tiles.
- Relative alignment does not establish real clock time. Avoid claiming more precision than the evidence allows, particularly for closely spaced events recorded from different positions.
- Reading three real phone recordings is a prerequisite. Test the actual file formats, decoding path and processing time before designing the polished interface.
- A useful failure state is part of the demo: multiple plausible offsets, an unrelated recording, or too little overlap should invite review rather than produce a false confident match.

**Demo:** Three clips establish the order of an alarm and a gate closing. Clicking the alignment cue plays the corresponding sound in both source clips. Add an unrelated fourth clip; it remains unplaced. The question is answered from recorded evidence, without generating missing footage or labeling the recording true.

**Validation gate:** At kickoff, use a time-boxed technical trial with short clips from the actual devices. Have a teammate create hidden trims with known offsets, add noise, and supply unrelated or repetitive audio. Check useful offset accuracy and rejection behavior. If this fails, move to the road concept before investing in the timeline UI.

## Wrong Block

**Do not keep the current version as the lead.** The congressional investigation into the Kenneth Fire false alert reports that targeting was present in other channels but missing in IPAWS. Crucially, it also reports that Genasys subsequently added both a warning for overly broad targeting and a safeguard carrying other channels' polygon targeting into IPAWS. The proposed demo closely repeats those documented fixes. The source reports vendor safeguards; this review did not test them. Source: [report, printed page 7 / PDF page 8](https://robertgarcia.house.gov/sites/evo-subsites/robertgarcia.house.gov/files/evo-media-document/false-alerts-final-report-5.10.pdf#page=8).

**The claim also needs narrowing:** A configured target is not a list of phones that will actually ring. Carrier, handset and location-service behavior affect reception. Current FCC materials discuss those limits; proposed changes must not be treated as deployed requirements. Source: [FCC 26-38](https://docs.fcc.gov/public/attachments/FCC-26-38A1.pdf).

**A possible revision:** Compare an independently specified intended area with an actual exported outgoing CAP message. Show the exact field that differs. This could catch a transformation/save problem that inspecting the drawn area alone misses. It depends on obtaining the outbound artifact and finding a practitioner-confirmed gap beyond existing vendor safeguards.

**Validation gate:** Accept imported or changed inputs, a correctly targeted control, and an intentionally broad alert that passes because broad delivery was intended. Use sample locations only as explicitly simulated exposure. No live alerts or restricted platform integrations are needed or authorized for this review.

Detailed supporting research is in [WRONG_BLOCK_RESEARCH_2026-11-13.md](WRONG_BLOCK_RESEARCH_2026-11-13.md).

## The overlooked signed-audio alert

The earlier Fake the Broadcast proposal has a clear physical demo: a preloaded offline phone receives a short acoustic alert and checks whether its signer is trusted. A forged alert fails. Consider a clearer product name if revived.

**What already exists:** ggwave transmits small payloads by sound, including one-to-many use cases. Its README gives roughly 8–16 bytes per second, and its default variable-length protocol has a 140-byte payload limit. The acoustic transport is prior art, not the proposed invention. Sources: [ggwave](https://github.com/ggerganov/ggwave), [payload constant](https://github.com/ggerganov/ggwave/blob/master/include/ggwave/ggwave.h).

**Important gaps:** The receiver and trusted keys must exist before the outage. A digital signature verifies the signer and message integrity, not the truth of the instructions. A previously valid recording can be replayed, so freshness needs explicit handling and limits. Compact message, signature and metadata must fit the payload; measure real transmission time. Range, microphone permissions, noise and phone behavior remain untested.

**Decision:** Worth one short real-device feasibility check, not an assumption that it is easy or novel. It provides a more concrete core demonstration than simulated emergency-message delivery. Keep it out of scope if it distracts from choosing between the latest three.

## How to choose without another idea loop

Use four evidence questions rather than another numerical ranking:

1. Can we obtain the actual inputs and reach the intended user?
2. What useful result can the judge change and independently inspect?
3. What remains difficult after the closest existing tool is considered?
4. Can the risky core pass a short kickoff trial with both success and failure cases?

Keep a simple explanation and one consequential decision. Put the remaining time into reliability and a clear demo. No new idea, sponsor integration or extra feature is required to resolve these four questions.

## Limits of this review

No prototype was built or benchmarked, no practitioners were interviewed, and no sponsor access was tested. Competitor checks were focused, not exhaustive. Current HackFest judging criteria, exact submission cutoff and sponsor awards remain unverified. The recommendations identify the strongest next experiments; they do not promise originality or a win.

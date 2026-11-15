# Wrong Block: evidence and gaps

Checked November 13, 2026. Research only; no implementation, live alerts, vendor access, or contact with emergency staff.

## Verdict

**Demote the current pitch.** The documented real-world failure is compelling, but the proposed fix substantially overlaps safeguards the affected vendor already added. A browser simulation can demonstrate configuration mistakes; it cannot establish which real phones will receive a WEA.

An independent alert-payload checker is a plausible small project if a practitioner confirms a remaining workflow gap. It is not presently a strong originality claim or a verified operational need.

## Verified incident and an important correction

The May 12, 2025 congressional report says the Kenneth Fire polygon was correctly entered and saved in other Genasys channels, but absent in its IPAWS channel. A county geocode remained, permitting countywide delivery. The suggested network-disruption cause was not established; the error could not be reproduced.

Crucially, printed page 7 says Genasys subsequently added **both** a warning for geocode-without-polygon targeting and a safeguard ensuring the IPAWS channel receives polygon targeting used by other channels. Those are close to Wrong Block's proposed hero feature. This is a real incident, but not evidence that this exact deficiency remains unaddressed.

Source: [Congressional report, printed pages 6–7](https://robertgarcia.house.gov/sites/evo-subsites/robertgarcia.house.gov/files/evo-media-document/false-alerts-final-report-5.10.pdf). The PDF was downloaded and its text read locally with macOS PDFKit after the web reader intermittently returned 403.

## Why “whose phones would actually go off” overclaims

The FCC's 2026 FCC 26-38 document discusses continuing geographic-targeting problems, including the effect of disabled handset location services, device capabilities, and carrier implementation. It proposes changes to improve geotargeting. A proposed regulatory change is not proof of a deployed fix or an adopted final requirement.

**Inference:** the app could calculate an intended/configured target area and evaluate simulated sample locations under declared assumptions. It cannot infer actual handset receipt from that area. It lacks live tower coverage, network status, handset state, and real per-device receipt evidence. Use “configured target,” “simulated exposure,” and “unknown delivery,” rather than presenting six animated phones as six verified deliveries.

Sources: [FCC 26-38 (2026), geotargeting discussion](https://docs.fcc.gov/public/attachments/FCC-26-38A1.pdf); [FCC's September 2022 WEA performance exercise report, published 2023](https://docs.fcc.gov/public/attachments/DOC-392829A1.pdf). The historical exercise demonstrates that target boundaries and actual presentation differ; do not use its rates as a 2026 performance estimate.

## Existing testing weakens broad novelty

- Everbridge advertises separate IPAWS test/live environments, target-area selection with polygons/circles, and follow-up/cancellation controls. Testing or previewing an alert is therefore not a new category. Its documentation also describes a Simulation Mode, although the detailed support page required authenticated access during this check. [Everbridge IPAWS overview](https://www.everbridge.com/resource/ipaws-with-everbridge/).
- FEMA's Technical Support Services Facility already supplies a controlled training environment, exercise support, and an independent IPAWS Message Viewer for validation. This facility is for approved alerting authorities; a student team should not assume immediate access. The fact sheet is dated June 2021 and establishes prior art, not a current access promise. [FEMA fact sheet](https://www.fema.gov/sites/default/files/documents/fema_ipaws-tss-fact-sheet.pdf).
- FEMA publishes alert-and-warning exercise starter kits. A new tabletop exercise by itself needs a more specific contribution. [FEMA exercise starter kits](https://preptoolkit.fema.gov/web/em-toolkits/alert-and-warning/).

This is a focused competitor check. It does not prove no independent tool already performs the narrower proposed comparison.

## What the team could actually import and check

The public February 2024 IPAWS-OPEN v4.02 design guide documents CAP fields, per-channel mappings, geometry restrictions, and update/cancellation references. It requires approved credentials for IPAWS-OPEN operations. This published interface guide is sufficient for an explicitly bounded **local CAP-file inspection** prototype; it does not provide access to a vendor's draft state or outbound private integration.

**Inference:** accepting an expected-area GeoJSON plus a captured/exported CAP XML file is feasible. Claiming to read an arbitrary vendor's live send settings is not justified without an available export/API. Inspecting the polygon the user drew also cannot detect a later save/serialization bug; the comparison needs the actual outbound artifact or an honestly labelled fixture of it.

Source: [FEMA IPAWS-OPEN v4.02 design guide](https://content.govdelivery.com/attachments/USDHSFEMA/2024/01/31/file_attachments/2767795/IPAWS-OPEN-v4-02-InterfaceDesignGuide_Final.pdf), sections 4, 8.6, 8.8–8.10. Vendor SMS/app export formats are separate and were not verified.

## Better bounded version, if the team keeps it

**Pitch:** “Check that the alert you are about to send still targets the area you intended.”

**User:** an emergency-communications developer or coordinator checking a prepared/exported alert. Access and workflow need practitioner validation.

**Core:** compare an independently specified intended area against the outgoing CAP artifact; show the two areas, identify the exact fields responsible for widening, and preserve the source artifact for inspection. A second channel can use one documented mock contract. Explain that broadcast delivery remains unknown.

**Possible differentiator, still unverified:** a vendor-independent set of reproducible regression cases and an inspectable difference between intended and serialized targeting. Avoid claiming that geofencing, test mode, or missing-polygon warnings are original.

**Theme issue:** this is prevention/testing infrastructure while emergency institutions still operate. The pitch needs to explain why that directly serves the dystopian scenario instead of merely depicting a disaster. Do not imply this is an actual alerting network.

## A meaningful demo and decision gate

1. Give the app an intended dorm area and a valid-looking CAP fixture whose precise geometry was lost while a broader geographic code remained. Show the exact mismatch and its configured geographic effect.
2. Let the judge change the intended area or import a different valid alert. The app must recompute rather than replay a fixed animation.
3. Include a correctly targeted control and an intentionally broad countywide alert. The latter must not be rejected merely for being broad: it is correct when broad targeting was intended.
4. Include one malformed or unsupported artifact that returns an explicit error, plus a case for which actual delivery is correctly shown as unknown.
5. Cross-check geometry and CAP handling against independently written expected results and the cited specification. Do not use “it matches our own generator” as the only validation.

**Go only if:** the team can obtain a representative outgoing artifact, explain a useful gap beyond the documented vendor safeguards, and prove the comparison on a pair it did not construct through the same implementation. Otherwise choose a different lead rather than adding more animated phones or sponsor integrations.

## Unresolved

No emergency coordinator validated demand. No current proprietary product was tested. No current API/export capability, real-world delivery model, or HackFest judging criteria were verified. The investigation above supports demoting the present pitch, not an assertion that every alert-testing workflow is solved.

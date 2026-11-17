# Echo: story

_v1 · owner `@m_opus` · for the UI builder. Paste the section 5 block; do not retype it._

## 1. Logline and tone

**Logline.** One Directorate tower clears every flight in the Hollow. When it goes dark, you are the Relay: you bolt radios into the tunnels so a nurse can reach a city that is dying of a lung sickness.

**Tone.** Quiet, grounded, hopeful under pressure. Short sentences, no melodrama. Mara is tired and practical. The Directorate never argues; it only announces. The win is small and honest: a pod arrives, late.

## 2. Prologue (shown once, before Mission 1)

Five typewriter screens, click to skip, in the TypeScript block.

## 3. Cast (on-screen names only)

| Name | Role | Voice |
|---|---|---|
| The Relay (you) | Resident organizer, never named or gendered. Addressed as "you". | Silent. |
| Nurse Mara Vale | Sector 07, bound for Lagos Deep. She/her. Rides pod MED-1. | Short radio lines in the run, each tied to an engine event. |
| The Directorate | Controls air, power, the network, every pod between levels. | A voice, never a face. Appears only as an all-caps BROADCAST line. |

Other names allowed on screen: the Hollow, Echo, Sector 07, existing city names. Add no named characters; other pods appear only as engine labels.

## 4. Mission arc

1. **Tower Down.** The tower dies. Echo works because beacons already exist.
2. **Dead Zones.** There are not enough beacons. Your choices decide who waits blind.
3. **The Grounding.** The outage is not a night. It is a season, shown as one day in time-lapse, and the Directorate keeps closing tunnels.
4. **Ghost Flight.** The Directorate learns Echo's rule (medicine first) and fakes a medical pod. No center to ask, so every beacon checks the signature.

Arc: it works, it depends on you, it must last, it must resist abuse.

## 5. Text (canonical)

Verdicts are keyed by stars earned (0 to 3). Mara line events: `tower-down`, `seal-heard`, `reroute`, `yield`, `arrive`, plus `credential-reject` (Ghost Flight only). Show a line the first time its event appears in the log; if the event never happens, show nothing.

```ts
export const STORY = {
  prologue: [
    "2087. The surface has been closed for thirty years. Machines hold it. Nobody is coming back up.",
    "Two billion people live in the Hollow: cities carved into old mines and subway tunnels, stacked in levels beneath the dead ones. The deeper you go, the darker it gets. The hotter. The sicker.",
    "The Directorate runs the air, the power, the network, and every pod between levels. Its numbers say all is well. The numbers are not true.",
    "A lung sickness is spreading in Lagos Deep. A nurse in Sector 07 is ready to go. Tonight, the tower will go dark.",
    "You are the Relay. You know the tunnels, and the people who live in them. You have radios. Build Echo.",
  ],
  missions: {
    "tower-down": {
      briefing: [
        "Sector 07, minute zero. Nurse Mara Vale has her bag packed and a pod waiting. Her patients are in Lagos Deep, where the lung sickness is spreading.",
        "Last year, residents bolted a battery beacon into every tunnel. The Directorate calls them unlicensed. Tonight they are all that stands between the tunnels and silence.",
        "At minute twenty, the tower goes dark. Send Mara when you are ready, then watch what the beacons do.",
      ],
      broadcast: "ALL FLIGHTS REMAIN AUTHORIZED. THE NETWORK IS STABLE. REMAIN IN YOUR SECTOR.",
      prepTip: "Every tunnel already has a beacon. Nothing to place. Send Mara and watch.",
      maraLines: [
        { event: "tower-down", text: "Tower's gone quiet. I'm still in Sector 07. The beacons are lit." },
        { event: "seal-heard", text: "They sealed the Lagos tunnel. The beacons say so. I'm not asking the tower." },
        { event: "reroute", text: "New route, through São Paulo. Longer. But it's open." },
        { event: "yield", text: "A passenger pod stepped aside for me. Nobody told it to. The rules did." },
        { event: "arrive", text: "Lagos Deep. I'm here. Point me to the wards." },
      ],
      verdicts: {
        0: "Mara never reached Lagos. The tower kept announcing flights. None of them flew.",
        1: "Mara made it. The rest of the Hollow is still waiting in the tunnels.",
        2: "Mara made it, and so did every nurse. The medicine is still on the way.",
        3: "Mara made it, and every nurse and every crate with her. The passengers waited. That was the price.",
      },
    },
    "dead-zones": {
      briefing: [
        "Same tunnels, same night. But the beacon stores ran low. You have forty beacons for a hundred and fourteen tunnel sectors.",
        "A tunnel with no beacon hears nothing and passes nothing on. A pod waits there, blind, before it dares to enter.",
        "At minute thirty, the Directorate seals the tunnel to Lagos. Put your beacons where the news has to travel.",
      ],
      broadcast: "NO TUNNEL WILL BE CLOSED. UNLICENSED RADIOS ARE A DANGER TO ALL FLIGHTS. HAND THEM IN AT YOUR SECTOR OFFICE.",
      prepTip: "The direct tunnel to Lagos will be sealed. Beacon the detour, and the cities on it.",
      maraLines: [
        { event: "tower-down", text: "Dark again. Half these tunnels have no beacon. I'll go where I can hear." },
        { event: "seal-heard", text: "Lagos tunnel is closed. If the detour has beacons, I'll know in time." },
        { event: "reroute", text: "Rerouting. If this stretch is silent, I wait. Waiting is safe." },
        { event: "yield", text: "Passenger pod gave way. Even here, with so little to hear." },
        { event: "arrive", text: "Made it to Lagos Deep. Late, but here." },
      ],
      verdicts: {
        0: "Mara did not reach Lagos in time. Silent tunnels cost more than time.",
        1: "Mara made it, slowly. Too many tunnels were silent.",
        2: "Mara and most of the Lagos nurses made it. The beacons you placed carried the news.",
        3: "Few beacons, well placed. Mara, the nurses and the supplies arrived. The dead zones cost minutes, not lives.",
      },
    },
    "grounding": {
      briefing: [
        "The tower is not coming back. The Directorate calls it a grounding and says it is temporary.",
        "Lagos needs nurses for weeks. You will see the first day, in time-lapse. A second wave of pods leaves once the first has landed.",
        "Expect more seals. Cairo, then London. Build a network that can lose a tunnel and keep talking.",
      ],
      broadcast: "THE GROUNDING IS TEMPORARY. TRAVEL WILL RESUME WITHIN DAYS.",
      prepTip: "Fifty beacons. Spread them. The Directorate will keep closing tunnels into Lagos.",
      maraLines: [
        { event: "tower-down", text: "The tower is down, and it is not coming back. That is the plan now." },
        { event: "seal-heard", text: "Another tunnel closed. The news is already moving. The pods are already going around." },
        { event: "reroute", text: "Longer way again. We keep the way open by moving." },
        { event: "yield", text: "Medicine first, then everyone else. Nobody argues. It is just the rule." },
        { event: "arrive", text: "First nurse in. I'm here. Send the rest." },
      ],
      verdicts: {
        0: "Lagos is running short. Tunnels closed faster than the news moved.",
        1: "Lagos has its first nurses. The sickness is not waiting.",
        2: "Lagos has nurses and supplies. The Directorate kept closing the doors. You kept finding others.",
        3: "A full day, three seals, and Lagos still has its nurses. Tomorrow will be harder. You know how to do it now.",
      },
    },
    "ghost-flight": {
      briefing: [
        "The Directorate has learned how Echo works: medicine goes first.",
        "Tonight it slips a pod of its own into the tunnels. It calls itself medical. Its signature is forged.",
        "There is no center to ask. Every beacon checks the signature itself. Keep Mara moving.",
      ],
      broadcast: "A MEDICAL CONVOY IS EN ROUTE. ALL FLIGHTS MUST GIVE WAY.",
      prepTip: "Every tunnel has a beacon. Watch the junction where the forged pod tries to jump the queue.",
      maraLines: [
        { event: "tower-down", text: "Tower's out. If anyone claims medical tonight, I want to see their signature." },
        { event: "seal-heard", text: "Lagos tunnel is closed. Rerouting. Medicine goes first. Real medicine." },
        { event: "credential-reject", text: "That pod claimed medical. The beacons read its signature. It does not match." },
        { event: "reroute", text: "Through São Paulo, again. The forged pod is not going to hold me." },
        { event: "arrive", text: "Lagos Deep. The beacons held the line, and so did the nurses." },
      ],
      verdicts: {
        0: "The line was easier to break than it looked.",
        1: "Mara made it. The forged pod did not keep her from Lagos.",
        2: "Mara made it and the ghost was turned away. Other nurses still arrived.",
        3: "The ghost was turned away. Every nurse arrived, and the supplies. No center had to say so.",
      },
    },
  },
  epilogue: [
    "Echo is a fallback. It works only where people built it beforehand.",
    "It is slower than a working tower. The center can fail, or be turned against you.",
    "In November 2026, every departure in the United States was halted for hours.",
    "Build the backup first.",
  ],
};
```

## 6. Story consistency (do not contradict the engine)

- **Times are minutes** (ticks), shown as `t+N`. The tower goes dark at minute 20. The Directorate seals the direct Sector 07 to Lagos tunnel at minute 30. Mara leaves Sector 07 at minute 31 and reroutes through São Paulo. In Echo she arrives around t+137 (Tower Down).
- **Beacons are battery radios** residents bolted into tunnels. They talk to neighbors only. They are not the Directorate's network. Say "beacon" or "radio," never "node" or "mesh."
- **Echo never opens a sealed tunnel.** It routes around it. Never imply the player can unseal.
- **Echo is slower.** Tower Down passengers wait about 2.4 times longer than on a normal day. Never claim Echo matches the tower.
- **Mission 2** has 40 beacons for 114 sectors. A pod waits 3 ticks, blind, before entering an unbeaconed sector. No beacons are pre-placed.
- **Mission 3** runs 1,440 minutes in time-lapse (one day, a stand-in for weeks). Seals: Lagos tunnel (t30), Cairo to Lagos (t300), London to Lagos (t700). A second wave of pods departs t200 to t700. Mara reaches Lagos early and her later lines are heard from there. Dispatch is automatic: the player only places beacons.
- **Mission 4** adds one fake medical pod from Sector 07 at minute 31, rejected for its forged signature. Signatures are simulated; say "forged," never "hacked."
- **The Directorate speaks only in BROADCAST lines.** Its numbers are false by design (Tower Down: "84 flights authorized", 5 flying).
- **Do not name a cause** for the November 2026 outage.
- **Mara is she/her.** The player is "you," never named or gendered.

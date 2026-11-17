// Canonical story text, pasted verbatim from docs/specs/echo/STORY.md §5 (do not retype; edit STORY.md and paste again).
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

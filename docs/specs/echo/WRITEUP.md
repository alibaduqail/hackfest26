# Echo: keeping essential movement going when the center fails

**Try it:** https://hollow-world-eight.vercel.app/ (opens on Tower Down, paused; press Run) · **Repo:** https://github.com/alibaduqail/hackfest26 (`hollow-world/`, `npm run harness`)

## The problem

In the Hollow, a network of underground cities, tunnel pods carry nurses, medicine, water and food between cities. Everyone still calls them flights, and one Directorate tower clears every one. One tower is one point of failure, and the Directorate can switch it off on purpose. When it goes dark, every flight stops, while its banner keeps claiming "84 flights authorized".

On Nov 13, 2026 the FAA halted every US departure for over four hours. We state no cause.

Echo addresses **#7** (organize and call for help without the central network) as the core, **#2** (water, food and medicine reach the deep cities, shared by need, medical first), **#9 in part** (nurses and supplies reach the outbreak city; we do not track the outbreak), and the lore: the Directorate controls movement and fakes its numbers. We do not claim #8 or #10.

## How Echo works

Every pod becomes its own navigator:

- It **carries the tunnel map**. Tunnels are physical and don't move.
- It **talks only to its neighbors** over trackside beacons: small battery radio relays residents install, one per sector, each talking only to the next beacon.
- It **follows three rules:** announce before you move; one pod per sector; medical first, then supply (water, food, medicine), then passengers. Only clinic-credentialed nurses can file medical.

When the Directorate seals a tunnel, the news hops beacon to beacon, one hop per minute, and every pod re-plans its own route around it. If a pod can't hear whether the next sector is clear, it waits. A dead beacon makes Echo slower, never unsafe.

**Precedents:** underground mines run node-to-node radio, required in US coal mines after the 2006 Sago disaster; airports without a tower run on pilots announcing intent on a shared frequency; people used phone mesh apps during internet shutdowns, such as Hong Kong in 2019.

## What the simulation shows

One seeded mission, Tower Down: 12 deep cities, 40 pods, the tower clears 6 flights and goes dark at minute 20, and at minute 30 the Directorate seals the direct Sector 07 to Lagos tunnel. Nurse Mara Vale's pod re-plans through São Paulo, a passenger pod yields to her, and she arrives at minute 137. Same seed, three runs (`npm run harness`):

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Flights moving / claimed by the tower | 5 / 84 | 40 / 84 | n/a |
| Passenger delay | 31.7× normal | 2.4× normal | 1.0× |
| Network capacity vs normal day | 5% | 94% | 100% |
| Mara arrives | never | t+137 | t+80 |

**Where Echo is worse:** passengers wait 2.4 times as long as on a normal day, the network runs at 94% of normal, and Mara's trip takes 137 minutes instead of 80. Echo is a fallback, not a replacement for the tower.

## What is simulated

- The credential check is a **simulated signature** (a deterministic hash), not cryptography.
- Pods, beacons and radio hops are a model: no hardware and no live peers. Tunnel lengths, sector times, the 18 flights per hour and the ×14 banner inflation are authored assumptions.
- The numbers come from one seeded mission, not a forecast.

## Questions we expect

- **Why not just a lock?** One pod per sector is a lock. The tower is the lock server. Echo grants those locks when the server is gone, with priority, announce and yield.
- **Who verifies nurses?** Clinics issue credentials before any outage, and pods check them locally with no network. In this build the signature is simulated.
- **What if they seal a tunnel?** Echo can't open it. Every pod carries the map, the news hops beacon to beacon, and pods route around it.

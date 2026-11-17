# Echo: keeping essential movement going when the center fails

**Echo is a playable simulation of the Hollow: you are the Relay, you place scarce radio beacons before the Directorate's tower goes dark, and the pods use only what you built.**

**Play:** https://hollow-world-eight.vercel.app/ (the game) · **Tower Down only:** https://hollow-world-eight.vercel.app/echo.html · **Repo:** https://github.com/alibaduqail/hackfest26

## The problem

In the Hollow, a network of underground cities, tunnel pods carry nurses, medicine, water and food between cities. Everyone still calls them flights, and one Directorate tower clears every one. One tower is one point of failure. The Directorate can also switch it off to punish a city. When it goes dark, every flight stops, yet its banner still claims "84 flights authorized".

In November 2026, every departure in the United States was halted for hours.

Echo addresses **#7** (organize and call for help without the central network) as the core, **#2** (water, food and medicine reach the deep cities, medical first), **#9 in part** (nurses and supplies reach the outbreak city; we do not track the outbreak), and the lore: the Directorate controls movement and fakes its numbers. We do not claim #8 or #10.

## How Echo works

Every pod becomes its own navigator:

- It **carries the tunnel map**.
- It **talks only to its neighbors** over trackside beacons: battery radio relays residents install, each talking only to the next.
- It **follows three rules:** announce before you move; one pod per sector; medical first, then supply, then passengers. Only clinic-credentialed nurses can file medical.

When the Directorate seals a tunnel, the news hops beacon to beacon and pods re-plan around it. A pod that cannot hear waits. A missing beacon makes Echo slower, never unsafe.

**Precedents:** US coal mines run node-to-node radio (required after the 2006 Sago disaster). Airports without a tower run on pilots announcing intent. Phone mesh apps served Hong Kong in 2019.

## The game

You are the Relay. Each mission has a briefing, a Prepare phase where you place beacons, a split-screen run (the Directorate alone on the left, Echo on the right), and a debrief with stars.

1. **Tower Down.** Every beacon is in place. Nurse Mara Vale leaves Sector 07 for Lagos Deep, the direct tunnel is sealed, and she reroutes through São Paulo.
2. **Dead Zones.** 40 beacons for 114 sectors. A pod in a silent sector waits, blind, before it enters. Your placement decides who waits.
3. **The Grounding.** The outage lasts a season, shown as one day in time-lapse. A second wave flies; three tunnels are sealed. 50 beacons.
4. **Ghost Flight.** The Directorate sends a fake medical pod with a forged signature. Beacons check it and reject it.

**The gameplay is the argument.** Echo needs no central server, but it needs radios in the tunnels. It works only where people built it beforehand.

## What the simulation shows

Tower Down: 12 deep cities, 40 pods. The tower goes dark at minute 20. At minute 30 the Directorate seals the Sector 07 to Lagos tunnel. Same seed, three runs (`npm run harness`):

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Flights moving / claimed | 5 / 84 | 40 / 84 | 40 / n/a |
| Passenger delay | 31.7× normal | 2.4× normal | 1.0× |
| Network capacity | 5% | 94% | 100% |
| Mara arrives | never | t+137 | t+80 |

**Beacon layouts (Dead Zones, `npm run harness:all`).** Everyone still arrives; placement changes the time. With no beacons, Mara arrives at t+167 and the last supply at t+201. With 40 beacons on the detour first: t+137 and t+189. With the best layout our search found: t+143 and t+162.

**Where Echo is worse:** passengers wait 2.4 times as long as on a normal day, the network runs at 94% of normal, and Mara's trip takes 137 minutes instead of 80. Echo is a fallback, not a replacement for the tower.

## What is simulated

- The credential check is a **simulated signature** (a deterministic hash), not cryptography.
- Pods, beacons and radio hops are a **model**: no hardware, no live peers. Tunnel lengths, sector times and the ×14 banner inflation are authored assumptions.
- **One seeded world.** The numbers show behavior in these scenarios, not a forecast.

## How it was built

Two students and a team of coordinated AI agents. The engine is headless and deterministic: the same seed gives the same numbers. It has 63 tests, and every pull request got an independent review before merging.

## Questions we expect

- **Why not just a lock?** One pod per sector is a lock. The tower is the lock server. Echo grants those locks when the server is gone, with priority, announce and yield.
- **Who verifies nurses?** Clinics issue credentials before any outage. Pods check them locally. Here the signature is simulated.
- **What carries broadcasts if the network is down?** Battery trackside beacons, each talking only to its neighbors. The Directorate can't switch off what it doesn't run.
- **Where is Echo worse?** Lower throughput than a working tower, and passengers wait longer. The scoreboard shows it.
- **Is it real?** Airports without towers already run this way.

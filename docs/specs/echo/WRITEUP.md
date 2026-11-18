# Echo: keeping essential movement going when the center fails

**Echo is a backup protocol for the Hollow's tunnels: battery beacons and three rules let pods keep moving, medicine first, when the Directorate's tower goes dark or lies. The game is how you plan and test it.**

**Play:** https://hollow-world-eight.vercel.app/ (the game) · **Tower Down only:** https://hollow-world-eight.vercel.app/echo.html · **Repo:** https://github.com/alibaduqail/hackfest26

## The problem

In the Hollow, a network of underground cities, tunnel pods carry nurses, medicine, water and food between cities. Everyone still calls them flights, and one Directorate tower clears every one — a single point of failure that can also go dark or lie. When it goes dark, every flight stops, yet its banner still claims "84 flights authorized".

In November 2026, every departure in the United States was halted for hours.

## How Echo works

Every pod becomes its own navigator:

- It **carries the tunnel map**.
- It **talks only to its neighbors** over trackside beacons: battery radio relays residents install, each talking only to the next.
- It **follows three rules:** announce before you move; one pod per sector; medical first, then supply, then passengers. Only clinic-credentialed nurses can file medical.

When the Directorate seals a tunnel, the news hops beacon to beacon and pods re-plan around it. A pod that cannot hear waits. A missing beacon makes Echo slower, never unsafe.

**Precedents:** US coal mines run node-to-node radio. Airports without a tower run on pilots announcing intent.

## Track problems addressed

One mechanism, five problems. Echo backs up movement, not shortages.

- **#7, organize without the Directorate's network.** Battery beacons talk only to neighbors. No center, no internet.
- **#9, numbers that don't match reality.** The tower claims 84 flights authorized while 5 move. Echo's picture comes from the pods' own announcements, so it shows what really moves.
- **#10, medicine runs out in the deep levels first.** Medical traffic goes first. Tower Down: 8 of 8 nurses and 10 of 10 supply runs arrive. We move medicine; we do not make it.
- **#5, a flooded tunnel cuts off a neighborhood.** A seal is passed hop by hop and pods reroute.
- **#2, share fairly.** Priority is fixed in advance: medical, then supply, then passengers. We do not allocate power.

## The game

You are the Relay. Each mission runs Briefing, Prepare (place beacons), a split-screen run (Directorate left, Echo right), then a debrief with stars.

1. **Tower Down.** Every beacon is in place. Nurse Mara Vale leaves Sector 07 for Lagos Deep, the direct tunnel is sealed, and she reroutes through São Paulo.
2. **Dead Zones.** 40 beacons for 114 sectors. A pod in a silent sector waits, blind, before it enters. Your placement decides who waits.
3. **The Grounding.** The outage lasts a season. A second wave flies; three tunnels are sealed. 50 beacons.
4. **Ghost Flight.** The Directorate sends a fake medical pod with a forged signature. Beacons check it and reject it.

**The gameplay is the argument.** Echo needs no central server, but it needs radios in the tunnels. It works only where people built it beforehand.

## The Descent

A five-level vertical cutaway shows the rules directly: the depot, a relay, a junction, a flooded shaft, the deep clinic. **Play the Descent** (title screen, or `/?screen=descent-live`) puts you in it live: as Mara and the medicine move through the shaft, you place five beacons on a budget. Two must warn the flood before the pods reach it, or both are trapped for good. The rest buy speed, each saving a pod a blind wait. Warn fast versus place for speed is the trade-off, tick by tick. You earn 0 to 3 stars for how fast Mara and the medicine arrive, and the screen can replay the three-star solution. A read-only cut, **See how Echo works**, narrates it without a clock.

## What the simulation shows

Tower Down: 12 deep cities, 40 pods, tower dark at minute 20, Lagos tunnel sealed at 30. Same seed, three runs (`npm run harness`):

| | Tower failed | Echo | Normal day |
|---|---|---|---|
| Nurses arrived | 0/8 | 8/8 | 8/8 |
| Supplies delivered | 0/10 | 10/10 | 10/10 |
| Flights moving / claimed | 5 / 84 | 40 / 84 | 40 / n/a |
| Passenger delay | 31.7× normal | 2.4× normal | 1.0× |
| Network capacity | 5% | 94% | 100% |
| Mara arrives | never | t+137 | t+80 |

**Beacon placement matters too (Dead Zones, `npm run harness:search`).** Everyone still arrives; placement changes the time, from t+167 with no beacons to t+143 with the best layout our search found.

**Where Echo is worse:** passengers wait 2.4× as long, the network runs at 94% of normal, and Mara's trip takes 137 minutes instead of 80. Echo is a fallback, not a replacement.

## What is simulated

- The credential check is a **simulated signature** (a deterministic hash), not cryptography.
- Pods, beacons and radio hops are a **model**: no hardware, no live peers, and tunnel lengths, sector times and the ×14 banner inflation are authored assumptions.
- **One seeded world:** the numbers show behavior in these scenarios, not a forecast.

## How it was built

Two students and a team of coordinated AI agents. The engine is headless and deterministic: the same seed gives the same numbers. It has 67 tests; every pull request got independent review.

## Questions we expect

- **Why not just a lock?** One pod per sector is a lock; the tower is the lock server. Echo grants those locks when the server is gone, with priority, announce and yield.
- **Who verifies nurses?** Clinics issue credentials before any outage; pods check them locally, with a simulated signature.
- **What carries broadcasts if the network is down?** Battery trackside beacons — nothing the Directorate runs, nothing it can switch off.
- **Where is Echo worse?** Lower throughput, longer passenger waits. The scoreboard shows it.

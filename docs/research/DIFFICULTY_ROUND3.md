# Descent difficulty, measured (round 3)

_Nov 20, 2026 · `@m_claude` · data from `hollow-world/scenarios/difficulty.ts` (`npx tsx scenarios/difficulty.ts`, seeded, repeatable) · answers judge finding 11 (the death spiral) and "neither gameplay judge won a Begin leg"._

Method: each player model is a function that turns a level into `placeBeacon` commands. The real engine (seeded floods, 8-tick telegraph, 2-tick build delay, early end) plays it out and the level's own star table scores it. **Win = at least 1 star**, which is what the journey counts as a won leg. Results are per flood candidate (each level has 3), then averaged. The models are not humans: they place perfectly on time, so real players will do worse than "GOOD" and a little different from "click anywhere".

## What the numbers say

**1. The cliff is the warning chain, not the retry cost.** Warning the sealed sector alone (what a first-timer does after reading "flood in 8") wins **0%** on every level, at every reaction time. Warning the sealed sector **and every link back to the fork** wins **100%**. There is no partial credit: one beacon short is a full loss.

| Level (budget) | click anywhere | route only | warns the flood tunnel only | GOOD: route, then full chain |
|---|---|---|---|---|
| I (5) | 38% | 33% | **0%** | 100% |
| II (7) | **0%** | **0%** | **0%** | 100% |
| III (6) | 48% | 100% | **0%** | 100% |

The random and route-only wins on I and III come from one flood each (`main0`, the sector right below the fork): a pod at the fork sees that seal without any news, so those floods are free passes. The other two floods per level (`main1`, `main2`) need 2 and 3 beacons on the chain. Level II has two floods and needs all four chain beacons: nothing naive wins it.

**2. How long the player has to answer (latest reaction, in ticks after the telegraph appears, that still wins):**

| Level | flood | ticks | at 1x | at 2x |
|---|---|---|---|---|
| I | main1 / main2 / main0 | 19 / 23 / (free) | 11.4 s / 13.8 s | 5.7 s / 6.9 s |
| II | A1B1 / A2B1 / A1B2 | 9 / 11 / 12 | 5.4 s / 6.6 s / 7.2 s | **2.7 s** / 3.3 s / 3.6 s |
| III | main1 / main2 / main0 | 10 / **7** / (free) | 6.0 s / **4.2 s** | 3.0 s / **2.1 s** |

Level I is relaxed. Levels II and III leave 2 to 4 seconds at 2x, which is under a first-timer's find-the-sector-and-click time. The screen's auto slow-mo (0.35x inside the telegraph window) stretches this about 2.9x while it is active; it only covers the 10 ticks before the seal, so most of the slack after the seal is real time.

**3. Retries: a free first retry helps the late-but-informed player; it does nothing for the uninformed one.** Journey Monte Carlo, 5000 players, 15 beacons + 4 from outfitting, clock 30 → limit 390:

| Player (per-leg win I / II / III) | current rules | free first retry | retry keeps beacons |
|---|---|---|---|
| GOOD, answers in time (100 / 100 / 100) | 100% saved, clock 353 | same | same |
| GOOD but 9 ticks late (100 / 100 / 67) | **68%** saved | **90%** saved | 68% |
| Warns the flood tunnel only (0 / 0 / 0) | 0% | 0% | 0% |
| Click anywhere (38 / 0 / 48) | 0% | 0% | 0% |

Retry cost is not the lever for a player who does not know the chain rule: they lose every attempt under every rule. It is a real lever only for a player who knows the rule and is slow.

## Recommendations (numbers, cheapest first)

1. **Telegraph the chain, not just the sector** (UI, no engine or hash change). When the flood appears, mark the sealed sector **and every link back to the fork** as "warn here", with the count ("3 beacons"). Today the HUD names one sector; one sector is 0%. This is the single change that moves a first-timer from 0% to winnable.
2. **Free first retry per leg** (journey.ts, one condition in `completeLeg`, I can do it with tests): the first failure of a leg costs no clock, no placed beacons and no dose. +22 points of Saved for slow-but-informed players (68% to 90%), no effect on careful ones. "Never enter a leg with 0 beacons" is already enforced by the Scavenge guard.
3. **More time on levels II and III:** pass `revealLead: 12` for those legs (the option already exists, journey `mods.revealLead`). That adds 4 ticks (2.4 s at 1x, 1.2 s at 2x) to a window that is 2 to 4 s at 2x today. Leave level I at 8.
4. **Do not** retune star deadlines or the budgets: with the full chain every level is 100% winnable, and the 3-star tier is still rare (33% of floods on level I with a generic route), so the top of the scale is intact.

## Limits

Models, not people: no mis-clicks, no hesitation, perfect timing. The conclusion that matters (one beacon short is a total loss; two of three levels leave under 4 s at 2x) is structural and would hold for any player. The unmeasured part is how many first-timers discover the chain rule on their own; recommendation 1 is aimed at exactly that.

## Raw output

```
Per leg, win = at least 1 star, over every flood candidate of the level (reveal lead 8, build delay 2 ticks). 3* = the top tier.

descent-live  (3 flood candidates; budget 5)
  win   0%  3*   0%  per-flood [  0%   0%   0%]  no beacons
  win  38%  3*   3%  per-flood [ 14%   3%  97%]  click anywhere (random sectors, random time 0-60)
  win  33%  3*  33%  per-flood [  0%   0% 100%]  route only (ignores the flood)
  win  33%  3*  33%  per-flood [  0%   0% 100%]  all at t0 on the first dark sectors
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 0 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 3 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 6 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 0 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 3 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 6 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 9 ticks after the telegraph

descent-live-2  (3 flood candidates; budget 7)
  win   0%  3*   0%  per-flood [  0%   0%   0%]  no beacons
  win   0%  3*   0%  per-flood [  0%   0%   0%]  click anywhere (random sectors, random time 0-60)
  win   0%  3*   0%  per-flood [  0%   0%   0%]  route only (ignores the flood)
  win   0%  3*   0%  per-flood [  0%   0%   0%]  all at t0 on the first dark sectors
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 0 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 3 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 6 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 0 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 3 ticks after the telegraph
  win 100%  3*  33%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 6 ticks after the telegraph
  win 100%  3*   0%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 9 ticks after the telegraph

descent-live-3  (3 flood candidates; budget 6)
  win   0%  3*   0%  per-flood [  0%   0%   0%]  no beacons
  win  48%  3*   1%  per-flood [ 40%   5% 100%]  click anywhere (random sectors, random time 0-60)
  win 100%  3*   0%  per-flood [100% 100% 100%]  route only (ignores the flood)
  win 100%  3*   0%  per-flood [100% 100% 100%]  all at t0 on the first dark sectors
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 0 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 3 ticks after the telegraph
  win   0%  3*   0%  per-flood [  0%   0%   0%]  warns the sealed sector only, 6 ticks after the telegraph
  win 100%  3*   0%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 0 ticks after the telegraph
  win 100%  3*   0%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 3 ticks after the telegraph
  win 100%  3*   0%  per-flood [100% 100% 100%]  GOOD: route first, then the full warning chain 6 ticks after the telegraph
  win  67%  3*   0%  per-flood [100%   0% 100%]  GOOD: route first, then the full warning chain 9 ticks after the telegraph

How long the player has (ticks after the telegraph the full warning chain can still be placed and the leg is still won; the telegraph itself shows 8 ticks before the seal):
  descent-live/main1: 19 ticks (= 11.4 s at 1x, 5.7 s at 2x)   descent-live/main2: 23 ticks (= 13.8 s at 1x, 6.9 s at 2x)   descent-live/main0: 40 ticks (= 24.0 s at 1x, 12.0 s at 2x)
  descent-live-2/A1B1: 9 ticks (= 5.4 s at 1x, 2.7 s at 2x)   descent-live-2/A2B1: 11 ticks (= 6.6 s at 1x, 3.3 s at 2x)   descent-live-2/A1B2: 12 ticks (= 7.2 s at 1x, 3.6 s at 2x)
  descent-live-3/main1: 10 ticks (= 6.0 s at 1x, 3.0 s at 2x)   descent-live-3/main2: 7 ticks (= 4.2 s at 1x, 2.1 s at 2x)   descent-live-3/main0: 40 ticks (= 24.0 s at 1x, 12.0 s at 2x)

Journey Monte Carlo (5000 players, 15+4 beacons after outfitting, start clock 30, limit 390): P(Saved) / P(finishes all 3 legs) / mean clock

  click anywhere (random sectors, random time 0-60)  (per-leg win  38%   0%  48%)
      0% saved    0% finish  clock 445  current rules (retry costs ticks+15, placed beacons lost, -1 dose)
      0% saved    0% finish  clock 429  free first retry (no clock, beacons or dose lost the first time a leg fails)
      0% saved    0% finish  clock 437  retry keeps the beacons you had (clock and dose still cost)

  warns the sealed sector only, 3 ticks after the telegraph  (per-leg win   0%   0%   0%)
      0% saved    0% finish  clock 419  current rules (retry costs ticks+15, placed beacons lost, -1 dose)
      0% saved    0% finish  clock 419  free first retry (no clock, beacons or dose lost the first time a leg fails)
      0% saved    0% finish  clock 394  retry keeps the beacons you had (clock and dose still cost)

  GOOD: route first, then the full warning chain 3 ticks after the telegraph  (per-leg win 100% 100% 100%)
    100% saved  100% finish  clock 353  current rules (retry costs ticks+15, placed beacons lost, -1 dose)
    100% saved  100% finish  clock 353  free first retry (no clock, beacons or dose lost the first time a leg fails)
    100% saved  100% finish  clock 353  retry keeps the beacons you had (clock and dose still cost)

  GOOD: route first, then the full warning chain 6 ticks after the telegraph  (per-leg win 100% 100% 100%)
    100% saved  100% finish  clock 353  current rules (retry costs ticks+15, placed beacons lost, -1 dose)
    100% saved  100% finish  clock 353  free first retry (no clock, beacons or dose lost the first time a leg fails)
    100% saved  100% finish  clock 353  retry keeps the beacons you had (clock and dose still cost)

  GOOD: route first, then the full warning chain 9 ticks after the telegraph  (per-leg win 100% 100%  67%)
     68% saved   90% finish  clock 401  current rules (retry costs ticks+15, placed beacons lost, -1 dose)
     90% saved   97% finish  clock 368  free first retry (no clock, beacons or dose lost the first time a leg fails)
     68% saved   90% finish  clock 391  retry keeps the beacons you had (clock and dose still cost)
```

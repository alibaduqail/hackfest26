# Patriot HackFest Fall 2026 — Where We Are

_Last updated: Saturday, Nov 14, 2026_

## Event basics

- **Format:** Virtual. Run by PatriotHacks, CS Club, and HackOverflow (Mason's hardware hackathon club).
- **Sponsors:** Microsoft, MetroStar, Caelon, Drums, Runtime. No sponsor prizes announced, so we're not forcing their tech in.
- **Building:** Sat Nov 14, 9 AM → **Fri Nov 20, 11 PM ET**. No extensions. (The PDF's submission section says "Saturday, Nov 20th." That's a typo: Nov 20 is a Friday.)
- **Submissions** open Sun Nov 15 on the organizers' own judging platform. Exact requirements are still to come.
- **Judging:** Nov 21–24. **Winners:** Nov 25.
- **Rules:**
  - Teams of 1–4. Only team members contribute.
  - No coding before the event or during judging.
  - No late submissions.
  - AI tools are allowed.
  - Be respectful.
- **Team** must be entered in the system when we submit. No edits after.
- **Judging criteria:** not published. The only hint is that one solution covering several of the track's problems "can strengthen your project in judging."

## The track: Life underground (the Hollow)

It's 2087. The surface is wrecked, and two billion people live underground in **the Hollow**, a city of tunnels stacked in levels. The government, **the Directorate**, controls air, power, the network, and movement between levels. Upper levels get light and fresh air. The deeper you go, the darker, hotter, and sicker it gets, and blackouts hit the bottom first. Now everything is failing, the Directorate's numbers don't match reality, and people wonder if the surface is safe again.

Basically: Fallout Shelter, but the Overseer is the bad guy.

**The 15 problems (short versions, numbered like the official doc):**

1. Warn people before power or air cuts out
2. Share power, water, and food fairly when there isn't enough
3. Keep the hot deep levels livable
4. Catch bad water before people drink it
5. Keep tunnels safe from sewage and flooding
6. Make or share space in overcrowded rooms
7. Organize and call for help without the Directorate's network
8. Reconnect families split across levels during blackouts
9. Track the real lung-sickness outbreak and get supplies where needed
10. Get basic care to people far from a clinic
11. Track and treat what living without sunlight does to people
12. Help a neighborhood grow and share its own food
13. Prove whether the surface is safe and tell everyone
14. Figure out which gear (suits, domes, outposts) works and who goes up first
15. Plan the mass move back to the surface

Two paths are allowed: make life underground more sustainable, or help people get back up. Pick one problem or combine several.

## What we learned from brainstorming

Earlier AI-generated ideas didn't land because:

- They were tools for managers (repair planners, schedulers, simulators), not regular people.
- Pitches explained the mechanism instead of why you'd care, with disclaimers stacked on top.
- Demos needed a tutorial before the payoff.
- Many were built for real-world disasters before anyone read the Hollow brief, then just renamed.
- The "top pick" kept changing, round after round.

**Our bar for the project:**

- Explainable in one breath
- A situation people recognize from games, movies, or TV
- A physical piece as a differentiator (nice to have, not required)
- The payoff shows up in a plain screen-recorded demo. No cinematic video needed.
- Fits the Hollow literally

## Direction

- **Build it as a web game:** a side view of the Hollow, like Fallout Shelter.
- **The game is the world. The project is the fix we put into it.** The video runs the city the Directorate's way, then turns on our fix and shows the difference.
- **Step 1: build the Hollow.** Every idea needs this part:
  - 8 floors, rich at the top and poor at the bottom
  - Per floor: power, air, heat, water, food, sickness, population
  - A failing power plant
  - A clock that updates every floor every second
  - The Directorate's rule: top floors get served first
- **Step 2: pick the fix by Sunday night (Nov 15).** The world changes slightly depending on the fix, and judges score the fix, not the world.
- If we finish early, add a second fix to the same world to cover more problems.

## Candidate fixes

| Fix | One-line pitch | Problems | Physical add-on |
|---|---|---|---|
| **Fair Share** (front-runner) | When power runs short, our system decides where it goes so nobody on the bottom floors loses air, water, or food. | #1, #2, #3 | Knob that controls the power plant |
| **Word of Mouth** | The government kills the internet, and warnings still spread by hopping from person to person. | #7, #8, #1 | Two ESP32 radios passing a real message (we only have one board) |
| **Real Numbers** | The government says 12 people are sick, and our map shows the real number. | #9, #10, partly #4 | Air sensor that counts as one room in the game |

### Fair Share in detail

- **Each floor has:** families, air fans, a water pump, grow lamps (food), regular lights, and a health bar.
- **Directorate mode:** top floors get everything first. Bottom floors go dark, fans stop, it gets hot, and the farms die.
- **Our mode:** every floor gets air, water, and food first. Lights and extras get whatever is left.
- **Warnings:** each floor sees how long it has left (e.g. "Floor 7: air cuts out in 2 hours").
- **Video:** the same blackout runs twice, side by side. Left: "people in danger: 400." Right: "people in danger: 0." Then a phone shot of a hand turning the knob.

## Tech

- **App:** React + TypeScript, PixiJS for the game screen, hosted on Vercel so judges can open a link.
- **Simulation:** rooms are just data. A clock updates them every second, and one swappable function decides who gets power.
- **Art:** free asset packs (e.g. Kenney). Nothing from Fallout.
- **Hardware:**
  - The Flipper Wi-Fi dev board is an ESP32-S2 with GPIO pins. It can run our own Arduino or CircuitPython code on its own, plugged into the laptop by USB-C.
  - Add a potentiometer and three jumper wires. Chrome reads the knob through the Web Serial API.
  - Flashing our code replaces the board's stock debug firmware.
  - The Jetson Orin Nano isn't needed.
- **Video:** a plain screen recording plus a phone shot of the hardware.

## Schedule (assuming Fair Share)

| Day | Goal |
|---|---|
| Sat Nov 14 | Floors, clock, and the Directorate's rule running with plain colored boxes |
| Sun Nov 15 | **Pick the fix.** Add warnings and counters. Read the submission requirements. |
| Mon–Tue | Art and the knob |
| Wed | Feature freeze. Test. |
| Thu | Record the video and write it up |
| Fri Nov 20 | Submit by the evening. The deadline is 11 PM ET. |

## Open items

- [ ] Pick the fix by Sunday night
- [ ] Watch mode vs. play mode: start with watch (flip a switch between rules), add play (player moves power around) if there's time
- [ ] Art style: pixel art vs. simple shapes
- [ ] Get a potentiometer and jumper wires (Micro Center)
- [ ] Read the submission requirements when they post on Nov 15: video length, repo, live link

## Sources

- Patriot HackFest Fall 2026 Event Information (organizer PDF)
- [Life underground track doc](https://docs.google.com/document/d/1sz_UdwRzvyL1dVbcbqLnUdJwVHvOUWARg4B79VmKgaE)
- [Flipper Wi-Fi Developer Board docs](https://docs.flipper.net/development/hardware/wifi-developer-board)

# Asset credits

All room furnishings, people, pipes, lamps, crop beds, machinery, lift/corridor geometry, cargo, surface silhouette, and UI artwork are original procedural vector art authored for this project in `src/world/render.ts`. Character textures are generated locally from those original shapes. No Fallout assets, external asset packs, remote images, fonts, or audio are included.

The presentation uses an isometric sectional model. The Hearth and Strata concept images were generated for visual exploration; neither image is used as a runtime backdrop or asset. The Hollow's fictional setting comes from the Patriot HackFest brief linked in the specification. Third-party software licenses remain in their packages (React, PixiJS, Vite, TypeScript and tooling).

## Fonts

- **Fraunces** (display serif), copyright The Fraunces Project Authors (Undercase Type), licensed under the SIL Open Font License 1.1.
- **IBM Plex Mono**, copyright IBM Corp., licensed under the SIL Open Font License 1.1.

The latin-subset woff2 files are self-hosted in `hollow-world/public/fonts/`; no font is loaded from a remote service. Both licenses permit this redistribution.

## Characters

Character portraits and sprites for Mara and the Director are original pixel art drawn for this project.

## Sound

- **Kenney "Impact Sounds" and "Interface Sounds"** (https://kenney.nl/assets/impact-sounds, https://kenney.nl/assets/interface-sounds), created by Kenney, released under Creative Commons Zero (CC0 1.0). Fifteen short clips are used, as `public/audio/{place,remove,tap,seal,relay}-{0,1,2}.ogg`: `impactMetal_medium_000-002` (place), `impactMetal_light_000-002` (remove), `impactSoft_medium_000-002` (tap), `impactPlate_heavy_000-002` (seal), `click_002-004` (relay). They are loaded after the first click or key press and played lowpassed, pitch-shifted and through a reverb.
- Everything else (bell, rumble, pebbles, flood rush, start swell, ambience hum and drips, and the fallback for every cue above if a sample fails to load) is synthesized at runtime in `src/echo-view/game/soundkit.ts` and `voices.ts`.

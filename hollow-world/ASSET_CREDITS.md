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

All sound effects are synthesized at runtime in `src/echo-view/game/soundkit.ts` and `voices.ts` (filtered noise, sine partials, a generated reverb impulse). No audio files or third-party samples are shipped.

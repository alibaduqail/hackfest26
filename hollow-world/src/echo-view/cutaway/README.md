# The Descent cutaway

From `hollow-world/`, run `npm ci` and `npm run dev`, then select **See how Echo works** on the title screen or open `/cutaway.html`. The production build (`npm run build`) also serves this page from `dist/cutaway.html`. All five levels use the same Descent mission. Switching Tower/Echo keeps the simulation clock fixed.

Select a named beat to inspect the observation that shows its rule. **Seal + reroute** opens at the first observation after Mara hears the seal and changes route (currently t+44). Tower mode uses the same capture tick. One minute of simulation passes per step. Space toggles playback, the arrows step forward/back, and T/E switch systems. With reduced motion, playback and stepping jump to settled beat states. A background tab pauses.

For capture, use `/cutaway.html?beat=3&mode=echo`. Add `&autoplay=1` to start playback or `&clean=1` to hide its controls. Full playback at 1× takes about 44 seconds. Test at 1920×1080 and 1440×900. Capture with OS reduced motion off for event frames and on for settled frames. Run `npm test` for the cutaway and engine checks.

The plate, original crew and pod sprites are in `art/`. Moving pods, stock, gate, lamps, labels, and occupied sections are drawn separately. The preview uses the existing engine and includes no recorded timeline. See the [game spec](../../../../docs/specs/echo/GAME.md) and [Descent contract](../../../../docs/specs/echo/DESCENT.md).

To share a single offline file, run `node src/echo-view/cutaway/export.mjs` from `hollow-world/`. The exported [cutaway-mockup/index.html](../../../../cutaway-mockup/index.html) includes the engine, artwork, and controls. Open it directly in a browser. Edit the source page and rerun the export to refresh it.

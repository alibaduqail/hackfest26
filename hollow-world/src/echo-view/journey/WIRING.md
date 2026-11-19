# Journey screens: wiring (#110)

Props-only components in `src/echo-view/journey/`. No engine calls, no storage, no import of `src/echo/journey.ts`.
Prop types are in `props.ts` and mirror the #107 contract field for field, so state passes straight through.

```tsx
import { TitleScreen, CampScreen, EndingScreen, TrailMap } from "./journey"; // index.ts also imports journey.css
```

Mount the existing `<Backdrop />` behind them (as GameApp does for the Title). The screens use `.g-screen`, so they scroll on their own.

## TitleScreen
`<TitleScreen onBegin onContinue? onTowerDown? onStrata? onFreePlay? />`
- `onBegin`: `startJourney()` then show the camp. Enter also triggers it.
- Each optional handler shows its button/link only when given (`onContinue` = a saved journey exists).

## CampScreen
```tsx
<CampScreen
  key={`${s.legIndex}-${s.attempt}`}   // remounts per camp (it also resets itself when these change)
  event={campEvent(s)}                 // CampEvent
  res={s.res}  limit={300}  legIndex={s.legIndex}  attempt={s.attempt}  log={s.log}
  onPick={(id) => sfx()}               // optional: a choice was locked in; state is NOT advanced yet
  onContinue={(id) => setS(choose(s, id))}  // "Continue down" / Enter: apply the choice, go to the leg
/>
```
- The player picks a choice (click, or keys 1-9), sees its reveal line and the supplies preview the effect, then presses *Continue down* (button or Enter).
- `onContinue` is the only place to call `choose()`. Picking is final; a new `event.id`/`legIndex`/`attempt` resets the screen.
- Each choice shows its cost from `choice.effect` (beacons, doses, minutes lost/saved, `nextRevealLead: 0` as "no flood warning").
- `legIndex` = legs finished (0 is outfitting), so the trail map shows legs before it as done and the next leg in amber. Stars come from `log`.

## EndingScreen
```tsx
<EndingScreen ending={ending(s)} res={s.res} limit={300} log={s.log}
  choiceNames={{ camp1: "The tower lies", "camp1/verify": "Verified through the beacons" }} // optional
  onAgain={() => setS(startJourney())} />
```
- `ending` is `{ kind, score, title, lines }`. All `lines` render as paragraphs; the **last line is styled as the closing line**, so put the tower comparison last.
- `choiceNames`: keys are an event id (heading for that choice row) or `${eventId}/${choiceId}` (the choice). Missing keys fall back to the humanized ids.
- Trail log: every leg attempt (stars, minutes, beacons placed, "failed, retried") and every camp choice, in order.
- Enter or *Begin again* calls `onAgain`.

## TrailMap
`<TrailMap legIndex={s.legIndex} log={s.log} />` (already inside CampScreen and EndingScreen; use it alone if a leg screen wants it).
Levels per leg: Descent I = Upper depot + Relay level, II = Junction + Flooded shaft, III = Deep clinic. Pass `legIndex={3}` for the ending.

## Notes
- `ResourceBar` (`{res, limit, preview?}`) is exported from `ResourceBar.tsx` if the leg screen wants the same supplies strip.
- Keys: 1-9 choose, Enter continues. Enter is ignored while a button has focus (the button handles it), so nothing fires twice.
- Desktop only. Tokens come from `theme.ts` (`installTheme()` must have run). Reduced motion is respected.
- `sample.ts` holds sample props (used by `src/echo-view/journey-screens.test.ts`); not needed at runtime.

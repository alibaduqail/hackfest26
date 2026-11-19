# Mounting LiveIntro and LiveDebrief in LiveScreen (m_sol)

No existing file was edited. Three small changes in `LiveScreen.tsx` (plus one in `useLive.ts` if you want the intro to hold the clock):

1. `import { LiveIntro } from "./LiveIntro"; import { LiveDebrief } from "./LiveDebrief"; import "./intro-debrief.css";` (components do not import the css so they render in node tests.)
2. Intro: keep `const [introDone, setIntroDone] = useState(false);` and render `{!introDone && <LiveIntro mission={mission} onStart={() => setIntroDone(true)} />}` as the last child of the root `.descent-live` div. Gate play on it: the run must not start (no auto-step, no first-placement start) until `introDone`. Reset `introDone` to false in `restart()` only if you want the card on every retry; I would show it once. The Start button has autoFocus and handles Space/Enter natively; LiveScreen's window Space handler already ignores presses on buttons.
3. Debrief: replace the whole `<section className="live-debrief">…</section>` inside `over ? (...)` with
   `<LiveDebrief mission={mission} commands={live.commands} stars={stars} onRetry={() => restart(false)} onWatchSolution={() => restart(true)} />`
   (`onNext` is optional; pass it when Descent II exists.) `live.commands` is the accepted command log from `useLive`; it is the player's save, so `runBaseline` replays exactly what they did, including in `watchSolution` mode.
4. Hints: `import { nextHint } from "./hints"`; once per run keep `const seen = useRef(new Set<number>())`, and when `nextHint(obs, seen.current)` returns a hint, show `text` as a small caption for ~6 s and `seen.current.add(level)`. Level 1's hint is already on the intro card (pass `hint={null}` to LiveIntro if you show it elsewhere).

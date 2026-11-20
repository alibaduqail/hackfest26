// Echo game sound: Web Audio synthesis only, no asset files (see soundkit.ts for the bus, voices.ts for the cues). Muted by default; the choice is kept in localStorage.
// Every access is guarded: with storage blocked the choice lives in memory, with no AudioContext (Node, old browsers) every call is a no-op.
// The context is created or resumed on the first user gesture only (autoplay policy); play() never creates it, so a page that loads with sound left on stays silent and context-free until then. The video-capture page (echo.html) never imports the toggle, so it stays silent.
import { getCtx, logCue, startAmbience, stopAmbience, unlockContext } from "./soundkit";
import { voices } from "./voices";

const KEY = "echo-sound-v1";
const MIN_GAP_MS = 80; // the same sound never fires more than ~12x a second (fast-forward)

export type Sound = "place" | "remove" | "empty" | "down" | "seal" | "yield" | "chime" | "start" | "star";

let on: boolean | null = null; // null = not read yet
let wantAmbience = false;
const last = new Map<Sound, number>();
const subs = new Set<() => void>();

export function isMuted(): boolean {
  if (on === null) {
    try { on = localStorage.getItem(KEY) === "on"; } catch { on = false; }
  }
  return !on;
}
export function setMuted(muted: boolean) {
  on = !muted;
  try { localStorage.setItem(KEY, muted ? "off" : "on"); } catch { /* storage blocked: memory only */ }
  if (!muted) unlock();
  syncAmbience();
  subs.forEach((f) => f());
}
export const toggleMuted = () => setMuted(!isMuted());
export function subscribe(f: () => void) { subs.add(f); return () => void subs.delete(f); }

/** Create or resume the AudioContext. Call from a user gesture. */
export function unlock() {
  unlockContext();
  syncAmbience();
}
/** Ask for the quiet cave ambience (faint hum, far drips) while a run is going; false stops it. Honours the mute switch. */
export function ambience(want: boolean) {
  logCue("ambience", want);
  wantAmbience = want;
  syncAmbience();
}
function syncAmbience() {
  try { if (wantAmbience && !isMuted()) startAmbience(); else stopAmbience(); } catch { /* audio is garnish */ }
}
/** Browsers need a gesture before audio starts: resume on the first click or key (game screens only). */
export function unlockOnFirstGesture() {
  if (typeof addEventListener !== "function") return () => {};
  const go = () => unlock();
  addEventListener("pointerdown", go, { once: true });
  addEventListener("keydown", go, { once: true });
  return () => { removeEventListener("pointerdown", go); removeEventListener("keydown", go); };
}

/** Play a sound if unmuted. `i` picks the pitch of a star ping. Never throws. */
export function play(name: Sound, i = 0) {
  logCue("play", name, i);
  if (isMuted()) return;
  try {
    const ctx = getCtx();
    if (!ctx || ctx.state !== "running") return;
    const now = performance.now();
    if (now - (last.get(name) ?? -Infinity) < MIN_GAP_MS && name !== "star") return;
    last.set(name, now);
    if (name === "star") voices.star(i); else voices[name]();
  } catch { /* audio is garnish: never break the game */ }
}

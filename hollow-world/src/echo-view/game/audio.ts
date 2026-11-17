// Echo game sound: Web Audio synthesis only, no asset files. Muted by default; the choice is kept in localStorage.
// Every access is guarded: with storage blocked the choice lives in memory, with no AudioContext (Node, old browsers) every call is a no-op.
// The context is created or resumed on the first user gesture only (autoplay policy); play() never creates it, so a page that loads with sound left on stays silent and context-free until then. The video-capture page (echo.html) never imports the toggle, so it stays silent.
const KEY = "echo-sound-v1";
const MASTER = 0.5;
const MIN_GAP_MS = 80; // the same sound never fires more than ~12x a second (fast-forward)

export type Sound = "place" | "remove" | "empty" | "down" | "seal" | "yield" | "chime" | "start" | "star";

let on: boolean | null = null; // null = not read yet
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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
  subs.forEach((f) => f());
}
export const toggleMuted = () => setMuted(!isMuted());
export function subscribe(f: () => void) { subs.add(f); return () => void subs.delete(f); }

/** Create or resume the AudioContext. Call from a user gesture. */
export function unlock() {
  try {
    if (!ctx && typeof AudioContext !== "undefined") {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER;
      master.connect(ctx.destination);
    }
    if (ctx?.state === "suspended") void ctx.resume();
  } catch { ctx = null; }
}
/** Browsers need a gesture before audio starts: resume on the first click or key (game screens only). */
export function unlockOnFirstGesture() {
  if (typeof addEventListener !== "function") return () => {};
  const go = () => unlock();
  addEventListener("pointerdown", go, { once: true });
  addEventListener("keydown", go, { once: true });
  return () => { removeEventListener("pointerdown", go); removeEventListener("keydown", go); };
}

interface Tone { f: number; dur: number; at?: number; to?: number; type?: OscillatorType; vol?: number; lp?: number; attack?: number }
/** One oscillator through an exponential decay (and an optional lowpass). */
function tone(t0: number, { f, dur, at = 0, to = f, type = "sine", vol = 0.15, lp, attack = 0.005 }: Tone) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + at;
  o.type = type;
  o.frequency.setValueAtTime(f, s);
  if (to !== f) o.frequency.exponentialRampToValueAtTime(to, s + dur);
  g.gain.setValueAtTime(0.0001, s);
  g.gain.linearRampToValueAtTime(vol, s + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  let node: AudioNode = o;
  if (lp) { const b = ctx.createBiquadFilter(); b.type = "lowpass"; b.frequency.value = lp; o.connect(b); node = b; }
  node.connect(g).connect(master);
  o.start(s);
  o.stop(s + dur + 0.05);
}

// All under 600 ms except the start swell. Volumes are low on purpose.
const VOICES: Record<Sound, (t: number, i: number) => void> = {
  place: (t) => tone(t, { f: 880, dur: 0.09, type: "triangle", vol: 0.14 }), // soft tick
  remove: (t) => tone(t, { f: 440, dur: 0.08, type: "triangle", vol: 0.14 }), // lower tick
  empty: (t) => tone(t, { f: 95, to: 80, dur: 0.2, type: "sawtooth", vol: 0.12, lp: 400 }), // dull buzz
  down: (t) => tone(t, { f: 220, to: 40, dur: 0.6, type: "sawtooth", vol: 0.1, lp: 900, attack: 0.03 }), // falling tone
  seal: (t) => { tone(t, { f: 110, to: 38, dur: 0.35, vol: 0.3 }); tone(t, { f: 70, to: 40, dur: 0.25, type: "triangle", vol: 0.2, lp: 200 }); }, // low thud
  yield: (t) => { tone(t, { f: 660, dur: 0.09, vol: 0.1 }); tone(t, { f: 880, dur: 0.12, at: 0.1, vol: 0.1 }); }, // two notes
  chime: (t) => [523.25, 659.25, 783.99].forEach((f, k) => tone(t, { f, dur: 0.5, at: k * 0.12, vol: 0.1 })), // gentle major triad
  start: (t) => { tone(t, { f: 55, dur: 1.4, vol: 0.2, attack: 0.7 }); tone(t, { f: 82.5, dur: 1.4, vol: 0.08, attack: 0.7 }); }, // soft drone swell
  star: (t, i) => tone(t, { f: [784, 988, 1175][Math.min(i, 2)], dur: 0.35, vol: 0.12 }), // one ping per star, rising
};

/** Play a sound if unmuted. `i` picks the pitch of a star ping. Never throws. */
export function play(name: Sound, i = 0) {
  if (isMuted()) return;
  try {
    if (!ctx || ctx.state !== "running") return;
    const now = performance.now();
    if (now - (last.get(name) ?? -Infinity) < MIN_GAP_MS && name !== "star") return;
    last.set(name, now);
    VOICES[name](ctx.currentTime, i);
  } catch { /* audio is garnish: never break the game */ }
}

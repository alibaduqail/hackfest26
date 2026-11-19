// Live Descent sound effects: Web Audio synthesis only, no asset files.
// Reuses game/audio.ts's mute flag (isMuted) so the one settings Sound switch controls both modules, and copies its
// tone()/unlock() pattern: a lazily-created AudioContext, resumed only on a user gesture (autoplay policy).
// Every gain ramp-down targets GAIN_FLOOR, never 0 (exponentialRampToValueAtTime rejects a literal 0 target).
import { isMuted } from "../../game/audio";

const MASTER = 0.6; // PLAYABLE_DESCENT.md §4 Mix note
const MIN_GAP_MS = 40; // per-event cooldown, same note
const GAIN_FLOOR = 0.001;
const HOP_IDLE_RESET_MS = 800;
const HOP_STEP = 2;
const HOP_CAP = 12;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayedAt = new Map<string, number>();
let hopStreak = 0;
let lastHopAt = -Infinity;

/** Create (once) and resume the shared AudioContext. Call from a user gesture. */
export function unlock() {
  try {
    if (!ctx && typeof AudioContext !== "undefined") {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = MASTER;
      const compressor = ctx.createDynamicsCompressor();
      master.connect(compressor);
      compressor.connect(ctx.destination);
    }
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
    master = null;
  }
}
/** Mirrors game/audio.ts's unlockOnFirstGesture: resumes on the first click or key, game screens only. */
export function unlockOnFirstGesture() {
  if (typeof addEventListener !== "function") return () => {};
  const go = () => unlock();
  addEventListener("pointerdown", go, { once: true });
  addEventListener("keydown", go, { once: true });
  return () => {
    removeEventListener("pointerdown", go);
    removeEventListener("keydown", go);
  };
}

function shouldPlay(name: string, now: number): boolean {
  if (isMuted()) return false;
  if (!ctx || ctx.state !== "running") return false;
  const prev = lastPlayedAt.get(name) ?? -Infinity;
  if (name !== "star" && now - prev < MIN_GAP_MS) return false;
  lastPlayedAt.set(name, now);
  return true;
}

interface Tone { f: number; dur: number; at?: number; to?: number; type?: OscillatorType; vol?: number }
/** One oscillator through an exponential decay to GAIN_FLOOR (never 0). */
function tone(t0: number, { f, dur, at = 0, to = f, type = "sine", vol = 0.15 }: Tone) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + at;
  o.type = type;
  o.frequency.setValueAtTime(f, s);
  if (to !== f) o.frequency.exponentialRampToValueAtTime(to, s + dur);
  g.gain.setValueAtTime(GAIN_FLOOR, s);
  g.gain.linearRampToValueAtTime(vol, s + 0.005);
  g.gain.exponentialRampToValueAtTime(GAIN_FLOOR, s + dur);
  o.connect(g).connect(master);
  o.start(s);
  o.stop(s + dur + 0.02);
}

/** 520 Hz stepped up 2 per hop (semitones), capped at 12: the hop-blip rising pitch. Exported for testing. */
export function hopPitch(streak: number): number {
  return 520 * 2 ** (Math.min(streak, HOP_CAP) / 12);
}

/** Beacon placed: sine thunk 180→60 Hz plus a triangle click. */
export function playPlaceThunk(now = performance.now()) {
  if (!shouldPlay("place", now)) return;
  try {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, { f: 180, to: 60, dur: 0.09, vol: 0.5 });
    tone(t, { f: 900, dur: 0.02, type: "triangle", vol: 0.2 });
  } catch { /* audio is garnish: never break the game */ }
}

/** News hop: a square blip whose pitch climbs per successive hop, resetting after 800 ms idle. */
export function playHopBlip(now = performance.now()) {
  if (!shouldPlay("hop", now)) return;
  if (now - lastHopAt > HOP_IDLE_RESET_MS) hopStreak = 0;
  lastHopAt = now;
  const f = hopPitch(hopStreak);
  hopStreak += HOP_STEP;
  try {
    if (!ctx) return;
    tone(ctx.currentTime, { f, dur: 0.07, type: "square", vol: 0.12 });
  } catch { /* audio is garnish */ }
}

/** Credential reject: sawtooth with a 25 Hz tremolo, plus a detuned sawtooth. */
export function playRejectBuzz(now = performance.now()) {
  if (!shouldPlay("reject", now)) return;
  try {
    if (!ctx || !master) return;
    const dur = 0.22, s = ctx.currentTime, stop = s + dur + 0.02;
    const carrier = ctx.createOscillator(), detuned = ctx.createOscillator(), lfo = ctx.createOscillator();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(140, s);
    detuned.type = "sawtooth";
    detuned.frequency.setValueAtTime(148, s);
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(25, s);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.12;
    const voice = ctx.createGain();
    voice.gain.setValueAtTime(GAIN_FLOOR, s);
    voice.gain.linearRampToValueAtTime(0.25, s + 0.01);
    voice.gain.exponentialRampToValueAtTime(GAIN_FLOOR, s + dur);
    lfo.connect(lfoDepth).connect(voice.gain);
    carrier.connect(voice);
    detuned.connect(voice);
    voice.connect(master);
    carrier.start(s);
    detuned.start(s);
    lfo.start(s);
    carrier.stop(stop);
    detuned.stop(stop);
    lfo.stop(stop);
  } catch { /* audio is garnish */ }
}

/** Flood seal: a filtered noise burst sweeping 2400→300 Hz, plus a low sine rumble. */
export function playFloodSplash(now = performance.now()) {
  if (!shouldPlay("flood", now)) return;
  try {
    if (!ctx || !master) return;
    const s = ctx.currentTime, dur = 0.4;
    const length = Math.max(1, Math.round(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, s);
    filter.frequency.exponentialRampToValueAtTime(300, s + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(GAIN_FLOOR, s);
    g.gain.linearRampToValueAtTime(0.35, s + 0.01);
    g.gain.exponentialRampToValueAtTime(GAIN_FLOOR, s + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(s);
    src.stop(s + dur + 0.02);
    tone(s, { f: 70, dur: 0.5, vol: 0.2 });
  } catch { /* audio is garnish */ }
}

/** Arrival: two sines a major-ish interval apart, each with a quiet 2x partial. */
export function playArrivalChime(now = performance.now()) {
  if (!shouldPlay("arrival", now)) return;
  try {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, { f: 880, dur: 0.4, vol: 0.18 });
    tone(t, { f: 1760, dur: 0.4, vol: 0.05 });
    tone(t, { f: 1318, dur: 0.4, at: 0.09, vol: 0.18 });
    tone(t, { f: 2636, dur: 0.4, at: 0.09, vol: 0.05 });
  } catch { /* audio is garnish */ }
}

/** Star n: a sine rising 2 semitones per star, with a quiet 3x partial. "star" is exempt from the gap cooldown. */
export function playStarDing(star: number, now = performance.now()) {
  if (!shouldPlay("star", now)) return;
  try {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 1046 * 2 ** ((2 * Math.max(0, star)) / 12);
    tone(t, { f, dur: 0.5, vol: 0.16 });
    tone(t, { f: f * 3, dur: 0.5, vol: 0.03 });
  } catch { /* audio is garnish */ }
}

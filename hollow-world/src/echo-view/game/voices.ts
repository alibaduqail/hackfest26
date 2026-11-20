// Cue voices for the Echo game and the Descent leg: physical, muffled, sparse. Each is a short burst of filtered noise
// (the strike) plus a few decaying partials (the body), sent to the shared room/hall reverb. Every call draws fresh
// pitch (±3%), level (±1 dB) and noise offset, so the same cue never repeats exactly. Nothing here is a plain tone.
import { GAIN_FLOOR, duck, getBus, getCtx, noiseBuffer, playSample, rand, sink, vary, type Bus, type Send, type Vary } from "./soundkit";

function env(g: GainNode, t: number, vol: number, rise: number, dur: number) {
  g.gain.setValueAtTime(GAIN_FLOOR, t);
  g.gain.linearRampToValueAtTime(vol, t + rise);
  g.gain.exponentialRampToValueAtTime(GAIN_FLOOR, t + rise + dur);
}

interface Hit { dur: number; vol: number; f: number; to?: number; kind?: BiquadFilterType; q?: number; rise?: number; send?: Send }
/** A burst of filtered noise: a strike, a click, a rumble or a pebble depending on the filter. */
function hit(b: Bus, t: number, { dur, vol, f, to, kind = "lowpass", q, rise = 0.002, send }: Hit) {
  const c = b.ctx, src = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
  src.buffer = noiseBuffer(c);
  fl.type = kind;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + rise + dur);
  if (q) fl.Q.value = q;
  env(g, t, vol, rise, dur);
  src.connect(fl);
  fl.connect(g);
  sink(b, g, send);
  src.start(t, rand(0, 1.5), rise + dur + 0.05);
}

interface Part { f: number; dur: number; vol: number; to?: number; rise?: number; type?: OscillatorType; send?: Send }
/** One decaying sine partial. */
function part(b: Bus, t: number, { f, dur, vol, to, rise = 0.004, type = "sine", send }: Part) {
  const c = b.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + rise + dur);
  env(g, t, vol, rise, dur);
  o.connect(g);
  sink(b, g, send);
  o.start(t);
  o.stop(t + rise + dur + 0.05);
}

type Voice = (b: Bus, t: number, v: Vary) => void;
/** Look up the bus, duck the ambience and run a voice at the context's current time. Never throws. */
function run(voice: Voice) {
  try {
    const b = getBus(), c = getCtx();
    if (!b || !c) return;
    duck(b, c.currentTime);
    const v = vary();
    voice(b, c.currentTime, v);
  } catch { /* audio is garnish: never break the game */ }
}

/** Muffled metal clunk with a faint relay click behind it. `f` sets the weight. */
const clunk = (f: number, vol: number, click: boolean, sample: "place" | "remove" = "place"): Voice => (b, t, v) => {
  if (playSample(b, t, sample, { vol: 0.7 * vol * v.g, rate: (f / 170) * v.p, lp: 2200, send: { room: 0.3 } })) { // Kenney CC0 metal impact
    if (click && playSample(b, t + 0.045, "relay", { vol: 0.3 * vol * v.g, rate: 1.1 * v.p, lp: 2800, send: { room: 0.5 } })) return;
    if (!click) return;
    hit(b, t + 0.045, { dur: 0.01, vol: 0.22 * vol * v.g, f: 2800 * v.p, kind: "bandpass", q: 2.5, send: { room: 0.5 } });
    return;
  }
  hit(b, t, { dur: 0.035, vol: 0.5 * vol * v.g, f: 900, kind: "bandpass", q: 0.8, send: { room: 0.3 } });
  part(b, t, { f: f * v.p, to: f * v.p * 0.62, dur: 0.12, vol: 0.55 * vol * v.g, send: { room: 0.3 } });
  part(b, t, { f: f * v.p * 2.76, dur: 0.07, vol: 0.2 * vol * v.g, send: { room: 0.3 } }); // inharmonic: metal, not a note
  part(b, t, { f: f * v.p * 5.4, dur: 0.04, vol: 0.08 * vol * v.g });
  if (click) hit(b, t + 0.045, { dur: 0.01, vol: 0.22 * vol * v.g, f: 2800 * v.p, kind: "bandpass", q: 2.5, send: { room: 0.5 } });
};
/** Dull rock tap: no pitch worth naming. */
const tap = (vol: number): Voice => (b, t, v) => {
  if (playSample(b, t, "tap", { vol: 0.8 * vol * v.g, rate: 0.9 * v.p, lp: 1100, send: { room: 0.2 } })) return; // Kenney CC0 soft impact, dulled
  hit(b, t, { dur: 0.05, vol: 0.4 * vol * v.g, f: 520 * v.p, send: { room: 0.2 } });
  part(b, t, { f: 88 * v.p, to: 58, dur: 0.14, vol: 0.45 * vol * v.g, send: { room: 0.15 } });
};
/** A single soft relay click. `pitch` shifts the click (the hop tick climbs). */
const relay = (pitch: number, vol: number): Voice => (b, t, v) => {
  if (playSample(b, t, "relay", { vol: 0.7 * vol * v.g, rate: Math.min(pitch, 2) * v.p, lp: 2600, send: { room: 0.3 } })) return; // Kenney CC0 click
  hit(b, t, { dur: 0.012, vol: 0.7 * vol * v.g, f: 2200 * pitch * v.p, kind: "bandpass", q: 3, send: { room: 0.3 } });
  hit(b, t, { dur: 0.03, vol: 0.4 * vol * v.g, f: 600, send: { room: 0.2 } });
  part(b, t, { f: 140 * pitch * v.p, to: 100, dur: 0.05, vol: 0.25 * vol * v.g });
};
/** Pebbles: tiny bandpassed ticks scattered over `span` seconds, thinning out. */
function pebbles(b: Bus, t: number, n: number, from: number, span: number, vol: number, v: Vary) {
  for (let i = 0; i < n; i++) {
    const at = rand(from, from + span), fade = 1 - (at - from) / (span * 1.4);
    hit(b, t + at, { dur: 0.012, vol: vol * fade * v.g, f: rand(1700, 3600), kind: "bandpass", q: 6, send: { room: 0.5 } });
    part(b, t + at, { f: rand(300, 700), dur: 0.02, vol: 0.03 * fade * v.g });
  }
}

const down: Voice = (b, t, v) => { // distant rumble and a few pebbles
  hit(b, t, { dur: 1.1, vol: 2.2 * v.g, f: 150 * v.p, rise: 0.3, send: { room: 0.5 } });
  hit(b, t + 0.05, { dur: 0.8, vol: 0.9 * v.g, f: 340, rise: 0.2, send: { room: 0.4 } });
  pebbles(b, t, Math.round(rand(4, 7)), 0.3, 0.9, 0.14, v);
};
const seal: Voice = (b, t, v0) => { // heavy muffled door / rock thud with a room tail
  const v = { p: v0.p, g: v0.g * 0.55 };
  if (playSample(b, t, "seal", { vol: 1.1 * v0.g, rate: 0.72 * v0.p, lp: 1000, send: { room: 0.8, hall: 0.4 } })) { // Kenney CC0 plate impact, slowed and dulled, with a procedural sub tail
    part(b, t, { f: 41 * v.p, to: 30, dur: 0.5, vol: 0.5 * v.g, rise: 0.006, send: { room: 0.8 } });
    return;
  }
  part(b, t, { f: 64 * v.p, to: 34, dur: 0.6, vol: 0.95 * v.g, rise: 0.006, send: { room: 0.8, hall: 0.4 } });
  part(b, t, { f: 41 * v.p, to: 30, dur: 0.45, vol: 0.5 * v.g, rise: 0.006, send: { room: 0.8 } });
  hit(b, t, { dur: 0.22, vol: 0.9 * v.g, f: 280, send: { room: 0.8, hall: 0.4 } });
  hit(b, t, { dur: 0.025, vol: 0.45 * v.g, f: 700, kind: "bandpass", q: 0.7, send: { room: 0.6 } });
};
const flood: Voice = (b, t, v) => { // a muffled rush closing down, a thud under it, a few drops
  hit(b, t, { dur: 0.8, vol: 0.9 * v.g, f: 1000 * v.p, to: 170, rise: 0.06, send: { room: 0.7, hall: 0.3 } });
  part(b, t, { f: 56 * v.p, to: 36, dur: 0.45, vol: 0.55 * v.g, rise: 0.01, send: { room: 0.6 } });
  pebbles(b, t, Math.round(rand(3, 5)), 0.25, 0.7, 0.1, v);
};
/** One warm low bell: inharmonic partials with slow decays and a long, dark tail. */
const bell = (f0: number): Voice => (b, t, v) => {
  const f = f0 * v.p, send = { room: 0.35, hall: 0.9 };
  hit(b, t, { dur: 0.03, vol: 0.25 * v.g, f: 700, send: { room: 0.3 } }); // the strike
  [[1, 1, 2.6], [1.004, 0.5, 2.4], [2.32, 0.42, 1.7], [3.87, 0.22, 1.0], [5.41, 0.09, 0.6]].forEach(([r, a, d]) =>
    part(b, t, { f: f * r, dur: d, vol: 0.3 * a * v.g, rise: 0.012, send }));
};
const start: Voice = (b, t, v) => { // low room-tone swell: hum plus air
  part(b, t, { f: 55 * v.p, dur: 1.2, vol: 0.22 * v.g, rise: 0.8, send: { hall: 0.4 } });
  part(b, t, { f: 82.5 * v.p, dur: 1.2, vol: 0.08 * v.g, rise: 0.8, send: { hall: 0.4 } });
  hit(b, t, { dur: 1.2, vol: 0.9 * v.g, f: 420, rise: 0.8, send: { hall: 0.5 } });
};
/** Star `i`: a soft pitched tap, rising only slightly (about a semitone and a half per star). */
const star = (i: number): Voice => (b, t, v) => {
  const f = 620 * 2 ** ((1.5 * Math.min(Math.max(i, 0), 2)) / 12) * v.p;
  part(b, t, { f, dur: 0.14, vol: 0.34 * v.g, rise: 0.002, send: { room: 0.5, hall: 0.2 } });
  part(b, t, { f: f * 2.4, dur: 0.05, vol: 0.08 * v.g, rise: 0.002 });
  hit(b, t, { dur: 0.01, vol: 0.2 * v.g, f: f * 2, kind: "bandpass", q: 4, send: { room: 0.4 } });
};

export const voices = {
  place: () => run(clunk(170, 1, true)),
  remove: () => run(clunk(118, 0.55, false, "remove")),
  empty: () => run(tap(1)),
  down: () => run(down),
  seal: () => run(seal),
  yield: () => run(relay(1, 0.8)),
  chime: () => run(bell(196)),
  start: () => run(start),
  star: (i: number) => run(star(i)),
  // Descent leg
  thunk: () => run(clunk(150, 1.15, true)),
  hop: (pitch: number) => run(relay(pitch / 520, 0.55)),
  reject: () => run(tap(1.25)),
  flood: () => run(flood),
  arrival: () => run(bell(247)),
};

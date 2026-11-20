// Shared sound bus for the Echo game and the live Descent leg: one AudioContext, one mix.
// Signal path: every cue -> master (0.28) -> lowpass 3 kHz -> speakers, with two small generated-impulse reverbs
// (a short "room" and a longer "hall", both darkened) fed by per-cue sends. Ambience (hum + far drips) rides a
// separate gain that ducks under cues. No asset files; everything is synthesized from noise and sine partials.
// The context is created on a user gesture only (autoplay policy), never by play().
export const GAIN_FLOOR = 0.001; // exponentialRampToValueAtTime rejects a literal 0 target
const MASTER = 0.28;

export interface Bus { ctx: AudioContext; dry: GainNode; room: GainNode; hall: GainNode; amb: GainNode }
export type Send = { room?: number; hall?: number };

let ctx: AudioContext | null = null;
let bus: Bus | null = null;
const noise = new WeakMap<object, AudioBuffer>();

export const getCtx = () => ctx;
export const getBus = () => bus;

/** A generated room impulse: decaying noise, darkened as it decays so the tail is dull like rock. */
function impulse(c: AudioContext, secs: number, decay: number): AudioBuffer {
  const n = Math.floor(c.sampleRate * secs);
  const buf = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    const pre = Math.floor(c.sampleRate * 0.012);
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / (n - pre);
      lp += ((Math.random() * 2 - 1) - lp) * (0.55 - 0.45 * t); // one-pole lowpass closing over time
      d[i] = lp * (1 - t) ** decay;
    }
  }
  return buf;
}

function reverb(c: AudioContext, into: AudioNode, secs: number, decay: number, wet: number): GainNode {
  const input = c.createGain(), conv = c.createConvolver(), out = c.createGain();
  conv.buffer = impulse(c, secs, decay);
  out.gain.value = wet;
  input.connect(conv);
  conv.connect(out);
  out.connect(into);
  return input;
}

function buildBus(c: AudioContext): Bus | null {
  try {
    const master = c.createGain();
    master.gain.value = MASTER;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3000;
    master.connect(lp);
    lp.connect(c.destination);
    const dry = c.createGain(), amb = c.createGain();
    dry.connect(master);
    amb.connect(master);
    return { ctx: c, dry, amb, room: reverb(c, master, 1.2, 3.2, 0.5), hall: reverb(c, master, 2.6, 2.4, 0.4) };
  } catch { return null; }
}

/** Create (once) and resume the shared AudioContext. Call from a user gesture. */
export function unlockContext() {
  try {
    if (!ctx && typeof AudioContext !== "undefined") {
      ctx = new AudioContext();
      bus = buildBus(ctx);
    }
    if (ctx?.state === "suspended") void ctx.resume();
  } catch { ctx = null; bus = null; }
}

/** Pitch and level variation for one cue: ±3% pitch, ±1 dB level, so no two plays are identical. */
export interface Vary { p: number; g: number }
export function vary(): Vary {
  const r = () => Math.random() * 2 - 1;
  return { p: 1 + 0.03 * r(), g: 10 ** (r() / 20) };
}
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** One shared white-noise buffer per context; each use starts at a random offset. */
export function noiseBuffer(c: AudioContext): AudioBuffer {
  let b = noise.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.set(c, b);
  }
  return b;
}

/** Send a node to the dry bus and, optionally, to the room and hall reverbs. */
export function sink(b: Bus, node: AudioNode, send: Send = {}, dest: AudioNode = b.dry) {
  node.connect(dest);
  for (const [k, to] of [["room", b.room], ["hall", b.hall]] as const) {
    const amt = send[k];
    if (!amt) continue;
    const g = b.ctx.createGain();
    g.gain.value = amt;
    node.connect(g);
    g.connect(to);
  }
}

/** Briefly pull the ambience down under a cue. */
export function duck(b: Bus, t: number) {
  b.amb.gain.setTargetAtTime(0.3, t, 0.03);
  b.amb.gain.setTargetAtTime(1, t + 0.5, 0.4);
}

// ---- Ambience: a faint low hum and a distant drip every 8-20 s while a leg runs ----
let hum: { stop(): void } | null = null;
let dripTimer: ReturnType<typeof setTimeout> | undefined;

/** One far-off drip: a short, damp, pitch-dropping ping with a faint second splash, mostly reverb. */
export function drip(t: number) {
  const b = bus;
  if (!b) return;
  const c = b.ctx, f = rand(1500, 2300);
  for (const [k, at, vol] of [[0, 0, 0.1], [1, rand(0.14, 0.22), 0.04]] as const) {
    const o = c.createOscillator(), g = c.createGain(), s = t + at;
    o.type = "sine";
    o.frequency.setValueAtTime(f * (1 - k * 0.08), s);
    o.frequency.exponentialRampToValueAtTime(f * 0.78, s + 0.07);
    g.gain.setValueAtTime(GAIN_FLOOR, s);
    g.gain.linearRampToValueAtTime(vol, s + 0.003);
    g.gain.exponentialRampToValueAtTime(GAIN_FLOOR, s + 0.09);
    o.connect(g);
    sink(b, g, { room: 1.2, hall: 0.5 }, b.amb);
    o.start(s);
    o.stop(s + 0.12);
  }
}

/** Start the hum (and, unless `manual`, the random drips). Safe to call repeatedly. */
export function startAmbience(manual = false) {
  const b = bus;
  if (!b || hum) return;
  try {
    const c = b.ctx, t = c.currentTime;
    const level = c.createGain();
    level.gain.setValueAtTime(GAIN_FLOOR, t);
    level.gain.linearRampToValueAtTime(1, t + 2.5);
    const parts: { stop(w?: number): void }[] = [];
    for (const [f, vol] of [[48, 0.035], [72.4, 0.014]] as const) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f;
      g.gain.value = vol;
      o.connect(g).connect(level);
      o.start(t);
      parts.push(o);
    }
    const air = c.createBufferSource(), lp = c.createBiquadFilter(), ag = c.createGain();
    air.buffer = noiseBuffer(c);
    air.loop = true;
    lp.type = "lowpass";
    lp.frequency.value = 260;
    ag.gain.value = 0.05;
    air.connect(lp).connect(ag).connect(level);
    air.start(t);
    parts.push(air);
    level.connect(b.amb);
    hum = {
      stop() {
        const now = c.currentTime;
        level.gain.setTargetAtTime(GAIN_FLOOR, now, 0.12);
        parts.forEach((p) => { try { p.stop(now + 1); } catch { /* already stopped */ } });
      },
    };
    if (!manual) {
      const next = () => {
        dripTimer = setTimeout(() => {
          if (c.state === "running") drip(c.currentTime + 0.02);
          next();
        }, rand(8000, 20000));
      };
      next();
    }
  } catch { hum = null; }
}

export function stopAmbience() {
  clearTimeout(dripTimer);
  dripTimer = undefined;
  try { hum?.stop(); } catch { /* audio is garnish */ }
  hum = null;
}

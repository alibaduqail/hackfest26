import assert from "node:assert/strict";
import test from "node:test";
import { setMuted } from "../../game/audio";
import {
  hopPitch,
  playArrivalChime,
  playFloodSplash,
  playHopBlip,
  playPlaceThunk,
  playRejectBuzz,
  playStarDing,
  unlock,
} from "./sfx";

const GAIN_FLOOR = 0.001;

class FakeParam {
  value = 0;
  calls: ["set" | "lin" | "exp", number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push(["set", v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push(["lin", v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.value = v;
    this.calls.push(["exp", v, t]);
    return this;
  }
}
class FakeNode {
  connect(target: unknown) {
    return target;
  }
  disconnect() {}
}
class FakeOsc extends FakeNode {
  type: OscillatorType = "sine";
  frequency = new FakeParam();
  start() {}
  stop() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeBiquad extends FakeNode {
  type: BiquadFilterType = "lowpass";
  frequency = new FakeParam();
}
class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  start() {}
  stop() {}
}
class FakeCompressor extends FakeNode {}

// sfx.ts keeps one AudioContext for the module's lifetime (same singleton pattern as game/audio.ts), created
// the first time unlock() finds no context yet. This records that one instance so tests can inspect it.
let created: FakeCtx | undefined;
class FakeCtx {
  state = "running";
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  gains: FakeGain[] = [];
  oscillators: FakeOsc[] = [];
  constructor() {
    created = this;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscillators.push(o);
    return o;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return new FakeBiquad();
  }
  createBufferSource() {
    return new FakeBufferSource();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  resume() {
    return Promise.resolve();
  }
}

Object.defineProperty(globalThis, "AudioContext", { configurable: true, writable: true, value: FakeCtx });
setMuted(false);
unlock(); // creates the one sfx.ts AudioContext for this whole file (ctx is a module-private singleton there)
const ctx = created!;
assert.ok(ctx, "unlock() must have created the fake context");

function downRamps(from = 0) {
  return ctx.gains.slice(from).flatMap((g) => g.gain.calls).filter((c) => c[0] === "exp");
}

test("hopPitch climbs 2 semitones per hop and caps at 12", () => {
  const base = hopPitch(0);
  assert.ok(Math.abs(hopPitch(2) - base * 2 ** (2 / 12)) < 1e-9);
  assert.equal(hopPitch(12), hopPitch(30), "capped at the same ceiling past 12 semitones");
});

test("every gain ramp-down targets GAIN_FLOOR, never a literal 0", () => {
  const from = ctx.gains.length;
  playPlaceThunk(1000);
  playArrivalChime(1100);
  playStarDing(0, 1200);
  playRejectBuzz(1300);
  playFloodSplash(1400);
  const ramps = downRamps(from);
  assert.ok(ramps.length >= 5, "each call produced at least one gain envelope");
  for (const [, value] of ramps) {
    assert.equal(value, GAIN_FLOOR);
    assert.notEqual(value, 0);
  }
});

test("sounds respect the shared mute flag from game/audio", () => {
  setMuted(true);
  const before = ctx.oscillators.length;
  playPlaceThunk(3000);
  assert.equal(ctx.oscillators.length, before, "muted: nothing was synthesized");
  setMuted(false);
  playPlaceThunk(3001);
  assert.ok(ctx.oscillators.length > before, "unmuted: the thunk plays");
});

test("a 40ms per-sound cooldown suppresses rapid repeats, but star is exempt", () => {
  playPlaceThunk(4000);
  const afterFirst = ctx.oscillators.length;
  playPlaceThunk(4010); // 10ms later: inside the 40ms gate
  assert.equal(ctx.oscillators.length, afterFirst, "the repeat was suppressed");
  playPlaceThunk(4060); // past the gate
  assert.ok(ctx.oscillators.length > afterFirst, "allowed again once the cooldown passed");

  const beforeStars = ctx.oscillators.length;
  playStarDing(0, 5000);
  const afterOneStar = ctx.oscillators.length;
  assert.ok(afterOneStar > beforeStars);
  playStarDing(1, 5005); // 5ms later: would be gated for any other sound
  assert.ok(ctx.oscillators.length > afterOneStar, "star pings are exempt from the cooldown");
});

test("hop blip resets its rising-pitch streak after 800ms of silence", () => {
  playHopBlip(6000);
  const first = ctx.oscillators.at(-1)!.frequency.value;
  playHopBlip(6050); // well under 800ms: streak continues, pitch rises
  const second = ctx.oscillators.at(-1)!.frequency.value;
  assert.ok(second > first);
  playHopBlip(6900); // more than 800ms after the second hop: streak resets
  const third = ctx.oscillators.at(-1)!.frequency.value;
  assert.equal(third, first, "pitch returns to the base after the idle reset");
});

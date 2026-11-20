// Live Descent sound effects: synthesized, no asset files. Same bus, mute flag and voices as game/audio.ts
// (soundkit.ts / voices.ts), so the one settings Sound switch controls both modules and the mix is one room.
// The context is created and resumed only on a user gesture (autoplay policy).
import { isMuted, unlock as unlockShared } from "../../game/audio";
import { getCtx, logCue } from "../../game/soundkit";
import { voices } from "../../game/voices";

const MIN_GAP_MS = 40; // per-event cooldown, same cue
const HOP_IDLE_RESET_MS = 800;
const HOP_STEP = 2;
const HOP_CAP = 12;

const lastPlayedAt = new Map<string, number>();
let hopStreak = 0;
let lastHopAt = -Infinity;

/** Create (once) and resume the shared AudioContext. Call from a user gesture. */
export function unlock() {
  unlockShared();
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
  const ctx = getCtx();
  if (!ctx || ctx.state !== "running") return false;
  const prev = lastPlayedAt.get(name) ?? -Infinity;
  if (name !== "star" && now - prev < MIN_GAP_MS) return false;
  lastPlayedAt.set(name, now);
  return true;
}

/** 520 Hz stepped up 2 per hop (semitones), capped at 12: the pitch scale of the hop tick's rising click. Exported for testing. */
export function hopPitch(streak: number): number {
  return 520 * 2 ** (Math.min(streak, HOP_CAP) / 12);
}

/** Beacon placed: a muffled metal clunk with a faint relay click. */
export function playPlaceThunk(now = performance.now()) {
  logCue("playPlaceThunk");
  if (shouldPlay("place", now)) voices.thunk();
}

/** News hop: a soft relay tick whose pitch creeps up per successive hop, resetting after 800 ms idle. */
export function playHopBlip(now = performance.now()) {
  logCue("playHopBlip");
  if (!shouldPlay("hop", now)) return;
  if (now - lastHopAt > HOP_IDLE_RESET_MS) hopStreak = 0;
  lastHopAt = now;
  const f = hopPitch(hopStreak);
  hopStreak += HOP_STEP;
  voices.hop(f);
}

/** Credential reject: a dull rock tap, no buzz. */
export function playRejectBuzz(now = performance.now()) {
  logCue("playRejectBuzz");
  if (shouldPlay("reject", now)) voices.reject();
}

/** Flood seal: a muffled rush closing down, a low thud and a few drops, with a room tail. */
export function playFloodSplash(now = performance.now()) {
  logCue("playFloodSplash");
  if (shouldPlay("flood", now)) voices.flood();
}

/** Arrival: one warm low bell. */
export function playArrivalChime(now = performance.now()) {
  logCue("playArrivalChime");
  if (shouldPlay("arrival", now)) voices.arrival();
}

/** Star n: a soft pitched tap, rising only slightly per star. "star" is exempt from the gap cooldown. */
export function playStarDing(star: number, now = performance.now()) {
  logCue("playStarDing", star);
  if (shouldPlay("star", now)) voices.star(star);
}

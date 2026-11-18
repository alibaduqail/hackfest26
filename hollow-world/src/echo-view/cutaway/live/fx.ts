// Live Descent visual juice: pooled particles, rings, screen-shake (trauma model), hit-stop and number pop-ups.
// Everything lives in fixed-size typed arrays allocated once at module load; spawn/update/draw only ever write
// into existing slots (round-robin), so the per-frame path never calls `new` or an array method that allocates.
// One flag (setReducedMotion) gates all motion in a single place, per PLAYABLE_DESCENT.md §6.
const PARTICLE_CAP = 512;
const RING_CAP = 32;
const POP_CAP = 16;
export const MAX_SHAKE_PX = 10; // clamp: beacon-place (+0.15) and seal (+0.5, decaying) both fit well under this
const TRAUMA_DECAY_PER_S = 1.4;
const FLASH_GAP_MS = 350; // WCAG 2.3.1: never more than ~3 flashes/sec from any single ring-flash source
const GRAVITY = 90; // px/s^2, gentle settle for dust particles

const px = new Float32Array(PARTICLE_CAP);
const py = new Float32Array(PARTICLE_CAP);
const pvx = new Float32Array(PARTICLE_CAP);
const pvy = new Float32Array(PARTICLE_CAP);
const plife = new Float32Array(PARTICLE_CAP);
const pmax = new Float32Array(PARTICLE_CAP);
const pcolor: string[] = new Array(PARTICLE_CAP).fill("");
let pCursor = 0;

const rx = new Float32Array(RING_CAP);
const ry = new Float32Array(RING_CAP);
const rlife = new Float32Array(RING_CAP);
const rmax = new Float32Array(RING_CAP);
const rbase = new Float32Array(RING_CAP);
const rgrow = new Float32Array(RING_CAP);
const rcolor: string[] = new Array(RING_CAP).fill("");
let rCursor = 0;
let lastFlashAtMs = -Infinity;

const npx = new Float32Array(POP_CAP);
const npy = new Float32Array(POP_CAP);
const nplife = new Float32Array(POP_CAP);
const npmax = new Float32Array(POP_CAP);
const nptext: string[] = new Array(POP_CAP).fill("");
const npcolor: string[] = new Array(POP_CAP).fill("");
let npCursor = 0;

let reducedMotion = false;
let trauma = 0;
let shakeSeed = 0;
let shakeX = 0;
let shakeY = 0;
let hitStopRemainingMs = 0;
let clockMs = 0;

/** The one switch every effect below consults. */
export function setReducedMotion(enabled: boolean) {
  reducedMotion = enabled;
  if (enabled) {
    trauma = 0;
    shakeX = 0;
    shakeY = 0;
    hitStopRemainingMs = 0;
  }
}
export function isReducedMotion() {
  return reducedMotion;
}

/** Deterministic pseudo-random in [0,1), a function of its seed only (no Math.random in the frame path). */
function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A burst of `count` dust particles at (x, y). No-op under reduced motion. */
export function spawnParticles(x: number, y: number, count: number, color: string, speed = 70) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const slot = pCursor;
    pCursor = (pCursor + 1) % PARTICLE_CAP;
    const angle = (slot * 2.399963 + i) % (Math.PI * 2); // golden-angle spiral: even spread, fully deterministic
    const s = speed * (0.4 + 0.6 * pseudo(slot + 1));
    px[slot] = x;
    py[slot] = y;
    pvx[slot] = Math.cos(angle) * s;
    pvy[slot] = Math.sin(angle) * s;
    plife[slot] = 0.35;
    pmax[slot] = 0.35;
    pcolor[slot] = color;
  }
}

/** An expanding ring at (x, y). Flash-rate-limited by default (WCAG 2.3.1); pass flash:false to exempt it. */
export function ring(x: number, y: number, color: string, opts: { radius?: number; duration?: number; flash?: boolean } = {}) {
  const { radius = 40, duration = 300, flash = true } = opts;
  if (flash) {
    if (clockMs - lastFlashAtMs < FLASH_GAP_MS) return;
    lastFlashAtMs = clockMs;
  }
  const slot = rCursor;
  rCursor = (rCursor + 1) % RING_CAP;
  rx[slot] = x;
  ry[slot] = y;
  rbase[slot] = radius;
  rgrow[slot] = radius * 0.35;
  rmax[slot] = duration / 1000;
  rlife[slot] = rmax[slot];
  rcolor[slot] = color;
}

/** A floating label ("+1", "✕", ...) at (x, y). Still shown under reduced motion, just without the float. */
export function numberPop(x: number, y: number, text: string, color: string) {
  const slot = npCursor;
  npCursor = (npCursor + 1) % POP_CAP;
  npx[slot] = x;
  npy[slot] = y;
  nplife[slot] = 0.6;
  npmax[slot] = 0.6;
  nptext[slot] = text;
  npcolor[slot] = color;
}

/** Add to the trauma accumulator (clamped to 1). No-op under reduced motion. */
export function shake(amount: number) {
  if (reducedMotion) return;
  trauma = Math.min(1, trauma + Math.max(0, amount));
}

/** Freeze fx (and, per the caller's own loop, the rest of the frame) for ~ms. No-op under reduced motion. */
export function hitStop(ms = 60) {
  if (reducedMotion) return;
  hitStopRemainingMs = Math.max(hitStopRemainingMs, ms);
}
export function isFrozen(): boolean {
  return hitStopRemainingMs > 0;
}

/** Advance every pooled effect by dtMsRaw (clamped to 50ms). Frozen (hit-stop) ticks only count down the freeze. */
export function update(dtMsRaw: number) {
  const dtMs = Math.min(Math.max(dtMsRaw, 0), 50);
  clockMs += dtMs;
  if (hitStopRemainingMs > 0) {
    hitStopRemainingMs = Math.max(0, hitStopRemainingMs - dtMs);
    shakeX = 0;
    shakeY = 0;
    return;
  }
  const dt = dtMs / 1000;
  trauma = Math.max(0, trauma - TRAUMA_DECAY_PER_S * dt);
  if (reducedMotion || trauma <= 0) {
    shakeX = 0;
    shakeY = 0;
  } else {
    const amt = trauma * trauma;
    shakeX = (pseudo(shakeSeed) * 2 - 1) * MAX_SHAKE_PX * amt;
    shakeY = (pseudo(shakeSeed + 1) * 2 - 1) * MAX_SHAKE_PX * amt;
    shakeSeed += 2;
  }
  for (let i = 0; i < PARTICLE_CAP; i++) {
    if (plife[i] <= 0) continue;
    plife[i] -= dt;
    px[i] += pvx[i] * dt;
    py[i] += pvy[i] * dt;
    pvy[i] += GRAVITY * dt;
  }
  for (let i = 0; i < RING_CAP; i++) if (rlife[i] > 0) rlife[i] -= dt;
  for (let i = 0; i < POP_CAP; i++) if (nplife[i] > 0) nplife[i] -= dt;
}

/** The current frame's shake offset (already decayed/clamped by update()). {0,0} under reduced motion. */
export function getShakeOffset(): { x: number; y: number } {
  return { x: shakeX, y: shakeY };
}

/** Draw every live particle, ring and pop-up into ctx (same world-space transform as the scene canvas). */
export function draw(ctx: CanvasRenderingContext2D) {
  const startAlpha = ctx.globalAlpha;
  for (let i = 0; i < PARTICLE_CAP; i++) {
    if (plife[i] <= 0) continue;
    ctx.globalAlpha = Math.max(0, plife[i] / pmax[i]);
    ctx.fillStyle = pcolor[i];
    ctx.fillRect(px[i] - 1.5, py[i] - 1.5, 3, 3);
  }
  for (let i = 0; i < RING_CAP; i++) {
    if (rlife[i] <= 0) continue;
    const t = 1 - rlife[i] / rmax[i];
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = rcolor[i];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(rx[i], ry[i], reducedMotion ? rbase[i] : rbase[i] + rgrow[i] * t, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  for (let i = 0; i < POP_CAP; i++) {
    if (nplife[i] <= 0) continue;
    const t = 1 - nplife[i] / npmax[i];
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = npcolor[i];
    ctx.fillText(nptext[i], npx[i], npy[i] + (reducedMotion ? 0 : -24 * t));
  }
  ctx.globalAlpha = startAlpha;
}

/** Clear every pool and accumulator (shake, hit-stop, flash cooldown). Call on retry/restart. */
export function reset() {
  plife.fill(0);
  rlife.fill(0);
  nplife.fill(0);
  pCursor = rCursor = npCursor = 0;
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  hitStopRemainingMs = 0;
  clockMs = 0;
  lastFlashAtMs = -Infinity;
}

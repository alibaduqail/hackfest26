// Pure, DOM-free state machine for the beacon-light overlay (light.ts draws it).
// No canvas/image references live here, so it is unit-testable without a browser.

export const DARKNESS_SOFT_MAX = 0.55;
export const DARKNESS_HARD_MAX = 0.65;

/** Clamps a configured darkness alpha into [0, 0.55], then a final safety clamp to <= 0.65. */
export function clampDarkness(alpha: number): number {
  const soft = Math.min(Math.max(alpha, 0), DARKNESS_SOFT_MAX);
  return Math.min(soft, DARKNESS_HARD_MAX);
}

export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** A gentle +-6% breathing multiplier around 1.0; 1 when disabled or reduced motion. */
export function flickerMultiplier(now: number, hz: number, enabled: boolean): number {
  if (!enabled || hz <= 0) return 1;
  return 1 + 0.06 * Math.sin(((now / 1000) * hz) * Math.PI * 2);
}

export type PulseKind = "announce" | "seal" | "release";

export interface LightCoreSector {
  readonly id: string;
  readonly beacon: boolean;
}

export interface LightCorePulseInput {
  readonly id: string;
  readonly kind: PulseKind;
  readonly from: readonly [number, number] | null;
  readonly to: readonly [number, number];
}

/** One pooled pulse slot, reused across frames. Never reallocated after construction. */
export interface PulseSlot {
  active: boolean;
  id: string;
  kind: PulseKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  hasFrom: boolean;
}

export interface LightCoreOptions {
  readonly sectorIds: readonly string[];
  readonly darknessAlpha?: number;
  readonly fadeInMs?: number;
  readonly flickerHz?: number;
  readonly reducedMotion?: boolean;
  readonly pulseSlots?: number;
}

const DEFAULT_PULSE_SLOTS = 24;

export class LightCore {
  readonly fadeInMs: number;
  readonly flickerHz: number;
  private readonly index = new Map<string, number>();
  private readonly lit: Uint8Array;
  private readonly fadeStart: Float64Array;
  private readonly darknessAlphaBase: number;
  private readonly pulsePool: PulseSlot[];
  private reduced: boolean;
  private lastFlickerStep = NaN;
  dirty = true;

  constructor(options: LightCoreOptions) {
    options.sectorIds.forEach((id, i) => this.index.set(id, i));
    this.lit = new Uint8Array(options.sectorIds.length);
    this.fadeStart = new Float64Array(options.sectorIds.length).fill(-Infinity);
    this.darknessAlphaBase = clampDarkness(options.darknessAlpha ?? DARKNESS_SOFT_MAX);
    this.fadeInMs = options.fadeInMs ?? 150;
    this.flickerHz = options.flickerHz ?? 8;
    this.reduced = options.reducedMotion ?? false;
    const slots = options.pulseSlots ?? DEFAULT_PULSE_SLOTS;
    this.pulsePool = Array.from({ length: slots }, () => ({
      active: false,
      id: "",
      kind: "announce" as PulseKind,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      hasFrom: false,
    }));
  }

  setReducedMotion(value: boolean) {
    this.reduced = value;
  }

  get reducedMotion() {
    return this.reduced;
  }

  /** Updates lit/fade state from the latest sector list. Cheap to call every frame; no allocation. */
  syncSectors(sectors: readonly LightCoreSector[], now: number) {
    for (const sector of sectors) {
      const i = this.index.get(sector.id);
      if (i === undefined) continue;
      const wasLit = this.lit[i] === 1;
      if (sector.beacon && !wasLit) {
        this.fadeStart[i] = now;
        this.dirty = true;
      } else if (!sector.beacon && wasLit) {
        this.dirty = true;
      }
      this.lit[i] = sector.beacon ? 1 : 0;
    }
  }

  /** Matches this frame's pulses into the pooled slot array without allocating. */
  syncPulses(pulses: readonly LightCorePulseInput[]) {
    for (const slot of this.pulsePool) slot.active = false;
    let next = 0;
    for (const pulse of pulses) {
      if (next >= this.pulsePool.length) break;
      const slot = this.pulsePool[next++];
      slot.active = true;
      slot.id = pulse.id;
      slot.kind = pulse.kind;
      slot.hasFrom = pulse.from !== null;
      slot.fromX = pulse.from ? pulse.from[0] : pulse.to[0];
      slot.fromY = pulse.from ? pulse.from[1] : pulse.to[1];
      slot.toX = pulse.to[0];
      slot.toY = pulse.to[1];
    }
  }

  private fadeActive(now: number): boolean {
    for (let i = 0; i < this.fadeStart.length; i++) {
      const elapsed = now - this.fadeStart[i];
      if (elapsed >= 0 && elapsed < this.fadeInMs) return true;
    }
    return false;
  }

  /** True when the cached dark/light canvas should be rebuilt this frame. */
  needsRedraw(now: number): boolean {
    if (this.dirty) return true;
    if (this.fadeActive(now)) return true;
    if (!this.reduced && this.flickerHz > 0) {
      const step = Math.floor((now / 1000) * this.flickerHz);
      if (step !== this.lastFlickerStep) return true;
    }
    return false;
  }

  /** Call after the caller has actually redrawn the cache this frame. */
  markRedrawn(now: number) {
    this.dirty = false;
    if (!this.reduced && this.flickerHz > 0) {
      this.lastFlickerStep = Math.floor((now / 1000) * this.flickerHz);
    }
  }

  isLit(sectorId: string): boolean {
    const i = this.index.get(sectorId);
    return i !== undefined && this.lit[i] === 1;
  }

  /** 0..1 eased fade for a section's light hole; 1 once its fade window has elapsed (or it was never animated). */
  fadeProgress(sectorId: string, now: number): number {
    const i = this.index.get(sectorId);
    if (i === undefined) return 1;
    const start = this.fadeStart[i];
    if (!Number.isFinite(start)) return 1;
    return easeOutCubic((now - start) / this.fadeInMs);
  }

  /** Darkness alpha for this frame: base alpha, optional flicker, always <= the hard cap. */
  effectiveAlpha(now: number): number {
    const flicker = flickerMultiplier(now, this.flickerHz, !this.reduced);
    return Math.min(this.darknessAlphaBase * flicker, DARKNESS_HARD_MAX);
  }

  /** The pooled slot array, reused every frame; exposed so a draw loop (and tests) can read it directly. */
  getPulseSlots(): readonly PulseSlot[] {
    return this.pulsePool;
  }

  /**
   * Travel position for a pulse glow, written into the caller's pre-allocated `out` tuple (never
   * allocates). Static at its destination when reduced motion is on.
   */
  pulsePosition(slot: PulseSlot, t: number, out: [number, number]) {
    if (this.reduced || !slot.hasFrom) {
      out[0] = slot.toX;
      out[1] = slot.toY;
      return;
    }
    out[0] = slot.fromX + (slot.toX - slot.fromX) * t;
    out[1] = slot.fromY + (slot.toY - slot.fromY) * t;
  }
}

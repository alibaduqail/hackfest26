// Beacon-light darkness + pulse-glow overlay for the live Descent.
// A standalone canvas layer, meant to sit ABOVE the existing scene.ts canvas (see WIRING-LIGHT.md).
// Read-only consumer of beacon/pulse/pod state handed to it each frame; never mutates engine or scene state.
import { LightCore, type LightCoreOptions, type LightCorePulseInput, type PulseKind } from "./light-core";

export interface LightSectorFrame {
  readonly id: string;
  readonly beacon: boolean;
  /** Section midpoint and orientation in the same world-unit space as scene.ts (default 1672x941). */
  readonly midX: number;
  readonly midY: number;
  readonly angle: number;
  readonly length: number;
}

export type LightPulseFrame = LightCorePulseInput;

export interface LightHeadlamp {
  readonly x: number;
  readonly y: number;
}

export interface LightFrame {
  /** Every sector the overlay should darken or light; omit sealed-flood chrome, LiveScreen owns that. */
  readonly sectors: readonly LightSectorFrame[];
  readonly pulses: readonly LightPulseFrame[];
  /** Pod positions the darkness layer exempts, so pods never vanish under it. */
  readonly headlamps: readonly LightHeadlamp[];
  /** 0..1 tween progress within the current tick, same convention as scene.ts's frameProgress. */
  readonly t: number;
  /** performance.now() in ms, used for fade-in and flicker timing only (never for sim state). */
  readonly now: number;
}

export interface LightLayerOptions extends Pick<LightCoreOptions, "darknessAlpha" | "fadeInMs" | "flickerHz" | "reducedMotion"> {
  readonly sectorIds: readonly string[];
  readonly width?: number;
  readonly height?: number;
  readonly headlampRadius?: number;
}

const DEFAULT_W = 1672, DEFAULT_H = 941;
const LIGHT_SPRITE_W = 256, LIGHT_SPRITE_H = 72;
const HEADLAMP_SPRITE_SIZE = 160;
const HATCH_TILE = 12;
const GLOW_SPRITE_SIZE = 96;
const DEFAULT_HEADLAMP_RADIUS = 46;

function makeCanvas(w: number, h: number) {
  const el = document.createElement("canvas");
  el.width = w;
  el.height = h;
  return el;
}

/** One soft elongated gradient, prebaked once; stretched and rotated per lit section at draw time. */
function makeLightSprite(): HTMLCanvasElement {
  const sprite = makeCanvas(LIGHT_SPRITE_W, LIGHT_SPRITE_H);
  const ctx = sprite.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    LIGHT_SPRITE_W / 2,
    LIGHT_SPRITE_H / 2,
    0,
    LIGHT_SPRITE_W / 2,
    LIGHT_SPRITE_H / 2,
    LIGHT_SPRITE_W / 2,
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.translate(LIGHT_SPRITE_W / 2, LIGHT_SPRITE_H / 2);
  ctx.scale(1, LIGHT_SPRITE_H / LIGHT_SPRITE_W);
  ctx.translate(-LIGHT_SPRITE_W / 2, -LIGHT_SPRITE_H / 2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, LIGHT_SPRITE_W, LIGHT_SPRITE_H);
  ctx.restore();
  return sprite;
}

/** One soft circular hole, prebaked once; punched at every headlamp position each frame. */
function makeHeadlampSprite(): HTMLCanvasElement {
  const sprite = makeCanvas(HEADLAMP_SPRITE_SIZE, HEADLAMP_SPRITE_SIZE);
  const ctx = sprite.getContext("2d")!;
  const r = HEADLAMP_SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.7, "rgba(255,255,255,0.6)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, HEADLAMP_SPRITE_SIZE, HEADLAMP_SPRITE_SIZE);
  return sprite;
}

/** One small tinted glow, prebaked once per pulse color, drawn with 'lighter' compositing. */
function makeGlowSprite(color: string): HTMLCanvasElement {
  const sprite = makeCanvas(GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
  const ctx = sprite.getContext("2d")!;
  const r = GLOW_SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
  return sprite;
}

/** One diagonal-hatch tile, prebaked once; tiled as a CanvasPattern for every dark-section chip. */
function makeHatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  const tile = makeCanvas(HATCH_TILE, HATCH_TILE);
  const tctx = tile.getContext("2d")!;
  tctx.strokeStyle = "rgba(221,216,193,0.55)";
  tctx.lineWidth = 2;
  tctx.beginPath();
  tctx.moveTo(-2, HATCH_TILE + 2);
  tctx.lineTo(HATCH_TILE + 2, -2);
  tctx.stroke();
  return ctx.createPattern(tile, "repeat")!;
}

const PULSE_COLORS: Record<PulseKind, string> = {
  seal: "rgba(224,99,79,0.9)",
  announce: "rgba(228,196,148,0.9)",
  release: "rgba(228,196,148,0.9)",
};

export function createLightLayer(canvas: HTMLCanvasElement, options: LightLayerOptions) {
  const W = options.width ?? DEFAULT_W;
  const H = options.height ?? DEFAULT_H;
  const headlampRadius = options.headlampRadius ?? DEFAULT_HEADLAMP_RADIUS;
  const core = new LightCore({
    sectorIds: options.sectorIds,
    darknessAlpha: options.darknessAlpha,
    fadeInMs: options.fadeInMs,
    flickerHz: options.flickerHz,
    reducedMotion: options.reducedMotion,
  });

  const ctx = canvas.getContext("2d")!;
  const halfW = Math.round(W / 2), halfH = Math.round(H / 2);
  const base = makeCanvas(halfW, halfH);
  const baseCtx = base.getContext("2d")!;
  baseCtx.scale(halfW / W, halfH / H);

  const lightSprite = makeLightSprite();
  const headlampSprite = makeHeadlampSprite();
  const glowSprites: Record<PulseKind, HTMLCanvasElement> = {
    seal: makeGlowSprite(PULSE_COLORS.seal),
    announce: makeGlowSprite(PULSE_COLORS.announce),
    release: makeGlowSprite(PULSE_COLORS.release),
  };
  const hatchPattern = makeHatchPattern(ctx);

  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  });
  resize.observe(canvas);

  function rebuildBase(now: number, sectors: readonly LightSectorFrame[]) {
    baseCtx.clearRect(0, 0, W, H);
    baseCtx.fillStyle = `rgba(6,11,15,${core.effectiveAlpha(now)})`;
    baseCtx.fillRect(0, 0, W, H);
    baseCtx.save();
    baseCtx.globalCompositeOperation = "destination-out";
    for (const sector of sectors) {
      if (!sector.beacon) continue;
      const fade = core.fadeProgress(sector.id, now);
      if (fade <= 0) continue;
      baseCtx.save();
      baseCtx.translate(sector.midX, sector.midY);
      baseCtx.rotate(sector.angle);
      baseCtx.globalAlpha = fade;
      const w = Math.max(sector.length, 20), h = LIGHT_SPRITE_H;
      baseCtx.drawImage(lightSprite, -w / 2, -h / 2, w, h);
      baseCtx.restore();
    }
    baseCtx.restore();
  }

  function drawHatchChips(sectors: readonly LightSectorFrame[]) {
    ctx.save();
    ctx.fillStyle = hatchPattern;
    ctx.strokeStyle = "rgba(221,216,193,0.5)";
    ctx.lineWidth = 1.5;
    const size = 22;
    for (const sector of sectors) {
      if (sector.beacon) continue;
      ctx.fillRect(sector.midX - size / 2, sector.midY - size / 2, size, size);
      ctx.strokeRect(sector.midX - size / 2, sector.midY - size / 2, size, size);
    }
    ctx.restore();
  }

  function drawHeadlamps(headlamps: readonly LightHeadlamp[]) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    const size = headlampRadius * 2;
    for (const lamp of headlamps) {
      ctx.drawImage(headlampSprite, lamp.x - size / 2, lamp.y - size / 2, size, size);
    }
    ctx.restore();
  }

  // Reused every frame so drawPulses never allocates.
  const pulsePos: [number, number] = [0, 0];
  function drawPulses(t: number) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const slot of core.getPulseSlots()) {
      if (!slot.active) continue;
      core.pulsePosition(slot, t, pulsePos);
      const sprite = glowSprites[slot.kind];
      ctx.drawImage(
        sprite,
        pulsePos[0] - GLOW_SPRITE_SIZE / 2,
        pulsePos[1] - GLOW_SPRITE_SIZE / 2,
        GLOW_SPRITE_SIZE,
        GLOW_SPRITE_SIZE,
      );
    }
    ctx.restore();
  }

  return {
    setReducedMotion(value: boolean) {
      core.setReducedMotion(value);
    },
    draw(frame: LightFrame) {
      core.syncSectors(frame.sectors, frame.now);
      core.syncPulses(frame.pulses);
      if (core.needsRedraw(frame.now)) {
        rebuildBase(frame.now, frame.sectors);
        core.markRedrawn(frame.now);
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(base, 0, 0, halfW, halfH, 0, 0, W, H);
      drawHeadlamps(frame.headlamps);
      drawHatchChips(frame.sectors);
      drawPulses(frame.t);
    },
    dispose() {
      resize.disconnect();
    },
  };
}

// The blackout layer: one darkness over the cutaway art with a soft pool of light cut out per beacon (pools.ts geometry).
// Painted only when the set of pools changes (plus a short fade-in for a new one), never per frame: the canvas holds a half-size
// bitmap and CSS scales it, so a repaint is a few dozen small sprite stamps and the compositor does the rest.
import { type Pool, WORLD_H, WORLD_W } from "./pools";

export interface LitPool { pool: Pool; strength: number } // 1: a live beacon; less: one on its way, or a hover preview

const S = .5; // bitmap scale: soft pools need no more
const BW = Math.round(WORLD_W * S), BH = Math.round(WORLD_H * S);
const DARK = "rgba(3,7,10,.9)";
const WARM = "rgb(255,214,150)";
const FADE_MS = 280;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function createDarkness(target: HTMLCanvasElement) {
  const ctx = target.getContext?.("2d");
  const temp = typeof document === "undefined" ? null : canvas(BW, BH);
  const tctx = temp?.getContext("2d");
  if (!ctx || !temp || !tctx) return { set() {}, dispose() {} };
  target.width = BW;
  target.height = BH;
  const stamp = canvas(64, 64);
  const sctx = stamp.getContext("2d")!;
  const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,.75)");
  g.addColorStop(.55, "rgba(255,255,255,.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, 64, 64);

  let pools: readonly LitPool[] = [];
  let reduced = false;
  let key = "";
  const born = new Map<string, number>(); // when each pool first lit, for its fade-in
  let raf = 0;

  function paint(now: number) {
    raf = 0;
    ctx!.globalCompositeOperation = "source-over";
    ctx!.globalAlpha = 1;
    ctx!.clearRect(0, 0, BW, BH);
    ctx!.fillStyle = DARK;
    ctx!.fillRect(0, 0, BW, BH);
    let fading = false;
    for (const { pool: p, strength } of pools) {
      const age = now - (born.get(p.id) ?? -Infinity);
      const fade = reduced || age >= FADE_MS ? 1 : 1 - (1 - Math.max(0, age) / FADE_MS) ** 3;
      if (fade < 1) fading = true;
      // One soft capsule: overlapping round stamps along the spine; their alpha stacks to full in the middle, soft at the rim.
      tctx!.globalCompositeOperation = "source-over";
      tctx!.clearRect(0, 0, BW, BH);
      const size = p.r * 2.3 * S, step = p.r * .35, n = Math.max(1, Math.ceil(p.len / step));
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = (p.x1 + (p.x2 - p.x1) * f) * S, y = (p.y1 + (p.y2 - p.y1) * f) * S;
        tctx!.drawImage(stamp, x - size / 2, y - size / 2, size, size);
      }
      tctx!.globalCompositeOperation = "source-in";
      tctx!.fillStyle = WARM;
      tctx!.fillRect(0, 0, BW, BH);
      ctx!.globalCompositeOperation = "destination-out";
      ctx!.globalAlpha = strength * fade;
      ctx!.drawImage(temp!, 0, 0);
      ctx!.globalCompositeOperation = "source-over";
      ctx!.globalAlpha = .1 * strength * fade; // a lamp-warm cast over the art inside the pool
      ctx!.drawImage(temp!, 0, 0);
    }
    ctx!.globalAlpha = 1;
    ctx!.globalCompositeOperation = "source-over";
    if (fading) raf = requestAnimationFrame(paint);
  }

  return {
    /** Hand over the pools to show. Repaints only when they differ from the last set. */
    set(next: readonly LitPool[], reducedMotion: boolean) {
      const k = next.map((p) => p.pool.id + ":" + p.strength).join("|") + (reducedMotion ? "r" : "");
      if (k === key) return;
      key = k;
      reduced = reducedMotion;
      const now = performance.now();
      const ids = new Set(next.map((p) => p.pool.id));
      for (const id of [...born.keys()]) if (!ids.has(id)) born.delete(id);
      for (const p of next) if (!born.has(p.pool.id)) born.set(p.pool.id, pools.length ? now : -Infinity);
      pools = next;
      if (!raf) raf = requestAnimationFrame(paint);
    },
    dispose() {
      cancelAnimationFrame(raf);
    },
  };
}

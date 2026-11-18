import assert from "node:assert/strict";
import test from "node:test";
import {
  draw,
  getShakeOffset,
  hitStop,
  isFrozen,
  MAX_SHAKE_PX,
  numberPop,
  reset,
  ring,
  setReducedMotion,
  shake,
  spawnParticles,
  update,
} from "./fx";

function fakeCtx() {
  const fillRects: [number, number, number, number, number][] = []; // x,y,w,h,alpha
  const arcs: [number, number, number, number][] = []; // x,y,radius,alpha
  const texts: [string, number, number, number][] = []; // text,x,y,alpha
  let alpha = 1;
  const ctx = {
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      alpha = v;
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "left" as CanvasTextAlign,
    fillRect(x: number, y: number, w: number, h: number) {
      fillRects.push([x, y, w, h, alpha]);
    },
    beginPath() {},
    arc(x: number, y: number, r: number) {
      arcs.push([x, y, r, alpha]);
    },
    stroke() {},
    fillText(text: string, x: number, y: number) {
      texts.push([text, x, y, alpha]);
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fillRects, arcs, texts };
}

test.beforeEach(() => {
  reset();
  setReducedMotion(false);
});

test("the particle pool is deterministic: the same spawn sequence draws identically every time", () => {
  reset();
  spawnParticles(100, 50, 5, "#fff");
  update(16);
  const a = fakeCtx();
  draw(a.ctx);

  reset();
  spawnParticles(100, 50, 5, "#fff");
  update(16);
  const b = fakeCtx();
  draw(b.ctx);

  assert.deepEqual(a.fillRects, b.fillRects);
  assert.equal(a.fillRects.length, 5);
});

test("spawning past capacity wraps the cursor instead of growing: never more than the pool size is alive", () => {
  reset();
  spawnParticles(0, 0, 520, "#fff", 0); // more than PARTICLE_CAP (512)
  update(1);
  const { ctx, fillRects } = fakeCtx();
  draw(ctx);
  assert.ok(fillRects.length <= 512);
});

test("reduced motion suppresses particles, shake and hit-stop through the one flag", () => {
  setReducedMotion(true);
  spawnParticles(10, 10, 4, "#fff");
  shake(1);
  hitStop(200);
  update(16);
  assert.deepEqual(getShakeOffset(), { x: 0, y: 0 });
  assert.equal(isFrozen(), false);
  const { ctx, fillRects } = fakeCtx();
  draw(ctx);
  assert.equal(fillRects.length, 0, "no particles were spawned under reduced motion");
});

test("reduced motion still shows a number pop, just without the float", () => {
  setReducedMotion(true);
  numberPop(20, 20, "+1", "#0f0");
  update(16);
  const { ctx, texts } = fakeCtx();
  draw(ctx);
  assert.equal(texts.length, 1);
  assert.equal(texts[0][2], 20, "y stays put: no upward float under reduced motion");
});

test("shake offset decays to zero and never exceeds the configured max", () => {
  shake(1);
  for (let i = 0; i < 5; i++) {
    update(16);
    const { x, y } = getShakeOffset();
    assert.ok(Math.abs(x) <= MAX_SHAKE_PX && Math.abs(y) <= MAX_SHAKE_PX);
  }
  for (let i = 0; i < 200; i++) update(50);
  assert.deepEqual(getShakeOffset(), { x: 0, y: 0 });
});

test("hit-stop freezes fx (including particle motion) until it elapses, then resumes", () => {
  spawnParticles(5, 5, 1, "#fff", 100);
  update(16); // one normal tick: the particle moves
  const moved = fakeCtx();
  draw(moved.ctx);

  hitStop(60);
  update(30);
  assert.equal(isFrozen(), true);
  const mid = fakeCtx();
  draw(mid.ctx);
  assert.deepEqual(mid.fillRects, moved.fillRects, "position frozen mid hit-stop");

  update(40); // total 70ms > 60ms: the freeze has elapsed
  assert.equal(isFrozen(), false);
  update(16);
  const after = fakeCtx();
  draw(after.ctx);
  assert.notDeepEqual(after.fillRects, mid.fillRects, "motion resumes once the freeze elapses");
});

test("a ring is rate-limited (WCAG 2.3.1: no more than ~3 flashes/sec) unless flash:false", () => {
  update(0);
  ring(1, 1, "#f00", { duration: 10_000 }); // long-lived so it survives the wait below
  ring(1, 1, "#f00", { duration: 10_000 }); // same simulated instant: rejected
  const soon = fakeCtx();
  draw(soon.ctx);
  assert.equal(soon.arcs.length, 1, "the immediate repeat was blocked");

  for (let i = 0; i < 8; i++) update(50); // 400ms: past the 350ms flash cooldown (dt clamps to 50ms/update)
  ring(1, 1, "#f00", { duration: 10_000 });
  const later = fakeCtx();
  draw(later.ctx);
  assert.equal(later.arcs.length, 2, "a ring is allowed again once the cooldown has elapsed");

  reset();
  ring(1, 1, "#f00", { flash: false });
  ring(1, 1, "#f00", { flash: false });
  const exempt = fakeCtx();
  draw(exempt.ctx);
  assert.equal(exempt.arcs.length, 2, "flash:false bypasses the rate limit entirely");
});

test("reset clears every pool and accumulator", () => {
  spawnParticles(1, 1, 3, "#fff");
  ring(1, 1, "#fff");
  numberPop(1, 1, "+1", "#fff");
  shake(1);
  hitStop(100);
  update(10);
  reset();
  assert.deepEqual(getShakeOffset(), { x: 0, y: 0 });
  assert.equal(isFrozen(), false);
  const { ctx, fillRects, arcs, texts } = fakeCtx();
  draw(ctx);
  assert.equal(fillRects.length + arcs.length + texts.length, 0);
});

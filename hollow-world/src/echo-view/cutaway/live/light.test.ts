import test from "node:test";
import assert from "node:assert/strict";
import { createLightLayer } from "./light";

test("createLightLayer fails soft (no-op layer) when 2D context creation returns null", () => {
  const stub = { getContext: () => null } as unknown as HTMLCanvasElement;
  const layer = createLightLayer(stub, { sectorIds: ["link0", "main0"] });
  assert.equal(typeof layer.setReducedMotion, "function");
  assert.equal(typeof layer.draw, "function");
  assert.equal(typeof layer.dispose, "function");
  assert.doesNotThrow(() => layer.setReducedMotion(true));
  assert.doesNotThrow(() => layer.draw({ sectors: [], pulses: [], headlamps: [], t: 0, now: 0 }));
  assert.doesNotThrow(() => layer.dispose());
});

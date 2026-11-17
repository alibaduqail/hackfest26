import test from "node:test";
import assert from "node:assert/strict";
import { isMuted, play, setMuted, toggleMuted } from "./audio";
import { deadOnMaraRoute } from "./Prepare";
import { deadZones } from "../../echo/missions";

test("sound is muted by default and survives blocked storage and a missing AudioContext", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  assert.equal(typeof AudioContext, "undefined", "Node has no AudioContext");
  assert.equal(isMuted(), true, "default muted");
  assert.doesNotThrow(() => play("seal"));
  setMuted(false); // storage write throws inside: kept in memory
  assert.equal(isMuted(), false);
  assert.doesNotThrow(() => { play("place"); play("star", 2); });
  toggleMuted();
  assert.equal(isMuted(), true);
});

test("the Prepare preview counts dead tunnels on Mara's detour", () => {
  const m = deadZones();
  const all = m.world.sectors.map((s) => ({ ...s, beacon: true }));
  const none = m.world.sectors.map((s) => ({ ...s, beacon: false }));
  assert.equal(deadOnMaraRoute(m, all), 0);
  assert.ok(deadOnMaraRoute(m, none)! > 0, "an unlit route crosses dead tunnels");
  assert.equal(deadOnMaraRoute({ ...m, pods: [] }, none), null, "no MED-1, no line");
});

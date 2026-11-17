import test from "node:test";
import assert from "node:assert/strict";
import { isMuted, play, setMuted, toggleMuted, unlock } from "./audio";
import { deadOnMaraRoute, moveFocus } from "./Prepare";
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

test("play() never creates the AudioContext: only a user gesture (unlock) does", () => {
  setMuted(false); // sound left on, no AudioContext yet (Node)
  let made = 0;
  class Fake { state = "suspended"; destination = {}; createGain() { return { gain: { value: 0 }, connect() {} }; } resume() { return Promise.resolve(); } constructor() { made++; } }
  Object.defineProperty(globalThis, "AudioContext", { configurable: true, writable: true, value: Fake });
  play("place"); play("start");
  assert.equal(made, 0, "mount-time sounds must not build a context");
  unlock();
  assert.equal(made, 1, "the first gesture does");
  Reflect.deleteProperty(globalThis, "AudioContext");
});

test("keyboard focus walks the tunnels: Left/Right along the list, Up/Down between routes", () => {
  const m = deadZones();
  const order = [...m.world.sectors].sort((a, b) => a.routeId.localeCompare(b.routeId) || a.index - b.index);
  assert.equal(moveFocus(order, null, "ArrowRight"), order[0].id, "first arrow lands on the first tunnel");
  assert.equal(moveFocus(order, order[0].id, "ArrowRight"), order[1].id);
  assert.equal(moveFocus(order, order[0].id, "ArrowLeft"), order.at(-1)!.id, "wraps");
  const next = moveFocus(order, order[0].id, "ArrowDown")!;
  assert.notEqual(order.find((s) => s.id === next)!.routeId, order[0].routeId, "Down changes route");
  assert.equal(moveFocus(order, order[0].id, "a"), order[0].id);
});

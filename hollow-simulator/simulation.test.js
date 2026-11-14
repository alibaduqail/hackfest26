import test from 'node:test';
import assert from 'node:assert/strict';
import { scenario } from './scenario.js';
import { createSimulation } from './simulation.js';
import { createController } from './controller.js';
const finish = (s, before = () => {}) => { while (s.state.minute < scenario.endMinute) { before(s); s.step(); } return s.state; };
test('default flooding closes the only passage and produces traceable household-minutes', () => {
  const s = createSimulation(scenario), result = finish(s);
  assert.equal(result.delivered, 0); assert.equal(result.coolingMinutes, 0); assert.equal(result.cutoff, 12 * 9);
  assert.ok(result.events.some(e => e.minute === 4 && e.text.includes('passage closed')));
  assert.equal(result.events.filter(e => e.text.includes('Cart waiting')).length, 1);
});
test('early pump keeps the cart moving at the cost of cooling', () => {
  const s = createSimulation(scenario);
  assert.equal(s.act({ type: 'assignBackup', targetId: 'deep-pump' }).ok, true);
  const result = finish(s);
  assert.equal(result.cutoff, 0); assert.equal(result.delivered, 9); assert.equal(result.coolingMinutes, 12); assert.equal(result.battery, 8);
});
test('late pump makes the cart wait until the tunnel drains', () => {
  const s = createSimulation(scenario); for (let i = 0; i < 5; i++) s.step();
  assert.equal(s.state.closed, true); assert.equal(s.state.delivered, 0);
  s.act({ type: 'assignBackup', targetId: 'deep-pump' }); s.step();
  assert.equal(s.state.closed, false); assert.equal(s.state.delivered, 3); assert.equal(s.state.cutoff, 24);
});
test('controller sees stale readings during a communications cut', () => {
  const s = createSimulation(scenario), controller = createController(); s.setComms(false); finish(s, sim => controller(sim.observe, sim.act));
  assert.equal(s.observe().reading.timestamp, 0); assert.equal(s.observe().reading.stale, true);
  assert.equal(s.state.water, 12); assert.equal(s.state.backup, 'deep-fan');
});
test('example controller responds to a fresh rising-water report', () => {
  const s = createSimulation(scenario), controller = createController(); finish(s, sim => controller(sim.observe, sim.act));
  assert.equal(s.state.backup, 'deep-pump'); assert.equal(s.state.cutoff, 0); assert.equal(s.state.delivered, 9);
});
test('invalid actions and depleted batteries are rejected', () => {
  const s = createSimulation({ ...scenario, machines: { ...scenario.machines, batteryMinutes: 1 } });
  assert.equal(s.act({ type: 'assignBackup', targetId: 'clinic' }).ok, false); s.step();
  assert.equal(s.act({ type: 'assignBackup', targetId: 'deep-pump' }).ok, false);
});

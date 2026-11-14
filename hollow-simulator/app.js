import { scenario } from './scenario.js';
import { createSimulation } from './simulation.js';
import { createController } from './controller.js';
const $ = id => document.getElementById(id);
let sim, actions, controllerOn, bot, timer, speed = 1, selected = 'tunnel';
const fmt = n => `00:${String(n).padStart(2, '0')}`;
function runController(instance, fn) { try { fn(instance.observe, instance.act); } catch (error) { console.error('Controller error:', error); } }
function apply(instance, item) { if (item.type === 'assignBackup') instance.act(item); else if (item.type === 'comms') instance.setComms(item.value); }
function project(useActions) {
  const projected = createSimulation(scenario), projectedController = createController(); let enabled = false;
  while (projected.state.minute < scenario.endMinute) {
    if (useActions) for (const item of actions.filter(a => a.minute === projected.state.minute)) { if (item.type === 'controller') enabled = item.value; else apply(projected, item); }
    if (enabled) runController(projected, projectedController);
    projected.step();
  }
  return projected.state;
}
function remember(item) { actions.push({ ...item, minute: sim.state.minute }); }
function tick() { if (controllerOn) runController(sim, bot); if (!sim.step() || sim.state.minute >= scenario.endMinute) pause(); render(); }
function pause() { clearInterval(timer); timer = null; $('play').innerHTML = '▶ &nbsp; Play'; }
function reset() { pause(); sim = createSimulation(scenario); actions = []; controllerOn = false; bot = createController(); render(); }
function render() {
  const s = sim.state, m = scenario.machines, report = sim.observe();
  $('clock').innerHTML = `${fmt(s.minute)} <small>/ ${fmt(scenario.endMinute)}</small>`;
  $('progressFill').style.width = `${s.minute / scenario.endMinute * 100}%`;
  $('mapStatus').textContent = !s.failed ? 'Awaiting incident' : s.closed ? 'Passage flooded' : 'Passage open';
  $('battery').textContent = `${s.battery} / ${m.batteryMinutes} MIN`;
  $('batteryFill').style.width = `${s.battery / m.batteryMinutes * 100}%`;
  $('powerBadge').textContent = !s.failed ? 'STANDBY' : s.battery ? 'BACKUP ACTIVE' : 'DEPLETED';
  document.querySelectorAll('.power-option').forEach(b => { b.classList.toggle('active', b.dataset.target === s.backup); b.setAttribute('aria-pressed', String(b.dataset.target === s.backup)); });
  for (const [id, value] of [['controller', controllerOn], ['comms', s.comms]]) { $(id).classList.toggle('on', value); $(id).setAttribute('aria-checked', String(value)); }
  $('reportStatus').textContent = report.reading ? `${s.comms ? 'Connected' : 'Cut'} · ${report.reading.stale ? 'stale' : 'report'} ${fmt(report.reading.timestamp)} · water ${report.reading.water}${report.reading.stale ? ` (${s.minute - report.reading.timestamp} min old)` : ''}` : 'Unknown · no reading';
  const height = Math.min(94, s.water / Math.max(m.closeAt, 1) * 50); $('water').setAttribute('height', height); $('water').setAttribute('y', 491 - height);
  $('waterText').textContent = `WATER ${s.water} / ${m.closeAt}${s.closed ? ' · CLOSED' : ''}`;
  document.querySelector('[data-id="homes"]').classList.toggle('blackout', s.failed);
  $('fanBlades').classList.toggle('spinning', !s.failed || (s.backup === 'deep-fan' && s.battery > 0));
  const positions = [[710, 175], [748, 250], [748, 350], [620, 411], [520, 411]];
  const pos = positions[Math.min(s.cartProgress, positions.length - 1)]; $('cart').setAttribute('transform', `translate(${pos[0]} ${pos[1]})`);
  const room = scenario.rooms.find(r => r.id === selected); $('inspectTitle').textContent = room.name; $('inspectLevel').textContent = `${room.level.toUpperCase()} LEVEL · ${room.id.toUpperCase()}`; $('inspectText').textContent = room.depends;
  $('inspectStatus').textContent = selected === 'tunnel' ? (s.closed ? 'Closed · cart cannot pass' : 'Passage open') : selected === 'deep-fan' || selected === 'deep-pump' ? (!s.failed || (s.backup === selected && s.battery > 0) ? 'Powered' : 'No power') : selected === 'homes' ? `${s.coolingMinutes} min without cooling` : selected === 'clinic' ? 'Powered · independent feeder' : 'Operational';
  document.querySelectorAll('.region').forEach(e => e.classList.toggle('selected', e.dataset.id === selected));
  const base = project(false), yours = project(true);
  for (const [id, value] of [['baseCrates', base.delivered], ['yourCrates', yours.delivered], ['baseCooling', base.coolingMinutes], ['yourCooling', yours.coolingMinutes], ['baseCutoff', base.cutoff], ['yourCutoff', yours.cutoff]]) $(id).textContent = value;
  const households = scenario.households.filter(h => h.route?.includes('tunnel')).reduce((a, h) => a + h.count, 0);
  $('cutoffDetail').textContent = `Lower: ${households} households × ${households ? yours.cutoff / households : 0} closed minutes = ${yours.cutoff}. Upper / middle: 0.`;
  $('events').replaceChildren(...(s.events.length ? s.events.slice().reverse() : [{ minute: 0, text: 'District standing by. Press Play or step forward to begin.' }]).map(e => { const row = document.createElement('div'); const t = document.createElement('time'); t.textContent = fmt(e.minute); const p = document.createElement('span'); p.textContent = e.text; row.append(t, p); return row; }));
}
$('play').onclick = () => { if (timer) { pause(); return; } if (sim.state.minute >= scenario.endMinute) return; $('play').innerHTML = '❚❚ &nbsp; Pause'; timer = setInterval(tick, 1000 / speed); };
$('step').onclick = () => { pause(); tick(); };
$('speed').onclick = () => { speed = speed === 1 ? 4 : 1; $('speed').textContent = `Speed: ${speed}×`; if (timer) { pause(); $('play').click(); } };
$('reset').onclick = reset;
document.querySelectorAll('.power-option').forEach(button => button.onclick = () => { const action = { type: 'assignBackup', targetId: button.dataset.target }; if (sim.act(action).ok) remember(action); render(); });
$('controller').onclick = () => { if (sim.state.minute >= scenario.endMinute) return; controllerOn = !controllerOn; remember({ type: 'controller', value: controllerOn }); render(); };
$('comms').onclick = () => { if (sim.state.minute >= scenario.endMinute) return; sim.setComms(!sim.state.comms); remember({ type: 'comms', value: sim.state.comms }); render(); };
document.querySelectorAll('.region').forEach(el => { const select = () => { selected = el.dataset.id; render(); }; el.addEventListener('click', select); el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }); });
reset();

export function createSimulation(config) {
  const s = { minute: 0, failed: false, backup: 'deep-fan', battery: config.machines.batteryMinutes, water: 0, closed: false, comms: true, cartProgress: 0, delivered: 0, coolingMinutes: 0, cutoff: 0, events: [], report: null };
  const record = (text) => s.events.push({ minute: s.minute, text });
  function publish() {
    if (s.comms) s.report = { timestamp: s.minute, water: s.water, passageClosed: s.closed, backup: s.backup, battery: s.battery, lowerFeederFailed: s.failed };
  }
  function observe() {
    return { now: s.minute, communications: s.comms, reading: s.report ? { ...s.report, stale: s.report.timestamp < s.minute || !s.comms } : null };
  }
  function act(action) {
    if (!action || action.type !== 'assignBackup' || !['deep-fan', 'deep-pump'].includes(action.targetId)) return { ok: false, reason: 'Unknown action or target.' };
    if (s.minute >= config.endMinute) return { ok: false, reason: 'Run has ended.' };
    if (s.battery <= 0) return { ok: false, reason: 'Battery is empty.' };
    if (s.backup !== action.targetId) { s.backup = action.targetId; record(`Backup assigned to ${s.backup === 'deep-fan' ? 'fan' : 'pump'}.`); }
    return { ok: true };
  }
  function setComms(connected) { if (s.comms !== connected) { s.comms = connected; record(`Communications ${connected ? 'restored' : 'cut'}.`); if (connected) publish(); } }
  function step() {
    if (s.minute >= config.endMinute) return false;
    s.minute++;
    for (const failure of config.failures.filter(f => f.minute === s.minute)) { if (failure.id === 'lower-feeder') s.failed = true; record(failure.description); }
    const powered = s.failed && s.battery > 0;
    const fan = !s.failed || (powered && s.backup === 'deep-fan');
    const pump = !s.failed || (powered && s.backup === 'deep-pump');
    if (s.failed && !fan) s.coolingMinutes++;
    if (s.failed) s.water = Math.max(0, s.water + (pump ? -config.machines.pumpDrain : config.machines.floodRise));
    const wasClosed = s.closed;
    if (!s.closed && s.water >= config.machines.closeAt) s.closed = true;
    else if (s.closed && s.water < config.machines.reopenBelow) s.closed = false;
    if (s.closed !== wasClosed) record(s.closed ? `Sump passage closed at water mark ${s.water}; ${lowerHouseholds()} households cut off.` : `Sump passage reopened at water mark ${s.water}.`);
    if (s.closed) s.cutoff += lowerHouseholds();
    const previousProgress = s.cartProgress;
    if (s.cartProgress < config.cart.travelMinutes) s.cartProgress++;
    if (s.cartProgress >= config.cart.travelMinutes && !s.closed) { s.delivered += config.cart.crates; s.cartProgress = 0; record(`Cart delivered ${config.cart.crates} crates to lower homes.`); }
    else if (s.cartProgress === config.cart.travelMinutes && s.closed && (previousProgress < config.cart.travelMinutes || !wasClosed)) record('Cart waiting at flooded passage.');
    if (powered) { s.battery--; if (!s.battery) record('Backup battery depleted.'); }
    publish();
    return true;
  }
  function lowerHouseholds() { return config.households.filter(h => h.route?.includes('tunnel')).reduce((n, h) => n + h.count, 0); }
  publish();
  return { state: s, observe, act, step, setComms };
}

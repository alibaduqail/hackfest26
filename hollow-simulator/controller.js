// Replace this factory with your team's controller. Each replay gets its own instance.
export function createController() {
  return function controller(observe, act) {
    const { reading } = observe();
    if (reading && !reading.stale && reading.lowerFeederFailed && reading.water > 0) {
      act({ type: 'assignBackup', targetId: 'deep-pump' });
    }
  };
}

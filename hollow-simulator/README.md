# The Hollow Simulator

A fictional, deterministic district blackout: choose between cooling lower homes and draining their only supply passage. All capacities, populations, and rates are invented for demonstration, not engineering data.

## Run it

Requires Node.js 18 or newer; no packages need to be installed.

```sh
cd hollow-simulator
npm start
```

Open <http://127.0.0.1:4173>. The app starts paused. Use **Play**, **Step +1 min**, **Speed: 1×** (click for 4×), and **Reset**. Click a location in the cutaway to inspect it. Run checks with `npm test`.

### Two-minute demo

1. Leave the fan selected and play at 4×. At minute 4, water closes the passage; the cart waits. The clinic remains powered.
2. Reset, select the pump before minute 4, and play again. The cart delivers, but the homes lose cooling. Alternatively, switch after the flood and watch the cart wait for drainage.
3. The comparison projects both decisions to minute 12, with the same starting conditions and failures. The timeline records the run on screen. The default gives 0 crates, 0 minutes without cooling, and 108 household-minutes cut off: 12 households × 9 closed minutes (minutes 4–12). Switching to the pump before the first minute gives 9 crates, 12 minutes without cooling, and 0 household-minutes cut off.
4. Reset, turn on **Example controller**, and play. Cut **Communications** to see the actual water continue to rise while the controller's last report ages.

## Connect your code

Edit `controller.js`. `createController()` returns a function called once immediately before each simulated minute while the example-controller switch is on:

```js
export function createController() {
  return (observe, act) => {
    const { now, communications, reading } = observe();
    if (reading && !reading.stale && reading.water > 0) {
      const result = act({ type: 'assignBackup', targetId: 'deep-pump' });
      // result is { ok: true } or { ok: false, reason: '...' }
    }
  };
}
```

`reading` is `null` when no report exists; otherwise it contains `timestamp`, `stale`, `water`, `passageClosed`, `backup`, `battery`, and `lowerFeederFailed`. The timestamp is the simulated minute of the last received report, not the current time. With communications cut, the simulator retains that report and marks it stale. When restored, a fresh report is published immediately. The map always shows the actual state.

Valid action targets are `deep-fan` and `deep-pump`. Manual buttons use the same `act` function and validation. Actions are rejected for unknown targets, an empty battery, or after the run ends. The controller may keep state in its factory closure: each replay receives its own controller instance. For reproducible comparisons, keep it deterministic and avoid external side effects, wall-clock time, random values, and modifying shared global state. Controller errors appear in the browser console. Reload after editing your code.

## Scenario and timing

Edit `scenario.js` to change the district's named locations, household counts and routes, connection list, battery capacity, flood/drain rates, closure thresholds, cart capacity/travel time, incident time, or end minute. Room and machine IDs are stable integration identifiers. The **illustrated cutaway geometry and labels are in `index.html`**; if you change the map topology or add locations, update that SVG and the corresponding simulation rules too. The current engine models one lower feeder, one passage, one fan, one pump, and one cart; the connections describe this fixed topology rather than a general routing engine.

At each minute: scheduled failures occur, the assigned machine uses one minute of battery, water changes, the passage closes or reopens, closed households accumulate one household-minute each, and the cart advances or waits. A cart delivers its configured crates when it reaches an open passage, then starts another trip. The default passage closes at water mark 4 and reopens below 4. Battery is consumed only after the feeder fails. Upper and middle households are unaffected by this incident.

The comparison replays your recorded manual assignments, communications changes, and controller toggle from minute 0, then continues to the common ending minute. Until you reach the end it is a **projection**, not the completed result. Decisions at a given clock time apply to the next minute. It assumes deterministic controller code and the same scenario throughout. The current on-screen timeline is the evidence for its closure and reopening; use Reset to replay the default or intervention and inspect those events.

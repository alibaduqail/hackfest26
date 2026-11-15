// Generate genuine engine snapshots for repeatable browser inspection through Import.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { HollowEngine } from "../src/engine/engine";
import { validateSave } from "../src/engine/validation";
import type { Scenario } from "../src/engine/types";
const scenario: Scenario = JSON.parse(
  readFileSync(new URL("../public/scenario.json", import.meta.url), "utf8"),
);
const output = new URL("./states/", import.meta.url);
mkdirSync(output, { recursive: true });
function save(name: string, engine: HollowEngine) {
  validateSave(scenario, engine.state);
  writeFileSync(
    new URL(`${name}.json`, output),
    JSON.stringify({ format: "hollow-save-v1", scenario, state: engine.state }),
  );
}
const engine = new HollowEngine(scenario);
save("initial", engine);
const mara = new HollowEngine(scenario);
mara.step(90);
save("mara-clinic", mara);
let rider = "";
for (let i = 0; i < 7200; i++) {
  engine.step();
  const p = engine.state.people.find(
    (p) =>
      scenario.links.find((l) => l.id === p.edgeId)?.kind === "lift" &&
      p.edgeProgress > 0.05 &&
      p.edgeProgress < 0.2,
  );
  if (p) {
    rider = p.id;
    save("lift-boarding", engine);
    break;
  }
}
if (!rider) throw new Error("No lift crossing found");
const riderDef = scenario.residents.find((p) => p.id === rider)!;
console.log(
  JSON.stringify({
    liftRider: riderDef.name,
    id: rider,
    tick: engine.state.tick,
    person: engine.state.people.find((p) => p.id === rider),
  }),
);
const staffed = new HollowEngine(scenario);
staffed.step(2400);
save("occupied", staffed);
const commons = new HollowEngine(scenario);
commons.step(4200);
save("commons", commons);
const cart = new HollowEngine(scenario);
cart.step(60);
save("cart-loaded", cart);
for (let i = 0; i < 7200; i++) {
  cart.step();
  if (cart.state.cart.phase === "unloading") {
    save("cart-unloading", cart);
    break;
  }
}
cart.step(16);
save("cart-empty-return", cart);
const blackout = new HollowEngine(scenario);
blackout.step(60);
blackout.incident("blackout");
for (let i = 0; i < 3600; i++) {
  blackout.step();
  if (
    blackout.state.closedLinks.length &&
    blackout.state.cart.phase === "waiting" &&
    blackout.state.cart.cargo.food > 0
  )
    break;
}
save("blackout-blocked", blackout);
const blackoutReview = new HollowEngine(
  scenario,
  structuredClone(blackout.state),
);
blackoutReview.step(Math.max(0, 600 - blackoutReview.state.tick));
save("blackout-review", blackoutReview);
console.log(
  JSON.stringify({
    blockedTick: blackout.state.tick,
    cart: blackout.state.cart,
    homesConnected: blackout.state.households.filter((h) => !h.accessClosed)
      .length,
  }),
);

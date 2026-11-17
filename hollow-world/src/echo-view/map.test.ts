import test from "node:test";
import assert from "node:assert/strict";
import { towerDown } from "../echo/missions";
import { staticObs } from "./game/campaign";
import { lane, makeProjection, sectorAt } from "./map";

test("projected directed lanes remain selectable in full and split panes", () => {
  const obs = staticObs(towerDown());
  for (const [w, h] of [[1440, 750], [550, 750]]) {
    const project = makeProjection(obs, w, h);
    for (const city of obs.cities) {
      const [x, y] = project([city.x, city.y]);
      assert.ok(x > 0 && x < w && y > 0 && y < h, `${city.name} fits`);
    }
    for (const s of obs.sectors) {
      const [a, b] = lane(project, s);
      assert.equal(sectorAt(obs, w, h, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2), s.id, `${s.id} in ${w}px pane`);
    }
  }
});

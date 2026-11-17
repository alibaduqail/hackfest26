import { test } from "node:test";
import assert from "node:assert/strict";
import { constrainCamera, elasticCamera, fitZoom } from "./camera";
const world = { left: 0, top: 0, right: 1000, bottom: 800 };
const view = { left: 100, top: 50, right: 900, bottom: 650 };

test("overview fits a wide settlement in the actual narrow viewport", () => {
  const settlement = { left: 0, top: 0, right: 2456, bottom: 1600 };
  const narrow = { left: 148, top: 16, right: 374, bottom: 828 };
  const zoom = fitZoom(settlement, narrow, 0.78);
  assert.ok(zoom < 0.22);
  assert.ok((settlement.right - settlement.left) * zoom <= narrow.right - narrow.left);
  assert.ok((settlement.bottom - settlement.top) * zoom <= narrow.bottom - narrow.top);
});

test("a camera inside the map keeps its position", () => {
  assert.deepEqual(constrainCamera({ x: 20, y: -40 }, world, view, 1), {
    x: 20,
    y: -40,
  });
  assert.deepEqual(elasticCamera({ x: 20, y: -40 }, world, view, 1), {
    x: 20,
    y: -40,
  });
});
test("overscroll returns to the closest edge or corner, including zoomed bounds", () => {
  assert.deepEqual(constrainCamera({ x: 500, y: 400 }, world, view, 1), {
    x: 100,
    y: 50,
  });
  assert.deepEqual(constrainCamera({ x: -500, y: -400 }, world, view, 1), {
    x: -100,
    y: -150,
  });
  assert.deepEqual(constrainCamera({ x: 20, y: -400 }, world, view, 1), {
    x: 20,
    y: -150,
  });
  assert.deepEqual(constrainCamera({ x: -3000, y: -3000 }, world, view, 2), {
    x: -1100,
    y: -950,
  });
});
test("a zoomed-out settlement centers in the available viewport", () => {
  assert.deepEqual(
    constrainCamera(
      { x: 900, y: 900 },
      { left: 100, top: 50, right: 300, bottom: 150 },
      view,
      1,
    ),
    { x: 300, y: 250 },
  );
  assert.deepEqual(
    constrainCamera(
      { x: -700, y: 300 },
      { left: 0, top: 0, right: 1200, bottom: 100 },
      { left: 0, top: 0, right: 800, bottom: 600 },
      1,
    ),
    { x: -400, y: 250 },
  );
});
test("drag resistance leaves a small finite overshoot that can settle to the same corner", () => {
  const dragged = elasticCamera({ x: 10000, y: -10000 }, world, view, 1);
  assert.ok(dragged.x > 100 && dragged.x < 180);
  assert.ok(dragged.y < -150 && dragged.y > -230);
  assert.deepEqual(constrainCamera(dragged, world, view, 1), {
    x: 100,
    y: -150,
  });
});
test("the inspector reduces available space without moving a valid camera unnecessarily", () => {
  const open = { ...view, right: 560 };
  assert.deepEqual(constrainCamera({ x: 20, y: -40 }, world, open, 1), {
    x: 20,
    y: -40,
  });
  assert.deepEqual(constrainCamera({ x: -500, y: -40 }, world, open, 1), {
    x: -440,
    y: -40,
  });
});

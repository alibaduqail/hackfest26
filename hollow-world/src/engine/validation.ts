import type { Scenario, WorldState } from "./types";
const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};
export function validateScenario(input: unknown): asserts input is Scenario {
  if (!input || typeof input !== "object")
    fail("scenario", "expected an object");
  const s = input as Scenario;
  if (s.schemaVersion !== 1 || s.modelVersion !== "hollow-1")
    fail("schemaVersion", "unsupported schema/model");
  if (
    typeof s.id !== "string" ||
    !s.id ||
    !Number.isSafeInteger(s.seed) ||
    !Number.isFinite(s.startHour)
  )
    fail("scenario", "invalid id, seed or startHour");
  for (const key of [
    "rooms",
    "links",
    "residents",
    "households",
    "incidents",
    "assumptions",
    "airZones",
    "waterLinks",
  ] as const)
    if (!Array.isArray(s[key])) fail(key, "expected array");
  if (!s.rooms.length || s.rooms.length > 300 || s.residents.length > 2000)
    fail("scenario", "limit: 1–300 rooms, up to 2000 residents");
  const ids = new Set<string>();
  for (const [key, array] of [
    ["rooms", s.rooms],
    ["links", s.links],
    ["residents", s.residents],
    ["households", s.households],
    ["incidents", s.incidents],
  ] as const)
    for (const x of array) {
      if (!x || typeof x.id !== "string" || ids.has(x.id))
        fail(key, "invalid or duplicate id");
      ids.add(x.id);
    }
  const rooms = new Map(s.rooms.map((r) => [r.id, r]));
  const kinds = [
    "home",
    "clinic",
    "depot",
    "farm",
    "plant",
    "switchgear",
    "recycler",
    "tap",
    "fan",
    "pump",
    "workshop",
    "mess",
    "checkpoint",
    "relay",
    "gate",
  ];
  for (const r of s.rooms) {
    if (!kinds.includes(r.kind) || typeof r.name !== "string")
      fail(r.id, "invalid name/kind");
    for (const key of [
      "x",
      "y",
      "w",
      "h",
      "floor",
      "district",
      "demandW",
      "beds",
      "capacity",
      "condition",
    ] as const)
      if (!Number.isFinite(r[key]) || r[key] < 0)
        fail(`${r.id}.${key}`, "expected finite nonnegative value");
    if (
      !Number.isInteger(r.floor) ||
      !Number.isInteger(r.district) ||
      !Number.isInteger(r.capacity) ||
      r.capacity < 1
    )
      fail(r.id, "floor, district and capacity must be valid integers");
    if (
      r.condition > 100 ||
      (r.feederFloor !== undefined &&
        (!Number.isInteger(r.feederFloor) ||
          r.feederFloor < 0 ||
          r.feederFloor > 7))
    )
      fail(r.id, "invalid condition or feeder level");
    if (r.w < 30 || r.h < 30 || r.district > 2 || r.floor > 7)
      fail(r.id, "invalid geometry/district/depth");
    validateStock(r.stock, `${r.id}.stock`);
  }
  for (const zone of s.airZones)
    if (
      rooms.get(zone.fanId)?.kind !== "fan" ||
      !Array.isArray(zone.roomIds) ||
      zone.roomIds.some((id) => !rooms.has(id))
    )
      fail("airZones", "invalid fan or served rooms");
  for (const link of s.waterLinks)
    if (
      !rooms.has(link.fromId) ||
      !rooms.has(link.toId) ||
      !Number.isFinite(link.litersPerSecond) ||
      link.litersPerSecond < 0
    )
      fail("waterLinks", "invalid endpoints or rate");
  for (const l of s.links) {
    if (
      !rooms.has(l.a) ||
      !rooms.has(l.b) ||
      l.a === l.b ||
      !["corridor", "stairs", "lift", "sump", "checkpoint"].includes(l.kind) ||
      !Number.isFinite(l.seconds) ||
      l.seconds <= 0 ||
      !Number.isInteger(l.capacity) ||
      l.capacity < 1
    )
      fail(l.id, "invalid connection endpoints, type, travel time or capacity");
  }
  const people = new Map(s.residents.map((p) => [p.id, p]));
  const households = new Map(s.households.map((h) => [h.id, h]));
  for (const h of s.households) {
    if (
      rooms.get(h.homeId)?.kind !== "home" ||
      rooms.get(h.depotId)?.kind !== "depot" ||
      !Array.isArray(h.members) ||
      !h.members.length ||
      new Set(h.members).size !== h.members.length ||
      h.members.some((id) => people.get(id)?.householdId !== h.id)
    )
      fail(h.id, "invalid home, depot or members");
    validateStock(h.stock, `${h.id}.stock`);
  }
  for (const p of s.residents) {
    if (
      typeof p.name !== "string" ||
      typeof p.role !== "string" ||
      typeof p.permit !== "boolean" ||
      !Number.isFinite(p.appearance) ||
      !Number.isFinite(p.shift) ||
      !rooms.has(p.homeId) ||
      !households.get(p.householdId)?.members.includes(p.id) ||
      (p.workId !== null && !rooms.has(p.workId))
    )
      fail(p.id, "invalid resident/home/work/household reference");
  }
  if (!s.settings || typeof s.settings !== "object")
    fail("settings", "expected settings");
  const keys = [
    "hungerPerSecond",
    "thirstPerSecond",
    "fatiguePerSecond",
    "sleepRecoveryPerSecond",
    "heatResponse",
    "waterTreatmentLps",
    "waterTreatmentYield",
    "growWaterLps",
    "harvestUnits",
    "fanAirReduction",
    "occupiedAirLoad",
    "stagnantAirRise",
    "baseCelsius",
    "depthHeating",
    "fanCoolingDelta",
    "storageCapacity",
    "generationW",
    "batteryWh",
    "batteryMaxW",
    "seepLps",
    "pumpLps",
    "tunnelAreaM2",
    "closeDepthM",
    "reportEvery",
    "reportDelay",
    "reportStaleAfter",
    "cropSeconds",
    "cartCrates",
    "cartCapacity",
  ] as const;
  for (const key of keys)
    if (!Number.isFinite(s.settings[key]) || s.settings[key] < 0)
      fail(`settings.${key}`, "expected finite nonnegative value");
  for (const key of [
    "tunnelAreaM2",
    "closeDepthM",
    "reportEvery",
    "cropSeconds",
    "cartCapacity",
  ] as const)
    if (s.settings[key] <= 0) fail(`settings.${key}`, "must be positive");
  if (s.settings.cartCrates > s.settings.cartCapacity)
    fail("settings.cartCrates", "exceeds cart capacity");
  if (s.settings.waterTreatmentYield > 1 || s.settings.heatResponse > 1)
    fail(
      "settings",
      "yield and integration response must be between zero and one",
    );
  for (const i of s.incidents)
    if (
      !Number.isSafeInteger(i.tick) ||
      i.tick < 0 ||
      ![
        "blackout",
        "restore",
        "comms",
        "reconnect",
        "lockdown",
        "unlock",
      ].includes(i.kind)
    )
      fail("incidents", "invalid tick or incident kind");
}
export function validateStock(stock: unknown, path: string) {
  if (!stock || typeof stock !== "object") fail(path, "expected stock");
  for (const key of ["food", "water", "medicine", "parts", "waste"])
    if (
      !Number.isFinite((stock as Record<string, number>)[key]) ||
      (stock as Record<string, number>)[key] < 0
    )
      fail(`${path}.${key}`, "expected finite nonnegative quantity");
}
export function scenarioHash(s: Scenario) {
  const str = JSON.stringify(s);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++)
    hash = Math.imul(hash ^ str.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function validateSave(
  s: Scenario,
  input: unknown,
): asserts input is WorldState {
  validateScenario(s);
  const w = input as WorldState;
  if (
    !w ||
    w.schemaVersion !== 1 ||
    w.modelVersion !== s.modelVersion ||
    w.scenarioHash !== scenarioHash(s) ||
    !Number.isSafeInteger(w.tick) ||
    w.tick < 0 ||
    typeof w.runId !== "string"
  )
    fail("save", "incompatible scenario/model or invalid time");
  for (const key of [
    "rooms",
    "people",
    "households",
    "events",
    "reports",
    "pendingReports",
    "disabled",
    "closedLinks",
    "receipts",
    "commands",
    "commandLog",
    "actions",
    "deficits",
  ] as const)
    if (!Array.isArray(w[key])) fail(`save.${key}`, "expected array");
  const numeric = (object: unknown, keys: string[], path: string) => {
    for (const key of keys) {
      const value = (object as Record<string, unknown>)?.[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
        fail(`${path}.${key}`, "expected finite nonnegative number");
    }
  };
  numeric(
    w,
    [
      "tick",
      "eventSequence",
      "inputSequence",
      "batteryMilliWh",
      "batteryResidual",
      "waterL",
      "topology",
    ],
    "save",
  );
  numeric(w.hydrology, ["inflowL", "drainedL"], "save.hydrology");
  for (const key of ["comms", "blackout", "lockdown"] as const)
    if (typeof w[key] !== "boolean") fail(`save.${key}`, "expected boolean");
  if(typeof w.backupTarget!=="string"||w.backupTarget&&!s.rooms.some(r=>r.id===w.backupTarget&&r.kind===w.backup))fail("save.backupTarget","unknown machine");
  if (!["fan", "pump"].includes(w.backup))
    fail("save.backup", "unknown assignment");
  for (const r of w.rooms)
    numeric(
      r,
      [
        "suppliedW",
        "temperature",
        "air",
        "contamination",
        "occupants",
        "staff",
        "growth",
        "output",
        "condition",
      ],
      `save.${r.id}`,
    );
  for (const h of w.households)
    numeric(
      h,
      ["cutoffSeconds", "coolingSeconds", "unmetFood", "unmetWater"],
      `save.${h.id}`,
    );
  for (const p of w.people) {
    numeric(
      p,
      [
        "edgeProgress",
        "activityUntil",
        "nextPlan",
        "hunger",
        "thirst",
        "fatigue",
        "heatExposure",
        "airExposure",
        "careNeeded",
        "completed",
      ],
      `save.${p.id}`,
    );
    if (
      !Array.isArray(p.path) ||
      !Array.isArray(p.knownClosed) ||
      typeof p.task !== "string" ||
      typeof p.reason !== "string"
    )
      fail(p.id, "invalid task/knowledge");
  }
  numeric(w.cart, ["progress", "delivered", "until"], "save.cart");
  for (const r of [...w.reports, ...w.pendingReports])
    numeric(
      r,
      ["sampledAtTick", "receivedAtTick", "waterM", "temperature", "air"],
      "save.report",
    );
  for (const c of w.commands)
    if (
      c.expectedRunId !== w.runId ||
      c.actorId !== "district-operator" ||
      !s.rooms.some((r) => r.id === c.targetId) ||
      ![
        "assignBackup",
        "setDeviceEnabled",
        "requestRepair",
        "requestDelivery",
      ].includes(c.type) ||
      (c.type === "assignBackup" &&
        !["fan", "pump"].includes(String(c.value))) ||
      (c.type === "setDeviceEnabled" && typeof c.value !== "boolean")
    )
      fail("save.commands", "invalid queued request");
  const ids = new Set(s.rooms.map((r) => r.id));
  const links = new Set(s.links.map((l) => l.id));
  for (const [list, defs] of [
    [w.rooms, s.rooms],
    [w.people, s.residents],
    [w.households, s.households],
  ] as const)
    if (
      list.length !== defs.length ||
      new Set(list.map((x) => x.id)).size !== defs.length ||
      list.some((x) => !defs.some((d) => d.id === x.id))
    )
      fail("save", "entity identity mismatch");
  function finiteTree(value: unknown, path: string) {
    if (typeof value === "number" && !Number.isFinite(value))
      fail(path, "invalid numeric value");
    if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) finiteTree(v, `${path}.${k}`);
  }
  finiteTree(w, "save");
  for (const r of w.rooms) {
    validateStock(r.stock, `save.${r.id}.stock`);
    if (
      typeof r.powered !== "boolean" ||
      r.temperature < 0 ||
      r.air < 0 ||
      r.air > 100
    )
      fail(r.id, "invalid room state");
  }
  for (const h of w.households) {
    validateStock(h.stock, `save.${h.id}.stock`);
    if (h.cutoffSeconds < 0 || h.coolingSeconds < 0)
      fail(h.id, "invalid deficit");
  }
  for (const p of w.people) {
    validateStock(p.bag, `save.${p.id}.bag`);
  }
  for (const p of w.people)
    if (
      !ids.has(p.roomId) ||
      !ids.has(p.destination) ||
      (p.edgeId && !links.has(p.edgeId)) ||
      p.path.some((id) => !links.has(id)) ||
      !["traveling", "queued", "active", "blocked", "resting"].includes(
        p.taskState,
      ) ||
      p.edgeProgress < 0 ||
      p.edgeProgress > 1
    )
      fail(p.id, "invalid resident position/task");
  if (
    !w.cart ||
    !ids.has(w.cart.roomId) ||
    !ids.has(w.cart.targetId) ||
    w.cart.path.some((id) => !links.has(id)) ||
    (w.cart.edgeId && !links.has(w.cart.edgeId)) ||
    w.batteryMilliWh < 0 ||
    w.waterL < 0
  )
    fail("save", "invalid cart/resources");
  validateStock(w.cart.cargo, "save.cart.cargo");
  validateStock(w.ledger.produced, "save.ledger.produced");
  validateStock(w.ledger.consumed, "save.ledger.consumed");
  validateStock(w.ledger.external, "save.ledger.external");
}

import type {
  CartState,
  Command,
  HouseholdState,
  IncidentKind,
  Item,
  PersonDef,
  PersonState,
  Receipt,
  RoomDef,
  RoomState,
  Scenario,
  Stock,
  WorldState,
} from "./types";
import { blocked, Router } from "./routing";
import { scenarioHash, validateSave, validateScenario } from "./validation";
export const emptyStock = (): Stock => ({
  food: 0,
  water: 0,
  medicine: 0,
  parts: 0,
  waste: 0,
});
const round = (n: number) => Math.round(n * 1000) / 1000;
export class HollowEngine {
  state: WorldState;
  router: Router;
  rooms: Map<string, RoomDef>;
  roomState: Map<string, RoomState>;
  personDefs: Map<string, PersonDef>;
  homes: Map<string, HouseholdState>;
  links: Map<string, Scenario["links"][number]>;
  constructor(
    public scenario: Scenario,
    saved?: WorldState,
    runId = "run-1",
  ) {
    validateScenario(scenario);
    this.router = new Router(scenario);
    this.rooms = new Map(scenario.rooms.map((r) => [r.id, r]));
    this.links = new Map(scenario.links.map((l) => [l.id, l]));
    this.personDefs = new Map(scenario.residents.map((p) => [p.id, p]));
    const depot = scenario.rooms.find((r) => r.kind === "depot")!;
    if (!depot) throw new Error("scenario: requires a depot");
    const initial: WorldState = {
      schemaVersion: 1,
      modelVersion: scenario.modelVersion,
      scenarioHash: scenarioHash(scenario),
      runId,
      tick: 0,
      rooms: scenario.rooms.map((r) => ({
        id: r.id,
        powered: true,
        suppliedW: r.demandW,
        temperature: 23 + r.floor * 0.85,
        air: 8 + r.floor,
        contamination: 0,
        stock: { ...r.stock },
        occupants: 0,
        staff: 0,
        growth: 0,
        output: 0,
        condition: r.condition,
        reason: "Operating",
      })),
      people: scenario.residents.map((p, i) => ({
        id: p.id,
        roomId: p.homeId,
        edgeId: null,
        fromId: p.homeId,
        toId: p.homeId,
        edgeProgress: 0,
        destination: p.homeId,
        path: [],
        task: "Beginning the day",
        taskState: "active",
        reason: "At home before the shift",
        activityUntil: 0,
        nextPlan: (i % 15) * 2,
        hunger: 20 + (i % 7) * 3,
        thirst: 15 + (i % 9),
        fatigue: 15,
        heatExposure: 0,
        airExposure: 0,
        careNeeded: i % 19 === 0 ? 65 : 0,
        bag: emptyStock(),
        knownClosed: [],
        completed: 0,
      })),
      households: scenario.households.map((h) => ({
        id: h.id,
        stock: { ...h.stock },
        cutoffSeconds: 0,
        coolingSeconds: 0,
        unmetFood: 0,
        unmetWater: 0,
        accessClosed: false,
        accessStart: null,
        causes: [],
      })),
      cart: {
        roomId: depot.id,
        edgeId: null,
        fromId: depot.id,
        toId: depot.id,
        progress: 0,
        path: [],
        cargo: emptyStock(),
        targetId:
          scenario.rooms.find((r) => r.id === "d2-f6")?.id ??
          scenario.households[0].homeId,
        phase: "loading",
        delivered: 0,
        reason: "Loading food and medicine at the depot",
        until: 20,
      },
      events: [],
      eventSequence: 0,
      inputSequence: 0,
      reports: [],
      pendingReports: [],
      comms: true,
      blackout: false,
      lockdown: false,
      backup: "fan",
      backupTarget:scenario.rooms.some(r=>r.id==="d2-f1")?"d2-f1":scenario.rooms.find(r=>r.kind==="fan")?.id??"",
      batteryMilliWh: scenario.settings.batteryWh * 1000,
      batteryResidual: 0,
      disabled: [],
      waterL: 0,
      hydrology: { inflowL: 0, drainedL: 0 },
      closedLinks: [],
      topology: 0,
      receipts: [],
      commands: [],
      commandLog: [],
      actions: [],
      ledger: {
        produced: emptyStock(),
        consumed: emptyStock(),
        external: emptyStock(),
      },
      deficits: [],
    };
    if (saved) {
      validateSave(scenario, saved);
      this.state = structuredClone(saved);
    } else this.state = initial;
    this.roomState = new Map(this.state.rooms.map((r) => [r.id, r]));
    this.homes = new Map(this.state.households.map((h) => [h.id, h]));
    if (!saved) {
      this.event(
        "A new shift begins. The Hollow is waking up.",
        depot.id,
        "routine",
      );
      this.census();
      this.power();
      this.publishReports(true);
    }
  }
  event(
    text: string,
    subjectId: string,
    kind = "system",
    causeIds: string[] = [],
  ) {
    const w = this.state;
    const id = `event-${++w.eventSequence}`;
    w.events.push({ id, tick: w.tick, text, subjectId, kind, causeIds });
    // shortcut: retain the latest 2,000 descriptive events; deficit intervals and replay inputs remain complete.
    if (w.events.length > 2000) w.events.splice(0, 200);
    return id;
  }
  incident(kind: IncidentKind, record = true) {
    const w = this.state;
    if (
      ![
        "blackout",
        "restore",
        "comms",
        "reconnect",
        "lockdown",
        "unlock",
      ].includes(kind)
    )
      throw new Error("Unknown incident");
    if (record)
      w.actions.push({ tick: w.tick, order: ++w.inputSequence, kind });
    if (kind === "blackout") w.blackout = true;
    if (kind === "restore") w.blackout = false;
    if (kind === "comms") w.comms = false;
    if (kind === "reconnect") w.comms = true;
    if (kind === "lockdown") w.lockdown = true;
    if (kind === "unlock") w.lockdown = false;
    w.topology++;
    this.router.cache.clear();
    const descriptions = {
      blackout:
        "Lower feeder trips. Floors 6–8 lose grid power; clinic feeder stays online.",
      restore: "Lower feeder restored. Devices return to the grid.",
      comms:
        "Directorate communications cut. Last received readings are retained.",
      reconnect:
        "Communications restored. New samples will arrive after transmission delay.",
      lockdown:
        "Directorate checkpoint sealed. Service permits temporarily suspended.",
      unlock: "Directorate checkpoint reopened under normal permit rules.",
    };
    this.event(
      descriptions[kind],
      kind === "comms" || kind === "reconnect" ? "d0-f2-annex" : "d2-f5",
      "incident",
    );
    this.power();
    this.access();
  }
  observe() {
    const w = this.state;
    return {
      schemaVersion: 1,
      runId: w.runId,
      nowTick: w.tick,
      communications: w.comms,
      reports: this.scenario.rooms.map((r) => {
        const report = w.reports.find((p) => p.subjectId === r.id);
        return {
          subjectId: r.id,
          sampledAtTick: report?.sampledAtTick ?? null,
          receivedAtTick: report?.receivedAtTick ?? null,
          status: !report
            ? "unknown"
            : !w.comms ||
                w.tick - report.sampledAtTick >
                  this.scenario.settings.reportStaleAfter
              ? "stale"
              : "fresh",
          values: report
            ? {
                waterM: report.waterM,
                temperature: report.temperature,
                air: report.air,
                powered: report.powered,
              }
            : null,
        };
      }),
    };
  }
  act(command: Command): Receipt {
    const w = this.state;
    const prior = w.receipts.find((r) => r.commandId === command?.commandId);
    if (prior) return { ...prior };
    const reject = (reason: string): Receipt => ({
      commandId: command?.commandId ?? "invalid",
      ok: false,
      reason,
    });
    if (
      !command ||
      typeof command.commandId !== "string" ||
      command.commandId.length > 100 ||
      command.expectedRunId !== w.runId ||
      !Number.isSafeInteger(command.requestedAtTick) ||
      command.requestedAtTick > w.tick
    )
      return reject("Invalid command or previous run");
    if (command.actorId !== "district-operator")
      return reject("Actor is not authorized");
    if (!w.comms) return reject("Command channel disconnected");
    if (!this.rooms.has(command.targetId)) return reject("Unknown target");
    if (w.commands.length >= 100) return reject("Command queue full");
    const pending = w.commands.find(
      (c) => c.targetId === command.targetId && c.type === command.type,
    );
    if (pending)
      return reject(
        "An earlier command already owns this target for this tick",
      );
    if (command.type === "assignBackup") {
      if (!["fan", "pump"].includes(String(command.value)))
        return reject("Choose fan or pump");
      const type = this.rooms.get(command.targetId)!.kind;
      if (type !== command.value)
        return reject("Target is not that machine type");
      if (w.batteryMilliWh <= 0) return reject("Battery empty");
      if (
        this.rooms.get(command.targetId)!.demandW >
        this.scenario.settings.batteryMaxW
      )
        return reject("Discharge power limit exceeded");
    } else if (command.type === "setDeviceEnabled") {
      if (typeof command.value !== "boolean")
        return reject("Expected enabled boolean");
    } else if (command.type === "requestRepair") {
      if (this.rooms.get(command.targetId)!.kind !== "workshop")
        return reject("Repairs must be requested at a workshop");
      if (this.roomState.get(command.targetId)!.stock.parts < 1)
        return reject("No spare parts");
    } else if (command.type === "requestDelivery") {
      if (this.rooms.get(command.targetId)!.kind !== "home")
        return reject("Delivery target must be homes");
      if (w.cart.phase !== "loading")
        return reject("Cart is already on a delivery");
      if (!this.router.route(w.cart.roomId, command.targetId, w))
        return reject("No open cargo route");
    } else return reject("Unknown action");
    const receipt = {
      commandId: command.commandId,
      ok: true,
      scheduledTick: w.tick + 1,
    };
    w.receipts.push(receipt);
    w.commands.push({ ...command });
    w.commandLog.push({
      tick: w.tick,
      order: ++w.inputSequence,
      command: { ...command },
    });
    return { ...receipt };
  }
  private applyCommands() {
    const w = this.state;
    const commands = w.commands.splice(0);
    for (const c of commands) {
      if (c.type === "assignBackup") {w.backup = c.value as "fan" | "pump";w.backupTarget=c.targetId;}
      else if (c.type === "setDeviceEnabled") {
        w.disabled = w.disabled.filter((id) => id !== c.targetId);
        if (!c.value) w.disabled.push(c.targetId);
      } else if (c.type === "requestDelivery") w.cart.targetId = c.targetId;
      else if (c.type === "requestRepair") {
        const r = this.roomState.get(c.targetId)!;
        if (r.stock.parts >= 1 && r.staff > 0) {
          this.consume(r.stock, "parts", 1);
          r.condition = 100;
        } else {
          this.event(
            "Repair could not start: requires parts and a technician.",
            c.targetId,
            "command",
          );
          continue;
        }
      }
      this.event(
        `Operator request executed: ${c.type}${c.value === undefined ? "" : ` → ${c.value}`}.`,
        c.targetId,
        "command",
      );
    }
  }
  step(count = 1) {
    if (!Number.isSafeInteger(count) || count < 0 || count > 10000000)
      throw new Error("Invalid tick count");
    for (let n = 0; n < count; n++) {
      const w = this.state;
      for (const i of this.scenario.incidents)
        if (i.tick === w.tick) this.incident(i.kind, false);
      this.applyCommands();
      this.census();
      this.power(true);
      this.people();
      this.census();
      this.production();
      this.cart();
      this.environment();
      w.tick++;
      this.publishReports();
    }
    return this.state;
  }
  private census() {
    for (const r of this.state.rooms) {
      r.occupants = 0;
      r.staff = 0;
    }
    for (const p of this.state.people)
      if (!p.edgeId) {
        const r = this.roomState.get(p.roomId)!;
        r.occupants++;
        if (p.task === "Working" && p.taskState === "active") r.staff++;
      }
  }
  private power(consumeEnergy = false) {
    const w = this.state,
      settings = this.scenario.settings;
    let available = settings.generationW;
    let batteryW = settings.batteryMaxW;
    const ordered = this.scenario.rooms
      .slice()
      .sort((a, b) => a.floor - b.floor || a.id.localeCompare(b.id));
    for (const def of ordered) {
      const r = this.roomState.get(def.id)!;
      const failed = w.blackout && (def.feederFloor ?? def.floor) >= 5;
      const backup =
        failed &&
        def.id === w.backupTarget &&
        w.batteryMilliWh >= Math.ceil((def.demandW * 1000) / 3600) &&
        def.demandW <= batteryW;
      r.powered =
        !w.disabled.includes(def.id) &&
        ((!failed && available >= def.demandW) || backup);
      r.suppliedW = r.powered ? def.demandW : 0;
      if (r.powered) {
        if (backup) batteryW -= def.demandW;
        else available -= def.demandW;
      }
      r.reason = !r.powered
        ? w.disabled.includes(def.id)
          ? "Switched off"
          : failed
            ? "Lower feeder disconnected"
            : "Directorate allocation: upper floors first"
        : ["farm", "recycler", "clinic", "workshop"].includes(def.kind) &&
            r.staff === 0
          ? "Waiting for staff"
          : "Operating";
    }
    if (w.blackout && consumeEnergy) {
      const draw = settings.batteryMaxW - batteryW;
      w.batteryResidual += draw * 1000;
      const used = Math.floor(w.batteryResidual / 3600);
      w.batteryResidual %= 3600;
      w.batteryMilliWh = Math.max(0, w.batteryMilliWh - used);
    }
  }
  private consume(stock: Stock, item: Item, amount: number) {
    const used = round(Math.min(stock[item], amount));
    stock[item] = round(stock[item] - used);
    this.state.ledger.consumed[item] = round(
      this.state.ledger.consumed[item] + used,
    );
    return used;
  }
  private produce(stock: Stock, item: Item, amount: number) {
    const quantity = round(amount);
    stock[item] = round(stock[item] + quantity);
    this.state.ledger.produced[item] = round(
      this.state.ledger.produced[item] + quantity,
    );
  }
  private transfer(source: Stock, target: Stock, item: Item, amount: number) {
    const q = round(Math.min(source[item], amount));
    source[item] = round(source[item] - q);
    target[item] = round(target[item] + q);
    return q;
  }
  private chooseTask(p: PersonState, def: PersonDef) {
    const w = this.state;
    const hour = (this.scenario.startHour + w.tick / 3600) % 24;
    let destination = def.homeId,
      task = "Resting",
      reason = "Off shift; returning home";
    if (p.careNeeded > 60) {
      destination = this.nearest(p.roomId, "clinic", def.permit, p.knownClosed);
      task = "Seeking care";
      reason = "Needs a staffed clinic and medicine";
    } else if (
      householdLow(this.homes.get(def.householdId)!) &&
      p.bag.food === 0
    ) {
      destination = this.scenario.households.find(
        (h) => h.id === def.householdId,
      )!.depotId;
      task = "Collecting rations";
      reason = "Household food reserve is running low";
    } else if (p.bag.food > 0 || p.bag.water > 0) {
      destination = def.homeId;
      task = "Bringing supplies home";
      reason = "Carrying household provisions";
    } else if (p.thirst > 55) {
      destination = def.homeId;
      task = "Drinking";
      reason = "Collecting water from household reserves";
    } else if (p.hunger > 55) {
      destination = def.homeId;
      task = "Eating";
      reason = "Meal from household food reserves";
    } else if (hour < 6 || hour >= 22) {
      task = "Sleeping";
      reason = "Rest period";
    } else if (def.workId && hour >= 7 + def.shift / 3600 && hour < 16) {
      destination = def.workId;
      task = "Working";
      reason = `Scheduled ${def.role.toLowerCase()} shift`;
    } else if (
      (hour >= 16 && hour < 18) ||
      (!def.workId && hour >= 8 && hour < 10)
    ) {
      destination = this.nearest(p.roomId, "mess", def.permit, p.knownClosed);
      task = "Meeting neighbors";
      reason = "Communal break and household errands";
    } else if (!def.workId && hour >= 10 && hour < 14) {
      destination = this.nearest(p.roomId, "tap", def.permit, p.knownClosed);
      task = "Collecting water";
      reason = "Household water collection";
    }
    if (
      p.destination !== destination ||
      p.task !== task ||
      p.taskState === "blocked"
    ) {
      p.destination = destination;
      p.task = task;
      p.reason = reason;
      const path = this.router.route(
        p.roomId,
        destination,
        w,
        def.permit,
        p.knownClosed,
      );
      if (path) {
        p.path = [...path];
        p.taskState = path.length ? "traveling" : "active";
      } else {
        p.path = [];
        p.taskState = "blocked";
        p.reason = `No permitted route to ${this.rooms.get(destination)?.name ?? destination}`;
      }
    }
    p.nextPlan = w.tick + 60;
  }
  private nearest(
    from: string,
    kind: RoomDef["kind"],
    permit: boolean,
    known: string[],
  ) {
    const options = this.scenario.rooms
      .filter((r) => r.kind === kind)
      .map((r) => ({
        id: r.id,
        path: this.router.route(from, r.id, this.state, permit, known),
      }))
      .filter((r) => r.path !== null)
      .sort(
        (a, b) => a.path!.length - b.path!.length || a.id.localeCompare(b.id),
      );
    return options[0]?.id ?? from;
  }
  private people() {
    const w = this.state;
    const edgeCounts = new Map<string, number>();
    for (const p of w.people)
      if (p.edgeId)
        edgeCounts.set(p.edgeId, (edgeCounts.get(p.edgeId) ?? 0) + 1);
    const serviceCounts = new Map<string, number>();
    const workCounts = new Map<string, number>();
    for (const p of w.people)
      if (
        !p.edgeId &&
        p.taskState === "active" &&
        ["Collecting water", "Seeking care", "Collecting rations"].includes(
          p.task,
        ) &&
        p.activityUntil > w.tick
      )
        serviceCounts.set(p.roomId, (serviceCounts.get(p.roomId) ?? 0) + 1);
    for (const p of w.people) {
      const def = this.personDefs.get(p.id)!,
        h = this.homes.get(def.householdId)!;
      p.hunger = round(
        Math.min(100, p.hunger + this.scenario.settings.hungerPerSecond),
      );
      p.thirst = round(
        Math.min(100, p.thirst + this.scenario.settings.thirstPerSecond),
      );
      p.fatigue = round(
        Math.max(
          0,
          Math.min(
            100,
            p.fatigue +
              (p.task === "Sleeping"
                ? -this.scenario.settings.sleepRecoveryPerSecond
                : this.scenario.settings.fatiguePerSecond),
          ),
        ),
      );
      const room = this.roomState.get(p.roomId)!;
      if (room.temperature > 30) p.heatExposure++;
      if (room.air > 40) p.airExposure++;
      if (p.edgeId) {
        const link = this.links.get(p.edgeId)!;
        const unavailable = blocked(link, w, def.permit);
        if (unavailable) {
          if (!p.knownClosed.includes(link.id)) p.knownClosed.push(link.id);
          p.taskState = "blocked";
          p.reason = `Traversal interrupted: ${unavailable}`;
          continue;
        }
        p.edgeProgress = Math.min(1, p.edgeProgress + 1 / link.seconds);
        p.taskState = "traveling";
        if (p.edgeProgress >= 1 - 1e-9) {
          p.roomId = p.toId;
          p.edgeId = null;
          p.edgeProgress = 0;
          p.completed++;
          p.nextPlan = Math.min(p.nextPlan, w.tick + 1);
          edgeCounts.set(
            link.id,
            Math.max(0, (edgeCounts.get(link.id) ?? 1) - 1),
          );
        }
        continue;
      }
      // Local reports restore previously closed routes only after a fresh connection report.
      if (w.comms && w.tick % 30 === 0)
        p.knownClosed = p.knownClosed.filter(
          (id) => !!blocked(this.links.get(id)!, w, def.permit),
        );
      if (w.tick >= p.nextPlan && !p.edgeId && w.tick >= p.activityUntil)
        this.chooseTask(p, def);
      if (p.path.length) {
        const link = this.links.get(p.path[0])!;
        const why = blocked(link, w, def.permit);
        if (why) {
          if (!p.knownClosed.includes(link.id)) p.knownClosed.push(link.id);
          p.path = [];
          p.taskState = "blocked";
          p.reason = why;
          p.nextPlan = w.tick + 10;
          continue;
        }
        if ((edgeCounts.get(link.id) ?? 0) >= link.capacity) {
          p.taskState = "queued";
          p.reason = `Queue for ${link.kind}; capacity ${link.capacity}`;
          continue;
        }
        p.path.shift();
        p.edgeId = link.id;
        p.fromId = p.roomId;
        p.toId = link.a === p.roomId ? link.b : link.a;
        p.edgeProgress = 0;
        p.taskState = "traveling";
        edgeCounts.set(link.id, (edgeCounts.get(link.id) ?? 0) + 1);
        continue;
      }
      if (p.taskState === "blocked") continue;
      if (p.task === "Working") {
        const used = workCounts.get(p.roomId) ?? 0;
        if (!room.powered) {
          p.taskState = "blocked";
          p.reason = "Workstation has no power";
          p.nextPlan = w.tick + 15;
          continue;
        }
        if (used >= this.rooms.get(p.roomId)!.capacity) {
          p.taskState = "queued";
          p.reason = "Waiting for a work position";
          continue;
        }
        workCounts.set(p.roomId, used + 1);
      }
      if (p.task === "Working" && p.taskState === "traveling")
        this.event(
          `${def.name} arrived for their ${def.role.toLowerCase()} shift.`,
          p.roomId,
          "shift",
        );
      p.taskState =
        p.task === "Sleeping" || p.task === "Resting" ? "resting" : "active";
      if (w.tick < p.activityUntil) continue;
      if (p.task === "Eating") {
        const q = this.consume(h.stock, "food", 3);
        if (q) {
          p.hunger = Math.max(0, p.hunger - q * 18);
          p.completed++;
        } else {
          h.unmetFood++;
          p.reason = "Household food reserves empty";
        }
        p.activityUntil = w.tick + 60;
      } else if (p.task === "Drinking") {
        const q = this.consume(h.stock, "water", 2);
        if (q) {
          p.thirst = Math.max(0, p.thirst - q * 28);
          p.completed++;
        } else {
          h.unmetWater++;
          p.reason = "Household water reserves empty";
        }
        p.activityUntil = w.tick + 30;
      } else if (p.task === "Bringing supplies home") {
        this.transfer(p.bag, h.stock, "food", p.bag.food);
        this.transfer(p.bag, h.stock, "water", p.bag.water);
        p.completed++;
        p.activityUntil = w.tick + 10;
        p.nextPlan = w.tick + 10;
      } else if (
        p.task === "Collecting water" ||
        p.task === "Seeking care" ||
        p.task === "Collecting rations"
      ) {
        const used = serviceCounts.get(p.roomId) ?? 0,
          cap = this.rooms.get(p.roomId)!.capacity;
        if (used >= cap) {
          p.taskState = "queued";
          p.reason = "Waiting for a service position";
          continue;
        }
        serviceCounts.set(p.roomId, used + 1);
        if (!room.powered) {
          p.taskState = "blocked";
          p.reason = "Service has no power";
          p.nextPlan = w.tick + 30;
          continue;
        }
        if (p.task === "Collecting water") {
          const q = this.transfer(room.stock, p.bag, "water", 5);
          p.reason = q ? "Carrying water to household" : "Tap storage empty";
          p.completed += q ? 1 : 0;
          p.nextPlan = w.tick + 1;
        } else if (p.task === "Collecting rations") {
          const q = this.transfer(room.stock, p.bag, "food", 15);
          p.reason = q ? "Carrying rations home" : "Depot food stock empty";
          p.completed += q ? 1 : 0;
          p.nextPlan = w.tick + 1;
        } else if (room.staff > 0 && room.stock.medicine >= 1) {
          this.consume(room.stock, "medicine", 1);
          p.careNeeded = Math.max(0, p.careNeeded - 50);
          p.reason = "Received care and medicine";
          p.completed++;
          this.event(`${def.name} received care.`, p.roomId, "care");
        } else {
          p.taskState = "queued";
          p.reason = "Waiting for clinical staff or medicine";
        }
        p.activityUntil = w.tick + 60;
      }
    }
  }
  private production() {
    const w = this.state;
    for (const link of this.scenario.waterLinks) {
      const a = this.roomState.get(link.fromId)!,
        b = this.roomState.get(link.toId)!;
      if (a.powered && b.stock.water < this.scenario.settings.storageCapacity)
        this.transfer(
          a.stock,
          b.stock,
          "water",
          Math.min(
            link.litersPerSecond,
            this.scenario.settings.storageCapacity - b.stock.water,
          ),
        );
    }
    for (const def of this.scenario.rooms) {
      const r = this.roomState.get(def.id)!;
      if (!r.powered || r.staff === 0) continue;
      if (
        def.kind === "recycler" &&
        r.stock.waste >= this.scenario.settings.waterTreatmentLps &&
        r.stock.water < this.scenario.settings.storageCapacity - 1
      ) {
        const input = this.consume(
          r.stock,
          "waste",
          (this.scenario.settings.waterTreatmentLps * r.condition) / 100,
        );
        this.produce(
          r.stock,
          "water",
          input * this.scenario.settings.waterTreatmentYield,
        );
        r.output = round(
          r.output + input * this.scenario.settings.waterTreatmentYield,
        );
        r.contamination = Math.max(0, 100 - r.condition);
      }
      if (
        def.kind === "farm" &&
        r.stock.water >= this.scenario.settings.growWaterLps &&
        r.stock.food <
          this.scenario.settings.storageCapacity -
            this.scenario.settings.harvestUnits
      ) {
        this.consume(r.stock, "water", this.scenario.settings.growWaterLps);
        r.growth++;
        if (r.growth >= this.scenario.settings.cropSeconds) {
          this.produce(r.stock, "food", this.scenario.settings.harvestUnits);
          r.output += this.scenario.settings.harvestUnits;
          r.growth = 0;
          this.event(
            `A crop harvest adds ${this.scenario.settings.harvestUnits} food units to farm storage.`,
            def.id,
            "production",
          );
        }
      }
      if (
        def.kind === "workshop" &&
        w.tick % 120 === 0 &&
        r.stock.parts > 0 &&
        r.condition < 100
      ) {
        this.consume(r.stock, "parts", 1);
        r.condition = Math.min(100, r.condition + 5);
      }
    }
  }
  private cart() {
    const w = this.state,
      c = w.cart,
      source = this.scenario.rooms.find((r) => r.kind === "depot")!;
    const stock = this.roomState.get(c.roomId)!.stock;
    if (c.edgeId) {
      const l = this.links.get(c.edgeId)!;
      const why = blocked(l, w, true);
      if (why) {
        c.phase = "waiting";
        c.reason = why;
        return;
      }
      c.phase = "traveling";
      c.progress = Math.min(1, c.progress + 1 / (l.seconds * 1.5));
      if (c.progress >= 1 - 1e-9) {
        c.roomId = c.toId;
        c.edgeId = null;
        c.progress = 0;
      }
      return;
    }
    if (c.phase === "loading") {
      if (w.tick < c.until) return;
      const food = this.transfer(
        stock,
        c.cargo,
        "food",
        this.scenario.settings.cartCrates,
      );
      this.transfer(stock, c.cargo, "medicine", Math.min(3, stock.medicine));
      if (!food) {
        c.reason = "Depot food stock empty";
        c.until = w.tick + 60;
        return;
      }
      this.event(
        `Supply cart loaded ${food} food and ${c.cargo.medicine} medicine units.`,
        c.roomId,
        "cargo",
      );
      c.phase = "traveling";
    }
    if (
      c.roomId === c.targetId &&
      (c.cargo.food > 0 || c.cargo.medicine > 0) &&
      (c.phase === "traveling" || c.phase === "waiting")
    ) {
      c.phase = "unloading";
      c.until = w.tick + 15;
      c.reason = "Unloading at the lower homes";
      return;
    }
    if (c.phase === "unloading") {
      if (w.tick < c.until) return;
      const delivered = c.cargo.food;
      const homes = this.scenario.households.filter(
        (h) => h.homeId === c.targetId,
      );
      if (homes.length) {
        for (const h of homes) {
          this.transfer(
            c.cargo,
            this.homes.get(h.id)!.stock,
            "food",
            delivered / homes.length,
          );
          this.transfer(
            c.cargo,
            this.homes.get(h.id)!.stock,
            "medicine",
            c.cargo.medicine / (homes.length - homes.indexOf(h)),
          );
        }
      } else {
        this.transfer(c.cargo, stock, "food", c.cargo.food);
        this.transfer(c.cargo, stock, "medicine", c.cargo.medicine);
      }
      c.delivered = round(c.delivered + delivered);
      this.event(
        `Cart delivered ${delivered} food units to ${this.rooms.get(c.targetId)!.name}.`,
        c.targetId,
        "delivery",
      );
      c.phase = "traveling";
      c.targetId = source.id;
    }
    if (
      c.roomId === source.id &&
      c.targetId === source.id &&
      c.cargo.food < 0.001
    ) {
      c.targetId =
        this.scenario.rooms.find((r) => r.id === "d2-f6")?.id ??
        this.scenario.households[0].homeId;
      c.phase = "loading";
      c.until = w.tick + 20;
      c.reason = "Loading the next supply shipment";
      return;
    }
    const path = this.router.route(c.roomId, c.targetId, w, true);
    if (!path || !path.length) {
      if (c.phase !== "waiting")
        this.event(
          "Supply cart waiting: no open route to lower homes.",
          c.roomId,
          "cargo",
        );
      c.phase = "waiting";
      c.reason = "No open cargo route; keeping all cargo";
      return;
    }
    const l = this.links.get(path[0])!;
    c.path = path.slice(1);
    c.edgeId = l.id;
    c.fromId = c.roomId;
    c.toId = l.a === c.roomId ? l.b : l.a;
    c.progress = 0;
    c.phase = "traveling";
    c.reason = "Following the supply route";
  }
  private environment() {
    const w = this.state,
      s = this.scenario.settings;
    for (const h of w.households) if (h.accessClosed) h.cutoffSeconds++;
    const pump = this.scenario.rooms
      .filter((r) => r.kind === "pump")
      .some((r) => this.roomState.get(r.id)!.powered);
    const removed = Math.min(w.waterL + s.seepLps, pump ? s.pumpLps : 0);
    w.waterL = round(w.waterL + s.seepLps - removed);
    w.hydrology.inflowL = round(w.hydrology.inflowL + s.seepLps);
    w.hydrology.drainedL = round(w.hydrology.drainedL + removed);
    const depth = w.waterL / (s.tunnelAreaM2 * 1000);
    const closed = depth >= s.closeDepthM;
    const sump = this.scenario.links
      .filter((l) => l.kind === "sump")
      .map((l) => l.id);
    if (closed !== sump.some((id) => w.closedLinks.includes(id))) {
      w.closedLinks = closed
        ? [...new Set([...w.closedLinks, ...sump])]
        : w.closedLinks.filter((id) => !sump.includes(id));
      w.topology++;
      this.router.cache.clear();
      this.event(
        closed
          ? "Sump crossing flooded. Lower homes have lost their depot route."
          : "Sump crossing drained. The lower depot route is open.",
        "d2-f5",
        "flood",
      );
      w.events[w.events.length - 1].tick = w.tick + 1;
      this.access(w.tick + 1);
    }
    for (const def of this.scenario.rooms) {
      const r = this.roomState.get(def.id)!;
      const fan = this.scenario.airZones.some(
        (zone) =>
          zone.roomIds.includes(def.id) &&
          this.roomState.get(zone.fanId)!.powered,
      );
      const target =
        s.baseCelsius +
        def.floor * s.depthHeating +
        (fan ? 0 : s.fanCoolingDelta) +
        r.occupants * 0.025;
      r.temperature = round(
        r.temperature + (target - r.temperature) * s.heatResponse,
      );
      r.air = round(
        Math.min(
          100,
          Math.max(
            0,
            r.air +
              r.occupants * s.occupiedAirLoad +
              (fan ? -s.fanAirReduction : s.stagnantAirRise),
          ),
        ),
      );
      if (def.kind === "home" && !fan)
        for (const h of this.scenario.households)
          if (h.homeId === def.id) this.homes.get(h.id)!.coolingSeconds++;
    }
  }
  private access(effectiveTick = this.state.tick) {
    const w = this.state;
    const causes = w.events
      .filter((e) => e.kind === "flood" || e.kind === "incident")
      .slice(-3)
      .map((e) => e.id);
    for (const def of this.scenario.households) {
      const h = this.homes.get(def.id)!;
      const inaccessible =
        this.router.route(def.homeId, def.depotId, w, true) === null;
      if (inaccessible !== h.accessClosed) {
        h.accessClosed = inaccessible;
        h.causes = causes;
        if (inaccessible) {
          h.accessStart = effectiveTick;
          w.deficits.push({
            householdId: h.id,
            start: effectiveTick,
            end: null,
            causes,
          });
        } else {
          const interval = w.deficits
            .slice()
            .reverse()
            .find((d) => d.householdId === h.id && d.end === null);
          if (interval) interval.end = effectiveTick;
          h.accessStart = null;
        }
      }
    }
  }
  private publishReports(initial = false) {
    const w = this.state,
      s = this.scenario.settings;
    if (w.comms && (initial || w.tick % s.reportEvery === 0))
      for (const r of w.rooms)
        w.pendingReports.push({
          subjectId: r.id,
          sampledAtTick: w.tick,
          receivedAtTick: w.tick + s.reportDelay,
          waterM:
            this.rooms.get(r.id)!.district === 2 &&
            this.rooms.get(r.id)!.floor >= 5
              ? w.waterL / (s.tunnelAreaM2 * 1000)
              : 0,
          temperature: r.temperature,
          air: r.air,
          powered: r.powered,
        });
    if (w.comms) {
      const delivered = w.pendingReports.filter(
        (r) => r.receivedAtTick <= w.tick,
      );
      w.pendingReports = w.pendingReports.filter(
        (r) => r.receivedAtTick > w.tick,
      );
      for (const r of delivered) {
        const index = w.reports.findIndex((x) => x.subjectId === r.subjectId);
        if (index >= 0) w.reports[index] = r;
        else w.reports.push(r);
      }
    }
    // Reports in transit are lost on link failure; previously delivered evidence is retained.
    else w.pendingReports = [];
  }
  totals() {
    const totals = emptyStock();
    for (const stock of [
      ...this.state.rooms.map((r) => r.stock),
      ...this.state.households.map((h) => h.stock),
      ...this.state.people.map((p) => p.bag),
      this.state.cart.cargo,
    ])
      for (const k of Object.keys(totals) as Item[])
        totals[k] = round(totals[k] + stock[k]);
    return totals;
  }
}

function householdLow(h: HouseholdState) {
  return h.stock.food < 15;
}

import type {
  PersonDef,
  Item,
  PersonState,
  RoomDef,
  Scenario,
  Stock,
  WorldEvent,
  WorldState,
} from "../engine/types";

export function appearance(person: PersonDef) {
  const n = person.appearance;
  const medical = person.role === "Nurse";
  const grower = person.role === "Grower";
  const technical = /Technician|engineer|operator/.test(person.role);
  return {
    skin: [0xc59a78, 0x946343, 0x634736, 0xe1bc96][n % 4],
    hair: [0x302b29, 0x372b23, 0x252b2b, 0xa19b88, 0x77513a][n % 5],
    shirt: medical
      ? 0xd7dfcf
      : grower
        ? 0x94a16b
        : technical
          ? 0x87989a
          : [0x548a8e, 0xab7557, 0x8290a2, 0x937d9c][n % 4],
    apron: grower ? 0x796542 : technical ? 0x405a67 : 0x395e69,
    width: 6 + (n % 3),
    hairStyle: n % 3,
    medical,
    grower,
    technical,
  };
}
export const cssColor = (color: number) =>
  `#${color.toString(16).padStart(6, "0")}`;
export type Pose =
  "walk" | "stand" | "work" | "bend" | "sit" | "sleep" | "carry";
export function residentPose(
  def: PersonDef,
  person: PersonState,
  room: RoomDef,
): Pose {
  if (person.edgeId) return "walk";
  if (Object.values(person.bag).some((n) => n > 0)) return "carry";
  if (person.taskState === "resting")
    return person.task === "Sleeping" ? "sleep" : "sit";
  if (person.taskState === "active" && person.task === "Working")
    return def.role === "Grower" ? "bend" : "work";
  if (room.kind === "mess" && person.taskState === "active") return "sit";
  return "stand";
}

// Positions mirror the broad fixture layouts; crowd slots fill aisles before reusing a station.
export function fixtureSpot(
  room: RoomDef,
  pose: Pose,
  slot: number,
  usableWidth = room.w,
) {
  const w = usableWidth;
  if (pose === "sleep") {
    const beds = Math.max(1, Math.floor((w - 30) / 110));
    if (slot < beds * (room.floor >= 5 ? 2 : 1))
      return {
        x: 61 + (slot % beds) * 110,
        z: 92,
        h: slot >= beds ? 62 : 19,
        facing: 1,
      };
    return {
      x: 40 + (slot % Math.max(1, Math.floor((w - 70) / 52))) * 52,
      z: 26 + (Math.floor(slot / beds) % 2) * 22,
      h: 0,
      facing: slot % 2 ? 1 : -1,
    };
  }
  if (pose === "bend")
    return {
      x: 53 + (slot % Math.max(1, Math.floor((w - 90) / 58))) * 58,
      z: slot % 2 ? 78 : 25,
      h: 0,
      facing: slot % 2 ? -1 : 1,
    };
  if (pose === "work") {
    const columns = Math.max(1, Math.floor((w - 72) / 68));
    return {
      x: 44 + (slot % columns) * 68,
      z: 72 - (Math.floor(slot / columns) % 3) * 23,
      h: 0,
      facing: slot % 2 ? -1 : 1,
    };
  }
  if (pose === "sit" && room.kind === "mess") {
    const tables = Math.max(1, Math.ceil((w - 91) / 95));
    if (slot < tables * 4)
      return {
        x: 48 + Math.floor(slot / 4) * 95 + (slot % 2) * 34,
        z: slot % 4 < 2 ? 44 : 112,
        h: 14,
        facing: slot % 4 < 2 ? 1 : -1,
      };
  }
  if (pose === "sit" && room.kind === "home") {
    const beds = Math.max(1, Math.floor((w - 30) / 110));
    if (slot < beds * 2)
      return {
        x: 47 + Math.floor(slot / 2) * 110 + (slot % 2) * 29,
        z: 78,
        h: 18,
        facing: slot % 2 ? -1 : 1,
      };
  }
  const columns = Math.max(1, Math.floor((w - 60) / 48));
  return {
    x: 32 + (slot % columns) * 48 + (Math.floor(slot / columns) % 2) * 9,
    z:
      [28, 92, 51, 113, 20, 75][slot % 6] -
      (Math.floor(slot / columns) % 2) * 7,
    h: 0,
    facing: slot % 3 === 0 ? -1 : 1,
  };
}

export function cargoUnits(stock: Stock) {
  return Object.values(stock).reduce((a, n) => a + n, 0);
}
export function roomStockItems(kind: RoomDef["kind"], stock: Stock): Item[] {
  const relevant: Partial<Record<RoomDef["kind"], Item[]>> = {
    home: ["food", "water"],
    depot: ["food", "water", "medicine", "parts"],
    clinic: ["medicine"],
    farm: ["food", "water"],
    workshop: ["parts"],
    recycler: ["water", "waste"],
    tap: ["water"],
    mess: ["food", "water"],
  };
  return (["food", "water", "medicine", "parts", "waste"] as Item[]).filter(
    (item) => stock[item] > 0 || relevant[kind]?.includes(item),
  );
}
export function subjectRoom(scenario: Scenario, state: WorldState, id: string) {
  const actor =
    id === "cart" ? state.cart : state.people.find((p) => p.id === id);
  const roomId = actor
    ? actor.edgeId &&
      ("progress" in actor ? actor.progress : actor.edgeProgress) >= 0.5
      ? actor.toId
      : actor.roomId
    : id;
  return scenario.rooms.find((r) => r.id === roomId);
}
export function importantEvent(event: WorldEvent) {
  return (
    ["incident", "access", "command", "delivery", "flood"].includes(
      event.kind,
    ) ||
    /blackout|blocked|waiting|closed|reopen|restor|unpowered|backup|no open route/i.test(
      event.text,
    )
  );
}

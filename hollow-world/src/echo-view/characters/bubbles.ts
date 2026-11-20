// Mara's one-liners for the camps and the leg intros: the same portrait + speech strip as the Descent dialogue, shown once when a screen opens.
// Camp lines are keyed by the camp event id; leg lines are derived read-only from the mission (floods, beacons, forged pods). Each is 12 words or fewer.
import type { Mission } from "../../echo/types";

const CAMP: Record<string, string> = {
  outfitting: "Pack light or pack safe. Nobody answers down there.",
  "tower-lies": "Tower says the shaft's clear. I don't believe it.",
  "forged-claim": "Someone's calling a pod medical. I'm the only nurse here.",
};
const RETRY = "We lost the beacons. Again, and smarter this time.";

/** Mara's line when a camp opens, for the camp event id (`retry-*` for a failed leg). */
export const campLine = (eventId: string): string => (eventId.startsWith("retry") ? RETRY : CAMP[eventId] ?? "");

/** Mara's line when a leg's intro opens: says what is different about this leg. */
export function legLine(m: Mission): string {
  const beacons = m.beaconBudget ?? 0, n = `${beacons} beacon${beacons === 1 ? "" : "s"}`;
  if (m.id === "descent-live-3") return `Fake medical pods ahead. Only ${n}: light the junction first.`;
  if ((m.seals?.length ?? 0) > 0) return `Two floods. I have ${n}: keep one for the second.`;
  return "Tower's dark. When the flood shows, beacon it and the shaft above.";
}

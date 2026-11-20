// Hollow theme words for pods and cargo: display only. The engine, the data and the observation hashes keep the plain labels ("SUP-1 · water");
// the view calls themeLabel() when it draws one. Wording stays inside the brief: water is recycled, the communal farms grow food under lamps,
// and the sickness in Lagos Deep is a lung sickness (STORY.md). No new facts about the world.
import type { Pod } from "./types";

export const CARGO_LABEL: Record<NonNullable<Pod["cargo"]>, string> = {
  water: "Recycled water",
  food: "Lamp-farm harvest",
  medicine: "Lung-sickness medicine",
};

/** One short line for a cargo type, for a tooltip or the debrief. */
export const CARGO_NOTE: Record<NonNullable<Pod["cargo"]>, string> = {
  water: "Recycled in the pumps and sent to the deep homes.",
  food: "Grown under lamps on the communal farms.",
  medicine: "For the lung sickness spreading below.",
};

/** "SUP-1 · water" -> "SUP-1 · Recycled water". Any other label (nurse, passenger, forged courier) comes back unchanged. */
export function themeLabel(pod: Pick<Pod, "label" | "cargo">): string {
  const [id, rest] = pod.label.split(" · ");
  if (!pod.cargo || rest === undefined || rest.toLowerCase() !== pod.cargo) return pod.label;
  return `${id} · ${CARGO_LABEL[pod.cargo]}`;
}

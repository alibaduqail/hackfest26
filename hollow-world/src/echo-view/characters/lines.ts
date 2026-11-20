// Character dialogue for the Descent leg. Lines are data (LINES); newLines() is pure: previous + current observation in, new lines out.
// The caller owns the `fired` set (ids already shown this run) and adds each returned id to it. No engine imports, view-layer only.
import type { LogEvent, Observation } from "../../echo/types";
import { placeName } from "../cutaway/live/names";

export type Speaker = "director" | "mara";
export interface Line { id: string; who: Speaker; text: string }
export interface LineCtx { ended: boolean; stars: number; coach?: boolean; placed?: number } // coach: leg 1, where Mara may say where to bolt; placed: beacons the player has bolted in so far

/** All the wording lives here. {section} and {n} are filled from the observation. */
export const LINES = {
  start: { who: "director", text: "I shut the tower down. Level 5 has no power. Nothing moves unless I say." },
  beacon: { who: "mara", text: "Dark down here. Outside the light, I won't hear a flood coming." },
  blind: { who: "director", text: "Hear that? Silence. Your pods are blind without my tower." },
  flood: { who: "director", text: "{section} floods in {n}. I didn't warn anyone. Did you?" },
  floodMara: { who: "mara", text: "Bolt a beacon on {place} and the shaft above. The news hops to me." },
  reroute: { who: "mara", text: "Got the flood warning through the beacons. Taking the bypass!" },
  rerouteOld: { who: "mara", text: "Got the flood warning over the beacons already in the shaft. Taking the bypass!" }, // none of the player's own beacons are down: the news came over the pre-placed ones
  rerouteDirector: { who: "director", text: "…How did she hear that?" },
  forged: { who: "mara", text: "No credential, no priority. Medical goes first." },
  held: { who: "director", text: "Told you. Without my tower, nothing moves." },
  win: { who: "director", text: "No… they did it without me." },
  fail: { who: "director", text: "Another blackout. Just as I planned." },
} as const satisfies Record<string, Omit<Line, "id">>;
type LineId = keyof typeof LINES;

const MARA = "MED-1";
const section = (id: string) => { const s = placeName(id); return s.charAt(0).toUpperCase() + s.slice(1); }; // same wording as the side panel

function make(id: LineId, vars: Record<string, string> = {}): Line {
  const { who, text } = LINES[id];
  return { id, who, text: text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") };
}

/** Lines triggered by the step from `prev` to `obs`, in table order, each id at most once per run (`fired`). */
export function newLines(prev: Observation, obs: Observation, fired: ReadonlySet<string>, ctx: LineCtx): Line[] {
  if (obs.tick <= prev.tick) return [];
  const log: LogEvent[] = obs.log.filter((e) => e.tick >= prev.tick && e.tick < obs.tick);
  const has = (pred: (e: LogEvent) => boolean) => log.some(pred);
  const out: Line[] = [];
  const add = (id: LineId, when: boolean, vars?: Record<string, string>) => {
    if (when && !fired.has(id)) out.push(make(id, vars));
  };
  add("start", prev.tick === 0);
  add("beacon", has((e) => e.kind === "beacon-placed"));
  add("blind", has((e) => e.kind === "blind"));
  const shown = (o: Observation) => o.floodWarnings?.find((w) => w.sectorId !== undefined);
  const telegraph = shown(obs);
  add("flood", !!telegraph && !shown(prev), telegraph && { section: section(telegraph.sectorId!), n: `${Math.max(0, telegraph.at! - obs.tick)} min` });
  // Only on leg 1's main1 flood: "the shaft above" is the whole answer there, and wrong advice for other floods and legs.
  add("floodMara", !!ctx.coach && telegraph?.sectorId === "main1" && !shown(prev), telegraph && { place: placeName(telegraph.sectorId!) });
  const rerouted = has((e) => e.kind === "reroute" && e.podId === MARA);
  add("reroute", rerouted && ctx.placed !== 0);
  add("rerouteOld", rerouted && ctx.placed === 0);
  add("rerouteDirector", rerouted);
  add("forged", has((e) => e.kind === "credential-reject"));
  add("held", has((e) => e.kind === "hold" && e.podId === MARA) && obs.sectors.some((s) => s.sealed)); // tower-down holds happen before any seal
  const arrived = obs.pods.find((p) => p.id === MARA)?.arriveTick != null;
  const won = arrived && ctx.stars > 0;
  add("win", ctx.ended && won);
  add("fail", ctx.ended && !won);
  return out;
}

/** Queue rule: one speaker at a time; if more than `max` lines wait, the oldest are skipped. */
export function enqueue(queue: readonly Line[], lines: readonly Line[], max = 2): Line[] {
  return [...queue, ...lines].slice(-max);
}

/** How long a line stays up: 3.5 s up to 4.5 s, longer for longer text. */
export function holdMs(text: string): number {
  return Math.min(4500, Math.max(3500, 2000 + text.length * 35));
}

// Pure helpers for the Journey screens (render-free so they can be tested without a DOM).
import type { Effect, LegId, LogEntry, Resources, Stars } from "./props";

export const LEG_IDS: LegId[] = ["descent1", "descent2", "descent3"];
export const LEG_NAMES: Record<LegId, string> = { descent1: "Descent I", descent2: "Descent II", descent3: "Descent III" };
/** The five Hollow levels (same names as the Descent in src/echo/descent.ts). */
export const LEVEL_NAMES = ["Upper depot", "Relay level", "Junction", "Flooded shaft", "Deep clinic"];
/** Which levels each of the three legs covers. */
export const LEG_LEVELS: number[][] = [[1, 2], [3, 4], [5]];

export type Tone = "good" | "bad" | "neutral";
export interface Cost { text: string; tone: Tone }

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** The visible cost line for a choice: what it gives and what it takes, in plain words. */
export function formatEffect(e: Effect): Cost[] {
  const out: Cost[] = [];
  if (e.beacons) out.push({ text: `${e.beacons > 0 ? "+" : "−"}${plural(Math.abs(e.beacons), "beacon")}`, tone: e.beacons > 0 ? "good" : "bad" });
  if (e.doses) out.push({ text: `${e.doses > 0 ? "+" : "−"}${plural(Math.abs(e.doses), "dose")}`, tone: e.doses > 0 ? "good" : "bad" });
  if (e.clock) out.push({ text: `${Math.abs(e.clock)} min ${e.clock > 0 ? "lost" : "saved"}`, tone: e.clock > 0 ? "bad" : "good" });
  if (e.nextRevealLead !== undefined) out.push(e.nextRevealLead === 0 ? { text: "no flood warning on the next leg", tone: "bad" } : { text: "early flood warning", tone: "good" });
  if (!out.length) out.push({ text: "no cost", tone: "neutral" });
  return out;
}

/** What the supplies will read after a choice (for the preview while the reveal is on screen). */
export function applyEffect(r: Resources, e: Effect): Resources {
  return { beacons: Math.max(0, r.beacons + (e.beacons ?? 0)), clock: Math.max(0, r.clock + (e.clock ?? 0)), doses: Math.max(0, r.doses + (e.doses ?? 0)) };
}

export const clockPct = (clock: number, limit: number) => Math.max(0, Math.min(100, Math.round((clock / limit) * 100)));

/** The best (latest winning) star count per leg, null for a leg not won yet. */
export function starsFromLog(log: LogEntry[]): (Stars | null)[] {
  return LEG_IDS.map((id) => {
    const wins = log.filter((l) => l.kind === "leg" && l.legId === id && l.result.stars > 0);
    const last = wins[wins.length - 1];
    return last && last.kind === "leg" ? last.result.stars : null;
  });
}

export type LevelState = "done" | "current" | "ahead";
export interface TrailNode { level: number; name: string; state: LevelState; leg: number; legEnd: boolean; here: boolean }
export interface TrailModel { nodes: TrailNode[]; stars: (Stars | null)[]; hereLevel: number /* 0 = still at the surface ramp */ }

/** The depth map: 5 levels, each owned by a leg; legs before `legIndex` are done, `legIndex` is next up, the rest are ahead. */
export function trailModel(legIndex: number, log: LogEntry[]): TrailModel {
  const done = Math.max(0, Math.min(LEG_LEVELS.length, legIndex));
  const hereLevel = done === 0 ? 0 : LEG_LEVELS[done - 1][LEG_LEVELS[done - 1].length - 1];
  const nodes = LEG_LEVELS.flatMap((levels, leg) => levels.map((level, i): TrailNode => ({
    level, name: LEVEL_NAMES[level - 1], leg,
    state: leg < done ? "done" : leg === done ? "current" : "ahead",
    legEnd: i === levels.length - 1, here: level === hereLevel,
  })));
  return { nodes, stars: starsFromLog(log), hereLevel };
}

export interface TrailRow { kind: "leg" | "choice"; title: string; detail: string; stars?: Stars; failed?: boolean }

/** The trail log, in the order it happened: every leg attempt (stars, minutes, retries) and every camp choice. */
export function trailRows(log: LogEntry[], names: Record<string, string> = {}): TrailRow[] {
  return log.map((l): TrailRow => {
    if (l.kind === "choice") {
      const choice = names[`${l.eventId}/${l.choiceId}`] ?? humanize(l.choiceId);
      return { kind: "choice", title: names[l.eventId] ?? humanize(l.eventId), detail: choice };
    }
    const r = l.result, failed = r.stars === 0 || r.maraAt === null;
    return {
      kind: "leg", title: LEG_NAMES[l.legId] + (l.attempt > 1 ? `, retry ${l.attempt - 1}` : ""), stars: r.stars, failed,
      detail: `${r.ticks} min · ${plural(r.beaconsPlaced, "beacon")} placed${failed ? " · failed, retried" : ""}`,
    };
  });
}

/** Retries per leg, from the log (attempts beyond the first). */
export const retriesOf = (log: LogEntry[]) => log.filter((l) => l.kind === "leg" && l.attempt > 1).length;

function humanize(id: string) {
  const s = id.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

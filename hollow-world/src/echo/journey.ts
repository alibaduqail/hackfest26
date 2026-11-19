// The Journey: an Oregon-Trail-style campaign over the three live Descent levels (spec: issue #107). Pure state machine, no DOM, no Math.random.
// Resources carry across legs: beacons (spent when placed), the patient's clock, and doses. A failed leg is retried and the failure carries forward.
// Deviation from the #107 sketch: a failed leg moves to phase "camp" (a "retry" event, where Scavenge can be offered), not straight to "leg", and
// choosing Scavenge stays in the camp so the player is never launched into an unwinnable leg.
import { runBaseline } from "./baseline";
import { DESCENT_LAYOUT } from "./descent";
import { DESCENT_LEVELS } from "./descent-levels";
import { createEngine } from "./engine";
import { forgedClaim, LEGS, outfitting, retry, SCAVENGE, towerLies, TUNING } from "./journey-events";
import type { Mission } from "./types";

export type LegId = "descent1" | "descent2" | "descent3";
export interface Resources { beacons: number; clock: number; doses: number }
export interface LegMods { budget: number; revealLead?: number } // revealLead: ticks of advance flood reveal (#101); 0 = none. Carried here, ignored by the engine until #101 lands.
export interface LegResult { legId: LegId; stars: 0 | 1 | 2 | 3; maraAt: number | null; medicineAt: number | null; beaconsPlaced: number; ticks: number }
export interface Effect { beacons?: number; clock?: number; doses?: number; nextRevealLead?: number }
export interface Choice { id: string; label: string; detail: string; effect: Effect; reveal?: string }
export interface CampEvent { id: string; title: string; body: string; choices: Choice[] }
export type Phase = "title" | "camp" | "leg" | "ending";
export type LogEntry = { kind: "leg"; legId: LegId; attempt: number; result: LegResult } | { kind: "choice"; eventId: string; choiceId: string };
export interface JourneyState { seed: number; phase: Phase; legIndex: number; attempt: number; res: Resources; pending: Partial<LegMods>; log: LogEntry[] }

export const LIMIT = TUNING.limit;
const at0 = (n: number) => Math.max(0, n);

export function startJourney(seed: number = TUNING.seed): JourneyState {
  return { seed, phase: "camp", legIndex: 0, attempt: 0, res: { ...TUNING.start }, pending: {}, log: [] };
}

function raw(s: JourneyState): { id: string; title: string; body: string; choices: Choice[] } {
  if (s.attempt > 0) return { id: `retry-${LEGS[s.legIndex].id}`, ...retry(LEGS[s.legIndex].name) };
  if (s.legIndex === 0) return { id: "outfitting", ...outfitting() };
  if (s.legIndex === 1) return { id: "tower-lies", ...towerLies(s.seed) };
  return { id: "forged-claim", ...forgedClaim(s.seed) };
}

/** The camp event for the current state: deterministic from seed + leg. Scavenge is added whenever the next leg cannot be won with the beacons left (no soft-locks). */
export function campEvent(s: JourneyState): CampEvent {
  const e = raw(s);
  const leg = LEGS[Math.min(s.legIndex, LEGS.length - 1)];
  const low = s.res.beacons < leg.minWin.length;
  return { ...e, choices: low ? [...e.choices, SCAVENGE] : e.choices };
}

/** Apply a camp choice. Unknown ids return the state unchanged. Scavenge stays in camp; every other choice starts the leg. */
export function choose(s: JourneyState, choiceId: string): JourneyState {
  if (s.phase !== "camp") return s;
  const ev = campEvent(s);
  const c = ev.choices.find((x) => x.id === choiceId);
  if (!c) return s;
  const res = { beacons: at0(s.res.beacons + (c.effect.beacons ?? 0)), clock: at0(s.res.clock + (c.effect.clock ?? 0)), doses: at0(s.res.doses + (c.effect.doses ?? 0)) };
  const pending = c.effect.nextRevealLead === undefined ? s.pending : { ...s.pending, revealLead: c.effect.nextRevealLead };
  return { ...s, res, pending, phase: c.id === "scavenge" ? "camp" : "leg", log: [...s.log, { kind: "choice", eventId: ev.id, choiceId: c.id }] };
}

/** The mission to play now, with the leg's budget (min of the leg cap and the beacons carried) and any carried-over reveal. */
export function currentLeg(s: JourneyState): { legId: LegId; mission: Mission; mods: LegMods; story: { title: string; body: string } } {
  if (s.legIndex < 0 || s.legIndex >= LEGS.length) throw new Error(`currentLeg: no leg to play (phase "${s.phase}", legIndex ${s.legIndex}); check phase === "leg" first`);
  const leg = LEGS[s.legIndex];
  const base = DESCENT_LEVELS[s.legIndex].build({ seed: s.seed, attempt: s.attempt, revealLead: s.pending.revealLead }); // the attempt seeds level 1's flood; revealLead 0 (trust the tower) gives no advance reveal
  const mods: LegMods = { budget: Math.min(base.beaconBudget ?? 0, s.res.beacons), ...(s.pending.revealLead === undefined ? {} : { revealLead: s.pending.revealLead }) };
  return { legId: leg.id, mission: { ...base, beaconBudget: mods.budget }, mods, story: leg.story };
}

/** Record a finished leg. Win: the clock gains Mara's arrival; late or missing medicine costs a dose; on to the next camp or the ending.
 * Fail (0 stars or Mara never arrives): clock += ticks played + 15, the placed beacons are lost, -1 dose, same leg again from a retry camp. */
export function completeLeg(s: JourneyState, r: LegResult): JourneyState {
  if (s.phase !== "leg") return s;
  const leg = LEGS[s.legIndex];
  const num = [r.ticks, r.beaconsPlaced, ...(r.maraAt === null ? [] : [r.maraAt]), ...(r.medicineAt === null ? [] : [r.medicineAt])];
  if (r.legId !== leg.id || !num.every(Number.isFinite)) return s; // a stale or malformed result must never move the clock (or make it NaN)
  const log: LogEntry[] = [...s.log, { kind: "leg", legId: leg.id, attempt: s.attempt, result: r }];
  const beacons = at0(s.res.beacons - r.beaconsPlaced);
  if (r.stars === 0 || r.maraAt === null) {
    const res = { beacons, clock: s.res.clock + r.ticks + TUNING.failPenalty, doses: at0(s.res.doses - 1) };
    return { ...s, res, phase: "camp", attempt: s.attempt + 1, log };
  }
  const late = r.medicineAt === null || r.medicineAt > leg.medicineBy;
  const res = { beacons, clock: s.res.clock + r.maraAt, doses: at0(s.res.doses - (late ? 1 : 0)) };
  const legIndex = s.legIndex + 1;
  return { ...s, res, legIndex, attempt: 0, pending: {}, phase: legIndex >= LEGS.length ? "ending" : "camp", log };
}

/** The choice's consequence text for the camp card after the choice was made (the tower-lie reveal, the credential reveal, ...). */
export function lastReveal(s: JourneyState): string | null {
  const c = [...s.log].reverse().find((e) => e.kind === "choice");
  if (!c || c.kind !== "choice") return null;
  const events = [outfitting(), towerLies(s.seed), forgedClaim(s.seed)];
  return [...events.flatMap((e) => e.choices), SCAVENGE].find((x) => x.id === c.choiceId)?.reveal ?? null;
}

const stars = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

/** How deep Mara gets on level 1 with no beacons, in the tower run: the system pitch line. Null when she does arrive. */
function towerLine(): string {
  const m = DESCENT_LEVELS[0].build();
  const b = runBaseline(m, []);
  const e = createEngine(m, "tower");
  e.step(m.endTick);
  const mara = e.observe().pods.find((p) => p.nurse)!;
  const level = DESCENT_LAYOUT.sectors.find((x) => x.sectorId === mara.path[Math.max(0, mara.at)])?.level ?? 1;
  return b.tower.mara === null ? `Without the beacons, Mara never leaves level ${level}. ${b.towerSays}` : `Under the dark tower Mara reaches the clinic at minute ${b.tower.mara}.`;
}

/** The ending and a trail log: every leg (stars, minutes, retries), every choice, and the system compared with the tower. */
export function ending(s: JourneyState): { kind: "saved" | "late"; score: number; title: string; lines: string[] } {
  const wins = LEGS.map((l) => s.log.find((e) => e.kind === "leg" && e.legId === l.id && e.result.stars > 0 && e.result.maraAt !== null)).map((e) => (e && e.kind === "leg" ? e.result : null));
  const saved = s.res.clock <= LIMIT && s.res.doses >= 1 && wins.every(Boolean);
  const score = at0(wins.reduce((n, r) => n + (r?.stars ?? 0) * 100, 0) + (LIMIT - s.res.clock) + s.res.doses * 20);
  const lines = LEGS.map((l, i) => {
    const r = wins[i];
    const retries = s.log.filter((e) => e.kind === "leg" && e.legId === l.id && (e.result.stars === 0 || e.result.maraAt === null)).length;
    return r ? `${l.name}: ${stars(r.stars)} · Mara at minute ${r.maraAt} · ${retries} retr${retries === 1 ? "y" : "ies"}` : `${l.name}: not completed`;
  });
  const events = [outfitting(), towerLies(s.seed), forgedClaim(s.seed)];
  for (const e of s.log) if (e.kind === "choice" && e.choiceId !== "retry") {
    const ev = events.find((x) => x.choices.some((c) => c.id === e.choiceId));
    const c = [...events.flatMap((x) => x.choices), SCAVENGE].find((x) => x.id === e.choiceId);
    if (c) lines.push(`${ev?.title ?? "Scavenged"}: ${c.label}`);
  }
  lines.push(`Clock ${s.res.clock} of ${LIMIT} minutes · ${s.res.doses} dose${s.res.doses === 1 ? "" : "s"} left · ${s.res.beacons} beacon${s.res.beacons === 1 ? "" : "s"} left`);
  lines.push(towerLine());
  const title = saved ? "The clinic is supplied" : s.res.doses < 1 ? "The medicine ran out" : "Too late";
  return { kind: saved ? "saved" : "late", score, title, lines };
}

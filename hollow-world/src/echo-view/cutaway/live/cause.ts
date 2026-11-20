// The one real cause of a failed live run, from the actual run (the complete log of the player's own playRun) and the mission data. Read-only.
// Headline: what happened to Mara ("Mara never arrived" / "Arrived 6 min late"). Cause: one plain sentence. Marks: the sectors to point at on the map.
import { runBaseline, type Baseline } from "../../../echo/baseline";
import { goalsForMission } from "../../../echo/descent-levels";
import type { Command, LogEvent, Mission } from "../../../echo/types";
import { placeName } from "./names";

export interface Verdict {
  headline: string;
  cause: string | null; // null on a win
  marks: string[]; // sector ids missing from the chain, drawn on the map behind the debrief
}

const list = (ids: string[]) => {
  const n = ids.map(placeName);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0];
};
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

/** The dark sections on Mara's route: where she waited blind, else (she never got through) the unlit sections of her planned path, the flooded one first. */
export function darkSections(mission: Mission, commands: Command[], log: LogEvent[], maraArrived: number | null): string[] {
  const placed = new Set(commands.flatMap((c) => (c.type === "placeBeacon" ? [c.sectorId] : [])));
  const dark = (id: string) => mission.world.sectors.find((s) => s.id === id)?.beacon === false && !placed.has(id);
  const mara = mission.pods.find((p) => p.nurse);
  const blind = [...new Set(log.filter((l) => l.kind === "blind" && l.podId === mara?.id && l.sectorId && dark(l.sectorId)).map((l) => l.sectorId!))];
  const planned = (mara?.path ?? []).filter(dark);
  const flood = maraArrived === null && mission.sealSectorId && planned.includes(mission.sealSectorId) ? [mission.sealSectorId] : [];
  return [...new Set([...flood, ...(blind.length ? blind : planned)])].slice(0, 3);
}

export function verdict(mission: Mission, commands: Command[], base: Baseline, stars: number): Verdict {
  const you = base.you;
  const log = you.log;
  const mara = mission.pods.find((p) => p.nurse);
  const medId = mission.pods.find((p) => p.cargo === "medicine")?.id;
  const darks = darkSections(mission, commands, log, you.mara);
  if (stars > 0) return { headline: "Clinic supplied", cause: null, marks: darks };

  const sector = (id: string) => mission.world.sectors.find((s) => s.id === id);
  const lit = (id: string) => sector(id)?.beacon !== false || log.some((l) => l.kind === "beacon-placed" && l.sectorId === id);
  const heards = log.filter((l) => l.kind === "seal-heard" && l.podId === mara?.id);
  const heard = heards[heards.length - 1];
  const rerouted = !!heard && log.some((l) => l.kind === "reroute" && l.podId === mara?.id && l.tick >= heard.tick);
  const stuck = !!heard && !rerouted && log.some((l) => l.kind === "hold" && l.podId === mara?.id && l.tick >= heard.tick);
  const goals = goalsForMission(mission);
  const medStuck = !!medId && log.some((l) => l.kind === "hold" && l.podId === medId);
  let headline: string;
  let cause: string | null = null;
  let marks = darks;

  if (you.mara === null) {
    headline = "Mara never arrived";
    if (stuck) {
      const sealId = heard!.sectorId!;
      const seal = sector(sealId);
      // the news reaches the fork only over beacons on the sealed sector and every sector between it and the fork
      const chain = seal ? mission.world.sectors.filter((s) => s.routeId === seal.routeId && s.index <= seal.index).sort((a, b) => b.index - a.index) : [];
      const missing = chain.filter((s) => !lit(s.id)).map((s) => s.id);
      if (missing.length) {
        cause = `The flood warning never reached Mara: ${list(missing)} had no beacon.`;
        marks = missing;
      } else {
        cause = "Mara heard the warning too late: she was already at the seal.";
        marks = [sealId];
      }
    } else if (darks.length) cause = `Mara lost the clock waiting blind at ${list(darks)}.`;
    else cause = "The run ended before Mara reached the clinic.";
  } else {
    const late = goals ? you.mara - goals[0].maraBy : 0;
    if (late > 0) {
      headline = `Arrived ${late} min late`;
      if (log.some((l) => l.kind === "reroute" && l.podId === mara?.id) && !darks.length) cause = "The flood sent Mara the long way round.";
      else if (darks.length) cause = `Mara waited blind at ${list(darks)}.`;
    } else if (you.medicine === null) {
      headline = "The medicine never arrived";
      cause = medStuck ? "The medicine pod was trapped by the same flood." : "The medicine pod never reached the clinic.";
      marks = medStuck && heard?.sectorId ? [heard.sectorId] : darks;
    } else {
      headline = `Medicine arrived ${Math.max(1, you.medicine - (goals?.[0].medicineBy ?? you.medicine))} min late`;
    }
  }
  return { headline, cause: cause && cap(cause), marks };
}

let last: { key: string; out: { base: Baseline; verdict: Verdict } } | null = null;
/** runBaseline + verdict, shared between the debrief panel and the map markers so the four silent runs happen once per finished run. */
export function analyzeRun(mission: Mission, commands: Command[], stars: number) {
  const key = JSON.stringify([mission.id, mission.sealSectorId, mission.sealAt, mission.seals ?? [], commands, stars]);
  if (last?.key === key) return last.out;
  const base = runBaseline(mission, commands);
  last = { key, out: { base, verdict: verdict(mission, commands, base, stars) } };
  return last.out;
}

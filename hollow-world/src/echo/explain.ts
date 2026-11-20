// explainRun: 2-4 plain lines that say why a run went the way it did, built only from log events and the mission data.
// Pass the complete log (RunOutcome.log from baseline.ts); observe().log keeps only the last 60 events and loses the early ones.
// Never invents or rounds a number in the player's favour: every tick and margin below comes from an event.
import { goalsForMission } from "./descent-levels";
import type { LogEvent, Mission, Pod } from "./types";

const BLIND_MIN = 3; // protocol.ts BLIND_TICKS: a pod waits this long at an unbeaconed sector (can overlap queue time, so costs are "up to")

const short = (p: Pod) => (p.label.split("· ")[1] ?? p.id).replace(/^Nurse /, "");
const first = (log: LogEvent[], kind: LogEvent["kind"], podId?: string) => log.find((l) => l.kind === kind && (!podId || l.podId === podId));

export function explainRun(log: LogEvent[], mission: Mission): string[] {
  const mara = mission.pods.find((p) => p.nurse);
  const med = mission.pods.find((p) => p.cargo === "medicine");
  if (!mara) return [];
  const name = short(mara);
  const arrived = first(log, "arrive", mara.id)?.tick ?? null;
  const medArrived = med ? (first(log, "arrive", med.id)?.tick ?? null) : null;
  // Multi-seal levels: explain the flood Mara last heard about (the one that decided her run), not just the first one.
  const heards = log.filter((l) => l.kind === "seal-heard" && l.podId === mara.id);
  const heard = heards[heards.length - 1];
  const reroutes = log.filter((l) => l.kind === "reroute" && l.podId === mara.id);
  const seals = log.filter((l) => l.kind === "seal");
  const seal = (heard && seals.find((x) => x.sectorId === heard.sectorId)) ?? seals[0];
  const sealId = seal?.sectorId ?? "the shaft";
  const reroute = heard ? reroutes.find((r) => r.tick >= heard.tick) : undefined; // she re-planned around that flood
  const stuck = !!heard && !reroute && log.some((l) => l.kind === "hold" && l.podId === mara.id && l.tick >= heard.tick);
  const when = reroutes.length > 1 ? `minutes ${reroutes.map((r) => r.tick).join(" and ")}` : `minute ${reroute?.tick}`;
  const lines: string[] = [];

  // 1. what the flood did to Mara
  if (!seal) lines.push(`The flood never hit. ${name} ${arrived === null ? "did not reach the clinic" : `reached the clinic at minute ${arrived}`}.`);
  else if (reroute) lines.push(`The flood${seals.length > 1 ? "s" : ""} sealed ${seals.map((x) => `${x.sectorId} at minute ${x.tick}`).join(" and ")}. The news hopped ${log.some((l) => l.kind === "beacon-placed") ? "beacon to beacon" : "along the beacons already in the shaft"}, ${name} re-routed at ${when}${arrived === null ? " but did not arrive" : ` and reached the clinic at minute ${arrived}`}.`);
  else if (stuck) lines.push(`The flood sealed ${sealId} at minute ${seal.tick}. No warning reached ${name}: she met the sealed shaft at minute ${heard!.tick} and could not get through.`);
  else if (arrived === null) lines.push(`${name} did not reach the clinic.`); // e.g. still queued at timeout: never claim she cleared the shaft
  else lines.push(`${name} cleared the shaft before the flood sealed ${sealId} at minute ${seal.tick} and reached the clinic at minute ${arrived}.`);

  // 2. the cause (stuck) or the cost of dark sectors (arrived)
  if (stuck && seal) {
    const sec = mission.world.sectors.find((x) => x.id === sealId);
    const prev = sec ? (mission.world.sectors.find((x) => x.routeId === sec.routeId && x.index === sec.index - 1)?.id ?? null) : null; // the link the news has to cross to reach her
    const lit = (id: string) => mission.world.sectors.find((s) => s.id === id)?.beacon !== false || log.some((l) => l.kind === "beacon-placed" && l.sectorId === id);
    const placed = (id: string) => log.find((l) => l.kind === "beacon-placed" && l.sectorId === id)?.tick;
    const s = sealId;
    if (!lit(s) && (!prev || !lit(prev))) lines.push(`${prev ? `${s} and ${prev} had` : `${s} had`} no beacon, so the flood news had nothing to travel on.`);
    else if (lit(s) && prev && !lit(prev)) lines.push(`${s} had a beacon but ${prev} did not, so the news never reached the fork. A beacon on the flood does nothing if the next link is dark.`);
    else if (!lit(s)) lines.push(`${prev} was lit but ${s} was dark, so the news never started.`);
    else lines.push(`Beacons on ${s} (minute ${placed(s) ?? 0})${prev ? ` and ${prev} (minute ${placed(prev) ?? 0})` : ""} went in too late: ${name} was already past the fork.`);
  } else {
    const dark = [...new Set(log.filter((l) => l.kind === "blind" && l.podId === mara.id).map((l) => l.sectorId!))];
    if (dark.length) lines.push(`${name} waited blind at ${dark.length} dark sector${dark.length > 1 ? "s" : ""}${dark.length <= 3 ? ` (${dark.join(", ")})` : ""}: up to ${dark.length * BLIND_MIN} minutes lost.`);
    else if (arrived !== null) lines.push(`Every sector on ${name}'s route was lit: no blind waits.`);
  }

  // 3. the medicine, when it never made it
  if (med && medArrived === null && arrived !== null) lines.push("The medicine never reached the clinic.");
  else if (med && medArrived === null && stuck) lines.push("The medicine was trapped by the same flood.");

  // 4. margin to the next star (descent-live only): both deadlines, the way the star table judges them
  const goals = goalsForMission(mission); // the star table of the flood this mission carries
  if (goals && arrived !== null) {
    const met = (g: (typeof goals)[number]) => arrived <= g.maraBy && (g.medicineBy === undefined || (medArrived !== null && medArrived <= g.medicineBy));
    const stars = goals.reduce((n, g) => (met(g) ? g.stars : n), 0);
    const next = goals[stars];
    if (!next) lines.push("Best possible run.");
    else {
      const m = arrived > next.maraBy ? `${name} by ${next.maraBy} (arrived ${arrived}, ${arrived - next.maraBy} late)` : null;
      const d = next.medicineBy === undefined ? null : medArrived === null ? `medicine by ${next.medicineBy} (never arrived)` : medArrived > next.medicineBy ? `medicine by ${next.medicineBy} (arrived ${medArrived}, ${medArrived - next.medicineBy} late)` : null;
      lines.push(`Next star (${"★".repeat(next.stars)}): ${[m, d].filter(Boolean).join("; ")}.`);
    }
  }
  return lines.slice(0, 4);
}

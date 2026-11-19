// The Directorate tower: clears flights while it is up, then goes dark. It keeps claiming flights it no longer clears.
import { say, sealsOf } from "./engine";
import type { Sim } from "./engine";
import type { Pod, Sector } from "./types";

/** standby mode: minutes after the primary tower fails that the backup tower comes online. */
export const STANDBY_AFTER = 20;

export const isFree = (s: Sim, sec: Sector) => sec.holder === null && !sec.sealed && (s.released.get(sec.id) ?? -1) < s.tick;

/** Put `p` into `sec` (caller checked it is free). */
export function enter(s: Sim, p: Pod, sec: Sector) {
  p.at++;
  p.progress = 0;
  p.status = "moving";
  sec.holder = p.id;
  s.entries++;
  say(s, "enter", `${p.label} enters ${sec.id}`, p.id, sec.id);
}

export function towerPhase(s: Sim) {
  const m = s.m;
  for (const p of s.pods) if (p.status === "scheduled" && p.departTick <= s.tick) p.status = "waiting";

  if (s.mode !== "normal")
    for (const { at, sectorId } of sealsOf(m))
      if (at === s.tick) {
        s.sec.get(sectorId)!.sealed = true;
        say(s, "seal", `Directorate seals ${sectorId}`, undefined, sectorId);
      }

  if (s.towerUp && !s.standbyBack && s.mode !== "normal" && s.tick >= m.towerDownAt) {
    s.towerUp = false;
    say(s, "tower-down", "Directorate tower offline");
    for (const p of s.pods) if (p.status === "moving") s.flown.add(p.id); // pods already mid-sector when it fails still fly
    if (s.mode === "tower" || s.mode === "standby")
      for (const p of s.pods)
        if (p.status === "waiting" && p.at >= 0) {
          p.status = "holding";
          say(s, "hold", `${p.label} holds at the boundary`, p.id);
        }
  }
  // The backup tower: a second CENTRAL tower. It clears flights again (the same grant rate) but has no beacons and cannot carry the seal news,
  // so pods it clears walk straight to the flooded shaft and wait there for ever. That is the point of the comparison with Echo.
  if (s.mode === "standby" && !s.towerUp && s.tick >= m.towerDownAt + STANDBY_AFTER) {
    s.towerUp = true;
    s.standbyBack = true;
    for (const p of s.pods) if (p.status === "holding") p.status = "waiting";
  }
  if (!s.towerUp) return;

  // grants: token bucket, one token per flight; a healthy normal-day tower is not throttled
  s.tokens += m.towerRatePerHour;
  const queue = s.pods.filter((p) => p.status === "waiting" && p.at < 0 && !s.rt.get(p.id)!.granted).sort((a, b) => a.departTick - b.departTick || (a.id < b.id ? -1 : 1));
  for (const p of queue) {
    if (s.mode !== "normal" && s.tokens < 60) break;
    if (s.mode !== "normal") s.tokens -= 60;
    s.rt.get(p.id)!.granted = true;
    s.grantsEver++;
    say(s, "grant", `Tower clears ${p.label}`, p.id);
  }
  s.tokens = Math.min(s.tokens, 60); // unspent clearance does not bank beyond one flight
  // a cleared pod enters its next sector once it is free
  const order = s.pods.filter((p) => p.status === "waiting" && s.rt.get(p.id)!.granted).sort((a, b) => a.departTick - b.departTick || (a.id < b.id ? -1 : 1));
  for (const p of order) {
    const next = s.sec.get(p.path[p.at + 1]);
    if (next && isFree(s, next)) enter(s, p, next);
  }
}

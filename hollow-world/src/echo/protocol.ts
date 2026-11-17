// Echo protocol: beacon news (one hop per tick), seal reroute, announce -> claim -> yield -> enter.
// Runs every tick in echo mode. News and rerouting work any time; claims only once the tower is down.
import { hasBeacon, say } from "./engine";
import type { SealNews, Sim, Topo } from "./engine";
import { enter, isFree } from "./tower";
import type { Pod, Priority } from "./types";

const RANK: Record<Priority, number> = { medical: 3, supply: 2, passenger: 1 };
const rank = (p: Pod) => (p.priority === "medical" && !p.credentialOk ? RANK.passenger : RANK[p.priority]); // forged medical competes as passenger
const BLIND_TICKS = 3; // GAME.md §2: an Echo pod waits this long at an unbeaconed sector before claiming it
const byPriority = (a: Pod, b: Pod) => rank(b) - rank(a) || b.waitedMin - a.waitedMin || (a.id < b.id ? -1 : 1);

/** Sectors a pod can enter after finishing `sid`. */
function after(t: Topo, sid: string): string[] {
  const city = t.end.get(sid);
  const next = t.succ.get(sid);
  return city ? (t.startingAt.get(city) ?? []) : next ? [next] : [];
}

/** Shortest path (fewest sectors, ties by lower id) from the pod's next boundary to its destination that avoids every seal it knows of, or null. */
function reroute(s: Sim, p: Pod): string[] | null {
  const known = new Set([...s.rt.get(p.id)!.knows].map((i) => s.topo.seals[i].sectorId));
  const ok = (id: string) => !known.has(id);
  const first = (p.at < 0 ? (s.topo.startingAt.get(p.origin) ?? []) : after(s.topo, p.path[p.at])).filter(ok);
  const parent = new Map<string, string | null>(first.map((id) => [id, null]));
  const q = [...first];
  while (q.length) {
    const id = q.shift()!;
    if (s.topo.end.get(id) === p.dest) {
      const out: string[] = [];
      for (let x: string | null = id; x; x = parent.get(x)!) out.unshift(x);
      return out;
    }
    for (const n of after(s.topo, id)) if (!parent.has(n) && ok(n)) (parent.set(n, id), q.push(n));
  }
  return null;
}

/** Hops until the news reaches this pod: its sector, or its origin terminal (one hop after the sectors touching it). */
function hops(n: SealNews, s: Sim, p: Pod): number {
  if (p.at >= 0) return n.dist.get(p.path[p.at]) ?? Infinity; // an unbeaconed sector has no dist: it never hears
  const near = (s.topo.touching.get(p.origin) ?? []).map((id) => n.dist.get(id) ?? Infinity);
  return near.length ? Math.min(...near) + 1 : Infinity;
}

function news(s: Sim) {
  s.topo.seals.forEach((n, i) => {
    if (s.tick < n.at) return;
    const seal = n.sectorId;
    const elapsed = s.tick - n.at;
    for (const [id, d] of n.dist) if (d === elapsed) s.pulses.push({ sectorId: id, kind: "seal", age: 0 }); // the news front, one hop per tick
    for (const p of s.pods) {
      const r = s.rt.get(p.id)!;
      if (r.knows.has(i) || p.status === "arrived") continue;
      const sees = p.status !== "moving" && p.path[p.at + 1] === seal; // standing at the sealed boundary: no news needed
      if (!sees && hops(n, s, p) > elapsed) continue;
      r.knows.add(i);
      if (!p.path.slice(p.at + 1).includes(seal)) continue; // seal is behind it, or it is inside: it finishes
      say(s, "seal-heard", `${p.label} hears ${seal} is sealed`, p.id, seal);
      const around = reroute(s, p);
      if (around) {
        p.path = [...p.path.slice(0, p.at + 1), ...around];
        p.rerouted = true;
        say(s, "reroute", `${p.label} re-plans around ${seal}`, p.id);
      } else r.stuck = true;
    }
  });
  for (const p of s.pods)
    if (s.rt.get(p.id)!.stuck && p.status === "waiting") {
      p.status = "holding";
      say(s, "hold", `${p.label} holds: no way around the seal`, p.id);
    }
}

export function echoPhase(s: Sim) {
  news(s);
  if (s.towerUp) return; // before the tower fails, Echo behaves exactly like the tower
  const claimed = new Set<string>();

  // winners from an earlier tick enter now, if the sector is still free
  for (const p of s.pods) {
    const r = s.rt.get(p.id)!;
    if (!r.claim) continue;
    const sec = s.sec.get(r.claim)!;
    if (r.claimTick < s.tick && p.status === "waiting" && isFree(s, sec)) {
      r.claim = null;
      enter(s, p, sec);
    } else if (sec.sealed || p.status !== "waiting") r.claim = null;
    else claimed.add(sec.id);
  }

  // everyone at a boundary or terminal announces its next sector; its beacon picks the winner
  const want = new Map<string, Pod[]>();
  for (const p of s.pods) {
    if (p.status !== "waiting" || s.rt.get(p.id)!.claim) continue;
    const id = p.path[p.at + 1];
    if (!id || s.sec.get(id)!.sealed) continue;
    if (!hasBeacon(s.sec.get(id)!)) {
      // dead zone: no beacon reports whether it is clear, so the pod waits blind at the boundary first
      const key = `${p.id}|${id}`;
      if (!s.blind.has(key)) {
        s.blind.set(key, s.tick);
        say(s, "blind", `${p.label} waits blind at ${id}: no beacon`, p.id, id);
      }
      if (s.tick - s.blind.get(key)! < BLIND_TICKS) continue;
    }
    (want.get(id) ?? want.set(id, []).get(id)!).push(p);
  }
  for (const [id, pods] of [...want].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const sec = s.sec.get(id)!;
    pods.sort(byPriority);
    for (const p of pods) {
      const key = `${p.id}|${id}`;
      if (s.announced.has(key)) continue;
      s.announced.add(key);
      say(s, "announce", `${p.label} announces ${id}`, p.id, id);
      s.pulses.push({ sectorId: id, kind: "announce", age: 0 });
      if (p.priority === "medical" && !p.credentialOk) say(s, "credential-reject", `${p.label}: signature rejected, queued as passenger`, p.id, id);
    }
    if (claimed.has(id) || !isFree(s, sec)) continue;
    const [winner, ...losers] = pods;
    s.rt.get(winner.id)!.claim = id;
    s.rt.get(winner.id)!.claimTick = s.tick;
    say(s, "claim", `${winner.label} claims ${id}`, winner.id, id);
    for (const l of losers) {
      const key = `${l.id}|${id}`;
      if (s.yielded.has(key)) continue;
      s.yielded.add(key);
      say(s, "yield", `${l.label} yields ${id} to ${winner.label}`, l.id, id);
    }
  }
}

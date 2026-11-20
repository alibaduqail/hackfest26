// View-layer display names for the Descent leg: engine ids ("main1", "link0") become short plain place names. Engine data is untouched.
import { descent } from "../../../echo/descent";
import { descentLive2 } from "../../../echo/descent2";
import { descentLive3 } from "../../../echo/descent3";

const ROUTE: Record<string, string> = {
  spur: "the forged-pod spur",
  paxline: "the passenger line",
  mainA: "the first main shaft",
  bypA: "the first bypass",
  mainB: "the second main shaft",
  bypB: "the second bypass",
  ramp: "the depot ramp",
  link: "the relay track",
  trunk: "the junction track",
  main: "the main shaft",
  byp: "the dry bypass",
};
const PARTS: Record<number, string[]> = {
  1: [""],
  2: ["upper", "lower"],
  3: ["upper", "middle", "lower"],
  4: ["upper", "upper-middle", "lower-middle", "lower"],
};
const length = new Map<string, number>();
for (const m of [descent(), descentLive2(), descentLive3()]) {
  for (const s of m.world.sectors) length.set(s.routeId, Math.max(length.get(s.routeId) ?? 0, s.index + 1));
}

/** "main1" -> "the middle main shaft". Unknown ids come back unchanged. */
export function placeName(id: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(id);
  const route = m && ROUTE[m[1]];
  if (!m || !route) return id;
  const part = PARTS[length.get(m[1]) ?? 3]?.[Number(m[2])];
  return part ? route.replace(/^the /, `the ${part} `) : route;
}

/** Replace every sector id inside a sentence with its plain name. */
export function plainText(text: string): string {
  return text.replace(/\b[A-Za-z]+\d+\b/g, (id) => placeName(id));
}

type PodLike = { id: string; label: string; cargo?: string };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The short name a player sees for a pod: "MED-1 · Nurse Mara Vale" -> "Mara", "SUP-3 · medicine" -> "Medicine", "PAX-1" -> "Passengers", "GHOST-1" -> "Fake medical pod". */
export function podName(p: PodLike): string {
  const rest = p.label.split(" · ")[1] ?? "";
  if (p.id.startsWith("MED")) return rest.replace(/^Nurse /, "").split(" ")[0] || "Nurse";
  if (p.id.startsWith("SUP")) return cap((p.cargo ?? rest).toLowerCase());
  if (p.id.startsWith("PAX")) return "Passengers";
  if (p.id.startsWith("GHOST")) return "Fake medical pod";
  return rest || p.id;
}

const POD_REF = /\b(?:MED|SUP|PAX|GHOST)-\d+(?: · .+?)?(?= (?:leaves|enters|arrives|holds|hears|re-plans|waits|announces|claims|yields)\b|[:,.]|$)/g;
const podRef = (ref: string) => { const [id, ...rest] = ref.split(" · "); return podName({ id, label: ref, cargo: rest.join(" · ") }); };
const CITY: Record<string, string> = { ny: "New York", s07: "Sector 07", sao: "São Paulo", lon: "London", lagos: "Lagos", cairo: "Cairo", mow: "Moscow", mum: "Mumbai", bei: "Beijing", tok: "Tokyo", jak: "Jakarta", syd: "Sydney" };
/** "s07-lagos-f0" -> "the Sector 07 to Lagos tunnel" (world-map tunnel ids). */
const tunnel = (t: string) => t.replace(/\b([a-z0-9]+)-([a-z]+)-[bf]\d+\b/g, (m, a: string, b: string) => (CITY[a] && CITY[b] ? `the ${CITY[a]} to ${CITY[b]} tunnel` : m));
const PLURAL = /^Passengers (\S+)/;

/** Engine log and explain sentences in plain words: pod labels become short names, protocol verbs become ordinary ones. View only; engine text and hashes stay as they are. */
export function plainLog(text: string): string {
  const t = text
    .replace(/(MED|SUP|PAX|GHOST)-\d+(?: · [^:]*?)?: signature rejected, queued as passenger/, (m) => `${podRef(m.split(": ")[0])} has no valid signature and joins the passenger line`)
    .replace(POD_REF, podRef)
    .replace(/ waits blind at (.+): no beacon/, " waits at $1: no beacon")
    .replace(/ (?:waited|waits) blind at /, (m) => m.replace(" blind", ""))
    .replace(/^(.+) yields (.+) to (.+)$/, "$3 goes first at $2")
    .replace(/ claims /, " takes ")
    .replace(/ announces /, " calls ahead to ")
    .replace(/ holds at the boundary/, " waits at the edge")
    .replace(/ re-plans around /, " finds a way around ")
    .replace(/\bdark sectors?\b/g, (m) => m.replace("sector", "section"));
  return tunnel(plainText(t)).replace(PLURAL, (_, v: string) => `Passengers ${v.replace(/^(\w+?)s\b/, "$1")}`);
}

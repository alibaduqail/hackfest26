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

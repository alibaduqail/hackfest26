// Map text placement: city names and floating pod tags, kept clear of each other. View only.
import { FONT_SANS, THEME } from "./theme";
import type { City, Observation } from "../echo/types";

type XY = [number, number];
export type Box = [x: number, y: number, w: number, h: number];

// label side per city, chosen so neighbours (NY/Sector 07, London/Moscow, Beijing/Tokyo) never collide
const LABEL_SIDE: Record<string, "l" | "r" | "t" | "b"> = { ny: "r", s07: "l", lon: "t", mow: "r", bei: "t", tok: "r", cairo: "t", lagos: "l", mum: "r", jak: "r", syd: "l", sao: "r" };
export const LABEL_FONT = `12px ${FONT_SANS}`;
export const overlaps = (a: Box, b: Box) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** The map label is the city's Hollow name ("London Deep"), never its surface name ("London"): the data's own `name`, display-only. */
export const shortName = (c: City) => c.name;

/** Where a city's name goes: left edge, middle line, width. */
export function labelAt(ctx: CanvasRenderingContext2D, c: City, [x, y]: XY, prepare: boolean): [number, number, number] {
  const side = prepare && c.id === "ny" ? "t" : LABEL_SIDE[c.id] ?? "r";
  ctx.font = LABEL_FONT;
  const wText = ctx.measureText(shortName(c)).width;
  return side === "t" ? [x - wText / 2, y - 42, wText] :
    side === "b" ? [x - wText / 2, y + 15, wText] :
    side === "l" ? [x - 11 - wText, y, wText] : [x + 11, y, wText];
}

export function cityLabel(ctx: CanvasRenderingContext2D, c: City, xy: XY, prepare: boolean) {
  const [tx, ty, width] = labelAt(ctx, c, xy, prepare);
  ctx.fillStyle = "rgba(13,22,28,0.85)"; ctx.fillRect(tx - 2, ty - 8, width + 4, 16);
  ctx.fillStyle = c.outbreak ? THEME.red : c.strata ? THEME.amber : THEME.text2;
  ctx.font = c.strata || c.outbreak ? `600 ${LABEL_FONT}` : LABEL_FONT;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(shortName(c), tx, ty);
}

/** Boxes the city names and the city blocks occupy, for tags that must stay clear of them. */
export function cityBoxes(ctx: CanvasRenderingContext2D, obs: Observation, project: (p: XY) => XY, prepare: boolean): Box[] {
  return obs.cities.flatMap((c): Box[] => {
    const [cx, cy] = project([c.x, c.y]);
    const [lx, ly, lw] = labelAt(ctx, c, [cx, cy], prepare);
    return [[lx - 2, ly - 8, lw + 4, 16], [cx - 10, cy - (c.strata ? 34 : 28), 20, c.strata ? 38 : 32]];
  });
}

/** A w x h tag beside the point (x, y): the first of several spots that hits nothing in `avoid`. The caller adds the result to `avoid`. */
export function placeTag([x, y]: XY, w: number, h: number, avoid: Box[], W: number, H: number): Box {
  const spots: XY[] = [[x + 9, y + 7], [x + 9, y - 7 - h], [x - 9 - w, y + 7], [x - 9 - w, y - 7 - h], [x + 9, y + 7 + h + 4], [x - 9 - w, y + 7 + h + 4], [x - w / 2, y + 24], [x - w / 2, y - 24 - h]];
  const boxes = spots.map(([bx, by]): Box => [Math.min(Math.max(2, bx), W - w - 2), Math.min(Math.max(2, by), H - h - 2), w, h]);
  return boxes.find((b) => !avoid.some((a) => overlaps(a, b))) ?? boxes[0];
}

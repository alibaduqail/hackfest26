/** Premise intro: the timeline (ms) and pure helpers. Everything on screen is a function of t, so any frame can be drawn. Pinned to art pixels (1672x941). */
export const ART_W = 1672, ART_H = 941;
export const DIR = [250, 1450, 2100], DARK = [900, 1250, 1900, 2550, 3000], PAOFF = 3600;
export const LAMP = 3950, PL = [4300, 5300, 5900, 7000], CLINIC = 6000, ROUTE = 6100;
export const B3A = 8600, BOLT1 = 8900, B3B = 10300, B3C = 12300, POD0 = 12400, POD1 = 14000, TITLE = 14600, DONE = 16800;
export const BX = 857, BY = [196, 372, 545, 720, 888];
export const BOLT = [BOLT1, B3B, B3B + 100, B3B + 200, B3B + 300];
export const HOP = [10800, 11100, 11400, 11700, 12000];
export const ECHO0 = POD1, ECHO1 = TITLE - 50;
export const BANDS = [[0, 235], [235, 400], [400, 575], [575, 740], [740, 941]];
export const WP = [[430, 200], [857, 200], [857, 545], [700, 545], [700, 720], [857, 720], [857, 888], [1120, 888]];
export const SEG = WP.slice(1).map((p, i) => Math.hypot(p[0] - WP[i][0], p[1] - WP[i][1]));
export const LEN = SEG.reduce((a, b) => a + b);
/** Reduced motion: still beats, crossfaded. */
export const STILLS = [1600, 3400, 7900, 9800, 12100, 14000], STILL_HOLD = 2000;
/** The real title takes over from the intro this long after TITLE (the dark has fully lifted). */
export const HANDOFF = TITLE + 1900;

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const inout = (x: number) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const fadeIn = (t: number, s: number, d = 240) => clamp((t - s) / d);

export const pulseY = (t: number) => BY[4] + (BY[0] - BY[4]) * inout((t - ECHO0) / (ECHO1 - ECHO0));

/** Holes cut back into the dark: [artX, artY, radius]. */
export function lights(t: number): number[][] {
  const L: number[][] = [];
  if (t > LAMP) L.push([430, 150, 170 * ease((t - LAMP) / 700)]);
  BY.forEach((y, i) => {
    if (t < BOLT[i]) return;
    const full = i === 0 ? ease((t - BOLT[i] - 100) / 800) : ease((t - HOP[i]) / 500);
    const echo = t > ECHO0 && t < TITLE + 400 ? clamp(1 - Math.abs(pulseY(t) - y) / 90) * 24 : 0;
    L.push([BX, y, 44 * ease((t - BOLT[i]) / 300) + 112 * full + echo]);
  });
  if (t > POD1) L.push([1300, 812, 220 * ease((t - POD1) / 700)]);
  return L;
}

/** A level losing power: one hard drop, one stutter, then dark. */
export function bandAlpha(t: number, i: number, reduced: boolean): number {
  const u = t - DARK[i];
  if (u < 0) return 0;
  if (reduced) return .94 * clamp(u / 200);
  return u < 70 ? .94 : u < 140 ? .5 : .94;
}

/** The pod: constant speed along the waypoints, eased at both ends. Returns [x, y, facing, segment]. */
export function podAt(t: number): [number, number, number, number] {
  let s = inout((t - POD0) / (POD1 - POD0)) * LEN;
  for (let i = 0; i < SEG.length; i++) {
    if (s <= SEG[i]) { const a = WP[i], b = WP[i + 1], f = s / SEG[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.sign(b[0] - a[0]) || 1, i]; }
    s -= SEG[i];
  }
  return [WP[WP.length - 1][0], WP[WP.length - 1][1], 1, SEG.length];
}

// The game's one palette: Ali's Strata look (src/style.css: slate-teal panels, warm cream text, amber lights).
// CSS reads these as var(--x); canvas code (map.ts) imports THEME directly. Change a colour here and both follow.
export const THEME = {
  bg: "#10191e", // page
  stage: "#0d161c", // map and world background
  panel: "#15242c", // cards, drawers
  panelHi: "#1c303a",
  line: "#3d535b", // dividers
  line2: "#4a5c61", // panel borders
  btn: "#253b43",
  btn2: "#30434b",
  text: "#ddd8c1",
  head: "#e9e0c8",
  text2: "#b4c4ba",
  muted: "#90a59f",
  dim: "#6f857f",
  amber: "#d2a76a", // primary accent: lights, primary buttons, selected
  amberHi: "#e4c494",
  amberText: "#edcd95",
  amberDim: "#a68f55",
  amberBg: "#2a2418",
  ink: "#16262b", // dark text on amber
  good: "#7ec8b3",
  red: "#e0634f", // the Directorate, seals, alerts
  redText: "#f0a898",
  redBg: "#3a1a18",
  redLine: "#7a3029",
  blue: "#6fb0d8",
  blueText: "#a6d2ea",
  ghost: "#b565d6",
  ghostText: "#d49be8",
  // Hollow control layer (additive, hollow.css): painted steel plates, a sodium lamp, bare rock.
  rock: "#0a1115", // deepest: disabled plates, inset wells
  plate: "#243840", // plate face, low edge
  plateHi: "#31464e", // plate face, lit edge
  plateEdge: "#506a72", // plate rim
  lamp: "#f2b65a", // lit indicator: hover edge, latched switch, focus glow
  lampDeep: "#c99654", // primary plate, shaded end
} as const;

export const FONT_SANS = `"Aptos", "Segoe UI", ui-sans-serif, system-ui, sans-serif`;
/** Signage face: DIN-like wayfinding condensed, what a lift-shaft sign would use. Falls back to the system's narrow sans offline. */
export const FONT_SIGN = `"Barlow Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", ui-sans-serif, system-ui, sans-serif`;
export const FONT_BODY = `"Barlow", "Aptos", "Segoe UI", ui-sans-serif, system-ui, sans-serif`;
export const FONT_MONO = `ui-monospace, SFMono-Regular, Menlo, monospace`;

/** Puts the tokens on :root as CSS variables. Call once, before the first render. */
export function installTheme() {
  const vars = Object.entries(THEME).map(([k, v]) => `--${k}:${v}`).join(";");
  const el = document.createElement("style");
  el.textContent = `:root{${vars};--sans:${FONT_SANS};--mono:${FONT_MONO};--sign:${FONT_SIGN};--body:${FONT_BODY};color-scheme:dark}`;
  document.head.prepend(el);
}

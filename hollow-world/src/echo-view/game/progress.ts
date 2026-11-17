// Best stars per mission, in localStorage. Every access is guarded: with storage blocked the game keeps
// progress in memory for the session. Unlocks are derived from stars, so only stars are stored.
const KEY = "echo-progress-v1";
export type Progress = Record<string, number>; // mission id -> best stars (0..3)

let mem: Progress = {};

export function loadProgress(): Progress {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (v && typeof v === "object" && !Array.isArray(v)) mem = { ...mem, ...v };
  } catch { /* storage blocked or corrupt: keep the in-memory copy */ }
  return { ...mem };
}

/** Keeps the best score; returns the updated progress. */
export function saveStars(id: string, stars: number): Progress {
  const p = loadProgress();
  if (stars > (p[id] ?? 0)) p[id] = stars;
  mem = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
  return { ...p };
}

/** One-off screens (prologue, epilogue) remembered beside the stars. */
export const hasSeen = (p: Progress, what: string) => (p[`seen:${what}`] ?? 0) > 0;
export const markSeen = (what: string) => saveStars(`seen:${what}`, 1);

/** Mission 1 is always open; mission N+1 opens once mission N has a star. */
export const isUnlocked = (ids: string[], i: number, p: Progress) => i === 0 || (p[ids[i - 1]] ?? 0) >= 1;

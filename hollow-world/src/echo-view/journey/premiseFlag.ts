/** The premise intro plays on a first visit only. `?intro=1` replays it (quiet, no UI). All storage access is guarded. */
const KEY = "echo.premiseSeen";

export function shouldPlayPremise(): boolean {
  if (typeof window === "undefined") return false;
  try { if (new URLSearchParams(window.location.search).get("intro") === "1") return true; } catch { /* ignore */ }
  try { return window.localStorage.getItem(KEY) !== "1"; } catch { return false; }
}

export function markPremiseSeen(): void {
  try { window.localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
}

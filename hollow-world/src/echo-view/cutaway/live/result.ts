import type { LogEvent } from "../../../echo/types";

export function deadlineMargin(arrival: number | null, deadline: number): string {
  if (arrival === null) return "Target minute " + deadline + " · did not arrive";
  const difference = deadline - arrival;
  if (!difference) return "Met the ★★★ deadline";
  return Math.abs(difference) + " min " + (difference < 0 ? "late for ★★★" : "ahead of ★★★");
}

export function blindWindows(podId: string, events: readonly LogEvent[], end: number) {
  return events.flatMap((event) => {
    if (event.kind !== "blind" || event.podId !== podId || !event.sectorId) return [];
    // The three-minute blind window can overlap time waiting for an occupied section.
    const resolved = events.find((next) =>
      next.sectorId === event.sectorId && next.tick >= event.tick &&
      (next.kind === "beacon-placed" || (next.kind === "claim" && next.podId === podId))
    );
    const minutes = Math.min(3, (resolved?.tick ?? end) - event.tick);
    return minutes > 0 ? [{ sectorId: event.sectorId, minutes }] : [];
  });
}

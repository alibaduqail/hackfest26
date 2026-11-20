// The browser's animation timestamp can lag the clock sampled while setting up the scene.
export function frameProgress(now: number, start: number, duration: number): number {
  return duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
}

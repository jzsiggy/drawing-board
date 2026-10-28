// The generating screen's progress bar. The model doesn't report progress,
// so this is an estimate from elapsed time: a poster usually takes about
// 20 s. It never reaches the end before the poster is actually done.

export type Stage = "queued" | "painting" | "fitting";

const TYPICAL_MS = 20_000;

export function estimateProgress(stage: Stage, elapsedMs: number): number {
  if (stage === "queued") return 5;
  // Eases towards 85% while painting, then 85-95% while fitting the inks.
  const painting = 85 * (1 - Math.exp(-Math.max(0, elapsedMs) / (TYPICAL_MS / 2)));
  return Math.round(stage === "fitting" ? Math.max(painting, 85) + 10 * (1 - Math.exp(-elapsedMs / TYPICAL_MS)) : Math.max(8, painting));
}

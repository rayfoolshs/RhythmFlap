import type { Grade, TimingDirection } from "./types";

export const COMBO_STEP = 5;

/** Timing windows in seconds. */
export const TIMING = {
  perfect: 0.08,
  good: 0.15,
  ok: 0.28,
};

export const BASE_POINTS: Record<Grade, number> = {
  PERFECT: 100,
  GOOD: 50,
  OK: 20,
};

export function timingGrade(deltaSeconds: number): Grade | "MISS" {
  const delta = Math.abs(deltaSeconds);
  if (delta <= TIMING.perfect) return "PERFECT";
  if (delta <= TIMING.good) return "GOOD";
  if (delta <= TIMING.ok) return "OK";
  return "MISS";
}

/** Classify signed error (pressedSeconds - targetSeconds): negative = early, positive = late. */
export function timingDirection(signedDeltaSeconds: number): TimingDirection {
  if (Math.abs(signedDeltaSeconds) <= 0.035) return "ON_TIME";
  return signedDeltaSeconds < 0 ? "EARLY" : "LATE";
}

/** 1x, then +0.5x every 5 hits, capped at 3x. */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(2, Math.floor(Math.max(0, combo) / COMBO_STEP) * 0.5);
}

export function timingScore(grade: Grade, comboBefore: number): number {
  return Math.round(BASE_POINTS[grade] * comboMultiplier(comboBefore));
}

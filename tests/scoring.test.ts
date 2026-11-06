import { describe, expect, it } from "vitest";
import {
  BASE_POINTS,
  COMBO_STEP,
  TIMING,
  comboMultiplier,
  timingGrade,
  timingScore,
} from "../src/game/scoring";

describe("scoring", () => {
  it("grades taps by distance from the beat", () => {
    expect(timingGrade(0)).toBe("PERFECT");
    expect(timingGrade(TIMING.perfect)).toBe("PERFECT");
    expect(timingGrade(TIMING.perfect + 0.01)).toBe("GOOD");
    expect(timingGrade(TIMING.good + 0.01)).toBe("OK");
    expect(timingGrade(TIMING.ok + 0.01)).toBe("MISS");
  });

  it("grades early and late taps the same way", () => {
    expect(timingGrade(-0.05)).toBe("PERFECT");
    expect(timingGrade(0.05)).toBe("PERFECT");
    expect(timingGrade(-0.12)).toBe("GOOD");
    expect(timingGrade(-0.4)).toBe("MISS");
  });

  it("steps the multiplier every five hits and caps at 3x", () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(COMBO_STEP - 1)).toBe(1);
    expect(comboMultiplier(COMBO_STEP)).toBe(1.5);
    expect(comboMultiplier(COMBO_STEP * 2)).toBe(2);
    expect(comboMultiplier(COMBO_STEP * 3)).toBe(2.5);
    expect(comboMultiplier(COMBO_STEP * 4)).toBe(3);
    expect(comboMultiplier(COMBO_STEP * 50)).toBe(3);
  });

  it("awards base points times the multiplier", () => {
    expect(timingScore("PERFECT", 0)).toBe(100);
    expect(timingScore("PERFECT", 5)).toBe(150);
    expect(timingScore("PERFECT", 20)).toBe(300);
    expect(timingScore("GOOD", 0)).toBe(50);
    expect(timingScore("OK", 0)).toBe(20);
    expect(BASE_POINTS.PERFECT).toBeGreaterThan(BASE_POINTS.GOOD);
  });

  it("always returns positive points", () => {
    for (const grade of ["PERFECT", "GOOD", "OK"] as const) {
      for (let combo = 0; combo < 30; combo += 1) {
        expect(timingScore(grade, combo)).toBeGreaterThan(0);
      }
    }
  });
});

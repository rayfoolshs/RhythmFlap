import { describe, expect, it } from "vitest";
import {
  BEATS_PER_BAR,
  PRE_ROLL_BEATS,
  generateBar,
  generateCourse,
  staffY,
} from "../src/game/layout";
import { createRng } from "../src/game/rng";
import { TIERS, tierById } from "../src/game/tiers";

describe("layout", () => {
  it("fills every bar with exactly four beats", () => {
    for (const tier of TIERS) {
      const notes = generateCourse(tier, "fill-check", 12);
      const bars = new Map<number, number>();
      for (const note of notes) {
        const bar = Math.floor((note.beat - PRE_ROLL_BEATS) / BEATS_PER_BAR);
        bars.set(bar, (bars.get(bar) ?? 0) + note.beats);
      }
      for (const total of bars.values()) {
        expect(total).toBeCloseTo(BEATS_PER_BAR, 6);
      }
    }
  });

  it("only uses durations the tier allows", () => {
    for (const tier of TIERS) {
      for (const note of generateCourse(tier, "values", 20)) {
        // A tie merges two allowed values into one longer note.
        if (note.tied) continue;
        expect(tier.values).toContain(note.beats);
      }
    }
  });

  it("keeps rests inside the tier's allowed rest values", () => {
    for (const tier of TIERS) {
      for (const note of generateCourse(tier, "rests", 30)) {
        if (!note.rest) continue;
        expect(tier.allowedRests.length).toBeGreaterThan(0);
        expect(tier.allowedRests.some((value) => Math.abs(value - note.beats) < 1e-9)).toBe(true);
      }
    }
  });

  it("only creates ties when the tier allows them", () => {
    for (const tier of TIERS) {
      const notes = generateCourse(tier, "ties", 40);
      const tied = notes.filter((note) => note.tied);
      if (tier.ties) {
        expect(tied.length).toBeGreaterThan(0);
        for (const note of tied) expect(note.beats).toBeGreaterThan(0.5);
      } else {
        expect(tied.length).toBe(0);
      }
    }
  });

  it("is reproducible per seed", () => {
    const tier = tierById(3);
    expect(generateCourse(tier, "same")).toEqual(generateCourse(tier, "same"));
    expect(generateCourse(tier, "same")).not.toEqual(generateCourse(tier, "other"));
  });

  it("keeps every pitch on the staff", () => {
    for (const note of generateCourse(tierById(9), "pitch", 40)) {
      expect(note.step).toBeGreaterThanOrEqual(0);
      expect(note.step).toBeLessThanOrEqual(8);
    }
  });

  it("maps step 0 to the bottom line and step 8 to the top", () => {
    expect(staffY(0)).toBeGreaterThan(staffY(8));
    expect(staffY(8)).toBe(staffY(0) - 8 * 9);
  });

  it("generates a bar whose notes are ordered and non-overlapping", () => {
    const notes = generateBar(tierById(5), createRng("order"), 0, { value: 0 }, { value: 4 });
    for (let i = 1; i < notes.length; i += 1) {
      expect(notes[i].beat).toBeGreaterThanOrEqual(notes[i - 1].beat + notes[i - 1].beats - 1e-9);
    }
  });
});

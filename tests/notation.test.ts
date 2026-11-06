import { describe, expect, it } from "vitest";
import { hasStem, isDotted, isFilled, noteShape } from "../src/game/notation";

describe("notation", () => {
  it("maps beat durations to note values", () => {
    expect(noteShape(0.5)).toBe("eighth");
    expect(noteShape(1)).toBe("quarter");
    expect(noteShape(1.5)).toBe("dottedQuarter");
    expect(noteShape(2)).toBe("half");
    expect(noteShape(3)).toBe("dottedHalf");
    expect(noteShape(4)).toBe("whole");
  });

  it("fills eighths and quarters but not halves", () => {
    expect(isFilled("eighth")).toBe(true);
    expect(isFilled("quarter")).toBe(true);
    expect(isFilled("dottedQuarter")).toBe(true);
    expect(isFilled("half")).toBe(false);
    expect(isFilled("whole")).toBe(false);
  });

  it("dots only dotted values", () => {
    expect(isDotted("dottedQuarter")).toBe(true);
    expect(isDotted("dottedHalf")).toBe(true);
    expect(isDotted("quarter")).toBe(false);
  });

  it("gives a stem to everything but a whole note", () => {
    expect(hasStem("whole")).toBe(false);
    expect(hasStem("half")).toBe(true);
    expect(hasStem("eighth")).toBe(true);
  });
});

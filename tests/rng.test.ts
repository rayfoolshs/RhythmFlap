import { describe, expect, it } from "vitest";
import { createRng, hashSeed, mulberry32, pick, randInt, randomSeed } from "../src/game/rng";

describe("rng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("teacher-42");
    const b = createRng("teacher-42");
    const first = Array.from({ length: 12 }, () => a());
    const second = Array.from({ length: 12 }, () => b());
    expect(first).toEqual(second);
  });

  it("differs for different seeds", () => {
    const a = createRng("alpha")();
    const b = createRng("beta")();
    expect(a).not.toBe(b);
  });

  it("stays in [0, 1)", () => {
    const rng = mulberry32(hashSeed("range"));
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces slug-safe seeds", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(randomSeed()).toMatch(/^[a-z0-9]{6}$/);
    }
  });

  it("picks from the supplied list and respects inclusive bounds", () => {
    const rng = createRng("pick");
    expect([0.5, 1, 1.5]).toContain(pick(rng, [0.5, 1, 1.5]));
    for (let i = 0; i < 200; i += 1) {
      const value = randInt(rng, -1, 1);
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

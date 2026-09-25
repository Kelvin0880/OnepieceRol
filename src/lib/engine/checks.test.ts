import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { encounterDifficulty } from "./checks";

describe("encounterDifficulty", () => {
  it("increases with island danger", () => {
    const low = encounterDifficulty(1, 1);
    const high = encounterDifficulty(10, 1);
    expect(high).toBeGreaterThan(low);
  });

  it("is softened by character level, but never trivial", () => {
    const dc1 = encounterDifficulty(5, 1);
    const dc50 = encounterDifficulty(5, 50);
    expect(dc50).toBeLessThan(dc1);
    expect(dc50).toBeGreaterThanOrEqual(5); // floor
  });

  it("stays within [5, 99] for extreme inputs", () => {
    expect(encounterDifficulty(1, 999)).toBeGreaterThanOrEqual(5);
    expect(encounterDifficulty(10, 0)).toBeLessThanOrEqual(99);
  });
});

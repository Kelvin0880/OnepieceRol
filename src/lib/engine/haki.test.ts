import { describe, it, expect } from "vitest";
import { trainHaki, conquerorsHakiAwakens } from "./haki";

describe("trainHaki", () => {
  it("never trains past 100", () => {
    expect(trainHaki(100, 100)).toEqual({ gained: 0, breakthrough: false });
    expect(trainHaki(99, 100).gained).toBeLessThanOrEqual(1);
  });
  it("never overshoots the 100 cap even near the ceiling", () => {
    for (let lvl = 90; lvl < 100; lvl++) expect(lvl + trainHaki(lvl, 100).gained).toBeLessThanOrEqual(100);
  });
  it("is steady: the same level and will always give the same session", () => {
    expect(trainHaki(20, 40)).toEqual(trainHaki(20, 40));
    expect(trainHaki(20, 40).gained).toBeGreaterThanOrEqual(1);
  });
  it("higher willpower gives more, and returns fade as the level climbs", () => {
    expect(trainHaki(10, 90).gained).toBeGreaterThan(trainHaki(10, 5).gained);
    expect(trainHaki(11, 50).gained).toBeGreaterThanOrEqual(trainHaki(80, 50).gained);
  });
  it("reaching a new tier of ten is a breakthrough that doubles the session", () => {
    const plain = trainHaki(11, 40);
    const tier = trainHaki(9, 40);
    expect(plain.breakthrough).toBe(false);
    expect(tier.breakthrough).toBe(true);
    expect(tier.gained).toBeGreaterThan(plain.gained);
  });
});

describe("conquerorsHakiAwakens", () => {
  it("needs a formidable will and both Hakis already trained: a rule, not a chance", () => {
    expect(conquerorsHakiAwakens(60, 40, 40)).toBe(true);
    expect(conquerorsHakiAwakens(59, 100, 100)).toBe(false);
    expect(conquerorsHakiAwakens(100, 39, 100)).toBe(false);
    expect(conquerorsHakiAwakens(100, 100, 39)).toBe(false);
  });
});

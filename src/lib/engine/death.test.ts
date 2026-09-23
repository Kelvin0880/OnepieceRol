import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { rollDeath } from "./death";

describe("rollDeath", () => {
  it("chance never goes below the floor even with maxed defensive stats", () => {
    const rng = mulberry32(1);
    const result = rollDeath(rng, {
      islandDanger: 1,
      characterLevel: 99,
      durability: 999,
      willpower: 999,
      permadeath: false,
    });
    expect(result.chance).toBeGreaterThanOrEqual(0.02);
  });

  it("chance never exceeds the ceiling even in a hopeless matchup", () => {
    const rng = mulberry32(1);
    const result = rollDeath(rng, {
      islandDanger: 10,
      characterLevel: 1,
      durability: 0,
      willpower: 0,
      permadeath: true,
    });
    expect(result.chance).toBeLessThanOrEqual(0.92);
  });

  it("non-permadeath mode roughly halves the chance vs permadeath, same inputs", () => {
    const rngA = mulberry32(1);
    const rngB = mulberry32(1);
    const soft = rollDeath(rngA, { islandDanger: 6, characterLevel: 3, durability: 10, willpower: 10, permadeath: false });
    const hard = rollDeath(rngB, { islandDanger: 6, characterLevel: 3, durability: 10, willpower: 10, permadeath: true });
    expect(soft.chance).toBeLessThan(hard.chance);
  });

  it("higher island danger relative to level increases death chance", () => {
    const rng1 = mulberry32(1);
    const rng2 = mulberry32(1);
    const easy = rollDeath(rng1, { islandDanger: 1, characterLevel: 20, durability: 10, willpower: 10, permadeath: true });
    const hard = rollDeath(rng2, { islandDanger: 10, characterLevel: 1, durability: 10, willpower: 10, permadeath: true });
    expect(hard.chance).toBeGreaterThan(easy.chance);
  });

  it("died flag matches roll < chance", () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const input = { islandDanger: 5, characterLevel: 5, durability: 5, willpower: 5, permadeath: true };
      const result = rollDeath(rng, input);
      expect(result.died).toBe(result.roll < result.chance);
    }
  });

  it("death is never guaranteed nor impossible over many trials at moderate risk", () => {
    let deaths = 0;
    const trials = 500;
    for (let seed = 0; seed < trials; seed++) {
      const rng = mulberry32(seed);
      const result = rollDeath(rng, { islandDanger: 5, characterLevel: 5, durability: 5, willpower: 5, permadeath: true });
      if (result.died) deaths++;
    }
    expect(deaths).toBeGreaterThan(0);
    expect(deaths).toBeLessThan(trials);
  });
});

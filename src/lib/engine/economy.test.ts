import { describe, it, expect } from "vitest";
import { fruitBlackMarketPrice, weaponPrice, bountyReward, berryReward, xpToNextLevel, computeBailBerries } from "./economy";

describe("fruitBlackMarketPrice", () => {
  it("scales up strictly with rarity tier", () => {
    const order = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY", "MYTHICAL_TIER"] as const;
    const prices = order.map(fruitBlackMarketPrice);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it("falls back to a sane multiplier for an unknown rarity", () => {
    expect(fruitBlackMarketPrice("NOT_A_RARITY" as Parameters<typeof fruitBlackMarketPrice>[0])).toBe(50_000);
  });
});

describe("weaponPrice", () => {
  it("Saijo O Wazamono is the most expensive graded tier", () => {
    const graded = ["WAZAMONO", "RYO_WAZAMONO", "O_WAZAMONO", "SAIJO_O_WAZAMONO"] as const;
    const prices = graded.map((g) => weaponPrice(1000, g));
    expect(Math.max(...prices)).toBe(prices[prices.length - 1]);
  });

  it("is proportional to basePrice", () => {
    expect(weaponPrice(2000, "WAZAMONO")).toBe(weaponPrice(1000, "WAZAMONO") * 2);
  });
});

describe("bountyReward", () => {
  it("bosses always pay more than a regular kill at the same danger/level", () => {
    const regular = bountyReward(5, 5, false);
    const boss = bountyReward(5, 5, true);
    expect(boss).toBeGreaterThan(regular);
  });

  it("stomping far-below-level content yields a reduced but positive reward", () => {
    const fresh = bountyReward(8, 1, false);
    const overleveled = bountyReward(8, 40, false);
    expect(overleveled).toBeLessThan(fresh);
    expect(overleveled).toBeGreaterThan(0);
  });

  it("never returns a negative bounty", () => {
    expect(bountyReward(10, 999, false)).toBeGreaterThanOrEqual(0);
  });
});

describe("berryReward", () => {
  it("increases with island danger", () => {
    expect(berryReward(10, false)).toBeGreaterThan(berryReward(1, false));
  });

  it("boss encounters pay a flat multiplier over regular ones", () => {
    const regular = berryReward(4, false);
    const boss = berryReward(4, true);
    expect(boss).toBe(regular * 3);
  });
});

describe("xpToNextLevel", () => {
  it("grows monotonically with level", () => {
    let prev = 0;
    for (let level = 1; level <= 30; level++) {
      const xp = xpToNextLevel(level);
      expect(xp).toBeGreaterThan(prev);
      prev = xp;
    }
  });
});

describe("computeBailBerries", () => {
  it("increases with island danger", () => {
    expect(computeBailBerries(10, 1)).toBeGreaterThan(computeBailBerries(1, 1));
  });

  it("increases with character level", () => {
    expect(computeBailBerries(5, 50)).toBeGreaterThan(computeBailBerries(5, 1));
  });

  it("is always positive, even at the lowest danger/level", () => {
    expect(computeBailBerries(1, 1)).toBeGreaterThan(0);
  });

  it("charges a Kairoseki premium for a devil fruit user", () => {
    expect(computeBailBerries(5, 10, true)).toBeGreaterThan(computeBailBerries(5, 10, false));
  });

  it("defaults to no premium when hasDevilFruit is omitted", () => {
    expect(computeBailBerries(5, 10)).toBe(computeBailBerries(5, 10, false));
  });
});

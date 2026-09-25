import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { marketWindow, msToNextWindow, MARKET_WINDOW_MS, offersForWindow, OFFERS_PER_WINDOW, offerPrice, stingChance, stingSprung, fruitIsFake, stingDamage, isBlackMarketIsland, pardonReduction, FAKE_FRUIT_CHANCE } from "./black-market";

describe("stock windows", () => {
  it("rotates every window and counts down", () => {
    expect(marketWindow(0)).toBe(0);
    expect(marketWindow(MARKET_WINDOW_MS)).toBe(1);
    expect(msToNextWindow(MARKET_WINDOW_MS - 1)).toBe(1);
  });
  it("the same window and island always show the same distinct offers", () => {
    const a = offersForWindow(42, 3);
    expect(a).toEqual(offersForWindow(42, 3));
    expect(a).toHaveLength(OFFERS_PER_WINDOW);
    expect(new Set(a.map((o) => o.id)).size).toBe(OFFERS_PER_WINDOW);
    const differs = Array.from({ length: 20 }, (_, w) => JSON.stringify(offersForWindow(w, 3))).some((s) => s !== JSON.stringify(a));
    expect(differs).toBe(true);
  });
  it("only lawless islands host a market", () => {
    expect(isBlackMarketIsland("Loguetown")).toBe(true);
    expect(isBlackMarketIsland("Isla Conomi")).toBe(false);
  });
});

describe("prices", () => {
  const ctx = { bounty: 1_000_000, notoriety: 0, faction: "PIRATE" };
  it("a pardon scales with fame but has a floor", () => {
    expect(offerPrice("pardon", ctx)).toBe(20_000);
    expect(offerPrice("pardon", { ...ctx, bounty: 900_000_000 })).toBe(18_000_000);
    expect(offerPrice("pardon", { bounty: 0, notoriety: 500, faction: "MARINE" })).toBe(20_000);
  });
  it("pardon removes a third of fame", () => expect(pardonReduction(1000)).toBe(300));
});

describe("risk", () => {
  it("stings grow with repeat deals and are capped", () => {
    expect(stingChance(0)).toBeLessThan(stingChance(3));
    expect(stingChance(99)).toBe(0.5);
  });
});

describe("no-chance risk", () => {
  it("the sting comes on the third deal in a window, never before", () => {
    expect([0, 1].map(stingSprung)).toEqual([false, false]);
    expect(stingSprung(2)).toBe(true);
    expect(stingSprung(9)).toBe(true);
  });
  it("which windows sell a rotten fruit is fixed by the stock, the same for every buyer", () => {
    const flags = Array.from({ length: 40 }, (_, w) => fruitIsFake(w, 7));
    expect(flags.some(Boolean) && flags.some((f) => !f)).toBe(true);
    expect(fruitIsFake(12, 7)).toBe(fruitIsFake(12, 7));
  });
  it("damage never kills", () => {
    expect(stingDamage(1, 100)).toBe(0);
    expect(stingDamage(50, 100)).toBeLessThan(50);
  });
});

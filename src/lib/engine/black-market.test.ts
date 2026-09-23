import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { marketWindow, msToNextWindow, MARKET_WINDOW_MS, offersForWindow, OFFERS_PER_WINDOW, offerPrice, stingChance, rollSting, rollFakeFruit, stingDamage, isBlackMarketIsland, pardonReduction, FAKE_FRUIT_CHANCE } from "./black-market";

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
  it("fake fruit rate is near its constant", () => {
    const rng = mulberry32(2);
    let fakes = 0;
    for (let i = 0; i < 4000; i++) if (rollFakeFruit(rng)) fakes++;
    expect(Math.abs(fakes / 4000 - FAKE_FRUIT_CHANCE)).toBeLessThan(0.04);
  });
  it("sting frequency tracks its chance and damage never kills", () => {
    const rng = mulberry32(9);
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (rollSting(rng, 2)) hits++;
    expect(Math.abs(hits / 4000 - stingChance(2))).toBeLessThan(0.04);
    expect(stingDamage(5, 100)).toBe(4);
    expect(stingDamage(100, 100)).toBe(15);
    expect(stingDamage(1, 100)).toBe(0);
  });
});

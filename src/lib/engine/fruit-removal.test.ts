import { describe, expect, it } from "vitest";
import { fruitRemovalBlockReason, fruitRemovalPrice, FRUIT_REMOVAL_ISLAND } from "./fruit-removal";

const paramecia = (level: number, extra: Partial<Parameters<typeof fruitRemovalPrice>[0]> = {}) =>
  fruitRemovalPrice({ level, fruitType: "PARAMECIA", awakened: false, singleton: false, ...extra });

describe("fruitRemovalPrice", () => {
  it("is a real fortune that grows with the level", () => {
    expect(paramecia(1)).toBe(165_000);
    expect(paramecia(9)).toBe(285_000);
    expect(paramecia(30)).toBeGreaterThan(paramecia(9));
  });

  it("costs more for rarer, stronger power", () => {
    expect(fruitRemovalPrice({ level: 9, fruitType: "LOGIA", awakened: false, singleton: false })).toBeGreaterThan(paramecia(9));
    expect(fruitRemovalPrice({ level: 9, fruitType: "ZOAN_MYTHICAL", awakened: false, singleton: false })).toBe(fruitRemovalPrice({ level: 9, fruitType: "LOGIA", awakened: false, singleton: false }));
    expect(paramecia(9, { singleton: true })).toBeGreaterThan(paramecia(9));
    expect(paramecia(9, { awakened: true })).toBe(paramecia(9) * 2);
  });

  it("always lands on a round figure and never breaks on a strange input", () => {
    expect(fruitRemovalPrice({ level: 7, fruitType: "ZOAN_ANCIENT", awakened: false, singleton: true }) % 5_000).toBe(0);
    expect(fruitRemovalPrice({ level: Number.NaN, fruitType: "UNKNOWN", awakened: false, singleton: false })).toBe(165_000);
  });
});

describe("fruitRemovalBlockReason", () => {
  const ok = { hasFruit: true, islandName: FRUIT_REMOVAL_ISLAND, alive: true, berries: 300_000, price: 285_000 };

  it("lets the ritual go ahead when everything is in order", () => {
    expect(fruitRemovalBlockReason(ok)).toBeNull();
  });

  it("explains every refusal", () => {
    expect(fruitRemovalBlockReason({ ...ok, hasFruit: false })).toMatch(/no hay nada que arrancar/);
    expect(fruitRemovalBlockReason({ ...ok, islandName: "Isla Drum" })).toMatch(/Isla Kairos/);
    expect(fruitRemovalBlockReason({ ...ok, alive: false })).toMatch(/estado actual/);
    expect(fruitRemovalBlockReason({ ...ok, berries: 100 })).toMatch(/285\.000/);
  });
});

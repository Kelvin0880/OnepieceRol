import { describe, it, expect } from "vitest";
import { impelDownCell, impelDownRescueLevel } from "./impel-down";

describe("impelDownCell", () => {
  it("small fish stay in the ordinary brig", () => {
    expect(impelDownCell("PIRATE", 99_999_999, 0)).toBe(0);
    expect(impelDownCell("REVOLUTIONARY", 0, 699)).toBe(0);
  });

  it("goes deeper with a higher bounty, capped at level 6", () => {
    expect(impelDownCell("PIRATE", 100_000_000, 0)).toBe(1);
    expect(impelDownCell("PIRATE", 1_000_000_000, 0)).toBe(4);
    expect(impelDownCell("PIRATE", 9_000_000_000, 0)).toBe(6);
  });

  it("revolutionaries and hunters are judged by notoriety, pirates by bounty", () => {
    expect(impelDownCell("REVOLUTIONARY", 0, 2_400)).toBe(3);
    expect(impelDownCell("PIRATE", 0, 99_999)).toBe(0);
  });

  it("the Government never jails its own", () => {
    expect(impelDownCell("MARINE", 9_000_000_000, 99_999)).toBe(0);
    expect(impelDownCell("CP0", 0, 99_999)).toBe(0);
  });
});

describe("impelDownRescueLevel", () => {
  it("gets much harder with depth", () => {
    expect(impelDownRescueLevel(100, 1)).toBeLessThan(impelDownRescueLevel(100, 6));
    expect(impelDownRescueLevel(100, 6)).toBeGreaterThan(300);
  });
});

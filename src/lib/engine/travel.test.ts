import { describe, it, expect } from "vitest";
import { canEnterIsland } from "./travel";

describe("canEnterIsland", () => {
  it("allows entry when level meets the requirement exactly", () => {
    expect(canEnterIsland(8, 8)).toBe(true);
  });

  it("allows entry when level exceeds the requirement", () => {
    expect(canEnterIsland(20, 8)).toBe(true);
  });

  it("refuses entry when below the requirement", () => {
    expect(canEnterIsland(7, 8)).toBe(false);
  });

  it("always allows entry when minLevelToEnter is the default (1)", () => {
    expect(canEnterIsland(1, 1)).toBe(true);
  });
});

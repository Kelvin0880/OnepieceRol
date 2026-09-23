import { describe, it, expect } from "vitest";
import { buildTurnOrder, nextTurnIndex } from "./party-turns";

describe("buildTurnOrder", () => {
  it("puts the captain first, keeping the rest in join order", () => {
    expect(buildTurnOrder(["b", "a", "c"], "a")).toEqual(["a", "b", "c"]);
  });

  it("returns just the rest, unmodified, if the captain isn't in the member list", () => {
    expect(buildTurnOrder(["b", "c"], "a")).toEqual(["b", "c"]);
  });

  it("handles a solo captain", () => {
    expect(buildTurnOrder(["a"], "a")).toEqual(["a"]);
  });

  it("handles an empty member list", () => {
    expect(buildTurnOrder([], "a")).toEqual([]);
  });
});

describe("nextTurnIndex", () => {
  it("advances to the next index", () => {
    expect(nextTurnIndex(["a", "b", "c"], 0)).toBe(1);
    expect(nextTurnIndex(["a", "b", "c"], 1)).toBe(2);
  });

  it("wraps back to 0 after the last member", () => {
    expect(nextTurnIndex(["a", "b", "c"], 2)).toBe(0);
  });

  it("stays at 0 for a single-member turn order", () => {
    expect(nextTurnIndex(["a"], 0)).toBe(0);
  });

  it("returns 0 for an empty turn order rather than throwing", () => {
    expect(nextTurnIndex([], 0)).toBe(0);
  });
});

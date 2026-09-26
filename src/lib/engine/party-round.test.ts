import { describe, expect, it } from "vitest";
import { missingMembers, orderedActions, parseRound, roundComplete, roundStalled } from "./party-round";

describe("party rounds", () => {
  it("parses stored actions defensively", () => {
    expect(parseRound('{"a":"hola","b":"  "}')).toEqual({ a: "hola" });
    expect(parseRound("basura")).toEqual({});
    expect(parseRound(null)).toEqual({});
  });
  it("a round is complete only when every member acted", () => {
    expect(missingMembers(["a", "b", "c"], { a: "x", c: "y" })).toEqual(["b"]);
    expect(roundComplete(["a", "b"], { a: "x" })).toBe(false);
    expect(roundComplete(["a", "b"], { a: "x", b: "y" })).toBe(true);
    expect(roundComplete([], {})).toBe(false);
  });
  it("orders actions by join order and drops people who left", () => {
    expect(orderedActions(["a", "b"], { b: "2", a: "1", z: "gone" })).toEqual([{ characterId: "a", text: "1" }, { characterId: "b", text: "2" }]);
  });
  it("a stalled round is answered with whoever acted", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(roundStalled(new Date("2026-01-01T11:00:00Z"), 1, now)).toBe(true);
    expect(roundStalled(new Date("2026-01-01T11:55:00Z"), 1, now)).toBe(false);
    expect(roundStalled(new Date("2026-01-01T11:00:00Z"), 0, now)).toBe(false);
    expect(roundStalled(null, 2, now)).toBe(false);
  });
});

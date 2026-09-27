import { describe, expect, it } from "vitest";
import { missingMembers, orderedActions, parseRound, roundComplete } from "./party-round";

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
});

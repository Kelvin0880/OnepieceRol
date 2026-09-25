import { describe, it, expect } from "vitest";
import { rescueEdge, rescueSucceeded, KAIROSEKI_RESCUE_PENALTY } from "./rescue";

describe("rescueEdge", () => {
  it("is how far ahead of the captor the rescuer stands", () => {
    expect(rescueEdge(120, 80)).toBe(40);
    expect(rescueEdge(50, 80)).toBe(-30);
  });
  it("a devil fruit prisoner is guarded more heavily", () => {
    expect(rescueEdge(120, 80, true)).toBe(40 - KAIROSEKI_RESCUE_PENALTY);
  });
  it("defaults to no Kairoseki penalty when the flag is omitted", () => {
    expect(rescueEdge(100, 60)).toBe(rescueEdge(100, 60, false));
  });
  it("the Kairoseki penalty is a real, non-trivial number", () => {
    expect(KAIROSEKI_RESCUE_PENALTY).toBeGreaterThanOrEqual(10);
  });
});

describe("rescueSucceeded", () => {
  it("only success and critical success free the prisoner", () => {
    expect(rescueSucceeded("success")).toBe(true);
    expect(rescueSucceeded("critical_success")).toBe(true);
    expect(rescueSucceeded("fail")).toBe(false);
    expect(rescueSucceeded("critical_fail")).toBe(false);
  });
});

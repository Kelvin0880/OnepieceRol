import { describe, it, expect } from "vitest";
import { canEnterIsland, travelCooldownMs, travelWaitMs } from "./travel";

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

describe("travel cooldown", () => {
  it("scales with the destination danger", () => {
    expect(travelCooldownMs(1)).toBeLessThan(travelCooldownMs(9));
    expect(travelCooldownMs(0)).toBe(6 * 60_000);
  });

  it("is zero when the character never traveled or the cooldown has elapsed", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(travelWaitMs(null, 5, now)).toBe(0);
    expect(travelWaitMs(new Date(now.getTime() - travelCooldownMs(5) - 1), 5, now)).toBe(0);
  });

  it("reports the remaining wait while cooling down", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const last = new Date(now.getTime() - 60_000);
    expect(travelWaitMs(last, 5, now)).toBe(travelCooldownMs(5) - 60_000);
  });
});

import { tideStatus, TIDE_WINDOW_MS, knowsTheRoad } from "./travel";

describe("tideStatus", () => {
  it("alternates open and closed windows and reports how long the current one lasts", () => {
    const openStart = new Date(TIDE_WINDOW_MS * 4);
    const a = tideStatus(openStart);
    expect(a.open).toBe(true);
    expect(a.msUntilChange).toBe(TIDE_WINDOW_MS);
    const b = tideStatus(new Date(TIDE_WINDOW_MS * 5 + 1000));
    expect(b.open).toBe(false);
    expect(b.msUntilChange).toBe(TIDE_WINDOW_MS - 1000);
    expect(tideStatus(new Date(TIDE_WINDOW_MS * 6)).open).toBe(true);
  });
});

describe("knowsTheRoad", () => {
  const road = ["a", "b", "c", "d"];
  it("needs every Road Poneglyph read", () => {
    expect(knowsTheRoad(["a", "b", "c"], road)).toBe(false);
    expect(knowsTheRoad(["d", "c", "b", "a", "x"], road)).toBe(true);
  });
  it("is never satisfied when no Road Poneglyphs exist", () => {
    expect(knowsTheRoad([], [])).toBe(false);
  });
});

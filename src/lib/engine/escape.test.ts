import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import {
  levelsToEscape,
  escapeDifficulty,
  escapeModifier,
  escapeResultFrom,
  applyEscapeResult,
  escapeCooldownLeftMs,
  ESCAPE_COOLDOWN_MS,
  MAX_ALERT,
} from "./escape";

describe("levelsToEscape", () => {
  it("is one obstacle for a brig and one per level in Impel Down", () => {
    expect(levelsToEscape(0)).toBe(1);
    expect(levelsToEscape(4)).toBe(4);
  });
});

describe("escapeDifficulty", () => {
  it("grows with depth, captor strength and alert, within bounds", () => {
    const base = escapeDifficulty(1, 100, 0);
    expect(escapeDifficulty(6, 100, 0)).toBeGreaterThan(base);
    expect(escapeDifficulty(1, 400, 0)).toBeGreaterThan(base);
    expect(escapeDifficulty(1, 100, 3)).toBeGreaterThan(base);
    expect(escapeDifficulty(6, 9999, 99)).toBeLessThanOrEqual(120);
  });
});

describe("escapeModifier", () => {
  const m = { agility: 40, willpower: 40, intellect: 30, level: 10, tacticModifier: 0, hasDevilFruit: false };
  it("rewards a clever plan and is hampered by Kairoseki on a fruit user", () => {
    expect(escapeModifier({ ...m, tacticModifier: 15 })).toBeGreaterThan(escapeModifier(m));
    expect(escapeModifier({ ...m, hasDevilFruit: true })).toBeLessThan(escapeModifier(m));
  });
});

describe("applyEscapeResult", () => {
  const s = (progress: number, alert: number, cellLevel: number) => ({ progress, alert, cellLevel });
  it("a climb advances one level and calms the guards; reaching the top frees the prisoner", () => {
    expect(applyEscapeResult(s(0, 3, 4), "climb")).toEqual({ state: s(1, 0, 4), free: false });
    expect(applyEscapeResult(s(3, 0, 4), "climb")).toEqual({ state: s(4, 0, 4), free: true });
  });
  it("a breakthrough climbs two and can free from the last two levels at once", () => {
    expect(applyEscapeResult(s(0, 0, 4), "breakthrough").state.progress).toBe(2);
    expect(applyEscapeResult(s(2, 0, 4), "breakthrough").free).toBe(true);
    expect(applyEscapeResult(s(0, 0, 0), "climb").free).toBe(true); // a brig is a single obstacle
  });
  it("a setback only raises the alert (capped)", () => {
    expect(applyEscapeResult(s(2, 0, 4), "setback")).toEqual({ state: s(2, 1, 4), free: false });
    expect(applyEscapeResult(s(2, MAX_ALERT, 4), "setback").state.alert).toBe(MAX_ALERT);
  });
  it("getting caught drags you one cell deeper (never past 6) and resets progress; a brig stays a brig", () => {
    expect(applyEscapeResult(s(3, 0, 4), "caught").state).toEqual(s(0, 1, 5));
    expect(applyEscapeResult(s(1, 0, 6), "caught").state.cellLevel).toBe(6);
    expect(applyEscapeResult(s(0, 0, 0), "caught").state.cellLevel).toBe(0);
  });
});

describe("escapeCooldownLeftMs", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("is zero with no previous try or once the cooldown has passed", () => {
    expect(escapeCooldownLeftMs(null, now)).toBe(0);
    expect(escapeCooldownLeftMs(new Date(now.getTime() - ESCAPE_COOLDOWN_MS), now)).toBe(0);
  });
  it("counts down after a recent try", () => {
    expect(escapeCooldownLeftMs(new Date(now.getTime() - 10 * 60_000), now)).toBe(ESCAPE_COOLDOWN_MS - 10 * 60_000);
  });
});

describe("escapeResultFrom", () => {
  it("maps the judge's outcome onto the escape steps", () => {
    expect(escapeResultFrom("critical_success")).toBe("breakthrough");
    expect(escapeResultFrom("success")).toBe("climb");
    expect(escapeResultFrom("fail")).toBe("setback");
    expect(escapeResultFrom("critical_fail")).toBe("caught");
  });
});

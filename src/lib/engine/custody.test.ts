import { describe, expect, it } from "vitest";
import { CUSTODY_MAX_MS, custodyExpired, custodyHint, isGovernmentIsland } from "./custody";

describe("custody", () => {
  it("knows which islands belong to the Government", () => {
    expect(isGovernmentIsland("Loguetown", "Marina")).toBe(true);
    expect(isGovernmentIsland("Enies Lobby", "Gobierno Mundial (CP-0)")).toBe(true);
    expect(isGovernmentIsland("Isla Egghead", "Gobierno Mundial (Laboratorio de Vegapunk)")).toBe(true);
    expect(isGovernmentIsland("Jaya", "Sin gobierno (Ciudad Mock y Ciudad Ley)")).toBe(false);
    expect(isGovernmentIsland("Isla Baltigo", "Ejército Revolucionario")).toBe(false);
  });
  it("a captive escapes after a day", () => {
    const t = new Date("2026-09-26T00:00:00Z");
    expect(custodyExpired(t, new Date(t.getTime() + CUSTODY_MAX_MS - 1))).toBe(false);
    expect(custodyExpired(t, new Date(t.getTime() + CUSTODY_MAX_MS))).toBe(true);
  });
  it("tells the captor what to do", () => {
    expect(custodyHint(true, [])).toContain("entregarlo ahora");
    expect(custodyHint(false, ["Loguetown", "Marineford"])).toContain("Loguetown");
  });
});

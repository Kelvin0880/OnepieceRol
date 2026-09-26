import { describe, expect, it } from "vitest";
import { actorPrisonCell, describeWorldState, prisonLabel } from "./world-state";

describe("actorPrisonCell", () => {
  it("goes deeper the bigger the canon bounty", () => {
    expect(actorPrisonCell(50_000_000, 80)).toBe(1);
    expect(actorPrisonCell(340_000_000, 80)).toBe(2);
    expect(actorPrisonCell(3_000_000_000, 99)).toBe(6);
  });
  it("falls back to power when there is no bounty, always 1-6", () => {
    expect(actorPrisonCell(null, 45)).toBe(1);
    expect(actorPrisonCell(null, 99)).toBe(5);
    expect(actorPrisonCell(null, 10)).toBe(1);
  });
});

describe("describeWorldState", () => {
  it("is empty with nothing to say", () => {
    expect(describeWorldState({ yonko: [], prisoners: [], defeated: [], fallen: [], events: [] })).toBe("");
  });
  it("states the prisoners with their level (real report: a captured Shanks still showed at home)", () => {
    const t = describeWorldState({ yonko: ["Buggy"], prisoners: [{ name: "Shanks", cell: 5 }], defeated: ["Kaido"], fallen: [], events: [] });
    expect(t).toContain("Shanks en Impel Down, Nivel 5");
    expect(t).toContain("Yonko vigentes: Buggy");
    expect(t).toContain("Derrotados");
    expect(prisonLabel(null)).toBe("Impel Down");
  });
});

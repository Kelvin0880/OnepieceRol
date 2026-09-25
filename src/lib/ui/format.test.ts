import { describe, expect, it } from "vitest";
import { diffVitals, formatBerries, formatCompact, formatMinutes, percent, type VitalsSnapshot } from "./format";

const base: VitalsSnapshot = { level: 3, hp: 80, berries: 1000, bounty: 0, notoriety: 0, rankTitle: "Novato", attributePoints: 0 };

describe("percent", () => {
  it("clamps to 0..100", () => {
    expect(percent(50, 100)).toBe(50);
    expect(percent(150, 100)).toBe(100);
    expect(percent(-5, 100)).toBe(0);
  });
  it("never divides by zero or NaN", () => {
    expect(percent(5, 0)).toBe(0);
    expect(percent(Number.NaN, 10)).toBe(0);
  });
});

describe("formatting", () => {
  it("uses the Spanish thousands separator for berries", () => {
    expect(formatBerries(1320000)).toBe("฿ 1.320.000");
  });
  it("shortens big bounties", () => {
    expect(formatCompact(4_048_900_000)).toBe("4 mil M");
    expect(formatCompact(3_000_000)).toBe("3 M");
    expect(formatCompact(1_500_000)).toBe("1,5 M");
    expect(formatCompact(950)).toBe("950");
  });
  it("formats waits in minutes and hours", () => {
    expect(formatMinutes(30_000)).toBe("1 min");
    expect(formatMinutes(45 * 60000)).toBe("45 min");
    expect(formatMinutes(120 * 60000)).toBe("2 h");
    expect(formatMinutes(135 * 60000)).toBe("2 h 15 min");
  });
});

describe("diffVitals", () => {
  it("says nothing on the first load", () => {
    expect(diffVitals(null, base)).toEqual([]);
  });
  it("says nothing when nothing changed", () => {
    expect(diffVitals(base, { ...base })).toEqual([]);
  });
  it("announces a level up, the points it brings and a new rank", () => {
    const out = diffVitals(base, { ...base, level: 4, attributePoints: 2, rankTitle: "Pirata conocido" });
    expect(out.map((t) => t.kind)).toEqual(["level", "rank", "points"]);
    expect(out[0].text).toBe("¡Nivel 4!");
    expect(out[2].text).toBe("+2 puntos de atributo");
  });
  it("reports berries both ways with the right tone", () => {
    expect(diffVitals(base, { ...base, berries: 1500 })).toEqual([{ kind: "berries", text: "+฿ 500", tone: "jade" }]);
    expect(diffVitals(base, { ...base, berries: 700 })).toEqual([{ kind: "berries", text: "−฿ 300", tone: "blood" }]);
  });
  it("reports damage and healing", () => {
    expect(diffVitals(base, { ...base, hp: 60 })[0]).toMatchObject({ kind: "damage", text: "−20 vida" });
    expect(diffVitals(base, { ...base, hp: 95 })[0]).toMatchObject({ kind: "heal", text: "+15 vida" });
  });
  it("reports bounty and merit gains but never losses", () => {
    expect(diffVitals(base, { ...base, bounty: 2_000_000 })[0].text).toBe("Recompensa +฿ 2.000.000");
    expect(diffVitals({ ...base, bounty: 10 }, base)).toEqual([]);
    expect(diffVitals(base, { ...base, notoriety: 40 })[0].text).toBe("Mérito +40");
  });
});

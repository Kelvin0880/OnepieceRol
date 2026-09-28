import { describe, expect, it } from "vitest";
import { bountyFor, cleanName, formatBerries, hashString, MAX_NAME_LENGTH } from "./bounty";

describe("bountyFor", () => {
  it("is stable for the same name, ignoring case and extra spaces", () => {
    const a = bountyFor("  Kirito   del Mar ");
    const b = bountyFor("kirito del mar");
    expect([a.amount, a.epithet]).toEqual([b.amount, b.epithet]);
  });

  it("keeps the name as typed (trimmed) on the poster", () => {
    expect(bountyFor("  Kirito  ").name).toBe("Kirito");
  });

  it("falls back to an unknown name", () => {
    expect(bountyFor("   ").name).toBe("Desconocido");
  });

  it("stays inside 10 million and 3.2 billion, in whole millions", () => {
    for (const n of ["Ana", "Barbosa", "Sebastian", "Zoro", "x", "Capitana Tormenta", "Ñandú", "12345"]) {
      const { amount } = bountyFor(n);
      expect(amount).toBeGreaterThanOrEqual(10_000_000);
      expect(amount).toBeLessThanOrEqual(3_200_000_000);
      expect(amount % 1_000_000).toBe(0);
    }
  });

  it("spreads different names over different posters", () => {
    const amounts = new Set(["Ana", "Luis", "Marta", "Pedro", "Lucía", "Iker", "Nora", "Hugo"].map((n) => bountyFor(n).amount));
    expect(amounts.size).toBeGreaterThan(5);
  });

  it("always picks an epithet", () => {
    expect(bountyFor("Nami").epithet.length).toBeGreaterThan(2);
  });
});

describe("helpers", () => {
  it("hashString is a 32-bit unsigned FNV-1a", () => {
    expect(hashString("")).toBe(0x811c9dc5);
    expect(hashString("a")).toBe(0xe40c292c);
  });

  it("cleanName caps the length like the game does", () => {
    expect(cleanName("a".repeat(40))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("formats berries with dots every three digits", () => {
    expect(formatBerries(1_500_000_000)).toBe("1.500.000.000");
    expect(formatBerries(999)).toBe("999");
    expect(formatBerries(30_000_000)).toBe("30.000.000");
  });
});

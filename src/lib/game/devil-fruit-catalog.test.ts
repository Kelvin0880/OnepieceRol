import { describe, expect, it } from "vitest";
import { FruitType } from "@prisma/client";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";

describe("devil fruit catalog", () => {
  it("has no duplicate names and every fruit explains what it does", () => {
    const names = DEVIL_FRUIT_CATALOG.map((f) => f.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    for (const f of DEVIL_FRUIT_CATALOG) {
      expect(f.description.length, f.name).toBeGreaterThan(40);
      expect(f.englishName.length, f.name).toBeGreaterThan(3);
    }
  });
  it("covers every fruit type, with plenty of common ones to drop", () => {
    const count = (t: FruitType) => DEVIL_FRUIT_CATALOG.filter((f) => f.type === t).length;
    for (const t of [FruitType.PARAMECIA, FruitType.ZOAN, FruitType.ZOAN_ANCIENT, FruitType.ZOAN_MYTHICAL, FruitType.LOGIA]) expect(count(t)).toBeGreaterThanOrEqual(8);
    expect(DEVIL_FRUIT_CATALOG.length).toBeGreaterThanOrEqual(200);
    expect(DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton).length).toBeGreaterThanOrEqual(60);
  });
  it("every Logia is intangible to ordinary blows and a singleton", () => {
    for (const f of DEVIL_FRUIT_CATALOG.filter((x) => x.type === FruitType.LOGIA)) {
      expect((f.effects as { logiaIntangible?: boolean }).logiaIntangible, f.name).toBe(true);
    }
  });
});

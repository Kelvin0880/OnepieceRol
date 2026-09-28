import { describe, expect, it } from "vitest";
import { ITEM_CATALOG } from "../engine/inventory";
import { validateSecrets, type SecretsCatalog } from "../engine/island-secrets";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { ISLAND_LORE_DATA } from "./island-lore-data";
import { ISLAND_SECRETS } from "./island-secrets-data";

const cat: SecretsCatalog = {
  islandNames: new Set(ISLAND_LORE_DATA.map((l) => l.island)),
  placesByIsland: new Map(ISLAND_LORE_DATA.map((l) => [l.island, new Set(l.places.map((p) => p.name))])),
  itemIds: new Set(ITEM_CATALOG.map((i) => i.id)),
  fruitNames: new Set(DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton).map((f) => f.name)),
};

describe("ISLAND_SECRETS data", () => {
  it("passes the engine validation against the real catalogs", () => {
    expect(validateSecrets(ISLAND_SECRETS, cat)).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = ISLAND_SECRETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every lore island at least 2 secrets, one repeatable and one one-time", () => {
    for (const lore of ISLAND_LORE_DATA) {
      const mine = ISLAND_SECRETS.filter((s) => s.island === lore.island);
      expect(mine.length, lore.island).toBeGreaterThanOrEqual(2);
      expect(mine.some((s) => s.cooldownHours !== null), `${lore.island} common`).toBe(true);
      expect(mine.some((s) => s.cooldownHours === null), `${lore.island} rare`).toBe(true);
    }
  });

  it("pays fruits only on one-time secrets, at most one per island", () => {
    const fruitSecrets = ISLAND_SECRETS.filter((s) => s.reward.fruit);
    expect(fruitSecrets.length).toBeGreaterThan(0);
    for (const s of fruitSecrets) expect(s.cooldownHours).toBeNull();
    const perIsland = new Map<string, number>();
    for (const s of fruitSecrets) perIsland.set(s.island, (perIsland.get(s.island) ?? 0) + 1);
    for (const [island, n] of perIsland) expect(n, island).toBe(1);
    expect(fruitSecrets.length).toBeLessThanOrEqual(12);
  });

  it("keeps rare secrets rarer than common ones", () => {
    for (const s of ISLAND_SECRETS) {
      if (s.cooldownHours === null) expect(s.chance, s.id).toBeLessThanOrEqual(0.08);
      else expect(s.chance, s.id).toBeGreaterThanOrEqual(0.1);
    }
  });
});

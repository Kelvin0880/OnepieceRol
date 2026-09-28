import { describe, expect, it } from "vitest";
import { eligibleSecrets, HOUR_MS, IslandSecret, pickSecret, secretWindowOpen, stableHash, validateSecrets } from "./island-secrets";

const base: IslandSecret = {
  id: "foosha:cache",
  island: "Pueblo Foosha",
  title: "Alijo bajo el muelle",
  discovery: "Entre las tablas del muelle viejo asoma un saco encerado que alguien escondió hace años y nunca volvió a buscar.",
  chance: 0.5,
  minLevel: 1,
  cooldownHours: null,
  reward: { berries: 500 },
};
const now = new Date("2026-09-27T12:00:00Z");

describe("secretWindowOpen", () => {
  it("is deterministic for the same character, secret and hour", () => {
    expect(secretWindowOpen("c1", "a:b", now, 0.3)).toBe(secretWindowOpen("c1", "a:b", new Date(now.getTime() + 60_000), 0.3));
  });
  it("chance 0 never opens and chance 1 always opens", () => {
    for (let h = 0; h < 50; h++) {
      const t = new Date(now.getTime() + h * HOUR_MS);
      expect(secretWindowOpen("c1", "a:b", t, 0)).toBe(false);
      expect(secretWindowOpen("c1", "a:b", t, 1)).toBe(true);
    }
  });
  it("opens for roughly the stated share of hours", () => {
    let open = 0;
    for (let h = 0; h < 2000; h++) if (secretWindowOpen("c1", "a:b", new Date(now.getTime() + h * HOUR_MS), 0.2)) open++;
    expect(open / 2000).toBeGreaterThan(0.15);
    expect(open / 2000).toBeLessThan(0.25);
  });
  it("differs between characters", () => {
    expect(stableHash("a")).not.toBe(stableHash("b"));
  });
});

describe("eligibleSecrets / pickSecret", () => {
  const other: IslandSecret = { ...base, id: "foosha:zzz", minLevel: 5, maxLevel: 9 };
  it("filters by island and level band", () => {
    expect(eligibleSecrets([base, other], "Pueblo Foosha", 1, new Map(), now).map((s) => s.id)).toEqual(["foosha:cache"]);
    expect(eligibleSecrets([base, other], "Pueblo Foosha", 6, new Map(), now).map((s) => s.id)).toEqual(["foosha:cache", "foosha:zzz"]);
    expect(eligibleSecrets([base, other], "Pueblo Foosha", 12, new Map(), now).map((s) => s.id)).toEqual(["foosha:cache"]);
    expect(eligibleSecrets([base], "Loguetown", 1, new Map(), now)).toEqual([]);
  });
  it("a one-time secret is gone once found; a cooldown one returns after its cooldown", () => {
    const found = new Map([["foosha:cache", new Date(now.getTime() - 100 * HOUR_MS)]]);
    expect(eligibleSecrets([base], "Pueblo Foosha", 1, found, now)).toEqual([]);
    const cd = { ...base, cooldownHours: 24 };
    expect(eligibleSecrets([cd], "Pueblo Foosha", 1, new Map([[cd.id, new Date(now.getTime() - 23 * HOUR_MS)]]), now)).toEqual([]);
    expect(eligibleSecrets([cd], "Pueblo Foosha", 1, new Map([[cd.id, new Date(now.getTime() - 25 * HOUR_MS)]]), now)).toHaveLength(1);
  });
  it("picks nothing when no window is open and the first open one otherwise", () => {
    expect(pickSecret([{ ...base, chance: 0.0001 }], "nobody", now)).toBeNull();
    expect(pickSecret([{ ...base, chance: 0.5 }, { ...base, id: "foosha:b", chance: 0.5 }], "c1", new Date(now.getTime() + 7 * HOUR_MS))?.id).toMatch(/^foosha:/);
    expect(pickSecret([], "c1", now)).toBeNull();
  });
});

describe("validateSecrets", () => {
  const cat = {
    islandNames: new Set(["Pueblo Foosha"]),
    placesByIsland: new Map([["Pueblo Foosha", new Set(["Bar de Makino"])]]),
    itemIds: new Set(["banquete"]),
    fruitNames: new Set(["Bara Bara no Mi"]),
  };
  it("accepts a good secret", () => {
    expect(validateSecrets([{ ...base, place: "Bar de Makino", reward: { berries: 400, items: [{ id: "banquete", qty: 1 }] } }], cat)).toEqual([]);
  });
  it("rejects every kind of broken secret", () => {
    const bad = (patch: Partial<IslandSecret>) => validateSecrets([{ ...base, ...patch }], cat);
    expect(bad({ island: "Nowhere" }).join()).toMatch(/unknown island/);
    expect(bad({ place: "Casa inventada" }).join()).toMatch(/not in the lore/);
    expect(bad({ reward: {} }).join()).toMatch(/pays nothing/);
    expect(bad({ reward: { items: [{ id: "nope", qty: 1 }] } }).join()).toMatch(/bad item/);
    expect(bad({ reward: { fruit: "Gomu Gomu no Mi" } }).join()).toMatch(/non-singleton/);
    expect(bad({ reward: { fruit: "Bara Bara no Mi" }, cooldownHours: 24 }).join()).toMatch(/one-time/);
    expect(bad({ chance: 0.9 }).join()).toMatch(/chance/);
    expect(bad({ cooldownHours: 1 }).join()).toMatch(/cooldown/);
    expect(bad({ id: "BadId" }).join()).toMatch(/id must look like/);
    expect(validateSecrets([base, base], cat).join()).toMatch(/duplicate/);
  });
});

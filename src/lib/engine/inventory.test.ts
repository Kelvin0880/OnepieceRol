import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { addToInventory, useItem, getItemDef, removeOne, lootFor, sellValue, belongingsFor, describeInventory, INVENTORY_SLOTS, ITEM_CATALOG, type BodyState } from "./inventory";

const body: BodyState = { hp: 50, maxHp: 100, stamina: 40, maxStamina: 100, heat: 60, berries: 1000 };

describe("addToInventory", () => {
  it("fills an existing stack first and then opens a new one", () => {
    const r = addToInventory([{ id: "vendaje", quantity: 8 }], "vendaje", 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stacks).toEqual([{ id: "vendaje", quantity: 9 }, { id: "vendaje", quantity: 2 }]);
  });
  it("refuses unknown items, bad quantities and a full backpack without changing anything", () => {
    expect(addToInventory([], "nada", 1).ok).toBe(false);
    expect(addToInventory([], "vendaje", 0).ok).toBe(false);
    expect(addToInventory([], "vendaje", 1.5).ok).toBe(false);
    const full = Array.from({ length: INVENTORY_SLOTS }, () => ({ id: "logpose", quantity: 1 }));
    const r = addToInventory(full, "vendaje", 1);
    expect(r.ok).toBe(false);
  });
});

describe("useItem", () => {
  it("heals but never above the maximum", () => {
    const r = useItem(getItemDef("botiquin")!, { ...body, hp: 80 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.hp).toBe(100);
  });
  it("restores stamina and can mix effects", () => {
    const r = useItem(getItemDef("elixir")!, body);
    expect(r.ok && r.state.hp === 90 && r.state.stamina === 80).toBe(true);
  });
  it("lowers pursuit heat, and refuses when there is none to lower", () => {
    const ok = useItem(getItemDef("papeles")!, body);
    expect(ok.ok && ok.state.heat).toBe(30);
    expect(useItem(getItemDef("papeles")!, { ...body, heat: 0 }).ok).toBe(false);
  });
  it("does not waste a heal when already at full health", () => {
    expect(useItem(getItemDef("vendaje")!, { ...body, hp: 100 }).ok).toBe(false);
  });
  it("a treasure map pays out and tools cannot be consumed", () => {
    const m = useItem(getItemDef("mapa")!, body);
    expect(m.ok && m.state.berries).toBe(2500);
    expect(useItem(getItemDef("logpose")!, body).ok).toBe(false);
  });
});

describe("removeOne", () => {
  it("consumes one unit and drops empty stacks", () => {
    expect(removeOne([{ id: "vendaje", quantity: 2 }], "vendaje")).toEqual([{ id: "vendaje", quantity: 1 }]);
    expect(removeOne([{ id: "vendaje", quantity: 1 }], "vendaje")).toEqual([]);
    expect(removeOne([], "vendaje")).toBeNull();
  });
});

describe("catalog sanity", () => {
  it("has unique ids, positive prices and sensible sale values", () => {
    const ids = new Set(ITEM_CATALOG.map((i) => i.id));
    expect(ids.size).toBe(ITEM_CATALOG.length);
    for (const i of ITEM_CATALOG) {
      expect(i.price).toBeGreaterThan(0);
      expect(sellValue(i)).toBeLessThan(i.price);
    }
  });
});

describe("belongingsFor / describeInventory", () => {
  it("gives role-appropriate belongings and a fallback", () => {
    expect(belongingsFor("Médico")).toContain("Botiquín de campaña");
    expect(belongingsFor("Navegante")).toContain("Log Pose");
    expect(belongingsFor("desconocido").length).toBeGreaterThan(0);
  });
  it("lists the backpack for the narrator", () => {
    expect(describeInventory([{ id: "vendaje", quantity: 3 }])).toBe("lleva en la mochila: Vendaje x3");
    expect(describeInventory([])).toContain("vacía");
  });
});

import { specialtyIdsFor, ITEM_CATALOG as CAT } from "./inventory";

describe("island specialties", () => {
  it("each island sells its own goods", () => {
    expect(specialtyIdsFor("Alabasta")).toEqual(["oasis"]);
    expect(specialtyIdsFor("Zou")).toEqual(["infusion"]);
    expect(specialtyIdsFor("Loguetown")).toEqual([]);
  });
  it("specialties never drop as random loot and always have a price and an island", () => {
    for (const i of CAT.filter((x) => x.soldAt)) {
      expect(i.minDanger).toBe(99);
      expect(i.price).toBeGreaterThan(0);
      expect(i.soldAt!.length).toBeGreaterThan(0);
    }
  });
});

describe("lootFor", () => {
  it("only a brilliant result leaves something, only catalog items available at that danger", () => {
    expect(lootFor("s", 5, "success")).toBeNull();
    for (let i = 0; i < 60; i++) {
      const d = lootFor(`seed${i}`, 3, "critical_success");
      expect(d).not.toBeNull();
      const def = ITEM_CATALOG.find((x) => x.id === d!.id)!;
      expect(def.minDanger).toBeLessThanOrEqual(3);
    }
  });
  it("is the same for the same seed and varies across seeds", () => {
    expect(lootFor("a", 6, "critical_success")).toEqual(lootFor("a", 6, "critical_success"));
    const ids = new Set(Array.from({ length: 80 }, (_, i) => lootFor(`v${i}`, 8, "critical_success")!.id));
    expect(ids.size).toBeGreaterThan(2);
  });
  it("cheap things turn up far more than a pearl", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 600; i++) {
      const id = lootFor(`c${i}`, 10, "critical_success")!.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect((counts.get("perla") ?? 0)).toBeLessThan(Math.max(...counts.values()));
  });
});

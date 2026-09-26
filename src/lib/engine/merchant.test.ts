import { describe, expect, it } from "vitest";
import { merchantStock } from "./merchant";
import { COMMON_WEAPONS } from "../game/common-gear";
import { ITEM_CATALOG } from "./inventory";

describe("island merchants", () => {
  it("every island sells the essentials but never a communication snail", () => {
    for (const n of ["Pueblo Foosha", "Loguetown", "Water 7", "Zou", "Dressrosa"]) {
      const s = merchantStock(n, 3);
      expect(s.items).toContain("vendaje");
      expect(s.items).not.toContain("denden");
    }
  });
  it("differs from island to island", () => {
    expect(merchantStock("Pueblo Foosha", 1).items).not.toContain("logpose");
    expect(merchantStock("Loguetown", 5).items).toContain("logpose");
    expect(merchantStock("Isla Drum", 7).items).toContain("elixir");
    expect(merchantStock("Water 7", 7).weapons).toContain("Cañón de mano");
    expect(merchantStock("Pueblo Foosha", 1).weapons).not.toContain("Cañón de mano");
    expect(merchantStock("Jaya", 5).items).toContain("papeles");
    expect(merchantStock("Pueblo Foosha", 1).items).not.toContain("papeles");
    expect(merchantStock("Isla Gyojin", 9).weapons).toEqual(["Tridente gyojin"]);
  });
  it("keeps the island specialties", () => {
    expect(merchantStock("Alabasta", 8).items).toContain("oasis");
    expect(merchantStock("Restaurante Baratie", 3).items).toContain("banquete");
  });
  it("some places have no shop at all", () => {
    expect(merchantStock("Impel Down", 10)).toMatchObject({ items: [], weapons: [] });
    expect(merchantStock("Laugh Tale", 10).items).toEqual([]);
  });
  it("only references items and weapons that exist", () => {
    const ids = new Set(ITEM_CATALOG.map((i) => i.id));
    const weapons = new Set(COMMON_WEAPONS.map((w) => w.name));
    for (const n of ["Pueblo Foosha", "Loguetown", "Water 7", "Jaya", "Isla Drum", "Alabasta", "Skypiea", "Isla Gyojin", "Zou", "Wano", "País de Wano", "Elbaf", "Whole Cake Island", "Punk Hazard", "Nuevo Marineford"]) {
      const s = merchantStock(n, 5);
      for (const id of s.items) expect(ids.has(id), `${n}: ${id}`).toBe(true);
      for (const w of s.weapons) expect(weapons.has(w), `${n}: ${w}`).toBe(true);
    }
  });
});

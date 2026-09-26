import { describe, expect, it } from "vitest";
import { ISLAND_NPC_DATA } from "./island-npc-data";
import { ISLAND_NPC_DATA_WAVE2 } from "./island-npc-data-wave2";
import { ISLAND_LORE_DATA } from "./island-lore-data";

const all = [...ISLAND_NPC_DATA, ...ISLAND_NPC_DATA_WAVE2];

describe("island residents data", () => {
  it("has unique names and unique slots per island, all with lore", () => {
    const names = all.map((n) => n.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const slots = all.map((n) => `${n.island}/${n.slot}`);
    expect(slots.filter((s, i) => slots.indexOf(s) !== i)).toEqual([]);
    for (const n of ISLAND_NPC_DATA_WAVE2) {
      expect(n.description.length, n.name).toBeGreaterThan(60);
      expect(n.personality.length, n.name).toBeGreaterThan(10);
    }
  });
  it("gives every island a real cast, with fighters and a gazetteer", () => {
    const islands = [...new Set(all.map((n) => n.island))];
    expect(islands.length).toBeGreaterThanOrEqual(47);
    for (const isl of islands) {
      const cast = all.filter((n) => n.island === isl);
      expect(cast.length, isl).toBeGreaterThanOrEqual(10);
      expect(cast.some((n) => ["guard", "thug", "marine", "pirate"].includes(n.category)), isl).toBe(true);
      expect(ISLAND_LORE_DATA.some((l) => l.island === isl), isl).toBe(true);
    }
  });
});

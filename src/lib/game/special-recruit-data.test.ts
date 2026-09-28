import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRole } from "../engine/companions";
import { ITEM_CATALOG } from "../engine/inventory";
import { validateSpecialRecruit } from "../engine/special-recruit";
import { STYLES } from "../engine/styles";
import { ISLAND_LORE_DATA } from "./island-lore-data";
import { ISLAND_NPC_DATA } from "./island-npc-data";
import { ISLAND_NPC_DATA_WAVE2 } from "./island-npc-data-wave2";
import { SPECIAL_RECRUITS } from "./special-recruit-data";
import { EXTRA_ACTORS } from "./world-actor-extra";
import { IMPEL_ACTORS } from "./world-actor-impel";
import { MORE_ACTORS } from "./world-actor-more";
import { ACTOR_PROFILES } from "./world-actor-profiles";
import { WAVE4_ACTORS } from "./world-actor-wave4";

const catalog = {
  itemIds: new Set(ITEM_CATALOG.map((i) => i.id)),
  styleIds: new Set(STYLES.map((s) => s.id)),
};

const ROLE_LABELS = ["Espadachín", "Navegante", "Cocinero", "Médico", "Francotirador", "Músico", "Carpintero", "Erudito", "Guardaespaldas"];
const FACTIONS = ["PIRATE", "MARINE", "REVOLUTIONARY", "BOUNTY_HUNTER", "CP0"] as const;

function seedActorNames(): string[] {
  const text = readFileSync(join(__dirname, "../../../prisma/seed.ts"), "utf8");
  return [...text.matchAll(/^\s*name: "([^"]+)"/gm)].map((m) => m[1]);
}

describe("special recruit data", () => {
  it("has about thirty entries", () => {
    expect(SPECIAL_RECRUITS.length).toBeGreaterThanOrEqual(30);
  });

  it("every entry passes the engine validation against the real catalog", () => {
    for (const e of SPECIAL_RECRUITS) {
      expect(validateSpecialRecruit(e.name, e.recruit, catalog), e.name).toEqual([]);
    }
  });

  it("every entry sits on a real island with lore, and each island is used once", () => {
    const islands = new Set(ISLAND_LORE_DATA.map((i) => i.island));
    for (const e of SPECIAL_RECRUITS) expect(islands.has(e.island), `${e.name} -> ${e.island}`).toBe(true);
    const used = SPECIAL_RECRUITS.map((e) => e.island);
    expect(new Set(used).size).toBe(used.length);
  });

  it("slots are unique and prefixed sp-", () => {
    const slots = SPECIAL_RECRUITS.map((e) => e.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (const s of slots) expect(s).toMatch(/^sp-[a-z0-9-]+$/);
  });

  it("names are unique across special recruits, residents and every canon actor", () => {
    const canon = [
      ...seedActorNames(),
      ...Object.keys(ACTOR_PROFILES),
      ...EXTRA_ACTORS.map((a) => a.name),
      ...MORE_ACTORS.map((a) => a.name),
      ...WAVE4_ACTORS.map((a) => a.name),
      ...IMPEL_ACTORS.map((a) => a.name),
      ...ISLAND_NPC_DATA.map((n) => n.name),
      ...ISLAND_NPC_DATA_WAVE2.map((n) => n.name),
    ].map((n) => n.toLowerCase());
    expect(canon.length).toBeGreaterThan(400);
    const taken = new Set(canon);
    const mine = SPECIAL_RECRUITS.map((e) => e.name.toLowerCase());
    expect(new Set(mine).size).toBe(mine.length);
    for (const n of mine) expect(taken.has(n), n).toBe(false);
  });

  it("roles match a real archetype, abilities are mirrored and no fruit or invented power appears", () => {
    for (const e of SPECIAL_RECRUITS) {
      expect(ROLE_LABELS, e.name).toContain(normalizeRole(e.recruit.role));
      expect(e.abilities).toEqual(e.recruit.abilities);
      expect(e.recruit.abilities.length, e.name).toBeGreaterThanOrEqual(3);
      expect(e.recruit.abilities.length, e.name).toBeLessThanOrEqual(5);
      const text = [e.description, e.recruit.lore, ...e.recruit.abilities, e.recruit.epithet].join(" ");
      expect(text, e.name).not.toMatch(/no mi\b|akuma|fruta del diablo|haki/i);
    }
  });

  it("each entry has a level within the island range and a scaled attribute total", () => {
    for (const e of SPECIAL_RECRUITS) {
      expect(e.level).toBeGreaterThanOrEqual(1);
      expect(e.level).toBeLessThanOrEqual(45);
      if (e.recruit.condition.minLevel) expect(e.recruit.condition.minLevel).toBeGreaterThanOrEqual(e.level - 3);
      const total = Object.values(e.recruit.attrs).reduce((n, v) => n + v, 0);
      expect(total, e.name).toBeGreaterThanOrEqual(60 + e.level * 2);
    }
  });

  it("every player faction has several options it can actually recruit", () => {
    for (const f of FACTIONS) {
      const options = SPECIAL_RECRUITS.filter((e) => !e.recruit.condition.factions || e.recruit.condition.factions.includes(f));
      const exclusive = SPECIAL_RECRUITS.filter((e) => e.recruit.condition.factions?.includes(f));
      expect(options.length, f).toBeGreaterThanOrEqual(8);
      expect(exclusive.length, f).toBeGreaterThanOrEqual(3);
    }
  });

  it("the condition mix covers levels, factions, bounty, notoriety, items and berries", () => {
    const cs = SPECIAL_RECRUITS.map((e) => e.recruit.condition);
    expect(cs.some((c) => c.minLevel)).toBe(true);
    expect(cs.some((c) => c.factions?.length)).toBe(true);
    expect(cs.some((c) => c.minBounty)).toBe(true);
    expect(cs.some((c) => c.minNotoriety)).toBe(true);
    expect(cs.some((c) => c.item)).toBe(true);
    expect(cs.some((c) => c.berries)).toBe(true);
  });
});

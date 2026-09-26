import { describe, expect, it } from "vitest";
import { isFighter, npcLoot, npcRewards, npcState, appendMemory, dueForReplacement, fallbackSuccessor, inventedNames, matchNpc, npcStats, parseGeneratedNpc, pickCombatNpc, rosterBlock, type IslandNpcRow } from "./island-npc";

const npc = (over: Partial<IslandNpcRow>): IslandNpcRow => ({
  id: "1", name: "Rocco Barrica", islandId: "i", slot: "guardia-puerta", title: "Guardia del almacén", category: "guard", description: "d", personality: "Bruto y leal.",
  level: 2, abilitiesJson: null, weapon: "Garrote", status: "ALIVE", diedNote: null, memoryJson: null, generation: 1, ...over,
});

describe("matchNpc", () => {
  const roster = [npc({}), npc({ id: "2", name: "Marga Sal", title: "Tabernera del Sombrero Roto", slot: "tabernera", category: "civilian" }), npc({ id: "3", name: "Bruno el Cojo", title: "Matón del puerto", slot: "maton", category: "thug" })];
  it("finds by full or partial name, ignoring accents and case", () => {
    expect(matchNpc(roster, "Ataco a rocco")?.name).toBe("Rocco Barrica");
    expect(matchNpc(roster, "hablo con MARGA")?.name).toBe("Marga Sal");
  });
  it("finds by job words", () => {
    expect(matchNpc(roster, "el guardia de la puerta")?.name).toBe("Rocco Barrica");
    expect(matchNpc(roster, "la tabernera")?.name).toBe("Marga Sal");
    expect(matchNpc(roster, "un matón")?.name).toBe("Bruno el Cojo");
  });
  it("skips the dead and returns null for strangers", () => {
    expect(matchNpc([npc({ status: "DEAD" })], "el guardia")).toBeNull();
    expect(matchNpc(roster, "el rey del mundo")).toBeNull();
  });
});

describe("pickCombatNpc", () => {
  it("only picks living fighters", () => {
    const roster = [npc({ status: "DEAD" }), npc({ id: "2", name: "Marga", category: "civilian" }), npc({ id: "3", name: "Bruno", category: "thug" })];
    expect(pickCombatNpc(roster, "s")?.name).toBe("Bruno");
    expect(pickCombatNpc([npc({ category: "civilian" })], "s")).toBeNull();
  });
});

describe("rosterBlock", () => {
  it("lists residents with memory and the dead, and carries the no-invention rule", () => {
    const block = rosterBlock("Foosha", [npc({ memoryJson: JSON.stringify(["Sebastian lo perdonó"]) }), npc({ id: "2", name: "Kael", status: "DEAD", diedNote: "muerto a manos de Sebastian" })]);
    expect(block).toContain("Rocco Barrica");
    expect(block).toContain("Sebastian lo perdonó");
    expect(block).toContain("MUERTOS");
    expect(block).toContain("PROHIBIDO inventar");
  });
  it("is empty for an island with nobody", () => {
    expect(rosterBlock("X", [])).toBe("");
  });
});

describe("stats, memory and replacement", () => {
  it("scales gently with level", () => {
    expect(npcStats(2)).toEqual({ hp: 85, atk: 16, def: 5, spd: 12 });
    expect(npcStats(10).hp).toBeGreaterThan(npcStats(2).hp);
  });
  it("keeps only the last notes", () => {
    let j: string | null = null;
    for (let i = 0; i < 12; i++) j = appendMemory(j, `n${i}`);
    expect(JSON.parse(j!)).toHaveLength(8);
    expect(JSON.parse(j!).at(-1)).toBe("n11");
  });
  it("replaces the dead only after the delay and only once", () => {
    const now = new Date("2026-01-02T12:00:00Z");
    const rows = [
      { status: "DEAD", successorId: null, diedAt: new Date("2026-01-02T01:00:00Z") },
      { status: "DEAD", successorId: null, diedAt: new Date("2026-01-02T10:00:00Z") },
      { status: "DEAD", successorId: "x", diedAt: new Date("2026-01-01T00:00:00Z") },
      { status: "ALIVE", successorId: null, diedAt: null },
    ];
    expect(dueForReplacement(rows, now)).toHaveLength(1);
  });
  it("fallback successor has a fresh name and the same personality", () => {
    const dead = npc({});
    const s = fallbackSuccessor(dead, new Set(["Rocco Barrica"]));
    expect(s.name).not.toBe("Rocco Barrica");
    expect(s.personality).toBe(dead.personality);
  });
});

describe("parseGeneratedNpc", () => {
  const good = JSON.stringify({ name: "Hilda Carena", title: "Guardia del almacén", description: "Una veterana de los muelles que perdió un ojo en una reyerta.", personality: "Seca, desconfiada y muy leal.", weapon: "Lanza corta", abilities: ["Embestida"] });
  it("accepts a valid one, even wrapped in prose", () => {
    expect(parseGeneratedNpc(`Aquí: ${good}`, new Set())?.name).toBe("Hilda Carena");
  });
  it("rejects taken names and junk", () => {
    expect(parseGeneratedNpc(good, new Set(["Hilda Carena"]))).toBeNull();
    expect(parseGeneratedNpc("nada", new Set())).toBeNull();
    expect(parseGeneratedNpc(JSON.stringify({ name: "X" }), new Set())).toBeNull();
  });
});

describe("inventedNames", () => {
  const allowed = ["Rocco Barrica", "Sebastian", "Sakazuki"];
  it("flags a new named character", () => {
    expect(inventedNames("Aparece un hombre llamado Vorgen con una espada.", allowed)).toEqual(["Vorgen"]);
    expect(inventedNames("Un tipo delgado conocido como Kael Ojo Rojo sonríe.", allowed)[0]).toContain("Kael");
  });
  it("flags a canon-looking name that is not in the roster, however it is introduced", () => {
    expect(inventedNames("Detrás de la barra está Makino. Es Makino, la tabernera, y sonríe.", allowed)).toEqual(["Makino"]);
    expect(inventedNames("Un hombre te mira. Soy Brutus, dice.", allowed)).toEqual(["Brutus"]);
    expect(inventedNames("Marga la Loca, el viejo guardia, ronda la plaza.", allowed).length).toBe(1);
  });
  it("does not flag places, techniques or known residents", () => {
    expect(inventedNames("Es Pueblo Foosha, un lugar tranquilo. Es Rocco, el guardia.", [...allowed, "Pueblo Foosha"])).toEqual([]);
    expect(inventedNames("Usa el Meigo, una técnica devastadora.", allowed)).toEqual([]);
  });
  it("lets known names through", () => {
    expect(inventedNames("El guardia llamado Rocco se levanta.", allowed)).toEqual([]);
    expect(inventedNames("Un pescador cualquiera mira el mar.", allowed)).toEqual([]);
  });
});

describe("live state", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  it("only a free, living resident is usable", () => {
    expect(npcState(npc({}), now, new Set()).usable).toBe(true);
    expect(npcState(npc({ status: "DEAD" }), now, new Set()).label).toBe("muerto");
    expect(npcState(npc({ status: "CAPTURED", stateNote: "detenido por Kirito" }), now, new Set()).usable).toBe(false);
    expect(npcState(npc({ recoversAt: new Date("2026-01-01T13:00:00Z") }), now, new Set()).usable).toBe(false);
    expect(npcState(npc({ recoversAt: new Date("2026-01-01T11:00:00Z") }), now, new Set()).usable).toBe(true);
    expect(npcState(npc({}), now, new Set(["1"])).label).toContain("peleando");
  });
  it("an occupied resident is not matched and appears as unavailable in the roster block", () => {
    const roster = [npc({}), npc({ id: "2", name: "Bruno el Cojo", title: "Matón del puerto", slot: "maton", category: "thug" })];
    expect(matchNpc(roster, "el guardia", new Set(["1"]))).toBeNull();
    const block = rosterBlock("Foosha", roster, now, new Set(["1"]));
    expect(block).toContain("NO DISPONIBLES AHORA");
    expect(block).toContain("Rocco Barrica (ocupado peleando");
    expect(block.split("NO DISPONIBLES")[0]).not.toContain("Rocco Barrica —");
    expect(block).toContain("Bruno el Cojo —");
  });
});

describe("fighters, rewards and loot", () => {
  it("only some residents are fighters", () => {
    expect(isFighter("guard")).toBe(true);
    expect(isFighter("thug")).toBe(true);
    expect(isFighter("civilian")).toBe(false);
    expect(isFighter("merchant")).toBe(false);
  });
  it("bystanders are frailer than fighters of the same level", () => {
    expect(npcStats(6, "civilian").hp).toBeLessThan(npcStats(6, "guard").hp);
    expect(npcStats(6, "civilian").atk).toBeLessThan(npcStats(6, "guard").atk);
  });
  it("fighters pay experience and money that grow with level; bystanders only a purse", () => {
    expect(npcRewards(10, "guard").xp).toBeGreaterThan(npcRewards(2, "guard").xp);
    expect(npcRewards(5, "thug").berries).toBeGreaterThan(npcRewards(5, "guard").berries);
    expect(npcRewards(8, "civilian").xp).toBe(0);
    expect(npcRewards(8, "civilian").berries).toBeGreaterThan(0);
  });
  it("loot is deterministic, level-gated and never dropped by bystanders", () => {
    expect(npcLoot("a", "guard", 3)).toBe(npcLoot("a", "guard", 3));
    expect(npcLoot("x", "civilian", 30)).toBeNull();
    const drops = new Set<string>();
    for (let i = 0; i < 200; i++) { const d = npcLoot(`s${i}`, "guard", 1); if (d) drops.add(d); }
    expect([...drops].every((d) => d === "vendaje" || d === "racion")).toBe(true);
    expect(drops.size).toBeGreaterThan(0);
  });
});

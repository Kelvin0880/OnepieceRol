import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import {
  STYLES,
  getStyle,
  learnableStyles,
  styleTier,
  canLearnStyle,
  styleApplies,
  activeStyle,
  passiveMods,
  chooseTechnique,
  styleForText,
  wieldedAttackBonus,
  trainStyleMastery,
  styleGrowthFromUse,
  describeStyles,
  type StyleAttr,
} from "./styles";
import { ACTOR_STYLES, styleAbilityLines, actorStyleNames } from "./actor-styles";

const attrs: Record<StyleAttr, number> = { strength: 10, agility: 10, durability: 10, willpower: 10, intellect: 10 };
const who = { faction: "PIRATE", level: 10, berries: 100_000, islandName: "Villa Shimotsuki", attrs, known: [] as { id: string; mastery: number }[] };

describe("catalog", () => {
  it("has unique ids and every learnable style names real teaching islands, techniques in order and sane numbers", () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length);
    for (const s of STYLES) {
      expect(s.techniques.length).toBeGreaterThan(0);
      const mins = s.techniques.map((t) => t.minMastery);
      expect([...mins].sort((a, b) => a - b)).toEqual(mins);
      expect(s.mods.pierce).toBeLessThanOrEqual(0.3);
      if (s.learn) expect(s.learn.islands.length).toBeGreaterThan(0);
    }
    expect(learnableStyles().length).toBeGreaterThanOrEqual(15);
  });
  it("the sword ladder needs the right number of blades", () => {
    expect(getStyle("ittoryu")!.weapons).toEqual({ min: 1, max: 1 });
    expect(getStyle("nitoryu")!.weapons).toEqual({ min: 2, max: 2 });
    expect(getStyle("santoryu")!.weapons).toEqual({ min: 3, max: 3 });
    expect(getStyle("black_leg")!.weapons).toEqual({ min: 0, max: 0 });
  });
  it("every actor style id exists", () => {
    for (const ids of Object.values(ACTOR_STYLES)) for (const id of ids) expect(getStyle(id)).toBeDefined();
    expect(styleAbilityLines("Roronoa Zoro")[0]).toContain("Santoryu");
    expect(actorStyleNames("Roronoa Zoro")).toEqual(["Santoryu (tres espadas)"]);
    expect(styleAbilityLines("Nadie")).toEqual([]);
  });
});

describe("styleTier", () => {
  it("climbs at 20/45/70/90 and reports the next threshold", () => {
    expect(styleTier(0).name).toBe("Iniciado");
    expect(styleTier(19).name).toBe("Iniciado");
    expect(styleTier(20).name).toBe("Practicante");
    expect(styleTier(70).name).toBe("Maestro");
    expect(styleTier(95).next).toBeNull();
    expect(styleTier(45).next).toBe(70);
  });
});

describe("canLearnStyle", () => {
  it("teaches a basic style to anyone on the right island with the money", () => {
    expect(canLearnStyle(getStyle("ittoryu")!, who)).toEqual({ ok: true });
  });
  it("refuses with a clear reason: wrong island, faction, level, attribute, prerequisite, money, already known, not teachable", () => {
    const reason = (def: string, patch: object) => {
      const r = canLearnStyle(getStyle(def)!, { ...who, ...patch });
      return r.ok ? "OK" : r.reason;
    };
    expect(reason("ittoryu", { islandName: "Loguetown2" })).toContain("Aquí nadie");
    expect(reason("rokushiki", { islandName: "Enies Lobby" })).toContain("facción");
    expect(reason("santoryu", { islandName: "País de Wano", level: 3 })).toContain("nivel");
    expect(reason("black_leg", { islandName: "Restaurante Baratie", attrs: { ...attrs, agility: 5 } })).toContain("Agilidad");
    expect(reason("nitoryu", {})).toContain("Ittoryu");
    expect(reason("ittoryu", { berries: 10 })).toContain("matrícula");
    expect(reason("ittoryu", { known: [{ id: "ittoryu", mastery: 5 }] })).toContain("Ya conoces");
    expect(reason("hachi_ryu", {})).toContain("no se enseña");
  });
  it("the sword ladder unlocks step by step", () => {
    const withItto = { ...who, known: [{ id: "ittoryu", mastery: 35 }] };
    expect(canLearnStyle(getStyle("nitoryu")!, withItto).ok).toBe(true);
    const onWano = { ...who, islandName: "País de Wano", level: 20, attrs: { ...attrs, agility: 20 }, known: [{ id: "nitoryu", mastery: 60 }] };
    expect(canLearnStyle(getStyle("santoryu")!, onWano).ok).toBe(true);
  });
  it("faction schools: CP0 and Marines get Rokushiki, revolutionaries their own arts", () => {
    expect(canLearnStyle(getStyle("rokushiki")!, { ...who, faction: "CP0", islandName: "Enies Lobby", level: 15 }).ok).toBe(true);
    expect(canLearnStyle(getStyle("ryusoken")!, { ...who, faction: "REVOLUTIONARY", islandName: "Isla Baltigo", level: 15, attrs: { ...attrs, strength: 22 } }).ok).toBe(true);
    expect(canLearnStyle(getStyle("ryusoken")!, { ...who, faction: "PIRATE", islandName: "Isla Baltigo", level: 15, attrs: { ...attrs, strength: 22 } }).ok).toBe(false);
  });
});

describe("weapons in hand", () => {
  it("a style only applies with the right number of weapons", () => {
    expect(styleApplies(getStyle("santoryu")!, 3)).toBe(true);
    expect(styleApplies(getStyle("santoryu")!, 2)).toBe(false);
    expect(styleApplies(getStyle("black_leg")!, 0)).toBe(true);
    expect(styleApplies(getStyle("black_leg")!, 1)).toBe(false);
    expect(styleApplies(getStyle("rokushiki")!, 2)).toBe(true);
  });
  it("activeStyle picks the chosen one when it applies, else the strongest applicable, else nothing", () => {
    const known = [{ id: "ittoryu", mastery: 50 }, { id: "black_leg", mastery: 80 }];
    expect(activeStyle(known, 1)!.def.id).toBe("ittoryu");
    expect(activeStyle(known, 0)!.def.id).toBe("black_leg");
    expect(activeStyle(known, 0, "ittoryu")!.def.id).toBe("black_leg");
    expect(activeStyle(known, 2)).toBeNull();
    expect(activeStyle([], 1)).toBeNull();
  });
  it("extra blades are clumsy without the style and approach full value with it", () => {
    const untrained = wieldedAttackBonus([10, 10], 1, 0);
    const trained = wieldedAttackBonus([10, 10], 2, 100);
    expect(untrained).toBe(13);
    expect(trained).toBe(20);
    expect(wieldedAttackBonus([10, 10], 2, 0)).toBe(15);
    expect(wieldedAttackBonus([10, 10, 10, 10], 3, 100)).toBe(30);
    expect(wieldedAttackBonus([], 1, 0)).toBe(0);
  });
});

describe("mastery-driven power", () => {
  it("the passive half grows with mastery and never exceeds half the listed bonus", () => {
    const d = getStyle("santoryu")!;
    expect(passiveMods(d, 0).atk).toBe(0);
    expect(passiveMods(d, 100).atk).toBe(d.mods.atk / 2);
    expect(passiveMods(d, 60).atk).toBeGreaterThan(passiveMods(d, 20).atk);
    expect(passiveMods(getStyle("hasshoken")!, 100).pierce).toBeCloseTo(0.13, 2);
  });
  it("techniques unlock with mastery and a named one is honoured only when unlocked", () => {
    const d = getStyle("santoryu")!;
    expect(chooseTechnique(d, 10, "ataco").technique).toBe("Oni Giri");
    expect(chooseTechnique(d, 70, "ataco").technique).toBe("Sanzen Sekai");
    expect(chooseTechnique(d, 70, "uso el Tatsumaki").technique).toBe("Tatsumaki");
    const locked = chooseTechnique(d, 10, "uso Ashura");
    expect(locked.technique).toBe("Oni Giri");
    expect(locked.fallbackNote).toContain("Ashura");
  });
  it("finds the style from a technique or style name in the text, else the active one", () => {
    const known = [{ id: "ittoryu", mastery: 50 }, { id: "black_leg", mastery: 50 }];
    expect(styleForText(known, "uso Diable Jambe", 0)!.def.id).toBe("black_leg");
    expect(styleForText(known, "hago un iai giri", 1)!.def.id).toBe("ittoryu");
    expect(styleForText(known, "ataco", 1)!.def.id).toBe("ittoryu");
  });
  it("training and use raise mastery, slower near the top, capped at 100", () => {
    expect(trainStyleMastery(mulberry32(1), 0, 10, 10)).toBeGreaterThan(trainStyleMastery(mulberry32(1), 90, 10, 10));
    expect(trainStyleMastery(mulberry32(1), 100, 10, 10)).toBe(0);
    expect(trainStyleMastery(mulberry32(1), 98, 50, 50)).toBeLessThanOrEqual(2);
    let hits = 0;
    for (let s = 1; s <= 500; s++) hits += styleGrowthFromUse(mulberry32(s), 20);
    expect(hits).toBeGreaterThan(50);
    expect(styleGrowthFromUse(mulberry32(1), 100)).toBe(0);
  });
});

describe("describeStyles (what the narrator reads)", () => {
  it("lists real styles, unlocked techniques and warns about a mismatch with the weapons in hand", () => {
    const text = describeStyles([{ id: "santoryu", mastery: 40 }], 2, ["Wado", "Sandai"]);
    expect(text).toContain("Santoryu");
    expect(text).toContain("Oni Giri");
    expect(text).not.toContain("Ashura");
    expect(text).toContain("NO aplicable");
    expect(describeStyles([], 0, [])).toContain("sin estilo");
  });
});

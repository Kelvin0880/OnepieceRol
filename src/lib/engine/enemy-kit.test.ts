import { describe, it, expect } from "vitest";
import { deriveEnemyKit, describeEnemyKit, fruitChance, fruitPhaseForLevel, nameHash, PLAY_TO_WIN_RULE } from "./enemy-kit";

describe("deriveEnemyKit", () => {
  it("a rookie thug has no Haki and no fruit; a veteran has Armament; a high-level boss has more", () => {
    const thug = deriveEnemyKit({ name: "Matón de taberna", level: 2, isBoss: false });
    expect(thug.armamentHaki).toBe(0);
    expect(thug.observationHaki).toBe(0);
    expect(thug.fruit).toBeUndefined();
    const vet = deriveEnemyKit({ name: "Veterano", level: 15, isBoss: false });
    expect(vet.armamentHaki).toBeGreaterThan(0);
    const boss = deriveEnemyKit({ name: "Capitán temible", level: 40, isBoss: true });
    expect(boss.armamentHaki).toBeGreaterThan(vet.armamentHaki);
    expect(boss.observationHaki).toBeGreaterThan(vet.observationHaki);
    expect(boss.conqueror).toBe(true);
  });
  it("is deterministic: the same enemy always has the same kit", () => {
    const pool = ["Bomu Bomu no Mi", "Hie Hie no Mi", "Kilo Kilo no Mi", "Doa Doa no Mi"];
    const a = deriveEnemyKit({ name: "Barbarroja", level: 30, isBoss: true, fruitPool: pool });
    const b = deriveEnemyKit({ name: "Barbarroja", level: 30, isBoss: true, fruitPool: pool });
    expect(a).toEqual(b);
  });
  it("never gives a fruit below level 10 and gives fruits to a good share of strong enemies", () => {
    const pool = ["Bomu Bomu no Mi", "Hie Hie no Mi", "Kilo Kilo no Mi"];
    let low = 0;
    let high = 0;
    for (let i = 0; i < 300; i++) {
      if (deriveEnemyKit({ name: `E${i}`, level: 8, isBoss: true, fruitPool: pool }).fruit) low++;
      if (deriveEnemyKit({ name: `E${i}`, level: 35, isBoss: true, fruitPool: pool }).fruit) high++;
    }
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(60);
  });
  it("without a fruit pool nobody carries a fruit", () => {
    expect(deriveEnemyKit({ name: "X", level: 50, isBoss: true }).fruit).toBeUndefined();
  });
  it("a declared kit wins over derived values (a named character is who they are)", () => {
    const k = deriveEnemyKit({
      name: "Kizaru", level: 3, isBoss: false,
      declared: { armamentHaki: 90, observationHaki: 95, conqueror: false, fruit: { name: "Pika Pika no Mi", phase: "awakened" }, abilities: ["Yasakani no Magatama"] },
    });
    expect(k.armamentHaki).toBe(90);
    expect(k.fruit?.name).toBe("Pika Pika no Mi");
    expect(k.abilities).toContain("Yasakani no Magatama");
  });
});

describe("fruit rules", () => {
  it("chance grows with level and is higher for bosses", () => {
    expect(fruitChance(9, "elite", true)).toBe(0);
    expect(fruitChance(30, "tough", false)).toBeGreaterThan(fruitChance(12, "tough", false));
    expect(fruitChance(30, undefined, true)).toBeGreaterThan(fruitChance(30, "tough", false));
  });
  it("phase advances with level", () => {
    expect(fruitPhaseForLevel(10, false)).toBe("initial");
    expect(fruitPhaseForLevel(25, false)).toBe("advanced");
    expect(fruitPhaseForLevel(50, false)).toBe("awakened");
    expect(fruitPhaseForLevel(40, true)).toBe("awakened");
  });
  it("nameHash is stable and spreads names", () => {
    expect(nameHash("a")).toBe(nameHash("a"));
    expect(nameHash("a")).not.toBe(nameHash("b"));
  });
});

describe("describeEnemyKit", () => {
  it("lists what the fighter has and what it lacks, so the narrator neither omits nor invents", () => {
    const text = describeEnemyKit("Kizaru", { armamentHaki: 90, observationHaki: 95, conqueror: false, fruit: { name: "Pika Pika no Mi", phase: "awakened" }, weapon: "Amaterasu", abilities: ["Yasakani no Magatama"] });
    expect(text).toContain("KIZARU");
    expect(text).toContain("Pika Pika no Mi");
    expect(text).toContain("DESPERTADA");
    expect(text).toContain("Haki del Rey: no lo posee");
    expect(text).toContain("Yasakani no Magatama");
    const bare = describeEnemyKit("Matón", { armamentHaki: 0, observationHaki: 0, conqueror: false, abilities: [] });
    expect(bare).toContain("Fruta del Diablo: ninguna");
    expect(bare).toContain("no lo domina");
  });
  it("the shared rule tells the narrator to play to win without changing outcomes", () => {
    expect(PLAY_TO_WIN_RULE).toContain("GANAR");
    expect(PLAY_TO_WIN_RULE).toContain("el resultado lo decide el árbitro");
  });
});

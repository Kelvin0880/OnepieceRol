import { describe, it, expect } from "vitest";
import { describeCapabilities, CapabilitySheet } from "./capabilities";

const base: CapabilitySheet = {
  name: "Kirito", level: 3, armamentHaki: 12, observationHaki: 0, conquerorsHaki: false, fruitName: null, fruitMastery: 0, fruitAwakened: false,
  weaponName: "Espada de acero", stamina: 80, maxStamina: 100, hp: 90, maxHp: 100, companions: [],
};

describe("describeCapabilities", () => {
  it("states what is locked so the narrator cannot grant it", () => {
    const t = describeCapabilities(base);
    expect(t).toContain("Haki de Observación: sin despertar (NO puede usarlo)");
    expect(t).toContain("Haki del Rey: NO lo tiene");
    expect(t).toContain("NINGUNA");
    expect(t).toContain("Espada de acero");
  });
  it("describes an owned fruit with its mastery phase", () => {
    const t = describeCapabilities({ ...base, fruitName: "Mera Mera no Mi", fruitMastery: 50 });
    expect(t).toContain("Mera Mera no Mi");
    expect(t).toContain("dominio 50/100");
  });
  it("flags fatigue and lists allies", () => {
    const t = describeCapabilities({ ...base, stamina: 10, companions: ["Jorge"] });
    expect(t).toContain("fatigado");
    expect(t).toContain("Jorge");
  });
  it("scales Haki wording with the value", () => {
    expect(describeCapabilities({ ...base, armamentHaki: 95 })).toContain("maestro");
    expect(describeCapabilities({ ...base, armamentHaki: 5 })).toContain("incipiente");
  });
});

import { describe, expect, it } from "vitest";
import { automaticSide, canonWarCandidates, enlistableSides, fightsTheGovernment, frontDue, frontPower, governmentSide, pickCanonWar, warDeclarationText, warlordCallText, type WarActor } from "./world-wars";

const a = (id: string, role: string, seat: string | null = null, powerLevel = 90, status = "ACTIVE"): WarActor => ({ id, name: id, role, factionType: "X", seat, powerLevel, status });
const world = [a("Dragon", "REVOLUTIONARY_COMMANDER", "REV_LEADER"), a("Sakazuki", "ADMIRAL", "FLEET_ADMIRAL"), a("Shanks", "YONKO"), a("Teach", "YONKO"), a("Dead", "YONKO", null, 99, "DECEASED")];

describe("canon war candidates", () => {
  it("offers the Revolution, justice, Emperor-vs-Marines and Emperor-vs-Emperor wars", () => {
    const kinds = canonWarCandidates(world).map((c) => `${c.kind}:${c.attacker.id}>${c.defender?.id ?? "gov"}`);
    expect(kinds).toContain("REVOLUTION:Dragon>gov");
    expect(kinds).toContain("JUSTICE:Sakazuki>Shanks");
    expect(kinds).toContain("MARINE:Teach>gov");
    expect(kinds).toContain("EMPEROR:Shanks>Teach");
    expect(kinds.some((k) => k.includes("Dead"))).toBe(false);
  });
  it("falls back to the chief of staff when the leader seat is empty", () => {
    const c = canonWarCandidates([a("Sabo", "REVOLUTIONARY_COMMANDER", "REV_CHIEF")]);
    expect(c[0].attacker.id).toBe("Sabo");
  });
  it("never starts a war with someone already busy, and is deterministic", () => {
    const c = canonWarCandidates(world);
    const pick = pickCanonWar(c, new Set(["Dragon", "Sakazuki"]), "s");
    expect(pick && ["Dragon", "Sakazuki"].includes(pick.attacker.id)).toBe(false);
    expect(pickCanonWar(c, new Set(), "x")).toEqual(pickCanonWar(c, new Set(), "x"));
    expect(pickCanonWar(c, new Set(world.map((w) => w.id)), "x")).toBeNull();
  });
});

describe("picking a war", () => {
  it("over many hours every kind comes up, and the weighted Revolution/justice wars are not starved", () => {
    const c = canonWarCandidates([...world, a("Kuma", "REVOLUTIONARY_COMMANDER", "REV_COMMANDER"), a("Big", "YONKO"), a("Kaido", "YONKO")]);
    const counts: Record<string, number> = {};
    for (let h = 480000; h < 480400; h++) {
      const p = pickCanonWar(c, new Set(), `war:${h}`)!;
      counts[p.kind] = (counts[p.kind] ?? 0) + 1;
    }
    for (const kind of ["REVOLUTION", "JUSTICE", "MARINE", "EMPEROR"]) expect(counts[kind] ?? 0).toBeGreaterThan(10);
    expect(counts.EMPEROR).toBeLessThan(300);
  });
});

describe("sides", () => {
  it("the Government defends against the Revolution and the Revolution attacks", () => {
    expect(automaticSide("REVOLUTION", "MARINE")).toBe("defender");
    expect(automaticSide("REVOLUTION", "CP0")).toBe("defender");
    expect(automaticSide("REVOLUTION", "REVOLUTIONARY")).toBe("attacker");
    expect(automaticSide("REVOLUTION", "PIRATE")).toBeNull();
  });
  it("marines carry a war of justice and defend against an Emperor", () => {
    expect(automaticSide("JUSTICE", "MARINE")).toBe("attacker");
    expect(automaticSide("MARINE", "MARINE")).toBe("defender");
  });
  it("pirates choose their Emperor and can join an Emperor against the Marines", () => {
    expect(enlistableSides("EMPEROR", "PIRATE")).toEqual(["attacker", "defender"]);
    expect(enlistableSides("MARINE", "PIRATE")).toEqual(["attacker"]);
    expect(enlistableSides("JUSTICE", "PIRATE")).toEqual(["defender"]);
    expect(enlistableSides("REVOLUTION", "PIRATE")).toEqual([]);
    expect(enlistableSides("REVOLUTION", "MARINE")).toEqual([]);
  });
});

describe("Shichibukai answer to the Government", () => {
  it("a warlord may only take the Government's side, and chooses freely between two Emperors", () => {
    expect(enlistableSides("MARINE", "PIRATE", true)).toEqual(["defender"]);
    expect(enlistableSides("REVOLUTION", "PIRATE", true)).toEqual(["defender"]);
    expect(enlistableSides("JUSTICE", "PIRATE", true)).toEqual(["attacker"]);
    expect(enlistableSides("EMPEROR", "PIRATE", true)).toEqual(["attacker", "defender"]);
  });
  it("an ordinary pirate keeps the old options", () => {
    expect(enlistableSides("MARINE", "PIRATE", false)).toEqual(["attacker"]);
    expect(enlistableSides("JUSTICE", "PIRATE")).toEqual(["defender"]);
  });
  it("knows which side is against the Government", () => {
    expect(governmentSide("EMPEROR")).toBeNull();
    expect(fightsTheGovernment("MARINE", "attacker")).toBe(true);
    expect(fightsTheGovernment("MARINE", "defender")).toBe(false);
    expect(fightsTheGovernment("JUSTICE", "defender")).toBe(true);
    expect(fightsTheGovernment("JUSTICE", "attacker")).toBe(false);
    expect(fightsTheGovernment("EMPEROR", "attacker")).toBe(false);
  });
  it("the summons exists only for wars with a Government side", () => {
    const plans = canonWarCandidates(world);
    const by = (k: string) => plans.find((p) => p.kind === k)!;
    expect(warlordCallText(by("EMPEROR"))).toBeNull();
    expect(warlordCallText(by("REVOLUTION"))?.body).toContain("Revolución");
    expect(warlordCallText(by("JUSTICE"))?.body).toContain("Shanks");
    expect(warlordCallText(by("MARINE"))?.headline).toContain("Shichibukai");
  });
});

describe("fronts", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  it("a front is due when its time has come", () => {
    expect(frontDue(null, now)).toBe(true);
    expect(frontDue(new Date(now.getTime() + 1000), now)).toBe(false);
  });
  it("players who fight for a side give its champion a little weight, capped", () => {
    expect(frontPower(90, 0)).toBe(90);
    expect(frontPower(90, 2)).toBe(94);
    expect(frontPower(95, 50)).toBe(100);
  });
  it("every war has a headline naming both sides", () => {
    const [p] = canonWarCandidates(world).filter((c) => c.kind === "EMPEROR");
    expect(warDeclarationText(p).headline).toContain(p.attacker.name);
    expect(warDeclarationText(p).headline).toContain(p.defenderName);
  });
});

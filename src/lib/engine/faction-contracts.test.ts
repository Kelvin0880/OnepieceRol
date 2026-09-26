import { describe, expect, it } from "vitest";
import { contractRep, contractRepLabel, factionContract, type ContractContext } from "./faction-contracts";

const residents = [
  { id: "t1", name: "Dirk", title: "Matón del muelle", category: "thug", level: 3 },
  { id: "g1", name: "Sargento Pols", title: "Guardia del puerto", category: "guard", level: 4 },
  { id: "c1", name: "Ana", title: "Tabernera", category: "civilian", level: 1 },
];
const ctx: ContractContext = { faction: "MARINE", level: 5, danger: 2, minLevel: 1, islandName: "Pueblo Foosha", residents, excludeIds: [], seed: "abcd" };

describe("faction contracts", () => {
  it("a marine gets an arrest warrant for an outlaw", () => {
    const c = factionContract(ctx)!;
    expect(c.kind).toBe("defeat_npc");
    expect(c.targetNpcId).toBe("t1");
    expect(c.title).toContain("Orden de arresto");
    expect(c.factionRep).toBeGreaterThan(0);
  });
  it("a revolutionary is sent against the Government's enforcer, never a civilian", () => {
    const c = factionContract({ ...ctx, faction: "REVOLUTIONARY" })!;
    expect(c.targetNpcId).toBe("g1");
  });
  it("a hunter gets a wanted poster that pays more than a marine's warrant", () => {
    const h = factionContract({ ...ctx, faction: "BOUNTY_HUNTER" })!;
    expect(h.title).toContain("SE BUSCA");
    expect(h.berries).toBeGreaterThan(factionContract(ctx)!.berries);
  });
  it("never targets someone another goal already names", () => {
    const c = factionContract({ ...ctx, excludeIds: ["t1"] })!;
    expect(c.kind).toBe("explore");
  });
  it("falls back to a patrol, a whisper campaign or a clean-up when nobody fits", () => {
    for (const faction of ["MARINE", "REVOLUTIONARY", "CP0", "BOUNTY_HUNTER", "PIRATE"] as const) {
      const c = factionContract({ ...ctx, faction, residents: [] });
      expect(c).not.toBeNull();
      expect(c!.target).toBeGreaterThan(0);
    }
  });
  it("pirates earn bounty in berries, the rest earn ladder points", () => {
    expect(contractRep("PIRATE", 2, 3)).toBe(9_000_000);
    expect(contractRep("MARINE", 2, 3)).toBe(110);
    expect(contractRepLabel("PIRATE", 1_500_000)).toContain("recompensa");
    expect(contractRepLabel("CP0", 50)).toContain("confianza");
    expect(contractRepLabel("MARINE", 0)).toBe("");
  });
});

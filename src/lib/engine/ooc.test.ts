import { describe, it, expect } from "vitest";
import {
  validateCharacterName,
  canRollback,
  planRollback,
  planRepair,
  gearSignature,
  isNarratorTone,
  MAX_ROLLBACKS_PER_DAY,
  CharacterSnapshot,
} from "./ooc";

const snap: CharacterSnapshot = {
  level: 4, experience: 120, hp: 40, maxHp: 60, stamina: 70, maxStamina: 100, berries: 5000, bounty: 100, notoriety: 0,
  strength: 10, agility: 9, durability: 8, willpower: 7, intellect: 6, observationHaki: 0, armamentHaki: 2,
  currentIslandId: "isla1", gearSignature: gearSignature({ weaponId: "w1", fruitId: null, inventoryCount: 2 }),
};

describe("validateCharacterName", () => {
  it("accepts and normalizes a good name", () => {
    expect(validateCharacterName("  Kaze   D.  Luna ")).toEqual({ ok: true, name: "Kaze D. Luna" });
    expect(validateCharacterName("Ñandú-Ōkami")).toMatchObject({ ok: true });
  });
  it("rejects too short, too long and odd symbols", () => {
    expect(validateCharacterName("A").ok).toBe(false);
    expect(validateCharacterName("x".repeat(31)).ok).toBe(false);
    expect(validateCharacterName("<script>").ok).toBe(false);
    expect(validateCharacterName("   ").ok).toBe(false);
  });
});

describe("canRollback", () => {
  const base = { dead: false, imprisoned: false, inDuelOrJointFight: false, rollbacksLast24h: 0 };
  it("allows a healthy, free character", () => expect(canRollback(base).ok).toBe(true));
  it("keeps permadeath: the dead cannot roll back", () => expect(canRollback({ ...base, dead: true }).ok).toBe(false));
  it("does not undo an imprisonment", () => expect(canRollback({ ...base, imprisoned: true }).ok).toBe(false));
  it("blocks mid duel / joint fight", () => expect(canRollback({ ...base, inDuelOrJointFight: true }).ok).toBe(false));
  it("caps rollbacks per day", () => {
    expect(canRollback({ ...base, rollbacksLast24h: MAX_ROLLBACKS_PER_DAY - 1 }).ok).toBe(true);
    expect(canRollback({ ...base, rollbacksLast24h: MAX_ROLLBACKS_PER_DAY }).ok).toBe(false);
  });
});

describe("planRollback", () => {
  it("restores berries when gear is unchanged", () => {
    const p = planRollback(snap, snap.gearSignature, 900);
    expect(p.berriesRestored).toBe(true);
    expect(p.data.berries).toBe(5000);
    expect(p.data.level).toBe(4);
    expect(p.data.currentIslandId).toBe("isla1");
  });
  it("keeps current berries when gear changed (no buy-then-rollback refund)", () => {
    const p = planRollback(snap, gearSignature({ weaponId: "w2", fruitId: null, inventoryCount: 2 }), 900);
    expect(p.berriesRestored).toBe(false);
    expect(p.data.berries).toBe(900);
  });
  it("never restores hp above max", () => {
    expect(planRollback({ ...snap, hp: 999 }, snap.gearSignature, 1).data.hp).toBe(60);
  });
});

describe("planRepair", () => {
  it("does nothing for a valid character", () => {
    const r = planRepair({ hp: 10, maxHp: 50, stamina: 5, maxStamina: 100, berries: 0, bounty: 0, notoriety: 0, experience: 0 });
    expect(r.changes).toEqual({});
    expect(r.notes).toEqual([]);
  });
  it("clamps out-of-range values and reports them", () => {
    const r = planRepair({ hp: 500, maxHp: 50, stamina: -20, maxStamina: 100, berries: -5, bounty: 0, notoriety: 0, experience: 0 });
    expect(r.changes).toEqual({ hp: 50, stamina: 0, berries: 0 });
    expect(r.notes).toHaveLength(3);
  });
  it("lifts hp 0 to 1 so a stuck-at-zero living character can act", () => {
    expect(planRepair({ hp: 0, maxHp: 50, stamina: 5, maxStamina: 100, berries: 1, bounty: 0, notoriety: 0, experience: 0 }).changes.hp).toBe(1);
  });
});

describe("isNarratorTone", () => {
  it("accepts only known tones", () => {
    expect(isNarratorTone("story")).toBe(true);
    expect(isNarratorTone("hard")).toBe(false);
    expect(isNarratorTone(undefined)).toBe(false);
  });
});

import { diffSnapshot } from "./ooc";

describe("rollback messages and preview diff", () => {
  it("a prisoner and a dead character get different, accurate reasons", () => {
    const base = { dead: false, imprisoned: false, inDuelOrJointFight: false, rollbacksLast24h: 0 };
    const dead = canRollback({ ...base, dead: true });
    const jailed = canRollback({ ...base, imprisoned: true });
    expect(dead.ok || dead.reason).toContain("muerto");
    expect(jailed.ok || jailed.reason).toContain("captura");
    expect(jailed.ok || jailed.reason).not.toContain("muerto");
  });
  it("diffSnapshot lists only what actually changes and hides berries when they are kept", () => {
    const now = { ...snap, level: 6, hp: 10, berries: 100, gearSignature: snap.gearSignature };
    const lines = diffSnapshot(snap, now, { snapshot: "Foosha", current: "Loguetown" }, false);
    expect(lines.find((l) => l.label === "Nivel")).toEqual({ label: "Nivel", from: 6, to: 4 });
    expect(lines.find((l) => l.label === "Isla")).toEqual({ label: "Isla", from: "Loguetown", to: "Foosha" });
    expect(lines.some((l) => l.label === "Berries")).toBe(false);
    expect(lines.some((l) => l.label === "Fuerza")).toBe(false);
    expect(diffSnapshot(snap, now, { snapshot: "Foosha", current: "Loguetown" }, true).some((l) => l.label === "Berries")).toBe(true);
  });
  it("an identical state has nothing to warn about", () => {
    expect(diffSnapshot(snap, { ...snap }, { snapshot: "A", current: "A" }, true)).toEqual([]);
  });
});

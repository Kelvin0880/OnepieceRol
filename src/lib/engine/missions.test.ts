import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { missionTier, missionRewards, generateMissionSpecs, progressGain, isComplete, shouldGenerateBatch, MISSION_BATCH_COOLDOWN_MS } from "./missions";

const ctx = { level: 1, danger: 1, minLevel: 1, islandName: "Pueblo Foosha", arcHook: "Un mafioso local extorsiona al pueblo.", openNeighbours: ["Villa Shimotsuki"] };

describe("scaling", () => {
  it("demands more the further above the island's entry level you are", () => {
    expect(missionTier(1, 1)).toBe(1);
    expect(missionTier(8, 1)).toBe(2);
    expect(missionTier(30, 10)).toBe(3);
  });
  it("pays more for higher tiers and dangerous islands", () => {
    expect(missionRewards(3, 5, "explore").berries).toBeGreaterThan(missionRewards(1, 5, "explore").berries);
    expect(missionRewards(2, 8, "explore").xp).toBeGreaterThan(missionRewards(2, 2, "explore").xp);
    expect(missionRewards(1, 3, "win_fights").berries).toBeGreaterThan(missionRewards(1, 3, "explore").berries);
  });
});

describe("generateMissionSpecs", () => {
  it("always offers the island's arc, a reconnaissance goal and one more", () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = generateMissionSpecs(mulberry32(seed), ctx);
      expect(s).toHaveLength(3);
      expect(s[0].isArc && s[0].kind === "win_fights").toBe(true);
      expect(s[0].brief).toContain("mafioso");
      expect(s[1].kind).toBe("explore");
    }
  });
  it("scales targets with the character's level", () => {
    const low = generateMissionSpecs(mulberry32(1), ctx);
    const high = generateMissionSpecs(mulberry32(1), { ...ctx, level: 30 });
    expect(high[0].target).toBeGreaterThan(low[0].target);
    expect(high[0].berries).toBeGreaterThan(low[0].berries);
  });
  it("only proposes travel toward a neighbour the character can enter", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) for (const m of generateMissionSpecs(mulberry32(seed), ctx)) seen.add(m.kind);
    expect(seen.has("travel")).toBe(true);
    for (let seed = 0; seed < 60; seed++) {
      const s = generateMissionSpecs(mulberry32(seed), { ...ctx, openNeighbours: [] });
      expect(s.some((m) => m.kind === "travel")).toBe(false);
    }
  });
  it("works for islands with no story hook", () => {
    const s = generateMissionSpecs(mulberry32(2), { ...ctx, arcHook: null });
    expect(s[0].brief).toContain("Pueblo Foosha");
  });
  it("trims a very long hook", () => {
    const s = generateMissionSpecs(mulberry32(2), { ...ctx, arcHook: "x".repeat(900) });
    expect(s[0].brief.length).toBeLessThan(400);
  });
});

describe("progress", () => {
  const m = (kind: never, extra = {}) => ({ kind, progress: 0, target: 3, ...extra });
  it("each event advances only its own kind", () => {
    expect(progressGain(m("explore" as never), { kind: "explore" })).toBe(1);
    expect(progressGain(m("explore" as never), { kind: "win" })).toBe(0);
    expect(progressGain(m("win_fights" as never), { kind: "win" })).toBe(1);
    expect(progressGain(m("train" as never), { kind: "train" })).toBe(1);
    expect(progressGain(m("spare" as never), { kind: "spare" })).toBe(1);
  });
  it("travel counts only toward its destination", () => {
    const t = m("travel" as never, { destination: "Loguetown" });
    expect(progressGain(t, { kind: "travel", destination: "Loguetown" })).toBe(1);
    expect(progressGain(t, { kind: "travel", destination: "Baratie" })).toBe(0);
  });
  it("completes at the target", () => {
    expect(isComplete(2, 3)).toBe(false);
    expect(isComplete(3, 3)).toBe(true);
  });
});

describe("batch pacing", () => {
  it("generates the first batch, waits while active, then after the cooldown", () => {
    const now = 10_000_000;
    expect(shouldGenerateBatch(0, null, now)).toBe(true);
    expect(shouldGenerateBatch(2, null, now)).toBe(false);
    expect(shouldGenerateBatch(0, now - 1000, now)).toBe(false);
    expect(shouldGenerateBatch(0, now - MISSION_BATCH_COOLDOWN_MS, now)).toBe(true);
  });
});

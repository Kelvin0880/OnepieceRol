import { describe, expect, it } from "vitest";
import { pickVanguard, canonBriefFallback, canonMinLevel, challengeBlockReason, duelEnemyOf, isVerdictChoice, missionBlockReason, vanguardOf, verdictReward, type CanonActorView } from "./canon-encounter";

const actor = (over: Partial<CanonActorView> = {}): CanonActorView => ({ id: "a", name: "Smoker", role: "MARINE_OFFICER", powerLevel: 60, factionType: "MARINE", status: "ACTIVE", locationHidden: false, currentIslandId: "isla", ...over });
const now = new Date("2026-01-01T12:00:00Z");
const base = { playerFaction: "PIRATE" as const, playerIslandId: "isla", level: 30, hasOpenChallenge: false, busy: false };

describe("challenge rules", () => {
  it("needs a third of their power in levels", () => {
    expect(canonMinLevel(60)).toBe(20);
    expect(canonMinLevel(12)).toBe(10);
    expect(challengeBlockReason({ actor: actor(), ...base, level: 10 })).toContain("nivel 20");
    expect(challengeBlockReason({ actor: actor(), ...base })).toBeNull();
  });
  it("only someone in plain sight on your island", () => {
    expect(challengeBlockReason({ actor: actor({ locationHidden: true }), ...base })).toContain("a la vista");
    expect(challengeBlockReason({ actor: actor({ currentIslandId: "otra" }), ...base })).toContain("a la vista");
    expect(challengeBlockReason({ actor: actor({ status: "CAPTURED" }), ...base })).toContain("a la vista");
  });
  it("not Yonko, Gorosei, your own side, or someone busy", () => {
    expect(challengeBlockReason({ actor: actor({ role: "YONKO" }), ...base })).toContain("trono");
    expect(challengeBlockReason({ actor: actor({ role: "GOROSEI" }), ...base })).toContain("final del juego");
    expect(challengeBlockReason({ actor: actor(), ...base, playerFaction: "MARINE" })).toContain("tuyos");
    expect(challengeBlockReason({ actor: actor({ factionType: "PIRATE" }), ...base })).toBeNull();
    expect(challengeBlockReason({ actor: actor(), ...base, busy: true })).toContain("ocupado");
    expect(challengeBlockReason({ actor: actor(), ...base, hasOpenChallenge: true })).toContain("abierto");
  });
});

describe("mission rules", () => {
  const m = { playerFaction: "MARINE" as const, playerIslandId: "isla", level: 20, hasOpenMission: false, lastMissionAt: null, now };
  it("allies and neutrals give tasks, enemies do not", () => {
    expect(missionBlockReason({ actor: actor(), ...m })).toBeNull();
    expect(missionBlockReason({ actor: actor({ factionType: "PIRATE" }), ...m })).toContain("enemigo");
    expect(missionBlockReason({ actor: actor({ factionType: "CIVILIAN" }), ...m })).toBeNull();
  });
  it("one open task at a time, with a cooldown", () => {
    expect(missionBlockReason({ actor: actor(), ...m, hasOpenMission: true })).toContain("sin terminar");
    expect(missionBlockReason({ actor: actor(), ...m, lastMissionAt: new Date(now.getTime() - 3600_000) })).toContain("acaba");
    expect(missionBlockReason({ actor: actor(), ...m, lastMissionAt: new Date(now.getTime() - 7 * 3600_000) })).toBeNull();
  });
});

describe("forces and rewards", () => {
  it("the vanguard is a fraction of the real thing", () => {
    const v = vanguardOf("Smoker", 60);
    const real = duelEnemyOf(60);
    expect(v.name).toBe("Vanguardia de Smoker");
    expect(v.hp).toBeLessThan(real.hp);
    expect(v.atk).toBeLessThan(real.atk);
  });
  it("capture pays more than a kill, spare and denial pay nothing", () => {
    expect(verdictReward(80, 300_000_000, "capture").berries).toBeGreaterThan(verdictReward(80, 300_000_000, "death").berries);
    expect(verdictReward(80, 300_000_000, "survived")).toEqual({ berries: 0, standing: 0 });
    expect(verdictReward(90, 9_000_000_000, "capture").berries).toBeLessThanOrEqual(100_000_000);
  });
  it("validates verdict choices and writes a fallback brief with real names only", () => {
    expect(isVerdictChoice("capture")).toBe(true);
    expect(isVerdictChoice("torture")).toBe(false);
    const b = canonBriefFallback({ actorName: "Smoker", rank: "Vicealmirante", personality: "Cabezota.", targetName: "Dirk", targetTitle: "Matón del muelle", islandName: "Foosha" });
    expect(b).toContain("Smoker");
    expect(b).toContain("Dirk");
  });
});

describe("pickVanguard", () => {
  const target = { id: "t", factionName: "Piratas de Big Mom", powerLevel: 93, currentIslandId: "wci" };
  const c = (id: string, power: number, over: Record<string, unknown> = {}) => ({ id, name: id, powerLevel: power, factionName: "Piratas de Big Mom", status: "ACTIVE", currentIslandId: "wci", role: "NOTABLE_PIRATE", busy: false, ...over });
  it("picks the strongest real subordinate of the same crew, below the target", () => {
    expect(pickVanguard(target, [c("Perospero", 84), c("Oven", 82), c("Katakuri", 93), c("Otro", 50, { factionName: "Marina" })])?.id).toBe("Perospero");
  });
  it("prefers someone on the same island, skips busy, dead and other crews", () => {
    expect(pickVanguard(target, [c("Lejos", 90, { currentIslandId: "otra" }), c("Aqui", 60)])?.id).toBe("Aqui");
    expect(pickVanguard(target, [c("Ocupado", 84, { busy: true }), c("Muerto", 80, { status: "DECEASED" })])).toBeNull();
  });
  it("nobody below them means no vanguard (never an invented one)", () => {
    expect(pickVanguard({ ...target, powerLevel: 40 }, [c("Fuerte", 80)])).toBeNull();
  });
  it("crew names ignore the parenthesis (captured / ex)", () => {
    expect(pickVanguard({ ...target, factionName: "Familia Donquixote (encarcelado)" }, [c("Diamante", 78, { factionName: "Familia Donquixote" })])?.id).toBe("Diamante");
  });
});

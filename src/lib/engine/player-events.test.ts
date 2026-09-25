import { describe, expect, it } from "vitest";
import { canCreateMore, canJoin, cleanSubmission, clampScore, defaultPrize, parseTrialScores, pendingHumans, pickWinner, readyToResolve, rewardFor, rewardSummary, stubTrialScores, EVENT_MAX_OPEN } from "./player-events";

const base = { level: 3, status: "ALIVE", minLevel: 1, maxLevel: 10, onIslandId: "a", eventIslandId: "a", alreadyIn: false, busyReason: null };
const e = (o: Partial<Parameters<typeof pickWinner>[0][number]> = {}) => ({ characterId: "c", isNpc: false, status: "SUBMITTED", score: 50, submittedAt: new Date(1000), level: 3, name: "x", ...o });

describe("player events", () => {
  it("only lets eligible characters join", () => {
    expect(canJoin(base)).toBeNull();
    expect(canJoin({ ...base, status: "DEAD" })).toMatch(/vivo/);
    expect(canJoin({ ...base, alreadyIn: true })).toMatch(/Ya estás/);
    expect(canJoin({ ...base, onIslandId: "b" })).toMatch(/isla del evento/);
    expect(canJoin({ ...base, level: 11 })).toMatch(/hasta 10/);
    expect(canJoin({ ...base, level: 1, minLevel: 2 })).toMatch(/nivel 2/);
    expect(canJoin({ ...base, busyReason: "Estás en una pelea." })).toBe("Estás en una pelea.");
  });

  it("bounds the submission text", () => {
    expect(cleanSubmission("corto")).toBeNull();
    expect(cleanSubmission("x".repeat(30))).not.toBeNull();
    expect(cleanSubmission("x".repeat(3001))).toBeNull();
  });

  it("resolves only when every human has finished and at least one submitted", () => {
    expect(readyToResolve([{ isNpc: false, status: "SUBMITTED" }, { isNpc: true, status: "SUBMITTED" }])).toBe(true);
    expect(readyToResolve([{ isNpc: false, status: "SUBMITTED" }, { isNpc: false, status: "REGISTERED" }])).toBe(false);
    expect(readyToResolve([{ isNpc: false, status: "WITHDRAWN" }, { isNpc: true, status: "SUBMITTED" }])).toBe(false);
    expect(readyToResolve([{ isNpc: true, status: "SUBMITTED" }])).toBe(false);
    expect(pendingHumans([{ isNpc: false, status: "REGISTERED" }, { isNpc: true, status: "REGISTERED" }, { isNpc: false, status: "SUBMITTED" }])).toBe(1);
  });

  it("clamps scores to 0-100 whole numbers", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-4)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore("x")).toBe(0);
  });

  it("picks the highest score; ties go to a human, then to whoever finished first", () => {
    expect(pickWinner([e({ score: 40 }), e({ score: 90, name: "top" })])?.name).toBe("top");
    expect(pickWinner([e({ isNpc: true, characterId: null, name: "npc", score: 80 }), e({ name: "human", score: 80 })])?.name).toBe("human");
    expect(pickWinner([e({ name: "late", score: 80, submittedAt: new Date(2000) }), e({ name: "early", score: 80, submittedAt: new Date(1000) })])?.name).toBe("early");
    expect(pickWinner([e({ status: "WITHDRAWN" })])).toBeNull();
  });

  it("gives the winner the prize and the rest a small consolation", () => {
    const prize = { berries: 1000, xp: 100 };
    expect(rewardFor(true, prize)).toEqual(prize);
    expect(rewardFor(false, prize)).toEqual({ berries: 100, xp: 25 });
    expect(defaultPrize(10).berries).toBeGreaterThan(defaultPrize(2).berries);
  });

  it("caps open events and spaces creation by 24 h", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(canCreateMore(EVENT_MAX_OPEN, null, now)).toBe(false);
    expect(canCreateMore(0, null, now)).toBe(true);
    expect(canCreateMore(1, new Date(now.getTime() - 3600_000), now)).toBe(false);
    expect(canCreateMore(1, new Date(now.getTime() - 25 * 3600_000), now)).toBe(true);
  });

  it("parses judge scores and never drops an entry", () => {
    const out = parseTrialScores(JSON.stringify({ resultados: [{ indice: 0, puntos: 70, motivo: "Buen plan" }, { indice: 2, puntos: 300, motivo: "x" }] }), 3);
    expect(out).toHaveLength(3);
    expect(out?.[0]).toMatchObject({ score: 70, verdict: "Buen plan" });
    expect(out?.[1].score).toBe(0);
    expect(out?.[2].score).toBe(100);
    expect(parseTrialScores("nope", 2)).toBeNull();
    expect(parseTrialScores(JSON.stringify({ resultados: [] }), 2)).toBeNull();
  });

  it("stub scores reward level and effort deterministically", () => {
    const [a, b] = stubTrialScores([{ level: 2, text: "x".repeat(10), isNpc: false }, { level: 8, text: "x".repeat(400), isNpc: false }]);
    expect(b.score).toBeGreaterThan(a.score);
  });

  it("summarises a prize", () => {
    expect(rewardSummary({ fruitName: "Tsuta Tsuta no Mi", berries: 10000, xp: 50 })).toBe("la fruta única «Tsuta Tsuta no Mi» + ฿ 10.000 + 50 XP");
    expect(rewardSummary({ fruitName: null, berries: 0, xp: 10 })).toBe("10 XP");
  });
});

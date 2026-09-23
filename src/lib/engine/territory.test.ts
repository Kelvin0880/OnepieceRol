import { describe, it, expect } from "vitest";
import {
  nextStage,
  contributionPoints,
  stageEnemy,
  stageRewards,
  garrisonAfterElapsed,
  consumedPeriodMs,
  fortifyCost,
  incomeAccrued,
  conquestExpired,
  resolveVote,
  allContributorsVoted,
  titleForHolder,
  GARRISON_PERIOD_MS,
  GARRISON_DECAY_PER_PERIOD,
  CONQUEST_IDLE_EXPIRY_MS,
  INCOME_CAP_HOURS,
} from "./territory";

describe("stages", () => {
  it("runs army -> commanders -> holder and then ends", () => {
    expect(nextStage("ARMY")).toBe("COMMANDERS");
    expect(nextStage("COMMANDERS")).toBe("HOLDER");
    expect(nextStage("HOLDER")).toBeNull();
  });
  it("later stages pay more and count more, downed allies earn half", () => {
    expect(contributionPoints("HOLDER", false)).toBeGreaterThan(contributionPoints("ARMY", false));
    expect(contributionPoints("COMMANDERS", true)).toBe(contributionPoints("COMMANDERS", false) / 2);
    expect(stageRewards("HOLDER", 10).berries).toBeGreaterThan(stageRewards("ARMY", 10).berries);
  });
  it("the holder is the toughest force and the army the weakest per body", () => {
    const army = stageEnemy("ARMY", 95, 10);
    const cmd = stageEnemy("COMMANDERS", 95, 10);
    const holder = stageEnemy("HOLDER", 95, 10);
    expect(holder.atk).toBeGreaterThan(cmd.atk);
    expect(cmd.atk).toBeGreaterThan(army.atk);
    expect(holder.def).toBeGreaterThan(army.def);
  });
});

describe("garrison", () => {
  it("decays a fixed amount per whole 12h period and never below zero", () => {
    expect(garrisonAfterElapsed(100, GARRISON_PERIOD_MS - 1)).toBe(100);
    expect(garrisonAfterElapsed(100, GARRISON_PERIOD_MS)).toBe(100 - GARRISON_DECAY_PER_PERIOD);
    expect(garrisonAfterElapsed(100, GARRISON_PERIOD_MS * 2.5)).toBe(100 - GARRISON_DECAY_PER_PERIOD * 2);
    expect(garrisonAfterElapsed(30, GARRISON_PERIOD_MS * 10)).toBe(0);
  });
  it("consumedPeriodMs keeps the remainder of the clock", () => {
    expect(consumedPeriodMs(GARRISON_PERIOD_MS * 2.5)).toBe(GARRISON_PERIOD_MS * 2);
    expect(consumedPeriodMs(-5)).toBe(0);
  });
  it("fortifying costs more the more damaged it is, and nothing when full", () => {
    expect(fortifyCost(100)).toBe(0);
    expect(fortifyCost(20)).toBeGreaterThan(fortifyCost(80));
  });
});

describe("income and expiry", () => {
  it("income grows with time and danger but is capped", () => {
    expect(incomeAccrued(10, 3600_000)).toBeLessThan(incomeAccrued(10, 7200_000));
    expect(incomeAccrued(10, 1000 * 3600_000)).toBe(incomeAccrued(10, INCOME_CAP_HOURS * 3600_000));
    expect(incomeAccrued(10, 3600_000)).toBeGreaterThan(incomeAccrued(5, 3600_000));
  });
  it("an idle conquest expires", () => {
    expect(conquestExpired(0, CONQUEST_IDLE_EXPIRY_MS)).toBe(false);
    expect(conquestExpired(0, CONQUEST_IDLE_EXPIRY_MS + 1)).toBe(true);
  });
});

describe("resolveVote", () => {
  const contrib = { a: 10, b: 6, c: 4 };
  it("weights votes by contribution", () => {
    const r = resolveVote({ a: "b", b: "c", c: "c" }, contrib, null);
    expect(r.tally).toEqual({ b: 10, c: 10 });
    expect(r.winnerId).toBe("b"); // 10-10 tie: the larger contributor (6 vs 4) wins
    expect(resolveVote({ a: "b", b: "c", c: "c" }, { a: 10, b: 6, c: 5 }, null).winnerId).toBe("c"); // 11 beats 10
  });
  it("ties go to the final blow, then the bigger contribution, then a stable id", () => {
    const tie = { a: "b", b: "c" };
    expect(resolveVote(tie, { a: 6, b: 6, c: 1 }, "c").winnerId).toBe("c");
    expect(resolveVote({ a: "a", b: "b" }, { a: 6, b: 6 }, null).winnerId).toBe("a");
    expect(resolveVote({ a: "a", b: "b" }, { a: 6, b: 7 }, null).winnerId).toBe("b");
  });
  it("ignores votes from and for non-contributors", () => {
    const r = resolveVote({ ghost: "a", a: "ghost", b: "b" }, contrib, null);
    expect(r.winnerId).toBe("b");
    expect(r.tally).toEqual({ b: 6 });
  });
  it("with no valid votes the top contributor wins; with no contributors nobody does", () => {
    expect(resolveVote({}, contrib, null).winnerId).toBe("a");
    expect(resolveVote({}, {}, null).winnerId).toBeNull();
  });
  it("detects when every contributor has voted", () => {
    expect(allContributorsVoted({ a: "a", b: "a" }, contrib)).toBe(false);
    expect(allContributorsVoted({ a: "a", b: "a", c: "b" }, contrib)).toBe(true);
    expect(allContributorsVoted({}, {})).toBe(false);
  });
});

describe("titleForHolder", () => {
  it("makes the conqueror of a Yonko a Yonko", () => {
    expect(titleForHolder("YONKO", "Isla Cementerio")).toBe("Yonko de Isla Cementerio");
    expect(titleForHolder("CIPHER_POL", "Enies Lobby")).toBe("Señor de Enies Lobby");
  });
});

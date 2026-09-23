import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { consequenceDelayMs, consequenceRipe, rollOutcome, rollConsequenceTrigger, boonRewards, tributeRewards, returningEnemy, nextStage, MAX_STAGE, TRIGGER_CHANCE } from "./consequence";

describe("consequence timing", () => {
  it("a thread is ripe only after its delay", () => {
    expect(consequenceRipe(1000, 999)).toBe(false);
    expect(consequenceRipe(1000, 1000)).toBe(true);
    expect(consequenceDelayMs("killed")).toBeLessThan(consequenceDelayMs("spared"));
  });
  it("triggers about TRIGGER_CHANCE of the time", () => {
    const rng = mulberry32(7);
    let hits = 0;
    for (let i = 0; i < 4000; i++) if (rollConsequenceTrigger(rng)) hits++;
    expect(hits / 4000).toBeGreaterThan(TRIGGER_CHANCE - 0.05);
    expect(hits / 4000).toBeLessThan(TRIGGER_CHANCE + 0.05);
  });
});

describe("outcomes branch by choice", () => {
  it("sparing yields boons and betrayals only, killing avengers and tribute only, both mixes appear", () => {
    const rng = mulberry32(3);
    const spared = new Set<string>();
    const killed = new Set<string>();
    for (let i = 0; i < 200; i++) {
      spared.add(rollOutcome(rng, "spared"));
      killed.add(rollOutcome(rng, "killed"));
    }
    expect([...spared].sort()).toEqual(["betrayal", "boon"]);
    expect([...killed].sort()).toEqual(["avenger", "tribute"]);
  });
  it("mercy is repaid more often than not", () => {
    const rng = mulberry32(11);
    let boons = 0;
    for (let i = 0; i < 1000; i++) if (rollOutcome(rng, "spared") === "boon") boons++;
    expect(boons).toBeGreaterThan(600);
  });
});

describe("scaling", () => {
  it("rewards grow with the stage and are capped", () => {
    expect(boonRewards(2, 5).berries).toBeGreaterThan(boonRewards(1, 5).berries);
    expect(boonRewards(99, 5)).toEqual(boonRewards(MAX_STAGE, 5));
    expect(tributeRewards(3, 4).notoriety).toBeGreaterThan(tributeRewards(1, 4).notoriety);
  });
  it("returning enemies toughen per stage and avengers hit harder than betrayers", () => {
    const p = { maxHp: 100, atk: 20, def: 10, spd: 10 };
    expect(returningEnemy(p, "avenger", 3).hp).toBeGreaterThan(returningEnemy(p, "avenger", 1).hp);
    expect(returningEnemy(p, "avenger", 2).atk).toBeGreaterThan(returningEnemy(p, "betrayal", 2).atk);
  });
  it("the thread ends after the last stage", () => {
    expect(nextStage(1)).toBe(2);
    expect(nextStage(MAX_STAGE)).toBeNull();
  });
});

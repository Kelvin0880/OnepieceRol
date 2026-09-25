import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { resolveEvent, eventDifficulty, parseEventBody, pickEventTemplate, EventBody, DEVIL_FRUIT_WATER_PENALTY } from "./events";

const sampleBody: EventBody = {
  flavorTexts: ["El viento sopla sobre la costa."],
  onCriticalSuccess: { text: ["¡Éxito rotundo!"], berries: [500, 500], xp: [50, 50] },
  onSuccess: { text: ["Lo lograste."], berries: [100, 100], xp: [10, 10] },
  onFail: { text: ["Fallaste."], hpLoss: [5, 5] },
  onCriticalFail: { text: ["Desastre total."], hpLoss: [20, 20] },
};

describe("parseEventBody", () => {
  it("round-trips through JSON", () => {
    expect(parseEventBody(JSON.stringify(sampleBody))).toEqual(sampleBody);
  });
});

describe("resolveEvent (the outcome comes from the AI judge)", () => {
  it("each judged outcome picks its own tier and its rewards", () => {
    const cs = resolveEvent("s", "critical_success", sampleBody);
    expect(cs).toMatchObject({ outcome: "critical_success", berries: 500, xp: 50, hpLoss: 0 });
    expect(cs.narrative).toBe("¡Éxito rotundo!");
    expect(resolveEvent("s", "success", sampleBody)).toMatchObject({ berries: 100, xp: 10 });
    expect(resolveEvent("s", "fail", sampleBody)).toMatchObject({ hpLoss: 5, berries: 0 });
    expect(resolveEvent("s", "critical_fail", sampleBody)).toMatchObject({ hpLoss: 20 });
  });
  it("ranges pay the middle of the range: the amount is never random", () => {
    const body: EventBody = { ...sampleBody, onSuccess: { text: ["ok"], berries: [100, 200], xp: [10, 20] } };
    expect(resolveEvent("a", "success", body)).toMatchObject({ berries: 150, xp: 15 });
    expect(resolveEvent("b", "success", body)).toMatchObject({ berries: 150, xp: 15 });
  });
  it("falls back to the plain tiers when the critical ones are absent", () => {
    const body: EventBody = { flavorTexts: ["x"], onSuccess: { text: ["ok"], berries: [10, 10] }, onFail: { text: ["fail"], hpLoss: [3, 3] } };
    expect(resolveEvent("s", "critical_success", body).narrative).toBe("ok");
    expect(resolveEvent("s", "critical_fail", body).narrative).toBe("fail");
  });
  it("reward fields default to zero when the tier omits them", () => {
    const body: EventBody = { flavorTexts: ["x"], onSuccess: { text: ["ok"] }, onFail: { text: ["f"] } };
    expect(resolveEvent("s", "success", body)).toMatchObject({ berries: 0, xp: 0, bounty: 0, hpLoss: 0 });
  });
  it("the same seed shows the same flavour text and different seeds can differ", () => {
    const body: EventBody = { ...sampleBody, flavorTexts: ["a", "b", "c", "d", "e"], onSuccess: { text: ["1", "2", "3", "4"] } };
    expect(resolveEvent("x", "success", body).flavorText).toBe(resolveEvent("x", "success", body).flavorText);
    const seen = new Set(Array.from({ length: 30 }, (_, i) => resolveEvent(`s${i}`, "success", body).flavorText));
    expect(seen.size).toBeGreaterThan(1);
  });
  it("only a brilliant result can flag a fruit find, and only when the event offers one", () => {
    const body: EventBody = { ...sampleBody, fruitDropChance: 0.5 };
    expect(resolveEvent("s", "critical_success", body).fruitDropRolled).toBe(true);
    expect(resolveEvent("s", "success", body).fruitDropRolled).toBe(false);
    expect(resolveEvent("s", "critical_success", sampleBody).fruitDropRolled).toBe(false);
  });
  it("triggersCombat mirrors the presence of an enemy spec and passes the personality through", () => {
    const enemy = { name: "Bandido", hp: 20, atk: 5, def: 2, spd: 3, personality: "torpe" };
    expect(resolveEvent("s", "fail", { ...sampleBody, enemy })).toMatchObject({ triggersCombat: true, enemy });
    expect(resolveEvent("s", "fail", sampleBody).triggersCombat).toBe(false);
    expect(resolveEvent("s", "fail", { ...sampleBody, enemy: { ...enemy, personality: undefined } }).enemy?.personality).toBeUndefined();
  });
});

describe("eventDifficulty", () => {
  it("uses the override when set and rises with island danger otherwise", () => {
    expect(eventDifficulty({ ...sampleBody, difficultyOverride: 42 }, 9, 1)).toBe(42);
    expect(eventDifficulty(sampleBody, 8, 1)).toBeGreaterThan(eventDifficulty(sampleBody, 2, 1));
  });
  it("a water hazard is far harder for a devil fruit user, and only if the event opts in", () => {
    const water: EventBody = { ...sampleBody, waterHazard: true, difficultyOverride: 30 };
    expect(eventDifficulty(water, 5, 5, true)).toBe(30 + DEVIL_FRUIT_WATER_PENALTY);
    expect(eventDifficulty(water, 5, 5, false)).toBe(30);
    expect(eventDifficulty({ ...sampleBody, difficultyOverride: 30 }, 5, 5, true)).toBe(30);
  });
  it("never passes 99", () => {
    expect(eventDifficulty({ ...sampleBody, waterHazard: true, difficultyOverride: 90 }, 9, 1, true)).toBe(99);
  });
  it("the penalty is large enough to matter", () => {
    expect(DEVIL_FRUIT_WATER_PENALTY).toBeGreaterThanOrEqual(40);
  });
});

describe("pickEventTemplate", () => {
  it("throws on an empty list", () => {
    expect(() => pickEventTemplate(mulberry32(1), [])).toThrow();
  });
  it("only ever returns templates from the input list", () => {
    const list = [{ id: "a", weight: 1 }, { id: "b", weight: 3 }];
    for (let s = 0; s < 50; s++) expect(["a", "b"]).toContain(pickEventTemplate(mulberry32(s), list).id);
  });
});

import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import { resolveEvent, parseEventBody, pickEventTemplate, EventBody, DEVIL_FRUIT_WATER_PENALTY } from "./events";

const sampleBody: EventBody = {
  flavorTexts: ["El viento sopla sobre la costa."],
  onCriticalSuccess: { text: ["¡Éxito rotundo!"], berries: [500, 500], xp: [50, 50] },
  onSuccess: { text: ["Lo lograste."], berries: [100, 100], xp: [10, 10] },
  onFail: { text: ["Fallaste."], hpLoss: [5, 5] },
  onCriticalFail: { text: ["Desastre total."], hpLoss: [20, 20] },
};

describe("parseEventBody", () => {
  it("round-trips through JSON", () => {
    const json = JSON.stringify(sampleBody);
    expect(parseEventBody(json)).toEqual(sampleBody);
  });
});

describe("resolveEvent", () => {
  it("critical fail rolls always pick the critical fail outcome and its penalties", () => {
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const rng = mulberry32(seed);
      const result = resolveEvent(rng, sampleBody, 999, 1, 99);
      if (result.outcome === "critical_fail") {
        expect(result.hpLoss).toBe(20);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("critical success rolls always pick the critical success outcome and its rewards", () => {
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const rng = mulberry32(seed);
      const result = resolveEvent(rng, sampleBody, -999, 10, 1);
      if (result.outcome === "critical_success") {
        expect(result.berries).toBe(500);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("falls back to onFail when onCriticalFail is absent", () => {
    const bodyNoCritFail: EventBody = { ...sampleBody, onCriticalFail: undefined };
    let found = false;
    for (let seed = 0; seed < 2000 && !found; seed++) {
      const rng = mulberry32(seed);
      const result = resolveEvent(rng, bodyNoCritFail, -999, 10, 1);
      if (result.outcome === "critical_fail") {
        expect(result.hpLoss).toBe(5); // onFail's value, not onCriticalFail's
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it("reward/penalty fields default to zero when the outcome tier omits them", () => {
    const rng = mulberry32(1);
    const result = resolveEvent(rng, sampleBody, -999, 10, 1);
    expect(Number.isFinite(result.berries)).toBe(true);
    expect(Number.isFinite(result.bounty)).toBe(true);
    expect(result.bounty).toBe(0); // sampleBody never specifies bounty
  });

  it("only flags a fruit drop on success tiers, gated by fruitDropChance", () => {
    const bodyWithDrop: EventBody = { ...sampleBody, fruitDropChance: 1 };
    let sawSuccessDrop = false;
    let sawFailNoDrop = false;
    for (let seed = 0; seed < 500; seed++) {
      const rng = mulberry32(seed);
      const result = resolveEvent(rng, bodyWithDrop, 999, 1, 99); // biased toward success
      if ((result.outcome === "success" || result.outcome === "critical_success") && result.fruitDropRolled) {
        sawSuccessDrop = true;
      }
      const rng2 = mulberry32(seed);
      const failResult = resolveEvent(rng2, bodyWithDrop, -999, 10, 1); // biased toward fail
      if ((failResult.outcome === "fail" || failResult.outcome === "critical_fail") && !failResult.fruitDropRolled) {
        sawFailNoDrop = true;
      }
    }
    expect(sawSuccessDrop).toBe(true);
    expect(sawFailNoDrop).toBe(true);
  });

  it("triggersCombat mirrors the presence of an enemy spec", () => {
    const rng = mulberry32(1);
    const withEnemy = resolveEvent(rng, { ...sampleBody, enemy: { name: "X", hp: 1, atk: 1, def: 1, spd: 1 } }, 0, 1, 1);
    const withoutEnemy = resolveEvent(mulberry32(1), sampleBody, 0, 1, 1);
    expect(withEnemy.triggersCombat).toBe(true);
    expect(withoutEnemy.triggersCombat).toBe(false);
  });
});

describe("resolveEvent — devil fruit water hazard", () => {
  const waterBody: EventBody = { ...sampleBody, waterHazard: true };

  it("does not penalize a character without a devil fruit", () => {
    let successCount = 0;
    for (let seed = 0; seed < 300; seed++) {
      const withFruit = resolveEvent(mulberry32(seed), waterBody, 20, 5, 20, true);
      const withoutFruit = resolveEvent(mulberry32(seed), waterBody, 20, 5, 20, false);
      if (withoutFruit.outcome === "success" || withoutFruit.outcome === "critical_success") successCount++;
      // Same roll, same difficulty: the devil fruit user's effective modifier is
      // always <= the non-user's, so they can never succeed where the non-user fails.
      const rank = (o: string) => ["critical_fail", "fail", "success", "critical_success"].indexOf(o);
      expect(rank(withFruit.outcome)).toBeLessThanOrEqual(rank(withoutFruit.outcome));
    }
    expect(successCount).toBeGreaterThan(0);
  });

  it("ignores waterHazard entirely when the event body doesn't opt in", () => {
    const rng1 = mulberry32(7);
    const rng2 = mulberry32(7);
    const withFruit = resolveEvent(rng1, sampleBody, 20, 5, 20, true);
    const withoutFruit = resolveEvent(rng2, sampleBody, 20, 5, 20, false);
    expect(withFruit.outcome).toBe(withoutFruit.outcome);
  });

  it("a large enough penalty still allows the guaranteed 5% critical success through", () => {
    let found = false;
    for (let seed = 0; seed < 3000 && !found; seed++) {
      const result = resolveEvent(mulberry32(seed), waterBody, 0, 10, 1, true);
      if (result.outcome === "critical_success") found = true;
    }
    expect(found).toBe(true);
  });

  it("DEVIL_FRUIT_WATER_PENALTY is large enough to matter at any realistic modifier", () => {
    expect(DEVIL_FRUIT_WATER_PENALTY).toBeGreaterThanOrEqual(40);
  });
});

describe("pickEventTemplate", () => {
  it("throws on an empty list", () => {
    expect(() => pickEventTemplate(mulberry32(1), [])).toThrow();
  });

  it("only ever returns templates from the input list", () => {
    const templates = [
      { id: "a", weight: 5 },
      { id: "b", weight: 5 },
    ];
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickEventTemplate(mulberry32(seed), templates);
      expect(["a", "b"]).toContain(picked.id);
    }
  });
});

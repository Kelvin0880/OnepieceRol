import { describe, expect, it } from "vitest";
import { focusPlan, isWithPlayer, readStay, writeStay, ERRAND_INFO, PATROL_GARRISON_GAIN, errandDone, errandDifficulty, errandRewards, garrisonLabel, isOnErrand, msUntilFall, readErrand, troopCount, writeErrand } from "./empire";
import { GARRISON_PERIOD_MS } from "./territory";

describe("garrison as an army", () => {
  it("scales troops with garrison and danger", () => {
    expect(troopCount(100, 8)).toBe(950);
    expect(troopCount(50, 8)).toBe(475);
    expect(troopCount(0, 8)).toBe(0);
    expect(troopCount(-5, 8)).toBe(0);
  });
  it("labels the garrison", () => {
    expect(garrisonLabel(100)).toBe("Intacta");
    expect(garrisonLabel(70)).toBe("Firme");
    expect(garrisonLabel(40)).toBe("Debilitada");
    expect(garrisonLabel(10)).toBe("Al borde de caer");
  });
  it("counts down to the fall", () => {
    const t0 = 1_000_000;
    expect(msUntilFall(100, t0, t0)).toBe(4 * GARRISON_PERIOD_MS);
    expect(msUntilFall(100, t0, t0 + GARRISON_PERIOD_MS / 2)).toBe(4 * GARRISON_PERIOD_MS - GARRISON_PERIOD_MS / 2);
    expect(msUntilFall(0, t0, t0)).toBe(0);
    expect(msUntilFall(30, t0, t0)).toBe(2 * GARRISON_PERIOD_MS);
  });
});

describe("errand storage in the companion profile", () => {
  const e = { kind: "patrol" as const, startedAt: 1000, endsAt: 5000, islandId: "isl" };
  it("merges into an existing profile without losing it", () => {
    const base = JSON.stringify({ epithet: "Corta-Tormentas", abilities: ["Tajo"] });
    const withE = writeErrand(base, e)!;
    expect(JSON.parse(withE).epithet).toBe("Corta-Tormentas");
    expect(readErrand(withE)).toEqual(e);
    const cleared = writeErrand(withE, null)!;
    expect(readErrand(cleared)).toBeNull();
    expect(JSON.parse(cleared).epithet).toBe("Corta-Tormentas");
  });
  it("works from an empty profile and returns to null", () => {
    const withE = writeErrand(null, e);
    expect(readErrand(withE)).toEqual(e);
    expect(writeErrand(withE, null)).toBeNull();
  });
  it("never trusts malformed JSON", () => {
    expect(readErrand("{oops")).toBeNull();
    expect(readErrand(JSON.stringify({ errand: { kind: "nope", startedAt: 1, endsAt: 2 } }))).toBeNull();
    expect(readErrand(JSON.stringify({ errand: { kind: "scout", startedAt: "x", endsAt: 2 } }))).toBeNull();
    expect(readErrand(null)).toBeNull();
    expect(writeErrand("{oops", e)).not.toBeNull();
  });
  it("busy only until it ends", () => {
    const j = writeErrand(null, e);
    expect(isOnErrand(j, 4999)).toBe(true);
    expect(isOnErrand(j, 5000)).toBe(false);
    expect(isOnErrand(null, 0)).toBe(false);
    expect(errandDone(e, 5000)).toBe(true);
    expect(errandDone(e, 4000)).toBe(false);
  });
});

describe("errands", () => {
  it("difficulty grows with danger and shrinks with power, always clamped", () => {
    expect(errandDifficulty(60, 8)).toBeGreaterThan(errandDifficulty(200, 8));
    expect(errandDifficulty(100, 10)).toBeGreaterThan(errandDifficulty(100, 2));
    expect(errandDifficulty(9999, 1)).toBe(10);
    expect(errandDifficulty(1, 10)).toBe(95);
  });
  it("pays each kind only its own reward and hurts on failure", () => {
    expect(errandRewards("patrol", true, 5)).toMatchObject({ success: true, garrisonGain: PATROL_GARRISON_GAIN, berries: 0, xp: 0 });
    expect(errandRewards("tribute", true, 5)).toMatchObject({ success: true, berries: 30_000, garrisonGain: 0 });
    expect(errandRewards("scout", true, 5)).toMatchObject({ success: true, xp: 160 });
    const bad = errandRewards("tribute", false, 5);
    expect(bad).toMatchObject({ success: false, berries: 0, garrisonGain: 0 });
    expect(bad.hpLossFraction).toBeGreaterThan(0);
  });
  it("has info for every kind", () => {
    for (const k of ["patrol", "tribute", "scout"] as const) expect(ERRAND_INFO[k].durationMs).toBeGreaterThan(0);
  });
});

describe("companions staying behind", () => {
  it("round-trips the flag without touching the rest of the profile", () => {
    const base = JSON.stringify({ epithet: "El Rápido", errand: { kind: "scout", startedAt: 1, endsAt: 2 } });
    const stayed = writeStay(base, true);
    expect(readStay(stayed)).toBe(true);
    expect(JSON.parse(stayed!).epithet).toBe("El Rápido");
    expect(readStay(writeStay(stayed, false))).toBe(false);
    expect(writeStay(null, false)).toBeNull();
    expect(readStay("no json")).toBe(false);
  });
  it("a nakama is with the player only when not away and not staying", () => {
    expect(isWithPlayer(null, 1000)).toBe(true);
    expect(isWithPlayer(writeStay(null, true), 1000)).toBe(false);
    expect(isWithPlayer(JSON.stringify({ errand: { kind: "patrol", startedAt: 0, endsAt: 5000 } }), 1000)).toBe(false);
    expect(isWithPlayer(JSON.stringify({ errand: { kind: "patrol", startedAt: 0, endsAt: 500 } }), 1000)).toBe(true);
  });
  it("choosing one companion sends the others to stay; choosing none brings everyone", () => {
    expect(focusPlan(["a", "b", "c"], "b")).toEqual({ a: true, b: false, c: true });
    expect(focusPlan(["a", "b"], null)).toEqual({ a: false, b: false });
  });
});

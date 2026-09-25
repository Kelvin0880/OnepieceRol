import { describe, it, expect } from "vitest";
import { mulberry32 } from "./rng";
import {
  bracketSize,
  totalRounds,
  roundName,
  drawBracket,
  gladiatorCombatant,
  gladiatorNames,
  choosePrize,
  pickKind,
  nextAction,
  canRegister,
  TOURNAMENT_INTERVAL_MS,
} from "./coliseum";

describe("bracket maths", () => {
  it("rounds up to the next power of two, between 4 and 16", () => {
    expect([1, 3, 4, 5, 8, 9, 16, 30].map(bracketSize)).toEqual([4, 4, 4, 8, 8, 16, 16, 16]);
    expect(totalRounds(16)).toBe(4);
    expect(totalRounds(4)).toBe(2);
  });
  it("names the rounds from the end", () => {
    expect([1, 2, 3, 4].map((r) => roundName(16, r))).toEqual(["Octavos de final", "Cuartos de final", "Semifinales", "Final"]);
    expect([1, 2].map((r) => roundName(4, r))).toEqual(["Semifinales", "Final"]);
  });
});

describe("drawBracket", () => {
  const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
  it("uses every entrant exactly once and is a real shuffle", () => {
    const pairs = drawBracket(mulberry32(7), ids);
    expect(pairs).toHaveLength(4);
    expect(pairs.flat().sort()).toEqual([...ids].sort());
    const orders = new Set<string>();
    for (let s = 1; s <= 30; s++) orders.add(JSON.stringify(drawBracket(mulberry32(s), ids)));
    expect(orders.size).toBeGreaterThan(20);
  });
  it("is deterministic for a seed and does not mutate its input", () => {
    const copy = [...ids];
    expect(drawBracket(mulberry32(3), ids)).toEqual(drawBracket(mulberry32(3), ids));
    expect(ids).toEqual(copy);
  });
});

describe("gladiators", () => {
  it("get stronger with level and named champions are a few levels above", () => {
    const low = gladiatorCombatant("A", 5, false);
    const high = gladiatorCombatant("B", 30, false);
    expect(high.atk).toBeGreaterThan(low.atk);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(gladiatorCombatant("C", 10, true).atk).toBeGreaterThan(gladiatorCombatant("C", 10, false).atk);
  });
  it("names never repeat a taken one and always fill the request", () => {
    const names = gladiatorNames(mulberry32(1), 20, new Set(["Brutus"]));
    expect(names).toHaveLength(20);
    expect(names).not.toContain("Brutus");
    expect(new Set(names).size).toBe(20);
  });
});

describe("prizes", () => {
  it("weapon prizes scale with level and carry a real stat, fruit prizes name the fruit, gold scales", () => {
    const w1 = choosePrize(mulberry32(2), "weapons", 6, []);
    const w2 = choosePrize(mulberry32(2), "weapons", 60, []);
    expect(w1.kind).toBe("weapon");
    expect(w2.weapon!.atkBonus).toBeGreaterThan(w1.weapon!.atkBonus);
    const f = choosePrize(mulberry32(2), "fruit", 20, ["Mera Mera no Mi", "Hie Hie no Mi"]);
    expect(f.kind).toBe("fruit");
    expect(["Mera Mera no Mi", "Hie Hie no Mi"]).toContain(f.fruitName);
    expect(f.label).toContain(f.fruitName!);
    expect(choosePrize(mulberry32(2), "gold", 40, []).berries!).toBeGreaterThan(choosePrize(mulberry32(2), "gold", 5, []).berries!);
  });
  it("falls back to gold when there is no fruit to give, and every kind is reachable", () => {
    const st = choosePrize(mulberry32(2), "styles", 20, []);
    expect(st.kind).toBe("style");
    expect(st.styleId).toBeTruthy();
    expect(st.label).toContain("manual");
    expect(choosePrize(mulberry32(2), "fruit", 20, []).kind).toBe("berries");
    const kinds = new Set<string>();
    for (let s = 1; s <= 60; s++) kinds.add(pickKind(mulberry32(s)));
    expect(kinds.size).toBe(4);
  });
});

describe("nextAction (the calendar)", () => {
  const t0 = 1_000_000_000_000;
  it("announces only once the interval has passed since the last one (or never had one)", () => {
    expect(nextAction({ status: null, lastTournamentAtMs: null }, t0)).toBe("announce");
    expect(nextAction({ status: "FINISHED", lastTournamentAtMs: t0 }, t0 + 1000)).toBe("none");
    expect(nextAction({ status: "FINISHED", lastTournamentAtMs: t0 }, t0 + TOURNAMENT_INTERVAL_MS)).toBe("announce");
  });
  it("starts at the announced time and resolves a round when its time is up", () => {
    expect(nextAction({ status: "ANNOUNCED", startsAtMs: t0 + 5000, lastTournamentAtMs: t0 }, t0)).toBe("none");
    expect(nextAction({ status: "ANNOUNCED", startsAtMs: t0 + 5000, lastTournamentAtMs: t0 }, t0 + 5000)).toBe("start");
    expect(nextAction({ status: "RUNNING", roundEndsAtMs: t0 + 900, lastTournamentAtMs: t0 }, t0 + 500)).toBe("none");
    expect(nextAction({ status: "RUNNING", roundEndsAtMs: t0 + 900, lastTournamentAtMs: t0 }, t0 + 900)).toBe("resolve_round");
  });
  it("never announces a second tournament while one is open", () => {
    expect(nextAction({ status: "RUNNING", roundEndsAtMs: t0 + 999_999_999, lastTournamentAtMs: null }, t0)).toBe("none");
  });
});

describe("canRegister", () => {
  const ok = { onDressrosa: true, alive: true, busy: false, status: "ANNOUNCED" as const, alreadyRegistered: false };
  it("allows a live character on Dressrosa while registration is open", () => {
    expect(canRegister(ok).ok).toBe(true);
  });
  it("refuses everyone else with a clear reason", () => {
    for (const bad of [{ status: "RUNNING" as const }, { status: null }, { onDressrosa: false }, { alive: false }, { busy: true }, { alreadyRegistered: true }]) {
      const r = canRegister({ ...ok, ...bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
    }
  });
});

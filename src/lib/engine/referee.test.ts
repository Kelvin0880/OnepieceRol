import { describe, expect, it } from "vitest";
import { MAX_HP_LOSS_FRACTION, MAX_STAMINA_LOSS, applyVerdict, parseRefereeVerdict, stubVerdict } from "./referee";

const NARR = "El rival bloquea con el antebrazo y responde con una patada baja que se acerca a tu rodilla.";
const good = (extra = "") => JSON.stringify({ narracion: NARR, cambios: [{ nombre: "Kirito", vida: 10, aguante: 5 }, { nombre: "Bandido", vida: 20, aguante: 8 }], ...(extra ? { x: extra } : {}) });

describe("parseRefereeVerdict", () => {
  it("reads a clean verdict", () => {
    const v = parseRefereeVerdict(good())!;
    expect(v.narration).toBe(NARR);
    expect(v.changes).toEqual([{ name: "Kirito", hp: 10, stamina: 5 }, { name: "Bandido", hp: 20, stamina: 8 }]);
  });
  it("digs the object out of fences and chatter", () => {
    expect(parseRefereeVerdict("Aquí tienes:\n```json\n" + good() + "\n```\nSuerte")).not.toBeNull();
  });
  it("survives braces and quotes inside the narration", () => {
    const raw = JSON.stringify({ narracion: 'Grita "¡Corta-Tormentas!" y {algo} se rompe en dos mientras el suelo tiembla.', cambios: [] });
    expect(parseRefereeVerdict(raw)?.narration).toContain("{algo}");
  });
  it("accepts english keys, negatives and floats safely", () => {
    const v = parseRefereeVerdict(JSON.stringify({ narration: NARR, changes: [{ name: "A", hp: -5, stamina: 3.6 }] }))!;
    expect(v.changes[0]).toEqual({ name: "A", hp: 0, stamina: 4 });
  });
  it("rejects junk, missing or too-short narration and broken JSON", () => {
    expect(parseRefereeVerdict("User Safety: safe")).toBeNull();
    expect(parseRefereeVerdict("{oops")).toBeNull();
    expect(parseRefereeVerdict(JSON.stringify({ narracion: "corto", cambios: [] }))).toBeNull();
    expect(parseRefereeVerdict(JSON.stringify({ cambios: [] }))).toBeNull();
    expect(parseRefereeVerdict("")).toBeNull();
  });
  it("ignores nameless or malformed changes", () => {
    const v = parseRefereeVerdict(JSON.stringify({ narracion: NARR, cambios: [null, 3, { vida: 5 }, { nombre: "  ", vida: 5 }, { nombre: "B", vida: 2 }] }))!;
    expect(v.changes).toEqual([{ name: "B", hp: 2, stamina: 0 }]);
  });
});

describe("applyVerdict", () => {
  const verdict = { narration: NARR, changes: [{ name: "kirito", hp: 30, stamina: 10 }, { name: "Bandido", hp: 500, stamina: 500 }] };
  it("matches names ignoring case and accents and subtracts", () => {
    const [k] = applyVerdict(verdict, [{ name: "Kirito", hp: 100, maxHp: 100, stamina: 80 }]);
    expect(k).toMatchObject({ hpLoss: 30, staminaLoss: 10, hpAfter: 70, staminaAfter: 70 });
    const [acc] = applyVerdict({ narration: NARR, changes: [{ name: "Ácido", hp: 4, stamina: 0 }] }, [{ name: "acido", hp: 10, maxHp: 10 }]);
    expect(acc.hpLoss).toBe(4);
    expect(acc.staminaAfter).toBeNull();
  });
  it("caps a single exchange at half the maximum life and a stamina ceiling", () => {
    const [b] = applyVerdict(verdict, [{ name: "Bandido", hp: 200, maxHp: 200, stamina: 100 }]);
    expect(b.hpLoss).toBe(200 * MAX_HP_LOSS_FRACTION);
    expect(b.staminaLoss).toBe(MAX_STAMINA_LOSS);
  });
  it("can finish someone already at half life or less, never below zero", () => {
    const [b] = applyVerdict({ narration: NARR, changes: [{ name: "Bandido", hp: 50, stamina: 0 }] }, [{ name: "Bandido", hp: 40, maxHp: 100 }]);
    expect(b).toMatchObject({ hpLoss: 40, hpAfter: 0 });
  });
  it("cannot kill a healthy fighter in one exchange", () => {
    const [b] = applyVerdict({ narration: NARR, changes: [{ name: "Bandido", hp: 100, stamina: 0 }] }, [{ name: "Bandido", hp: 100, maxHp: 100 }]);
    expect(b.hpAfter).toBe(50);
  });
  it("protects a fighter who has not been attacked yet", () => {
    const [k] = applyVerdict(verdict, [{ name: "Kirito", hp: 100, maxHp: 100, stamina: 80, protectedThisExchange: true }]);
    expect(k).toMatchObject({ hpLoss: 0, staminaLoss: 0, hpAfter: 100, staminaAfter: 80 });
  });
  it("adds several entries for the same fighter and leaves unmentioned ones untouched", () => {
    const v = { narration: NARR, changes: [{ name: "A", hp: 5, stamina: 1 }, { name: "A", hp: 6, stamina: 2 }] };
    const out = applyVerdict(v, [{ name: "A", hp: 50, maxHp: 50 }, { name: "B", hp: 50, maxHp: 50 }]);
    expect(out[0].hpLoss).toBe(11);
    expect(out[1]).toMatchObject({ hpLoss: 0, hpAfter: 50 });
  });
});

describe("stubVerdict (scripted checks only)", () => {
  const strong = { name: "Fuerte", side: "player" as const, maxHp: 100, sheet: "ataque 100, defensa 100, velocidad 50" };
  const weak = { name: "Debil", side: "enemy" as const, maxHp: 100, sheet: "ataque 5, defensa 5, velocidad 5" };
  it("the stronger side loses little and the weaker loses a lot", () => {
    const v = stubVerdict([strong, weak]);
    const s = v.changes.find((c) => c.name === "Fuerte")!;
    const w = v.changes.find((c) => c.name === "Debil")!;
    expect(w.hp).toBeGreaterThan(s.hp * 3);
    expect(parseRefereeVerdict(JSON.stringify({ narracion: v.narration, cambios: v.changes }))).not.toBeNull();
  });
  it("pairs the first two actors when nobody is an enemy (a duel)", () => {
    const v = stubVerdict([{ ...strong, side: "player" }, { ...weak, side: "player" }]);
    expect(v.changes.find((c) => c.name === "Debil")!.hp).toBeGreaterThan(v.changes.find((c) => c.name === "Fuerte")!.hp);
  });
});

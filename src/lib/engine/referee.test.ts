import { describe, expect, it } from "vitest";
import { MAX_HP_LOSS_FRACTION, MAX_STAMINA_LOSS, applyVerdict, parseRefereeVerdict, sanitizeVerdict, splitSentences, stubVerdict } from "./referee";

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

describe("three-part verdict", () => {
  it("assembles result, reaction and the rival's intention in that order", () => {
    const v = parseRefereeVerdict(JSON.stringify({ resultado: "El puñetazo pasó rozando tu costado sin tocarte.", reaccion_rival: "Rocco resopla, herido pero en pie.", intencion_rival: "Rocco intenta un gancho a tu mandíbula que, si conecta, te dejaría aturdido.", cambios: [] }))!;
    expect(v.narration.split("\n\n")).toHaveLength(3);
    expect(v.narration.endsWith("aturdido.")).toBe(true);
    expect(v.rivalIntent).toContain("intenta un gancho");
  });
  it("still accepts the single-field form", () => {
    expect(parseRefereeVerdict(JSON.stringify({ narracion: NARR, cambios: [] }))?.rivalIntent).toBeUndefined();
  });
});

describe("mano negra guard (sanitizeVerdict)", () => {
  const mk = (resultado: string, intent: string) => parseRefereeVerdict(JSON.stringify({ resultado, reaccion_rival: "Rocco se tambalea, herido pero sigue en pie ante ti.", intencion_rival: intent, cambios: [] }))!;

  it("the reported case: 'activo mi Haki de observación' does not become a dodge", () => {
    const v = mk("Rocco lanza un puñetazo cargado de Haki. El puñetazo conecta, pero logras esquivarlo por un estrecho margen. Tu Haki de Observación te muestra el golpe venir.", "Rocco intenta un cabezazo contra tu frente que, si conecta, te aturdiría.");
    const { verdict, report } = sanitizeVerdict(v, "Ok muchacho intenta atacarme\n-Activaria mi HAKI de observación-", "Rocco");
    expect(verdict.narration).not.toContain("logras esquivarlo");
    expect(verdict.narration).toContain("Tu Haki de Observación te muestra");
    expect(report.removed.some((s) => s.includes("logras esquivarlo"))).toBe(true);
  });
  it("keeps a dodge the player did write", () => {
    const v = mk("Rocco lanza un puñetazo. Logras esquivar por un palmo.", "Rocco intenta otro golpe que, si conecta, te haría retroceder.");
    const { verdict } = sanitizeVerdict(v, "Me agacho y esquivo hacia la izquierda", "Rocco");
    expect(verdict.narration).toContain("Logras esquivar por un palmo");
  });
  it("a rival attack written as landed is dropped from the intention", () => {
    const v = mk("El corte de Kirito se pierde en el aire, sin tocarlo.", "Rocco te golpea en el estómago. Rocco intenta después una patada baja que, si conecta, te derribaría.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).not.toContain("te golpea");
    expect(verdict.rivalIntent).toContain("intenta después una patada");
  });
  it("if the whole intention was a landed hit it is replaced by a safe hand-over", () => {
    const v = mk("El corte de Kirito se pierde en el aire sin tocarlo.", "Sientes el golpe en tu costado. El puñetazo conecta y te derriba.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco");
    expect(verdict.rivalIntent).toContain("Rocco se prepara para atacar de nuevo");
    expect(verdict.narration.endsWith(verdict.rivalIntent!)).toBe(true);
  });
  it("does not let the narration attack for the player", () => {
    const v = mk("Te lanzas contra él y cortas su hombro. El aire se rompe.", "Rocco intenta una patada que, si conecta, te haría retroceder.");
    const { verdict } = sanitizeVerdict(v, "-Lo miraría con desdén-", "Rocco");
    expect(verdict.narration).not.toContain("Te lanzas");
  });
  it("leaves clean verdicts untouched", () => {
    const v = mk("El puñetazo llega y te alcanza el costado con fuerza.", "Rocco intenta un gancho que, si conecta, te sacudiría.");
    const { verdict, report } = sanitizeVerdict(v, "Ok, intenta atacarme", "Rocco");
    expect(report.removed).toHaveLength(0);
    expect(verdict.narration).toBe(v.narration);
  });
  it("a sentence that opens with the player's name is the narrator acting for them", () => {
    const v = mk("Kirito saca su espada y la clava en el muelle. El puñetazo de Rocco pasa a un palmo de tu cara.", "Rocco intenta un gancho que, si conecta, te sacudiría.");
    const { verdict } = sanitizeVerdict(v, "Ataco con mi espada", "Rocco", "Kirito");
    expect(verdict.narration).not.toContain("Kirito saca");
    expect(verdict.narration).toContain("pasa a un palmo");
  });
  it("splits sentences without losing text", () => {
    expect(splitSentences("Uno. Dos! ¿Tres?").join(" ")).toBe("Uno. Dos! ¿Tres?");
  });
});

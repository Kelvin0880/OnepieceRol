import { describe, expect, it } from "vitest";
import { difficultyLabel, parseFateVerdict, parseMatchVerdict, parseOutcomeVerdict, stubFate, stubMatch, stubOutcome } from "./judge";

describe("parseOutcomeVerdict", () => {
  it("reads the four outcomes in Spanish and English, ignoring accents and case", () => {
    expect(parseOutcomeVerdict('{"resultado":"exito_total","motivo":"plan brillante"}')?.outcome).toBe("critical_success");
    expect(parseOutcomeVerdict('{"resultado":"Éxito"}')?.outcome).toBe("success");
    expect(parseOutcomeVerdict('{"resultado":"fallo"}')?.outcome).toBe("fail");
    expect(parseOutcomeVerdict('{"resultado":"FALLO GRAVE"}')?.outcome).toBe("critical_fail");
    expect(parseOutcomeVerdict('{"outcome":"success"}')?.outcome).toBe("success");
  });
  it("digs the JSON out of chatter and keeps a short reason", () => {
    const v = parseOutcomeVerdict('Claro:\n```json\n{"resultado":"fallo","motivo":"' + "x".repeat(900) + '"}\n```')!;
    expect(v.outcome).toBe("fail");
    expect(v.reason.length).toBe(400);
  });
  it("rejects anything else", () => {
    expect(parseOutcomeVerdict("User Safety: safe")).toBeNull();
    expect(parseOutcomeVerdict('{"resultado":"quizá"}')).toBeNull();
    expect(parseOutcomeVerdict("{oops")).toBeNull();
    expect(parseOutcomeVerdict("")).toBeNull();
  });
});

describe("parseFateVerdict", () => {
  it("reads death, capture and survival plus the fallen companions", () => {
    expect(parseFateVerdict('{"destino":"muerte","motivo":"lo remata"}')?.fate).toBe("death");
    expect(parseFateVerdict('{"destino":"Captura"}')?.fate).toBe("captured");
    const s = parseFateVerdict('{"destino":"sobrevive","companeros_caidos":["Jorge",3,"Ana"]}')!;
    expect(s.fate).toBe("survives");
    expect(s.companionsLost).toEqual(["Jorge", "Ana"]);
  });
  it("rejects unknown fates", () => {
    expect(parseFateVerdict('{"destino":"tal vez"}')).toBeNull();
    expect(parseFateVerdict("nada")).toBeNull();
  });
});

describe("parseMatchVerdict", () => {
  it("needs a clear winner", () => {
    expect(parseMatchVerdict('{"ganador":"A","motivo":"más fuerte"}')?.winner).toBe("a");
    expect(parseMatchVerdict('{"winner":"b"}')?.winner).toBe("b");
    expect(parseMatchVerdict('{"ganador":"empate"}')).toBeNull();
  });
});

describe("difficultyLabel", () => {
  it("bands", () => {
    expect(difficultyLabel(10)).toBe("fácil");
    expect(difficultyLabel(40)).toBe("media");
    expect(difficultyLabel(60)).toBe("difícil");
    expect(difficultyLabel(80)).toBe("muy difícil");
    expect(difficultyLabel(95)).toBe("extrema");
  });
});

describe("deterministic stand-ins", () => {
  it("outcome follows the margin", () => {
    expect(stubOutcome(100, 40)).toBe("critical_success");
    expect(stubOutcome(50, 40)).toBe("success");
    expect(stubOutcome(30, 40)).toBe("fail");
    expect(stubOutcome(0, 60)).toBe("critical_fail");
  });
  it("fate: deadly places kill the weak, the Government captures, the rest survive", () => {
    expect(stubFate({ islandDanger: 10, level: 5, durability: 5 })).toBe("death");
    expect(stubFate({ islandDanger: 2, level: 10, durability: 10, killerFaction: "MARINE" })).toBe("captured");
    expect(stubFate({ islandDanger: 2, level: 10, durability: 10, killerFaction: "PIRATE" })).toBe("survives");
  });
  it("match: the stronger wins, ties go to A", () => {
    expect(stubMatch({ level: 10, atk: 50, def: 50 }, { level: 10, atk: 20, def: 20 })).toBe("a");
    expect(stubMatch({ level: 1, atk: 5, def: 5 }, { level: 10, atk: 50, def: 50 })).toBe("b");
    expect(stubMatch({ level: 1, atk: 5, def: 5 }, { level: 1, atk: 5, def: 5 })).toBe("a");
  });
});

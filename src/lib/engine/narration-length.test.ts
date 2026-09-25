import { describe, it, expect } from "vitest";
import { planLength, currentActionBlock, countWords } from "./narration-length";

describe("planLength", () => {
  it("a one-line message gets a short reply", () => {
    const p = planLength("chat", "Bueno, ¿qué tenemos que hacer?");
    expect(p.label).toBe("breve");
    expect(p.maxWords).toBeLessThanOrEqual(120);
  });
  it("a long developed post earns a long reply", () => {
    const long = Array(200).fill("palabra").join(" ");
    const p = planLength("chat", long);
    expect(p.label).toBe("larga");
    expect(p.maxWords).toBeGreaterThanOrEqual(600);
    expect(p.maxWords).toBeGreaterThan(planLength("chat", "hola").maxWords);
  });
  it("fight rounds are never held back, even after a one-line move", () => {
    const long = Array(150).fill("golpe").join(" ");
    expect(planLength("combat_round", "ataco").maxWords).toBeGreaterThanOrEqual(550);
    expect(planLength("combat_round", long).maxWords).toBeGreaterThanOrEqual(650);
    expect(planLength("combat_end", "ataco").maxWords).toBeGreaterThanOrEqual(450);
  });
  it("token budget scales with the word budget", () => {
    expect(planLength("chat", "hola").maxTokens).toBeLessThan(planLength("chat", Array(100).fill("a").join(" ")).maxTokens);
  });
  it("the instruction asks for plain language and only long when needed", () => {
    const i = planLength("chat", "hola").instruction;
    expect(i).toMatch(/NUNCA te limites/);
    expect(i).toMatch(/nivel de detalle/);
  });
  it("counts words ignoring extra whitespace", () => {
    expect(countWords("  a   b \n c ")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("currentActionBlock", () => {
  it("quotes the current message and forbids embellishing it", () => {
    const b = currentActionBlock("Me voy solo");
    expect(b).toContain("Me voy solo");
    expect(b).toMatch(/no a mensajes anteriores/);
    expect(b).toMatch(/No le añadas/);
  });
});

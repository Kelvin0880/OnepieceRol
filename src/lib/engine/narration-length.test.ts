import { describe, it, expect } from "vitest";
import { planLength, currentActionBlock, countWords } from "./narration-length";

describe("planLength", () => {
  it("a one-line message gets a short reply", () => {
    const p = planLength("chat", "Bueno, ¿qué tenemos que hacer?");
    expect(p.label).toBe("breve");
    expect(p.maxWords).toBeLessThanOrEqual(90);
  });
  it("a long developed post earns more room, but never past 300 words", () => {
    const long = Array(200).fill("palabra").join(" ");
    const p = planLength("chat", long);
    expect(p.label).toBe("larga");
    expect(p.maxWords).toBeLessThanOrEqual(300);
    expect(p.maxWords).toBeGreaterThan(planLength("chat", "hola").maxWords);
  });
  it("fight rounds stay tight even when the player writes a lot, finishing blows get room", () => {
    const long = Array(150).fill("golpe").join(" ");
    expect(planLength("combat_round", long).maxWords).toBeLessThanOrEqual(130);
    expect(planLength("combat_end", "ataco").maxWords).toBeGreaterThanOrEqual(150);
  });
  it("token budget scales with the word budget", () => {
    expect(planLength("chat", "hola").maxTokens).toBeLessThan(planLength("chat", Array(100).fill("a").join(" ")).maxTokens);
  });
  it("the instruction asks for plain language and only long when needed", () => {
    const i = planLength("chat", "hola").instruction;
    expect(i).toMatch(/sencillo/);
    expect(i).toMatch(/Solo te alargas/);
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

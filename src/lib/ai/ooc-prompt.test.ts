import { describe, it, expect } from "vitest";
import { buildOocPrompt, parseOocReply, sanitizeProposal, appendNote, OocPromptContext } from "./ooc-prompt";

const ctx: OocPromptContext = {
  characterName: "Kirito", faction: "PIRATE", level: 2, hp: 80, maxHp: 100, stamina: 60, maxStamina: 100, islandName: "Pueblo Foosha", status: "ALIVE",
  tone: "balanced", notes: null, crewName: "Black Bulls", isCaptain: true, inParty: true, partyPact: null, hasPendingFight: false,
  checkpoints: 3, rollbacksLeft: 3, memorySummary: "Venció a un barbudo.", recentScene: ["[Jugador]: hola", "El tabernero sonríe."], history: [],
};

describe("buildOocPrompt", () => {
  it("gives the model the real state and the closed action list, and forbids changing outcomes", () => {
    const p = buildOocPrompt(ctx, "el narrador repite lo que digo");
    expect(p.user).toContain("Kirito");
    expect(p.user).toContain("Vida 80/100");
    expect(p.user).toContain("el narrador repite lo que digo");
    expect(p.user).toContain("Venció a un barbudo.");
    expect(p.system).toContain("rollback");
    expect(p.system).toContain("NO puedes");
    expect(p.system).toContain("JSON");
  });
});

describe("parseOocReply", () => {
  it("parses a reply with a valid proposal", () => {
    const r = parseOocReply('{"reply":"Puedo dejarlo así.","action":{"type":"set_tone","tone":"story"}}');
    expect(r.reply).toBe("Puedo dejarlo así.");
    expect(r.proposal).toEqual({ type: "set_tone", tone: "story" });
  });
  it("tolerates a fenced code block and surrounding chatter", () => {
    const r = parseOocReply('Claro:\n```json\n{"reply":"ok","action":{"type":"rollback"}}\n```');
    expect(r.proposal).toEqual({ type: "rollback" });
  });
  it("drops unknown or invalid actions but keeps the reply", () => {
    expect(parseOocReply('{"reply":"hola","action":{"type":"give_berries","amount":999999}}').proposal).toBeNull();
    expect(parseOocReply('{"reply":"hola","action":{"type":"set_tone","tone":"hard"}}').proposal).toBeNull();
    expect(parseOocReply('{"reply":"hola","action":{"type":"rename","name":"<b>"}}').proposal).toBeNull();
  });
  it("falls back to plain text when the model did not return JSON", () => {
    const r = parseOocReply("Lo siento, el narrador se equivocó.");
    expect(r.reply).toContain("se equivocó");
    expect(r.proposal).toBeNull();
  });
  it("never yields an empty reply", () => {
    expect(parseOocReply('{"action":null}').reply.length).toBeGreaterThan(0);
  });
});

describe("sanitizeProposal", () => {
  it("normalizes names and trims free text", () => {
    expect(sanitizeProposal({ type: "rename", name: "  Kaze   Luna " })).toEqual({ type: "rename", name: "Kaze Luna" });
    expect(sanitizeProposal({ type: "add_note", note: "  no repitas mi acción " })).toEqual({ type: "add_note", note: "no repitas mi acción" });
    expect(sanitizeProposal({ type: "set_pact", text: "" })).toBeNull();
    expect(sanitizeProposal(null)).toBeNull();
  });
});

describe("appendNote", () => {
  it("joins notes and caps the total length keeping the newest", () => {
    expect(appendNote(null, "a")).toBe("a");
    expect(appendNote("a", "b")).toBe("a | b");
    const long = appendNote("x".repeat(790), "NUEVA", 800);
    expect(long.length).toBeLessThanOrEqual(800);
    expect(long.endsWith("NUEVA")).toBe(true);
  });
});

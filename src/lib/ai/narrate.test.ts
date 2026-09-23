import { describe, it, expect } from "vitest";
import { isValidNarration } from "./narrate";

describe("isValidNarration", () => {
  it("accepts ordinary narrative prose", () => {
    expect(isValidNarration("Desenfundas tu espada mientras el bandido retrocede, sorprendido por tu velocidad.")).toBe(true);
  });

  it("rejects an empty or near-empty response", () => {
    expect(isValidNarration("")).toBe(false);
    expect(isValidNarration("   ")).toBe(false);
    expect(isValidNarration("Ok.")).toBe(false);
  });

  it("rejects a leaked moderation/safety-classifier artifact", () => {
    // Found live: a free-tier model's raw content was literally this string.
    expect(isValidNarration("User Safety: safe")).toBe(false);
    expect(isValidNarration("Safety: flagged for review")).toBe(false);
  });

  it("rejects a refusal instead of narration", () => {
    expect(isValidNarration("I cannot continue this story as requested.")).toBe(false);
    expect(isValidNarration("I'm sorry, but I can't help with that.")).toBe(false);
    expect(isValidNarration("As an AI, I don't have the ability to do that.")).toBe(false);
  });

  it("is case-insensitive when matching known bad prefixes", () => {
    expect(isValidNarration("USER SAFETY: SAFE")).toBe(false);
  });
});

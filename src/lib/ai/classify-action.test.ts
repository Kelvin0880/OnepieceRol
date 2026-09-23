import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyPlayerAction, ActionId, MIN_TACTIC_MODIFIER, MAX_TACTIC_MODIFIER } from "./classify-action";
import { AiUnavailableError } from "./openrouter-client";

const callOpenRouterMock = vi.fn();
vi.mock("./openrouter-client", async () => {
  const actual = await vi.importActual<typeof import("./openrouter-client")>("./openrouter-client");
  return { ...actual, callOpenRouter: (...args: unknown[]) => callOpenRouterMock(...args) };
});

beforeEach(() => {
  callOpenRouterMock.mockReset();
});

const nonCombatPhase: ActionId[] = ["narrate", "explore", "train", "rest", "travel"];
// A party member's shared-scene turn: same non-combat set, plus the option
// to explicitly step away from the group.
const partyScenePhase: ActionId[] = ["narrate", "explore", "train", "rest", "leave_party"];
// The very first fight-or-flee choice, and every subsequent round of an
// ongoing exchange, share this set — both now default to "engage" on real
// ambiguity, since the dice (not the classification) decide the outcome.
const threatPhase: ActionId[] = ["engage", "flee"];
// The one choice that stays genuinely strict: killing or sparing a beaten
// foe has no safe "keep going" default, unlike combat itself.
const mercyPhase: ActionId[] = ["mercy_spare", "mercy_finish"];

describe("classifyPlayerAction", () => {
  it("returns a model-picked action when it's in the valid set", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"explore"}');
    const result = await classifyPlayerAction("Me interno en la jungla a ver qué encuentro.", nonCombatPhase);
    expect(result).toEqual({ action: "explore", source: "ai", tacticModifier: 0 });
  });

  it("never trusts a model response outside the valid set, even if it insists twice", async () => {
    // Model hallucinates "engage" while we're not in a threat phase — rejected both
    // attempts, and since narrate is valid here, that's where it lands instead of "engage".
    callOpenRouterMock.mockResolvedValue('{"action":"engage"}');
    const result = await classifyPlayerAction("Ataco con mi katana.", nonCombatPhase);
    expect(result).toEqual({ action: "narrate", source: "ai", tacticModifier: 0 });
  });

  it("never trusts a model response outside the valid set during the mercy choice either", async () => {
    // Model hallucinates "rest" while deciding a beaten foe's fate — rejected,
    // and there's no safe default for this one, so it stays a genuine unclear no-op.
    callOpenRouterMock.mockResolvedValue('{"action":"rest"}');
    const result = await classifyPlayerAction("Me quedo quieto.", mercyPhase);
    expect(result).toEqual({ action: "unclear", source: "ai", tacticModifier: 0 });
  });

  it("treats a model-returned unclear as a real no-op during the mercy choice, without falling back to keywords", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("No sé qué hacer con él.", mercyPhase);
    expect(result).toEqual({ action: "unclear", source: "ai", tacticModifier: 0 });
  });

  it("falls through to the engage default (still via the AI path) when the model insists on unclear during combat", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("Ataco con mi katana.", threatPhase);
    // Combat already committed the player to a fight — real ambiguity after
    // two genuine model attempts defaults to "keep fighting" rather than
    // stalling the exchange, but it's still the classifier's own default
    // logic (source: "ai"), never a silent reroute through the keyword path.
    // No tactic info is available on a defaulted read, so it's neutral (0).
    expect(result).toEqual({ action: "engage", source: "ai", tacticModifier: 0 });
  });

  it("treats malformed JSON from the model as unclear per attempt, then applies the same combat default", async () => {
    callOpenRouterMock.mockResolvedValue("not json at all");
    const result = await classifyPlayerAction("Ataco con mi katana.", threatPhase);
    expect(result).toEqual({ action: "engage", source: "ai", tacticModifier: 0 });
  });

  it("treats malformed JSON from the model as a real unclear no-op during the mercy choice", async () => {
    callOpenRouterMock.mockResolvedValue("not json at all");
    const result = await classifyPlayerAction("No sé.", mercyPhase);
    expect(result).toEqual({ action: "unclear", source: "ai", tacticModifier: 0 });
  });

  it("falls back to keyword matching only when the AI call itself fails", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Ataco con todo lo que tengo.", threatPhase);
    expect(result).toEqual({ action: "engage", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback defaults to narrate outside combat instead of blocking the player", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    // "ataco" would match "engage", but engage isn't valid outside a threat phase —
    // narrate is the safe catch-all (pure roleplay, no engine call), not a real no-op.
    const result = await classifyPlayerAction("Ataco a todo el mundo.", nonCombatPhase);
    expect(result).toEqual({ action: "narrate", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback resolves free-roam roleplay text (no keyword match at all) as narrate", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Estaría mirando un bar, y entraría a ver si alguna chica quiere conmigo.", nonCombatPhase);
    expect(result).toEqual({ action: "narrate", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback still recognizes an explicit decisive/risky commitment as explore, not narrate", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Me interno en la jungla a explorar a fondo, pase lo que pase.", nonCombatPhase);
    expect(result).toEqual({ action: "explore", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback defaults an ongoing fight to engage even with no clear attack keyword", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Sigo presionando sin dejarle respirar.", threatPhase);
    expect(result).toEqual({ action: "engage", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback still has no catch-all during the real binary mercy choice", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Me quedo pensando qué hacer.", mercyPhase);
    expect(result).toEqual({ action: "unclear", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("keyword fallback recognizes flee phrasing even during an ongoing fight", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("¡Huyo de aquí ahora mismo!", threatPhase);
    expect(result).toEqual({ action: "flee", source: "keyword_fallback", tacticModifier: 0 });
  });

  it("retries once when the first attempt is unclear, and uses a clear second attempt", async () => {
    callOpenRouterMock.mockResolvedValueOnce('{"action":"unclear"}').mockResolvedValueOnce('{"action":"narrate"}');
    const result = await classifyPlayerAction("Camino por el muelle.", nonCombatPhase);
    expect(result).toEqual({ action: "narrate", source: "ai", tacticModifier: 0 });
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });

  it("defaults to narrate after two unclear AI attempts, since narrate is valid outside combat", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("???", nonCombatPhase);
    expect(result).toEqual({ action: "narrate", source: "ai", tacticModifier: 0 });
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });

  it("gives up as a real unclear no-op after two attempts during the mercy choice (no safe default for it)", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("???", mercyPhase);
    expect(result).toEqual({ action: "unclear", source: "ai", tacticModifier: 0 });
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });

  it("returns unclear immediately without calling the network when no actions are valid", async () => {
    const result = await classifyPlayerAction("cualquier cosa", []);
    expect(result).toEqual({ action: "unclear", source: "ai", tacticModifier: 0 });
    expect(callOpenRouterMock).not.toHaveBeenCalled();
  });

  describe("leave_party (only offered while sharing a live party scene)", () => {
    it("returns leave_party when the model picks it and it's in the valid set", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"leave_party"}');
      const result = await classifyPlayerAction("Me bajo del barco y me voy solo a mirar el mercado.", partyScenePhase);
      expect(result).toEqual({ action: "leave_party", source: "ai", tacticModifier: 0 });
    });

    it("never returns leave_party when it isn't in the valid set (solo play, no active party)", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"leave_party"}');
      const result = await classifyPlayerAction("Me separo del grupo.", nonCombatPhase);
      expect(result).toEqual({ action: "narrate", source: "ai", tacticModifier: 0 });
    });

    it("keyword fallback recognizes explicit separation phrasing", async () => {
      callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
      const result = await classifyPlayerAction("Me separo del grupo y voy por mi cuenta.", partyScenePhase);
      expect(result).toEqual({ action: "leave_party", source: "keyword_fallback", tacticModifier: 0 });
    });

    it("keyword fallback still defaults ordinary roleplay text to narrate, not leave_party", async () => {
      callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
      const result = await classifyPlayerAction("Pido una cerveza y me siento en la barra.", partyScenePhase);
      expect(result).toEqual({ action: "narrate", source: "keyword_fallback", tacticModifier: 0 });
    });
  });

  describe("tactic_modifier (merged into the same classification call, not a separate AI call)", () => {
    it("carries a valid in-range tactic_modifier through when action is engage", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"engage","tactic_modifier":12}');
      const result = await classifyPlayerAction("Aprovecho que es torpe y lo desequilibro con una finta.", threatPhase);
      expect(result).toEqual({ action: "engage", source: "ai", tacticModifier: 12 });
    });

    it("clamps a tactic_modifier above the maximum", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"engage","tactic_modifier":500}');
      const result = await classifyPlayerAction("Un movimiento genial.", threatPhase);
      expect(result.tacticModifier).toBe(MAX_TACTIC_MODIFIER);
    });

    it("clamps a tactic_modifier below the minimum", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"engage","tactic_modifier":-500}');
      const result = await classifyPlayerAction("Cierro los ojos y ataco al azar.", threatPhase);
      expect(result.tacticModifier).toBe(MIN_TACTIC_MODIFIER);
    });

    it("ignores a tactic_modifier when the action is flee, not engage", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"flee","tactic_modifier":15}');
      const result = await classifyPlayerAction("¡Corro!", threatPhase);
      expect(result).toEqual({ action: "flee", source: "ai", tacticModifier: 0 });
    });

    it("defaults to 0 when tactic_modifier is missing from an engage response", async () => {
      callOpenRouterMock.mockResolvedValue('{"action":"engage"}');
      const result = await classifyPlayerAction("Ataco.", threatPhase);
      expect(result).toEqual({ action: "engage", source: "ai", tacticModifier: 0 });
    });
  });
});

describe("sneak (Poneglyph infiltration)", () => {
  const withSneak: ActionId[] = ["narrate", "explore", "attack", "train", "rest", "sneak"];

  it("accepts sneak only when it is offered, carrying a clamped tactic modifier", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"sneak","tactic_modifier":99}');
    const result = await classifyPlayerAction("Me cuelo por los conductos hasta el Poneglifo sin ser visto.", withSneak);
    expect(result.action).toBe("sneak");
    expect(result.tacticModifier).toBe(MAX_TACTIC_MODIFIER);
  });

  it("rejects sneak when the island has no Poneglyph to sneak to", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"sneak"}');
    const result = await classifyPlayerAction("Me cuelo sin ser visto.", nonCombatPhase);
    expect(result.action).toBe("narrate");
  });

  it("the outage keyword fallback recognises an infiltration", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("down"));
    const result = await classifyPlayerAction("Me infiltro a escondidas hacia la bóveda.", withSneak);
    expect(result.action).toBe("sneak");
    expect(result.source).toBe("keyword_fallback");
  });
});

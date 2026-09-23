import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyPlayerAction, ActionId } from "./classify-action";
import { AiUnavailableError } from "./openrouter-client";

const callOpenRouterMock = vi.fn();
vi.mock("./openrouter-client", async () => {
  const actual = await vi.importActual<typeof import("./openrouter-client")>("./openrouter-client");
  return { ...actual, callOpenRouter: (...args: unknown[]) => callOpenRouterMock(...args) };
});

beforeEach(() => {
  callOpenRouterMock.mockReset();
});

const explorePhase: ActionId[] = ["explore", "train", "rest", "travel"];
const threatPhase: ActionId[] = ["engage", "flee"];

describe("classifyPlayerAction", () => {
  it("returns a model-picked action when it's in the valid set", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"explore"}');
    const result = await classifyPlayerAction("Voy a mirar por los alrededores.", explorePhase);
    expect(result).toEqual({ action: "explore", source: "ai" });
  });

  it("treats a model response outside the valid set as unclear, never trusting it blindly", async () => {
    // Model hallucinates "engage" while we're not in a threat phase.
    callOpenRouterMock.mockResolvedValue('{"action":"engage"}');
    const result = await classifyPlayerAction("Ataco con mi katana.", explorePhase);
    expect(result).toEqual({ action: "unclear", source: "ai" });
  });

  it("treats a model-returned unclear as a real no-op, without falling back to keywords", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("Ataco con mi katana.", threatPhase);
    // Even though "ataco" would keyword-match "engage", the model saw the text and
    // explicitly said unclear — that must NOT be silently overridden by keywords.
    expect(result).toEqual({ action: "unclear", source: "ai" });
  });

  it("treats malformed JSON from the model as unclear, not a crash or a keyword fallback", async () => {
    callOpenRouterMock.mockResolvedValue("not json at all");
    const result = await classifyPlayerAction("Ataco con mi katana.", threatPhase);
    expect(result).toEqual({ action: "unclear", source: "ai" });
  });

  it("falls back to keyword matching only when the AI call itself fails", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("Ataco con todo lo que tengo.", threatPhase);
    expect(result).toEqual({ action: "engage", source: "keyword_fallback" });
  });

  it("keyword fallback still respects the valid-action set for this turn", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    // "ataco" would match "engage", but engage isn't valid outside a threat phase.
    const result = await classifyPlayerAction("Ataco a todo el mundo.", explorePhase);
    expect(result).toEqual({ action: "unclear", source: "keyword_fallback" });
  });

  it("keyword fallback recognizes flee phrasing", async () => {
    callOpenRouterMock.mockRejectedValue(new AiUnavailableError("all models down"));
    const result = await classifyPlayerAction("¡Huyo de aquí ahora mismo!", threatPhase);
    expect(result).toEqual({ action: "flee", source: "keyword_fallback" });
  });

  it("retries once when the first attempt is unclear, and uses a clear second attempt", async () => {
    callOpenRouterMock.mockResolvedValueOnce('{"action":"unclear"}').mockResolvedValueOnce('{"action":"explore"}');
    const result = await classifyPlayerAction("Camino por el muelle.", explorePhase);
    expect(result).toEqual({ action: "explore", source: "ai" });
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });

  it("gives up as unclear only after two real attempts", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"unclear"}');
    const result = await classifyPlayerAction("???", explorePhase);
    expect(result).toEqual({ action: "unclear", source: "ai" });
    expect(callOpenRouterMock).toHaveBeenCalledTimes(2);
  });

  it("returns unclear immediately without calling the network when no actions are valid", async () => {
    const result = await classifyPlayerAction("cualquier cosa", []);
    expect(result).toEqual({ action: "unclear", source: "ai" });
    expect(callOpenRouterMock).not.toHaveBeenCalled();
  });
});

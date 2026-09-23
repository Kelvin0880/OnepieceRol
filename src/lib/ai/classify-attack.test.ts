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

const freeRoam: ActionId[] = ["narrate", "explore", "attack", "train", "rest"];

// The exact failure that motivated this: an attack on a bar patron was read as
// "explore" and answered with an unrelated random encounter.
describe("attack classification", () => {
  it("returns the target, tier, technique and tactic the model extracted", async () => {
    callOpenRouterMock.mockResolvedValue(
      '{"action":"attack","target":"el hombre de la gorra y el parche","target_tier":"average","technique":"armament","tactic_modifier":8}'
    );
    const r = await classifyPlayerAction("saco mi katana y le corto el pecho", freeRoam);
    expect(r).toMatchObject({ action: "attack", target: "el hombre de la gorra y el parche", targetTier: "average", technique: "armament", tacticModifier: 8, source: "ai" });
  });

  it("ignores invalid tier/technique values instead of trusting them", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"attack","target":"un guardia","target_tier":"godlike","technique":"nuke"}');
    const r = await classifyPlayerAction("ataco al guardia", freeRoam);
    expect(r.action).toBe("attack");
    expect(r.targetTier).toBeUndefined();
    expect(r.technique).toBeUndefined();
  });

  it("does not offer attack where it is not a valid action", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"attack","target":"x"}');
    const r = await classifyPlayerAction("ataco", ["narrate", "rest"]);
    expect(r.action).toBe("narrate");
  });

  it("passes the last narrator message to the model so it can resolve who the target is", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"attack","target":"el viejo marinero"}');
    await classifyPlayerAction("le pego al primero que se me acerque", freeRoam, { sceneContext: "Un viejo marinero se acerca a ti." });
    const userPrompt = callOpenRouterMock.mock.calls[0][1] as string;
    expect(userPrompt).toContain("Un viejo marinero se acerca a ti.");
  });

  it("the keyword fallback (AI outage only) still recognises an unmistakable attack", async () => {
    callOpenRouterMock.mockImplementation(async () => {
      throw new AiUnavailableError("down");
    });
    const r = await classifyPlayerAction("desenfundo mi katana y ataco", freeRoam);
    expect(r).toMatchObject({ action: "attack", source: "keyword_fallback" });
  });

  it("a purely verbal threat stays roleplay", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"narrate"}');
    const r = await classifyPlayerAction("Te aviso que un día voy a conquistar este mundo, jajaja", freeRoam);
    expect(r.action).toBe("narrate");
  });

  it("extracts a train focus", async () => {
    callOpenRouterMock.mockResolvedValue('{"action":"train","focus":"fruit"}');
    const r = await classifyPlayerAction("practico con los poderes de mi fruta", freeRoam);
    expect(r).toMatchObject({ action: "train", trainFocus: "fruit" });
  });
});

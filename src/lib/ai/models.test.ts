import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEY = "OPENROUTER_MODELS";

describe("OPENROUTER_MODELS", () => {
  const originalValue = process.env[ENV_KEY];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = originalValue;
  });

  it("falls back to a non-empty default list when unset", async () => {
    delete process.env[ENV_KEY];
    const { OPENROUTER_MODELS } = await import("./models");
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0);
  });

  it("parses a comma-separated env override", async () => {
    process.env[ENV_KEY] = "model-a,model-b, model-c ";
    const { OPENROUTER_MODELS } = await import("./models");
    expect(OPENROUTER_MODELS).toEqual(["model-a", "model-b", "model-c"]);
  });

  it("falls back to the default list when the env var is empty", async () => {
    process.env[ENV_KEY] = "";
    const { OPENROUTER_MODELS } = await import("./models");
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0);
  });

  it("falls back to the default list when the env var is only whitespace/commas", async () => {
    process.env[ENV_KEY] = " , , ";
    const { OPENROUTER_MODELS } = await import("./models");
    expect(OPENROUTER_MODELS.length).toBeGreaterThan(0);
  });
});

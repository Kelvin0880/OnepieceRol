import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callOpenRouter, AiUnavailableError } from "./openrouter-client";

const ORIGINAL_ENV = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
});

afterEach(() => {
  process.env.OPENROUTER_API_KEY = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

function okResponse(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) } as Response;
}

function failResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as Response;
}

describe("callOpenRouter", () => {
  it("returns the first successful model's content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse("hola"));
    vi.stubGlobal("fetch", fetchMock);
    const text = await callOpenRouter("sys", "user", { models: ["model-a"] });
    expect(text).toBe("hola");
  });

  it("falls through to the next model on failure", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(failResponse(429)).mockResolvedValueOnce(okResponse("segundo modelo"));
    vi.stubGlobal("fetch", fetchMock);
    const text = await callOpenRouter("sys", "user", { models: ["model-a", "model-b"] });
    expect(text).toBe("segundo modelo");
  });

  it("throws AiUnavailableError listing every model's failure once all fail", async () => {
    const fetchMock = vi.fn().mockResolvedValue(failResponse(429));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callOpenRouter("sys", "user", { models: ["model-a", "model-b"] })).rejects.toThrow(AiUnavailableError);
    try {
      await callOpenRouter("sys", "user", { models: ["model-a", "model-b"] });
    } catch (err) {
      expect((err as Error).message).toContain("model-a");
      expect((err as Error).message).toContain("model-b");
    }
  });

  // Found live (2026-09-23): several models timing out in a row on the same
  // request meant the player waited models.length * timeoutMs before seeing
  // any response. A fixed overall budget (2x the per-model timeout, see
  // openrouter-client.ts) means a long enough run of slow models gets
  // skipped outright instead of each burning a full fresh timeout.
  it("skips remaining models once the overall time budget is exhausted", async () => {
    let calls = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      calls++;
      // Simulate a hang that only resolves once the caller's own AbortController fires.
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("This operation was aborted")));
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const start = Date.now();
    await expect(
      callOpenRouter("sys", "user", { models: ["model-a", "model-b", "model-c", "model-d", "model-e"], timeoutMs: 100 })
    ).rejects.toThrow(AiUnavailableError);
    const elapsed = Date.now() - start;

    // Budget is 2x timeoutMs (200ms here) — well under 5 * 100ms = 500ms if every model burned its full timeout.
    expect(elapsed).toBeLessThan(400);
    expect(calls).toBeLessThan(5);
  }, 2000);
});

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
  // any response. The first two models are raced in parallel (one timeoutMs),
  // and only if both fail does the rest of the list get tried sequentially
  // against one more shared timeoutMs budget — so a long enough run of slow
  // models still gets skipped outright instead of each burning a full fresh
  // timeout.
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

    // Race stage (~100ms) + at most one more sequential attempt (~100ms) before the budget runs out.
    expect(elapsed).toBeLessThan(400);
    expect(calls).toBeLessThan(5);
  }, 2000);

  // The actual bug this session, found live twice in a row: strictly
  // sequential fallback meant a hanging first model fully blocked the
  // second (the reliable paid one) from even starting — so having it in
  // the list didn't help when the free router in front of it hung.
  it("races the first two models so a hanging one doesn't block a fast one from succeeding", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = init.body as string;
      if (body.includes("model-a")) {
        // Never resolves on its own — only rejects if aborted.
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      }
      return okResponse("respuesta rápida");
    });
    vi.stubGlobal("fetch", fetchMock);

    const start = Date.now();
    const text = await callOpenRouter("sys", "user", { models: ["model-a", "model-b"], timeoutMs: 5000 });
    const elapsed = Date.now() - start;

    expect(text).toBe("respuesta rápida");
    expect(elapsed).toBeLessThan(500); // nowhere near model-a's 5s timeout
  });
});

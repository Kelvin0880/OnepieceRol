import { describe, expect, it, vi } from "vitest";
import { wakeServer } from "./wake";

const ok = () => Promise.resolve(new Response("{}", { status: 200 }));

describe("wakeServer", () => {
  it("is ready when the CORS ping answers", async () => {
    const fetchImpl = vi.fn((_url: string, _init?: RequestInit) => ok());
    await expect(wakeServer({ fetchImpl })).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ mode: "cors" });
  });

  it("falls back to a no-cors knock when the ping is blocked", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => (init?.mode === "cors" ? Promise.reject(new TypeError("Failed to fetch")) : ok()));
    await expect(wakeServer({ fetchImpl })).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ mode: "no-cors" });
  });

  it("also knocks when the ping route answers with an error status", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => (init?.mode === "cors" ? Promise.resolve(new Response("", { status: 404 })) : ok()));
    await expect(wakeServer({ fetchImpl })).resolves.toBe("ready");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up as unknown when nothing answers", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError("offline")));
    await expect(wakeServer({ fetchImpl })).resolves.toBe("unknown");
  });

  it("gives up as unknown after the timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expect(wakeServer({ fetchImpl, timeoutMs: 20 })).resolves.toBe("unknown");
  });
});

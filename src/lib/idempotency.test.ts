import { describe, it, expect, beforeEach } from "vitest";
import { runOncePerCharacter, ActionInFlightError, _resetIdempotencyForTests } from "./idempotency";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  _resetIdempotencyForTests();
});

describe("runOncePerCharacter", () => {
  it("runs the action and returns its result", async () => {
    expect(await runOncePerCharacter("c1", "req-00001", async () => 42)).toBe(42);
  });

  it("a retry with the same requestId while running joins the same call (runs once)", async () => {
    const d = deferred<string>();
    let calls = 0;
    const first = runOncePerCharacter("c1", "req-00001", () => {
      calls++;
      return d.promise;
    });
    const retry = runOncePerCharacter("c1", "req-00001", async () => {
      calls++;
      return "second";
    });
    d.resolve("done");
    expect(await first).toBe("done");
    expect(await retry).toBe("done");
    expect(calls).toBe(1);
  });

  it("a retry after success returns the cached result without re-running", async () => {
    let calls = 0;
    const run = () => runOncePerCharacter("c1", "req-00001", async () => ++calls);
    expect(await run()).toBe(1);
    expect(await run()).toBe(1);
    expect(calls).toBe(1);
  });

  it("refuses a different request while one is still running", async () => {
    const d = deferred<number>();
    const first = runOncePerCharacter("c1", "req-00001", () => d.promise);
    await expect(runOncePerCharacter("c1", "req-00002", async () => 1)).rejects.toBeInstanceOf(ActionInFlightError);
    d.resolve(1);
    await first;
  });

  it("different characters never block each other", async () => {
    const d = deferred<number>();
    const a = runOncePerCharacter("c1", "req-00001", () => d.promise);
    expect(await runOncePerCharacter("c2", "req-00002", async () => 7)).toBe(7);
    d.resolve(1);
    await a;
  });

  it("failures are not cached and release the lock so the player can retry", async () => {
    await expect(runOncePerCharacter("c1", "req-00001", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await runOncePerCharacter("c1", "req-00001", async () => "ok")).toBe("ok");
  });

  it("cached results expire", async () => {
    let t = 0;
    let calls = 0;
    const run = () => runOncePerCharacter("c1", "req-00001", async () => ++calls, () => t);
    expect(await run()).toBe(1);
    t = 11 * 60 * 1000;
    expect(await run()).toBe(2);
  });
});

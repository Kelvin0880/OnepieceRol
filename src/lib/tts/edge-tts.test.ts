import { describe, it, expect, vi, beforeEach } from "vitest";

const synthesizeMock = vi.fn();

vi.mock("edge-tts-universal", () => ({
  EdgeTTS: class {
    synthesize() {
      return synthesizeMock();
    }
  },
}));

import { synthesizeNarration, EdgeTtsUnavailableError, resetCircuitForTest } from "./edge-tts";

function audioOf(bytes: number[]) {
  return { audio: { arrayBuffer: async () => new Uint8Array(bytes).buffer } };
}

beforeEach(() => {
  synthesizeMock.mockReset();
  resetCircuitForTest();
});

describe("synthesizeNarration", () => {
  it("returns the synthesized audio bytes", async () => {
    synthesizeMock.mockResolvedValue(audioOf([1, 2, 3]));
    const buf = await synthesizeNarration("Hola");
    expect(Array.from(buf)).toEqual([1, 2, 3]);
  });

  it("wraps a failure in EdgeTtsUnavailableError", async () => {
    synthesizeMock.mockRejectedValue(new Error("boom"));
    await expect(synthesizeNarration("Hola")).rejects.toThrow(EdgeTtsUnavailableError);
  });

  it("treats empty audio the same as a real failure", async () => {
    synthesizeMock.mockResolvedValue(audioOf([]));
    await expect(synthesizeNarration("Hola")).rejects.toThrow(EdgeTtsUnavailableError);
  });

  // The real risk this guards against: edge-tts is Microsoft's unofficial "Read aloud" service, not a stable
  // API — if it starts failing outright (blocked, protocol changed), every click must fail fast instead of
  // piling up timed-out requests against our own server.
  it("opens the circuit after repeated failures and stops calling the library at all", async () => {
    synthesizeMock.mockRejectedValue(new Error("boom"));
    for (let i = 0; i < 4; i++) await expect(synthesizeNarration("x")).rejects.toThrow(EdgeTtsUnavailableError);
    const callsBeforeOpen = synthesizeMock.mock.calls.length;
    await expect(synthesizeNarration("x")).rejects.toThrow(EdgeTtsUnavailableError);
    expect(synthesizeMock.mock.calls.length).toBe(callsBeforeOpen); // short-circuited, never even tried this time
  });

  it("a success resets the failure count, so an isolated bad run alone never opens the circuit", async () => {
    synthesizeMock.mockRejectedValue(new Error("boom"));
    for (let i = 0; i < 3; i++) await expect(synthesizeNarration("x")).rejects.toThrow(EdgeTtsUnavailableError);
    synthesizeMock.mockResolvedValueOnce(audioOf([9]));
    await synthesizeNarration("x");

    synthesizeMock.mockRejectedValue(new Error("boom"));
    for (let i = 0; i < 3; i++) await expect(synthesizeNarration("x")).rejects.toThrow(EdgeTtsUnavailableError);
    const callsSoFar = synthesizeMock.mock.calls.length;
    synthesizeMock.mockResolvedValueOnce(audioOf([1]));
    const buf = await synthesizeNarration("x"); // still below the threshold, so the circuit never opened
    expect(buf).toBeInstanceOf(Buffer);
    expect(synthesizeMock.mock.calls.length).toBe(callsSoFar + 1);
  });
});

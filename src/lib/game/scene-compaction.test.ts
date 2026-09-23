import { describe, it, expect } from "vitest";
import { shouldCompact, KEEP_RECENT_MESSAGES, MIN_COMPACTION_BATCH } from "./scene-compaction";

describe("shouldCompact", () => {
  it("waits until a worthwhile batch of older messages has piled up beyond the recent window", () => {
    expect(shouldCompact(0)).toBe(false);
    expect(shouldCompact(KEEP_RECENT_MESSAGES + MIN_COMPACTION_BATCH - 1)).toBe(false);
    expect(shouldCompact(KEEP_RECENT_MESSAGES + MIN_COMPACTION_BATCH)).toBe(true);
  });
});

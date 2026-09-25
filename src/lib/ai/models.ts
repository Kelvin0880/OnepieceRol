/**
 * PAID models only (owner's decision, 2026-09-25): the free router and free models gave wildly uneven quality and are
 * never used. DeepSeek answers first (better roleplay and instruction-following per cent); gpt-4o-mini joins as a
 * hedged backup when it is slow or fails (see hedgeDelayMs). This list is the only place that knows model names.
 */
const DEFAULT_MODELS = ["deepseek/deepseek-chat", "openai/gpt-4o-mini"];

export const OPENROUTER_MODELS: string[] = (() => {
  const fromEnv = process.env.OPENROUTER_MODELS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
})();

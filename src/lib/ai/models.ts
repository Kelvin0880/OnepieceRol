/**
 * Free-tier availability on OpenRouter shifts over time — this list is the
 * only place that should ever know a concrete model name. Everything else
 * (openrouter-client.ts) just walks the array on failure.
 *
 * `openrouter/free` goes first: it's OpenRouter's own router that picks a
 * free model at random from whatever's currently available, so it already
 * does most of the fallback work for us at zero cost.
 *
 * `openai/gpt-4o-mini` goes SECOND, not last — it used to be last, on the
 * reasoning that a paid model should only be reached as a rare last resort.
 * Found live (2026-09-23) why that backfired once `callOpenRouter` gained
 * an overall time budget for the whole fallback chain (instead of a full
 * fresh timeout per model): with 3 free named models still ahead of it,
 * a bad stretch where those are all slow/overloaded can burn the *entire*
 * budget before gpt-4o-mini is even attempted — logged as "skipped,
 * narration time budget exhausted" even though the account has ample paid
 * credit sitting unused. Putting it 2nd means it's one of only two attempts
 * that reliably get a real timeout slice; the 3 free named models stay as
 * extra (free) tries afterward if it also somehow fails.
 */
/**
 * Paid model FIRST (2026-09-24): the free router hands each call to a random
 * free model, so quality swung wildly turn to turn (answering the wrong
 * message, ignoring the action). gpt-4o-mini costs fractions of a cent a
 * turn and follows instructions reliably; the free models are only the
 * backup that joins when it is slow (see hedgeDelayMs) or fails.
 */
const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

export const OPENROUTER_MODELS: string[] = (() => {
  const fromEnv = process.env.OPENROUTER_MODELS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
})();

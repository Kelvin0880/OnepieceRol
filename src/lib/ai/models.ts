/**
 * Free-tier availability on OpenRouter shifts over time — this list is the
 * only place that should ever know a concrete model name. Everything else
 * (openrouter-client.ts) just walks the array on failure.
 *
 * `openrouter/free` goes first: it's OpenRouter's own router that picks a
 * free model at random from whatever's currently available, so it already
 * does most of the fallback work for us. The rest are named backups in
 * case the router itself is unavailable.
 *
 * `openai/gpt-4o-mini` is last on purpose: it's a paid model (fractions of
 * a cent per narration call), only ever reached if all 4 free models fail
 * at once — found live (2026-09-23) that free-tier `:free` models share
 * OpenRouter-wide capacity and do occasionally 429/timeout together even
 * with a paid account well under its daily quota. This turns that rare
 * event into a slightly-paid response instead of the dry static fallback.
 */
const DEFAULT_MODELS = [
  "openrouter/free",
  "google/gemma-4-31b-it:free",
  "qwen/qwen3.8-27b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-4o-mini",
];

export const OPENROUTER_MODELS: string[] = (() => {
  const fromEnv = process.env.OPENROUTER_MODELS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
})();

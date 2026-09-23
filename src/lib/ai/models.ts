/**
 * Free-tier availability on OpenRouter shifts over time — this list is the
 * only place that should ever know a concrete model name. Everything else
 * (openrouter-client.ts) just walks the array on failure.
 *
 * `openrouter/free` goes first: it's OpenRouter's own router that picks a
 * free model at random from whatever's currently available, so it already
 * does most of the fallback work for us. The rest are named backups in
 * case the router itself is unavailable.
 */
const DEFAULT_MODELS = ["openrouter/free", "google/gemma-4-31b-it:free", "qwen/qwen3.8-27b:free", "nvidia/nemotron-3-super-120b-a12b:free"];

export const OPENROUTER_MODELS: string[] = (() => {
  const fromEnv = process.env.OPENROUTER_MODELS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODELS;
})();

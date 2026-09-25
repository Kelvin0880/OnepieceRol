/**
 * Thin wrapper around OpenRouter's OpenAI-compatible chat completions
 * endpoint. No SDK — it's a plain REST call, matching this project's
 * minimal-dependency convention (custom auth, no NextAuth, etc.).
 */
export class AiUnavailableError extends Error {}

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface CallOpenRouterOptions {
  models: string[];
  timeoutMs?: number;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional sanity check on the model's raw content — e.g. rejecting a
   * moderation/safety-classifier artifact a free-tier model occasionally
   * returns instead of following the prompt (found live: one model's
   * "response" was literally the string "User Safety: safe"). A failed
   * check is treated exactly like a non-2xx response: move to the next
   * model in the fallback list, never surface the bad content.
   */
  validate?: (text: string) => boolean;
  /** The preferred model gets this head start before the backup is also fired; a failure of the preferred one starts the backup at once. 0 = fire both together. */
  hedgeDelayMs?: number;
}

/** Quality beats speed: the first (paid) model normally answers alone, the free ones only join when it is slow or failing. */
const DEFAULT_HEDGE_DELAY_MS = 40_000; // long fight answers take 15-30 s: the backup must only join when the main model is truly stuck

/** Accepts a caller-supplied AbortController (instead of always making its own) so a race between two calls can cancel the loser. */
async function callOnce(
  model: string,
  system: string,
  user: string,
  jsonMode: boolean,
  temperature: number,
  timeoutMs: number,
  maxTokens?: number,
  validate?: (text: string) => boolean,
  controller: AbortController = new AbortController()
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AiUnavailableError("OPENROUTER_API_KEY is not set.");

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiUnavailableError(`OpenRouter ${model} responded ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AiUnavailableError(`OpenRouter ${model} returned an empty response.`);
    }
    if (validate && !validate(content)) {
      throw new AiUnavailableError(`OpenRouter ${model} returned content that failed validation: ${content.slice(0, 80)}`);
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Fires the first `raceModels.length` models at once; resolves with the first success, or null once every one of them has failed. Failures are pushed onto `errors` as they land. */
function raceModels(
  raceModels: string[],
  system: string,
  user: string,
  jsonMode: boolean,
  temperature: number,
  timeoutMs: number,
  maxTokens: number | undefined,
  validate: ((text: string) => boolean) | undefined,
  errors: string[],
  hedgeDelayMs: number
): Promise<string | null> {
  if (raceModels.length === 0) return Promise.resolve(null);
  const controllers = raceModels.map(() => new AbortController());

  return new Promise((resolve) => {
    let remaining = raceModels.length;
    let done = false;
    const started = new Set<number>();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const start = (i: number) => {
      if (done || started.has(i)) return;
      started.add(i);
      callOnce(raceModels[i], system, user, jsonMode, temperature, timeoutMs, maxTokens, validate, controllers[i])
        .then((text) => {
          done = true;
          timers.forEach(clearTimeout);
          controllers.forEach((c, j) => j !== i && c.abort());
          resolve(text);
        })
        .catch((err) => {
          errors.push(`${raceModels[i]}: ${err instanceof Error ? err.message : String(err)}`);
          remaining--;
          if (remaining === 0) resolve(null);
          else raceModels.forEach((_, k) => start(k));
        });
    };
    start(0);
    raceModels.forEach((_, i) => {
      if (i > 0) timers.push(setTimeout(() => start(i), i * hedgeDelayMs));
    });
    if (hedgeDelayMs <= 0) raceModels.forEach((_, i) => start(i));
  });
}

/**
 * Tries the model list, only throwing once every model has failed (or the
 * overall time budget below runs out) — callers (narrate.ts,
 * classify-action.ts) are expected to catch this and fall back to non-AI
 * behavior, never to propagate it to the player.
 *
 * The first two models are fired in parallel and raced, not queued one
 * after another. Found live (2026-09-23): with the free router
 * (`openrouter/free`) and the paid backup (`openai/gpt-4o-mini`) tried
 * strictly in sequence, a hanging free-router call meant the paid model
 * didn't even *start* trying until the free one had already burned its
 * full timeout — so a single slow upstream call fully negated having a
 * reliable paid fallback at all. Racing them means neither's latency can
 * block the other's start; whichever answers first wins, and the loser is
 * aborted immediately (aborted requests generate essentially no tokens,
 * so this doesn't meaningfully change the paid model's usual near-zero
 * cost). Any models beyond the first two are still tried sequentially
 * afterward, only if both raced attempts failed, with the same shared
 * time-budget skip rule as before.
 */
export async function callOpenRouter(system: string, user: string, options: CallOpenRouterOptions): Promise<string> {
  const { models, timeoutMs = 10_000, jsonMode = false, temperature = 0.9, maxTokens, validate, hedgeDelayMs = DEFAULT_HEDGE_DELAY_MS } = options;
  if (models.length === 0) throw new AiUnavailableError("No models configured.");

  // Collect every model's failure, not just the last — a single "Last error"
  // hid which of the earlier models 429'd vs. timed out vs. returned junk,
  // found live (2026-09-23) trying to diagnose a production fallback spike.
  const errors: string[] = [];

  const raceCount = Math.min(2, models.length);
  const raced = await raceModels(models.slice(0, raceCount), system, user, jsonMode, temperature, timeoutMs, maxTokens, validate, errors, hedgeDelayMs);
  if (raced !== null) return raced;

  // Both raced attempts failed — fall through to any remaining models
  // sequentially, sharing one more timeout's worth of total patience so a
  // run of slow ones still can't make the player wait indefinitely.
  const deadline = Date.now() + timeoutMs;
  for (const model of models.slice(raceCount)) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) {
      errors.push(`${model}: skipped, narration time budget exhausted`);
      continue;
    }
    try {
      return await callOnce(model, system, user, jsonMode, temperature, Math.min(timeoutMs, remaining), maxTokens, validate);
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new AiUnavailableError(`All ${models.length} model(s) failed. [${errors.join(" | ")}]`);
}

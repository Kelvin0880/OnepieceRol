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
}

async function callOnce(
  model: string,
  system: string,
  user: string,
  jsonMode: boolean,
  temperature: number,
  timeoutMs: number,
  maxTokens?: number,
  validate?: (text: string) => boolean
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AiUnavailableError("OPENROUTER_API_KEY is not set.");

  const controller = new AbortController();
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

/**
 * Tries each model in order, moving to the next on any failure (timeout,
 * non-2xx, empty content). Only throws once every model has failed —
 * callers (narrate.ts, classify-action.ts) are expected to catch this and
 * fall back to non-AI behavior, never to propagate it to the player.
 */
export async function callOpenRouter(system: string, user: string, options: CallOpenRouterOptions): Promise<string> {
  const { models, timeoutMs = 10_000, jsonMode = false, temperature = 0.9, maxTokens, validate } = options;
  if (models.length === 0) throw new AiUnavailableError("No models configured.");

  let lastError: unknown;
  for (const model of models) {
    try {
      return await callOnce(model, system, user, jsonMode, temperature, timeoutMs, maxTokens, validate);
    } catch (err) {
      lastError = err;
    }
  }
  throw new AiUnavailableError(`All ${models.length} model(s) failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

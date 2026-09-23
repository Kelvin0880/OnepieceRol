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
}

async function callOnce(model: string, system: string, user: string, jsonMode: boolean, temperature: number, timeoutMs: number): Promise<string> {
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
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new AiUnavailableError(`OpenRouter ${model} responded ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AiUnavailableError(`OpenRouter ${model} returned an empty response.`);
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
  const { models, timeoutMs = 10_000, jsonMode = false, temperature = 0.9 } = options;
  if (models.length === 0) throw new AiUnavailableError("No models configured.");

  let lastError: unknown;
  for (const model of models) {
    try {
      return await callOnce(model, system, user, jsonMode, temperature, timeoutMs);
    } catch (err) {
      lastError = err;
    }
  }
  throw new AiUnavailableError(`All ${models.length} model(s) failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

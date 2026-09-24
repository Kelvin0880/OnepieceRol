/**
 * One in-flight action per character, and safe retries. Found in a real
 * account's history (2026-09-24): a slow AI reply made the browser give up
 * while the server kept going and saved the turn, so the player re-sent the
 * same text and burned a second combat round without seeing the first.
 *
 * - Same (character, requestId) while running -> the retry joins the running call.
 * - Same (character, requestId) after it finished OK -> the cached result comes back, nothing re-runs.
 * - A different requestId while one is running -> refused, so two turns never overlap.
 * In-memory: correct for the single Render process this app runs as (same assumption as realtime.ts).
 */

export class ActionInFlightError extends Error {}

const RESULT_TTL_MS = 10 * 60 * 1000;

interface Running {
  requestId: string;
  promise: Promise<unknown>;
}

const running = new Map<string, Running>();
const finished = new Map<string, { at: number; value: unknown }>();

function sweep(now: number) {
  for (const [k, v] of finished) if (now - v.at > RESULT_TTL_MS) finished.delete(k);
}

export async function runOncePerCharacter<T>(characterId: string, requestId: string | undefined, fn: () => Promise<T>, now: () => number = Date.now): Promise<T> {
  sweep(now());
  const key = requestId ? `${characterId}:${requestId}` : null;

  if (key && finished.has(key)) return finished.get(key)!.value as T;

  const current = running.get(characterId);
  if (current) {
    if (requestId && current.requestId === requestId) return current.promise as Promise<T>;
    throw new ActionInFlightError("Tu acción anterior todavía se está resolviendo. Espera a que aparezca su respuesta en la escena.");
  }

  const promise = fn();
  running.set(characterId, { requestId: requestId ?? "", promise });
  try {
    const value = await promise;
    if (key) finished.set(key, { at: now(), value });
    return value;
  } finally {
    if (running.get(characterId)?.promise === promise) running.delete(characterId);
  }
}

export function _resetIdempotencyForTests() {
  running.clear();
  finished.clear();
}

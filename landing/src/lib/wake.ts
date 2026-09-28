export const GAME_URL = "https://grand-line-rpg-qgkv.onrender.com";
export const PING_URL = `${GAME_URL}/api/ping`;

export type WakeStatus = "idle" | "waking" | "ready" | "unknown";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Render's free plan sleeps after a quiet spell and takes about a minute to boot, so the page knocks early.
 * The ping route answers with CORS for this site; if it is not there (an older deploy), a no-cors request to
 * the root still wakes the server and only settles once it answers.
 */
export async function wakeServer(opts: { fetchImpl?: FetchLike; timeoutMs?: number; pingUrl?: string; rootUrl?: string } = {}): Promise<WakeStatus> {
  const fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      const res = await fetchImpl(opts.pingUrl ?? PING_URL, { mode: "cors", cache: "no-store", signal: controller.signal });
      if (res.ok) return "ready";
    } catch (err) {
      if (controller.signal.aborted) return "unknown";
      if (!(err instanceof TypeError)) return "unknown";
    }
    await fetchImpl(opts.rootUrl ?? GAME_URL, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return "ready";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

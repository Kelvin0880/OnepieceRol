import { prisma } from "./db";

/**
 * Best-effort durable error log. Always logs to the console first (so local
 * dev still sees it immediately), then persists to the database so the
 * history survives process restarts and deploys. The DB write itself is
 * swallowed on failure — a broken logger must never be the reason a request
 * fails or masks the original error.
 */
export async function logError(context: string, err: unknown, meta?: Record<string, unknown>): Promise<void> {
  console.error(`[${context}]`, err);
  try {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    await prisma.errorLog.create({
      data: { context, message, stack, metaJson: meta ? JSON.stringify(meta) : null },
    });
  } catch {
    // Logging failures are never allowed to compound the original error.
  }
}

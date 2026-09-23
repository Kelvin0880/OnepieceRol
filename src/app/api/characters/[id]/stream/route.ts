import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { hub } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_MS = 20_000;

/**
 * Server-Sent Events: tells this character's browser to refetch the moment
 * something shared changes (a crewmate's move, a duel round, a fight
 * resolving...). Carries no game data itself — the client refetches the normal
 * state endpoint — so authorization stays in exactly one place.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    if (err instanceof UnauthorizedError) return new Response("No has iniciado sesión.", { status: 401 });
    throw err;
  }
  const { id } = await params;
  const owner = await prisma.character.findUnique({ where: { id }, select: { userId: true } });
  if (!owner || owner.userId !== userId) return new Response("Personaje no encontrado.", { status: 404 });

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      send("retry: 3000\n\n");
      send("event: ready\ndata: {}\n\n");
      const off = hub.subscribe(id, (event) => send(`event: refresh\ndata: ${JSON.stringify(event)}\n\n`));
      const beat = setInterval(() => {
        try {
          send(": ping\n\n");
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(beat);
        off();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

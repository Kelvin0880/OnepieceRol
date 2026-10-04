import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { synthesizeNarration, EdgeTtsUnavailableError } from "@/lib/tts/edge-tts";
import { logError } from "@/lib/log-error";

// Needs real Node APIs (edge-tts-universal opens a WebSocket to Microsoft's service), not the edge runtime.
export const runtime = "nodejs";

const schema = z.object({ text: z.string().min(1).max(4000) });

export async function POST(req: NextRequest) {
  try {
    await requireUserId();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const audio = await synthesizeNarration(parsed.data.text);
    return new NextResponse(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    // Expected/recoverable (edge-tts down, blocked or slow): the client falls back to the browser's own
    // voice on any non-2xx, so this is never logged as an application error — doing so would flood ErrorLog
    // with one row per click during a real Microsoft-side outage.
    if (err instanceof EdgeTtsUnavailableError) return NextResponse.json({ error: err.message }, { status: 503 });
    await logError("api/tts", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

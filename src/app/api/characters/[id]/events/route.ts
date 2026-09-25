import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { getEventsFor, joinEvent, submitEventEntry, withdrawFromEvent, PlayerEventError } from "@/lib/game/player-events";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("join"), eventId: z.string() }),
  z.object({ op: z.literal("withdraw"), eventId: z.string() }),
  z.object({ op: z.literal("submit"), eventId: z.string(), text: z.string().min(1).max(6000) }),
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getEventsFor(id, userId));
  } catch (err) {
    return fail(err, "GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    if (b.op === "join") return NextResponse.json(await joinEvent(id, userId, b.eventId));
    if (b.op === "withdraw") return NextResponse.json(await withdrawFromEvent(id, userId, b.eventId));
    return NextResponse.json(await submitEventEntry(id, userId, b.eventId, b.text));
  } catch (err) {
    return fail(err, "POST");
  }
}

async function fail(err: unknown, method: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof PlayerEventError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError(`api/characters/[id]/events ${method}`, err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

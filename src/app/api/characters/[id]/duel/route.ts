import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { challengeDuel, respondToDuel, cancelDuel, DuelError } from "@/lib/game/duel";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("challenge"), opponentId: z.string(), lethal: z.boolean().optional() }),
  z.object({ op: z.literal("respond"), duelId: z.string(), accept: z.boolean() }),
  z.object({ op: z.literal("cancel"), duelId: z.string() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    switch (parsed.data.op) {
      case "challenge":
        return NextResponse.json(await challengeDuel(id, userId, parsed.data.opponentId, parsed.data.lethal ?? false));
      case "respond":
        return NextResponse.json(await respondToDuel(id, userId, parsed.data.duelId, parsed.data.accept));
      case "cancel":
        return NextResponse.json(await cancelDuel(id, userId, parsed.data.duelId));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof DuelError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/duel", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

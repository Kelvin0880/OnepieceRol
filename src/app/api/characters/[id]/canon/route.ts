import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { CanonError, requestCanonMission, startCanonChallenge, startCanonDuel, submitCanonVerdict } from "@/lib/game/canon-encounter";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("mission"), actorId: z.string() }),
  z.object({ op: z.literal("challenge"), actorId: z.string() }),
  z.object({ op: z.literal("duel") }),
  z.object({ op: z.literal("verdict"), choice: z.string() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const b = parsed.data;
    switch (b.op) {
      case "mission":
        return NextResponse.json(await requestCanonMission(id, userId, b.actorId));
      case "challenge":
        return NextResponse.json(await startCanonChallenge(id, userId, b.actorId));
      case "duel":
        return NextResponse.json(await startCanonDuel(id, userId));
      case "verdict":
        return NextResponse.json(await submitCanonVerdict(id, userId, b.choice));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof CanonError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/canon", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

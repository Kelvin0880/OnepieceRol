import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { proposeBattle, respondToBattle, BattleError } from "@/lib/game/group-battle";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("propose"),
    targetCrewId: z.string(),
    matchups: z.array(z.object({ myCharacterId: z.string(), opponentCharacterId: z.string() })).min(1).max(20),
    lethal: z.boolean().optional(),
  }),
  z.object({ op: z.literal("respond"), battleId: z.string(), accept: z.boolean() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    if (parsed.data.op === "propose") {
      const battle = await proposeBattle(id, userId, parsed.data.targetCrewId, parsed.data.matchups, parsed.data.lethal ?? false);
      return NextResponse.json(battle);
    }

    const result = await respondToBattle(id, userId, parsed.data.battleId, parsed.data.accept);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof BattleError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/battle", err);
    return NextResponse.json({ error: "Error inesperado en la batalla." }, { status: 500 });
  }
}

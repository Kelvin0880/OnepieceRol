import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { musterForConquest, assaultTerritory, castVote, fortifyTerritory, collectIncome, defendTerritory, TerritoryError } from "@/lib/game/territory";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("muster") }),
  z.object({ op: z.literal("unmuster") }),
  z.object({ op: z.literal("assault") }),
  z.object({ op: z.literal("vote"), candidateId: z.string() }),
  z.object({ op: z.literal("fortify") }),
  z.object({ op: z.literal("collect") }),
  z.object({ op: z.literal("defend") }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    switch (parsed.data.op) {
      case "muster":
        return NextResponse.json(await musterForConquest(id, userId, true));
      case "unmuster":
        return NextResponse.json(await musterForConquest(id, userId, false));
      case "assault":
        return NextResponse.json(await assaultTerritory(id, userId));
      case "vote":
        return NextResponse.json(await castVote(id, userId, parsed.data.candidateId));
      case "fortify":
        return NextResponse.json(await fortifyTerritory(id, userId));
      case "collect":
        return NextResponse.json(await collectIncome(id, userId));
      case "defend":
        return NextResponse.json(await defendTerritory(id, userId));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof TerritoryError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/territory", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { payBail, attemptRescue, PrisonError } from "@/lib/game/prison";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("bail") }),
  z.object({ op: z.literal("rescue"), targetCharacterId: z.string() }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    if (parsed.data.op === "bail") {
      return NextResponse.json(await payBail(id, userId));
    }
    return NextResponse.json(await attemptRescue(id, userId, parsed.data.targetCharacterId));
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof PrisonError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/prison", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

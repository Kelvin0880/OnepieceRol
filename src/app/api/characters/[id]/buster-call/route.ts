import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { musterBusterCall, defendAgainstWave, BusterCallError } from "@/lib/game/buster-call";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [z.object({ op: z.literal("muster") }), z.object({ op: z.literal("unmuster") }), z.object({ op: z.literal("defend") })]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    switch (parsed.data.op) {
      case "muster":
        return NextResponse.json(await musterBusterCall(id, userId, true));
      case "unmuster":
        return NextResponse.json(await musterBusterCall(id, userId, false));
      case "defend":
        return NextResponse.json(await defendAgainstWave(id, userId));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof BusterCallError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/buster-call", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

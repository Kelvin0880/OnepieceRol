import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { createCrew, joinCrew, leaveCrew, CrewError } from "@/lib/game/crew";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), name: z.string(), flagDesc: z.string(), shipName: z.string().optional() }),
  z.object({ op: z.literal("join"), inviteCode: z.string() }),
  z.object({ op: z.literal("leave") }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

    switch (parsed.data.op) {
      case "create":
        return NextResponse.json(await createCrew(id, userId, parsed.data.name, parsed.data.flagDesc, parsed.data.shipName));
      case "join":
        return NextResponse.json(await joinCrew(id, userId, parsed.data.inviteCode));
      case "leave":
        await leaveCrew(id, userId);
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof CrewError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/crew", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

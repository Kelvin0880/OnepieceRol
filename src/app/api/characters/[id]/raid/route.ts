import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { musterRaid, pledgeAlly, launchRaidPhase, castRaidVote, RaidError } from "@/lib/game/raid";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("muster") }),
  z.object({ op: z.literal("unmuster") }),
  z.object({ op: z.literal("pledge"), actorId: z.string().min(1) }),
  z.object({ op: z.literal("launch") }),
  z.object({ op: z.literal("vote"), candidateId: z.string().min(1) }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const d = parsed.data;
    switch (d.op) {
      case "muster":
        return NextResponse.json(await musterRaid(id, userId, true));
      case "unmuster":
        return NextResponse.json(await musterRaid(id, userId, false));
      case "pledge":
        return NextResponse.json(await pledgeAlly(id, userId, d.actorId));
      case "launch":
        return NextResponse.json(await launchRaidPhase(id, userId));
      case "vote":
        return NextResponse.json(await castRaidVote(id, userId, d.candidateId));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof RaidError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/raid", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

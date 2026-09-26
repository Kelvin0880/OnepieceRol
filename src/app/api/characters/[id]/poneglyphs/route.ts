import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { decipherRubbings, getRouteState, handRubbing, PoneglyphError, readHistoryStone, studyScript } from "@/lib/game/poneglyph";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("study") }),
  z.object({ op: z.literal("decipher") }),
  z.object({ op: z.literal("read_history") }),
  z.object({ op: z.literal("hand"), rubbingId: z.string().min(1), toCharacterId: z.string().min(1) }),
]);

function fail(err: unknown, where: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof PoneglyphError) return NextResponse.json({ error: err.message }, { status: 400 });
  return logError(where, err).then(() => NextResponse.json({ error: "Error inesperado." }, { status: 500 }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getRouteState(id, userId));
  } catch (err) {
    return fail(err, "api/characters/[id]/poneglyphs GET");
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const d = parsed.data;
    switch (d.op) {
      case "study":
        return NextResponse.json(await studyScript(id, userId));
      case "decipher":
        return NextResponse.json(await decipherRubbings(id, userId));
      case "read_history":
        return NextResponse.json(await readHistoryStone(id, userId));
      case "hand":
        return NextResponse.json(await handRubbing(id, userId, d.rubbingId, d.toCharacterId));
    }
  } catch (err) {
    return fail(err, "api/characters/[id]/poneglyphs POST");
  }
}

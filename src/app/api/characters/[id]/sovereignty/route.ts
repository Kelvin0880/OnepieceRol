import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { applyForWarlord, challengeEmperor, declareWar, getSovereigntyState, payWarlordTribute, proclaimEmperor, resignWarlord, SovereigntyError, warAssault } from "@/lib/game/sovereignty";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("proclaim") }),
  z.object({ op: z.literal("challenge"), actorId: z.string().min(1), fate: z.enum(["spare", "capture", "kill"]).optional() }),
  z.object({ op: z.literal("warlord_apply") }),
  z.object({ op: z.literal("warlord_tribute") }),
  z.object({ op: z.literal("warlord_resign") }),
  z.object({ op: z.literal("declare_war"), kind: z.enum(["MARINE", "EMPEROR"]), targetId: z.string().optional() }),
  z.object({ op: z.literal("war_assault") }),
]);

function fail(err: unknown, where: string) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof SovereigntyError) return NextResponse.json({ error: err.message }, { status: 400 });
  return logError(where, err).then(() => NextResponse.json({ error: "Error inesperado." }, { status: 500 }));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getSovereigntyState(id, userId));
  } catch (err) {
    return fail(err, "api/characters/[id]/sovereignty GET");
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
      case "proclaim":
        return NextResponse.json(await proclaimEmperor(id, userId));
      case "challenge":
        return NextResponse.json(await challengeEmperor(id, userId, d.actorId, d.fate));
      case "warlord_apply":
        return NextResponse.json(await applyForWarlord(id, userId));
      case "warlord_tribute":
        return NextResponse.json(await payWarlordTribute(id, userId));
      case "warlord_resign":
        return NextResponse.json(await resignWarlord(id, userId));
      case "declare_war":
        return NextResponse.json(await declareWar(id, userId, d.kind, d.targetId));
      case "war_assault":
        return NextResponse.json(await warAssault(id, userId));
    }
  } catch (err) {
    return fail(err, "api/characters/[id]/sovereignty POST");
  }
}

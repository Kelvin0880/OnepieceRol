import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import {
  exploreCharacter,
  trainCharacter,
  travelCharacter,
  restCharacter,
  engageCharacter,
  fleeCharacter,
  resolveMercyChoice,
  resolveFreeTextAction,
  confirmLeaveParty,
  rejoinParty,
  GameActionError,
} from "@/lib/game/perform-action";
import { DuelError } from "@/lib/game/duel";
import { JointFightError, getOpenJointFightFor } from "@/lib/game/joint-fight";
import { logError } from "@/lib/log-error";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("explore") }),
  z.object({ action: z.literal("train") }),
  z.object({ action: z.literal("rest") }),
  z.object({ action: z.literal("travel"), targetIslandId: z.string() }),
  z.object({ action: z.literal("engage") }),
  z.object({ action: z.literal("flee") }),
  z.object({ action: z.literal("mercy"), spare: z.boolean() }),
  z.object({ action: z.literal("confirm_leave_party") }),
  z.object({ action: z.literal("rejoin_party") }),
]);

// Free text is the primary input path (see resolveFreeTextAction) — the
// explicit `action` shapes above stay as the reliable button fallback.
const freeTextSchema = z.object({ freeText: z.string().min(1).max(6000) });

const schema = z.union([actionSchema, freeTextSchema]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Acción inválida." }, { status: 400 });

    if ("freeText" in parsed.data) {
      return NextResponse.json(await resolveFreeTextAction(id, userId, parsed.data.freeText));
    }

    if (await getOpenJointFightFor(id)) {
      return NextResponse.json({ error: "Estás en plena pelea con tus aliados: describe tu movimiento en el cuadro de texto." }, { status: 400 });
    }

    switch (parsed.data.action) {
      case "explore":
        return NextResponse.json(await exploreCharacter(id, userId));
      case "train":
        return NextResponse.json(await trainCharacter(id, userId));
      case "rest":
        return NextResponse.json(await restCharacter(id, userId));
      case "travel":
        return NextResponse.json(await travelCharacter(id, userId, parsed.data.targetIslandId));
      case "engage":
        return NextResponse.json(await engageCharacter(id, userId));
      case "flee":
        return NextResponse.json(await fleeCharacter(id, userId));
      case "mercy":
        return NextResponse.json(await resolveMercyChoice(id, userId, parsed.data.spare));
      case "confirm_leave_party":
        return NextResponse.json(await confirmLeaveParty(id, userId));
      case "rejoin_party":
        return NextResponse.json(await rejoinParty(id, userId));
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof JointFightError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof DuelError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof GameActionError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters/[id]/actions", err);
    return NextResponse.json({ error: "Error inesperado ejecutando la acción." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { OocError, oocChat, applyOocAction, getOocOverview, createCheckpoint, deleteCheckpoint, rollbackToCheckpoint } from "@/lib/game/ooc";
import { sanitizeProposal } from "@/lib/ai/ooc-prompt";
import { runOncePerCharacter, ActionInFlightError } from "@/lib/idempotency";
import { logError } from "@/lib/log-error";

const schema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("chat"),
    text: z.string().min(1).max(2000),
    history: z.array(z.object({ role: z.enum(["player", "assistant"]), text: z.string().max(1500) })).max(12).optional(),
  }),
  z.object({ op: z.literal("apply"), action: z.unknown() }),
  z.object({ op: z.literal("checkpoint"), label: z.string().min(1).max(60) }),
  z.object({ op: z.literal("delete_checkpoint"), checkpointId: z.string() }),
  z.object({ op: z.literal("rollback"), checkpointId: z.string().optional() }),
]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getOocOverview(id, userId));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
    const body = parsed.data;
    switch (body.op) {
      case "chat":
        return NextResponse.json(await oocChat(id, userId, body.text, body.history));
      case "apply": {
        const action = sanitizeProposal(body.action);
        if (!action) return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
        // Same one-at-a-time guard as game actions: a rollback must never overlap a narration in flight.
        return NextResponse.json(await runOncePerCharacter(id, undefined, () => applyOocAction(id, userId, action)));
      }
      case "checkpoint":
        await createCheckpoint(id, userId, "manual", body.label);
        return NextResponse.json({ message: "Punto de restauración guardado." });
      case "delete_checkpoint":
        await deleteCheckpoint(id, userId, body.checkpointId);
        return NextResponse.json({ message: "Punto borrado." });
      case "rollback":
        return NextResponse.json(await runOncePerCharacter(id, undefined, () => rollbackToCheckpoint(id, userId, body.checkpointId)));
    }
  } catch (err) {
    return fail(err);
  }
}

async function fail(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ActionInFlightError) return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof OocError) return NextResponse.json({ error: err.message }, { status: 400 });
  await logError("api/characters/[id]/ooc", err);
  return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
}

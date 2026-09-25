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
  closeFight,
  retryJointRoundFor,
  resolveFreeTextAction,
  confirmLeaveParty,
  rejoinParty,
  GameActionError,
} from "@/lib/game/perform-action";
import { DuelError } from "@/lib/game/duel";
import { JointFightError, getOpenJointFightFor } from "@/lib/game/joint-fight";
import { logError } from "@/lib/log-error";
import { runOncePerCharacter, ActionInFlightError } from "@/lib/idempotency";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("explore") }),
  z.object({ action: z.literal("train") }),
  z.object({ action: z.literal("rest") }),
  z.object({ action: z.literal("travel"), targetIslandId: z.string() }),
  z.object({ action: z.literal("engage") }),
  z.object({ action: z.literal("flee") }),
  z.object({ action: z.literal("mercy"), spare: z.boolean() }),
  z.object({ action: z.literal("close_fight"), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("retry_joint_round") }),
  z.object({ action: z.literal("confirm_leave_party") }),
  z.object({ action: z.literal("rejoin_party") }),
]);

// Free text is the primary input path (see resolveFreeTextAction) — the
// explicit `action` shapes above stay as the reliable button fallback.
const freeTextSchema = z.object({ freeText: z.string().min(1).max(6000) });

const schema = z.union([actionSchema, freeTextSchema]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const raw = await req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    const rid =
      typeof raw?.requestId === "string" &&
      raw.requestId.length >= 8 &&
      raw.requestId.length <= 64
        ? raw.requestId
        : undefined;
    return await runOncePerCharacter(
      id,
      rid ? `${userId}:${rid}` : undefined,
      () => dispatch(id, userId, parsed.data),
    )
      .then((body) => NextResponse.json(body))
      .catch((err) => handleError(err));
  } catch (err) {
    return handleError(err);
  }
}

type ParsedBody = z.infer<typeof schema>;

async function dispatch(
  id: string,
  userId: string,
  data: ParsedBody,
): Promise<unknown> {
  if ("freeText" in data) {
    return await resolveFreeTextAction(id, userId, data.freeText);
  }

  if (await getOpenJointFightFor(id)) {
    throw new GameActionError(
      "Estás en plena pelea con tus aliados: describe tu movimiento en el cuadro de texto.",
    );
  }

  switch (data.action) {
    case "explore":
      return await exploreCharacter(id, userId);
    case "train":
      return await trainCharacter(id, userId);
    case "rest":
      return await restCharacter(id, userId);
    case "travel":
      return await travelCharacter(id, userId, data.targetIslandId);
    case "engage":
      return await engageCharacter(id, userId);
    case "flee":
      return await fleeCharacter(id, userId);
    case "mercy":
      return await resolveMercyChoice(id, userId, data.spare);
    case "close_fight":
      return await closeFight(id, userId, data.note);
    case "retry_joint_round":
      return await retryJointRoundFor(id, userId);
    case "confirm_leave_party":
      return await confirmLeaveParty(id, userId);
    case "rejoin_party":
      return await rejoinParty(id, userId);
  }
}

async function handleError(err: unknown) {
  if (err instanceof UnauthorizedError)
    return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ActionInFlightError)
    return NextResponse.json({ error: err.message }, { status: 409 });
  if (err instanceof JointFightError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof DuelError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  if (err instanceof GameActionError)
    return NextResponse.json({ error: err.message }, { status: 400 });
  await logError("api/characters/[id]/actions", err);
  return NextResponse.json(
    { error: "Error inesperado ejecutando la acción." },
    { status: 500 },
  );
}

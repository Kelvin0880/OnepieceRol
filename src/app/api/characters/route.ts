import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Faction } from "@prisma/client";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { createCharacter, CharacterCreationError, ARCHETYPES, ArchetypeId } from "@/lib/game/create-character";
import { logError } from "@/lib/log-error";

const archetypeIds = ARCHETYPES.map((a) => a.id) as [ArchetypeId, ...ArchetypeId[]];

const schema = z.object({
  name: z.string(),
  faction: z.nativeEnum(Faction),
  archetypeId: z.enum(archetypeIds),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await requireUserId();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Datos de personaje inválidos." }, { status: 400 });

    const character = await createCharacter(userId, parsed.data.name, parsed.data.faction, parsed.data.archetypeId);
    return NextResponse.json(character);
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof CharacterCreationError) return NextResponse.json({ error: err.message }, { status: 400 });
    await logError("api/characters", err);
    return NextResponse.json({ error: "Error inesperado creando el personaje." }, { status: 500 });
  }
}

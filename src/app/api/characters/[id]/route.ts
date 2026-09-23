import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, UnauthorizedError } from "@/lib/require-user";
import { logError } from "@/lib/log-error";
import { syncPartyForCharacter, getPartyStateForCharacter } from "@/lib/game/party";
import { currentStamina } from "@/lib/game/combat-prep";
import { fatigueLevel, FATIGUE_LABELS } from "@/lib/engine/stamina";
import { fruitPhase, FRUIT_PHASE_LABELS } from "@/lib/engine/fruit-mastery";
import { getDuelStateForCharacter } from "@/lib/game/duel";
import { areHostile, PlayerFaction } from "@/lib/engine/hostility";
import { deleteCharacter, DeleteCharacterError } from "@/lib/game/delete-character";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    // Lazily materializes/dissolves this character's live party scene based
    // on current crew+island togetherness — same request-driven style as
    // tickWorldIfDue, no cron/background job. Cheap: scoped to this one
    // character's crew, not a world-wide scan.
    await syncPartyForCharacter(id);

    const character = await prisma.character.findUnique({
      where: { id },
      include: {
        currentIsland: true,
        devilFruit: true,
        equippedWeapon: true,
        ownedWeapons: true,
        companions: true,
        inventory: true,
        crew: {
          include: {
            members: { select: { id: true, name: true, level: true, faction: true, status: true, currentIslandId: true, partyId: true, isSeparatedFromParty: true } },
          },
        },
        pendingEncounter: true,
        imprisonment: true,
        logs: { orderBy: { createdAt: "desc" }, take: 30 },
        sceneMessages: { orderBy: { createdAt: "asc" }, take: 60 },
      },
    });
    if (!character || character.userId !== userId) {
      return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
    }

    // Presence heartbeat (throttled to once a minute): real PvP hunts only land on online players.
    if (!character.lastSeenAt || Date.now() - character.lastSeenAt.getTime() > 60_000) {
      await prisma.character.update({ where: { id }, data: { lastSeenAt: new Date() } });
    }
    const party = await getPartyStateForCharacter(id);
    const duel = await getDuelStateForCharacter(id);
    const connections = JSON.parse(character.currentIsland.connections) as string[];
    const connectedIslands = await prisma.island.findMany({ where: { id: { in: connections } } });

    const othersHere = await prisma.character.findMany({
      where: { currentIslandId: character.currentIslandId, id: { not: character.id }, status: "ALIVE" },
      select: { id: true, name: true, faction: true, level: true, bounty: true, notoriety: true, crew: { select: { id: true, name: true } } },
      take: 20,
    });

    const prisonersHere =
      character.status === "ALIVE"
        ? await prisma.character.findMany({
            where: { currentIslandId: character.currentIslandId, id: { not: character.id }, status: "IMPRISONED" },
            select: { id: true, name: true, faction: true, level: true },
            take: 20,
          })
        : [];

    const crewBattles = character.crew
      ? await prisma.groupBattle.findMany({
          where: { OR: [{ crewAId: character.crew.id }, { crewBId: character.crew.id }] },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : [];
    const crewAIds = [...new Set(crewBattles.map((b) => b.crewAId))];
    const crewBIds = [...new Set(crewBattles.map((b) => b.crewBId))];
    const battleCrews = await prisma.crew.findMany({ where: { id: { in: [...crewAIds, ...crewBIds] } }, select: { id: true, name: true } });
    const crewNameById = new Map(battleCrews.map((c) => [c.id, c.name]));
    const shapedBattles = crewBattles.map((b) => ({
      id: b.id,
      status: b.status,
      isChallenger: b.crewAId === character.crew?.id,
      opponentCrewName: crewNameById.get(b.crewAId === character.crew?.id ? b.crewBId : b.crewAId) ?? "Desconocido",
      matchupCount: (JSON.parse(b.matchupsJson) as unknown[]).length,
      resultJson: b.resultJson,
      createdAt: b.createdAt,
    }));

    const { pendingEncounter, imprisonment, ...rest } = character;
    const shapedPending = pendingEncounter
      ? (() => {
          const enemySpec = JSON.parse(pendingEncounter.enemyJson) as { name: string; hp: number };
          return {
            phase: pendingEncounter.phase,
            assessment: pendingEncounter.assessment,
            enemyName: enemySpec.name,
            enemyMaxHp: enemySpec.hp,
            enemyHp: pendingEncounter.enemyHp ?? enemySpec.hp,
          };
        })()
      : null;
    const shapedImprisonment = imprisonment
      ? { reason: imprisonment.reason, bailBerries: imprisonment.bailBerries, cellLevel: imprisonment.cellLevel, minRescueLevel: imprisonment.minRescueLevel, capturedAt: imprisonment.capturedAt }
      : null;

    const staminaNow = currentStamina(character);
    const phase = fruitPhase(character.fruitMastery, character.fruitAwakened);
    return NextResponse.json({
      character: {
        ...rest,
        stamina: staminaNow,
        fatigue: FATIGUE_LABELS[fatigueLevel(staminaNow, character.maxStamina)],
        fruitPhase: character.devilFruit ? FRUIT_PHASE_LABELS[phase] : null,
        pendingEncounter: shapedPending,
        imprisonment: shapedImprisonment,
      },
      connectedIslands,
      othersHere: othersHere.map((o) => ({ ...o, hostile: areHostile(character.faction as PlayerFaction, o.faction as PlayerFaction) })),
      prisonersHere,
      crewBattles: shapedBattles,
      party,
      duel,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    await logError("api/characters/[id]", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { name } = await deleteCharacter(id, userId);
    return NextResponse.json({ ok: true, name });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof DeleteCharacterError) return NextResponse.json({ error: err.message }, { status: 404 });
    await logError("api/characters/[id] DELETE", err);
    return NextResponse.json({ error: "Error inesperado." }, { status: 500 });
  }
}

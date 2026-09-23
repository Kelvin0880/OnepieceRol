import { prisma } from "../db";
import { buildTurnOrder, nextTurnIndex } from "../engine/party-turns";

/**
 * Live multiplayer party scenes — crewmates who are physically together
 * (same crew, same island, neither explicitly separated) share one scene
 * with a turn order, instead of each getting their own private narration.
 * See Party/PartySceneMessage in schema.prisma for the shape.
 *
 * Deliberately does NOT import anything from perform-action.ts (and isn't
 * imported there except as plain function calls inside resolveFreeTextAction)
 * — turn-gating functions here return a result object instead of throwing
 * perform-action.ts's GameActionError, so the two files don't need a
 * circular dependency just to share one error class.
 */

async function dissolvePartyIfTooSmall(partyId: string): Promise<void> {
  const remaining = await prisma.character.count({ where: { partyId } });
  if (remaining < 2) {
    await prisma.character.updateMany({ where: { partyId }, data: { partyId: null } });
    await prisma.party.delete({ where: { id: partyId } }).catch(() => {});
  }
}

async function detachFromParty(characterId: string, partyId: string): Promise<void> {
  await prisma.character.update({ where: { id: characterId }, data: { partyId: null } });
  await dissolvePartyIfTooSmall(partyId);
}

/**
 * Lazily creates/updates/dissolves the party for one character's current
 * situation — called on every character-state poll (GET /api/characters/[id]),
 * the same request-driven style tickWorldIfDue already uses instead of a
 * cron job. Eventually consistent across a crew: each member's own next
 * poll folds them in or out, no push/broadcast needed.
 */
export async function syncPartyForCharacter(characterId: string): Promise<void> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.status !== "ALIVE") return;

  if (!character.crewId || character.isSeparatedFromParty) {
    if (character.partyId) await detachFromParty(character.id, character.partyId);
    return;
  }

  const together = await prisma.character.findMany({
    where: { crewId: character.crewId, currentIslandId: character.currentIslandId, status: "ALIVE", isSeparatedFromParty: false },
    orderBy: { createdAt: "asc" },
  });

  if (together.length < 2) {
    if (character.partyId) await detachFromParty(character.id, character.partyId);
    return;
  }

  const crew = await prisma.crew.findUnique({ where: { id: character.crewId } });
  const captainId = crew?.captainId ?? together[0].id;
  const memberIds = together.map((c) => c.id);
  const turnOrder = buildTurnOrder(memberIds, captainId);

  const existing = await prisma.party.findUnique({ where: { crewId: character.crewId }, include: { members: { select: { id: true } } } });

  if (!existing) {
    const party = await prisma.party.create({
      data: { crewId: character.crewId, turnOrder: JSON.stringify(turnOrder), members: { connect: memberIds.map((id) => ({ id })) } },
    });
    await prisma.partySceneMessage.create({
      data: { partyId: party.id, authorCharacterId: null, authorName: "Narrador", text: `${together.map((c) => c.name).join(", ")} se reúnen. La escena comienza.` },
    });
    return;
  }

  const currentIds = existing.members.map((m) => m.id).sort().join(",");
  const desiredIds = [...memberIds].sort().join(",");
  if (currentIds !== desiredIds) {
    // Membership changed (someone arrived/left/traveled) — resync roster and
    // turn order, restarting the cycle at turnIndex 0. awaitingNarrator
    // stays false: nobody has spoken in this new configuration yet, so it's
    // simply turnOrder[0]'s turn, not a narrator reply in flight.
    await prisma.party.update({
      where: { id: existing.id },
      data: { turnOrder: JSON.stringify(turnOrder), turnIndex: 0, awaitingNarrator: false, members: { set: memberIds.map((id) => ({ id })) } },
    });
  }
}

export async function confirmLeaveParty(characterId: string, userId: string): Promise<{ log: string[] }> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.userId !== userId) throw new Error("Personaje no encontrado.");
  if (!character.partyId) return { log: ["Ya no estás compartiendo una escena con nadie."] };

  const partyId = character.partyId;
  await prisma.character.update({ where: { id: character.id }, data: { partyId: null, isSeparatedFromParty: true } });
  await prisma.partySceneMessage.create({ data: { partyId, authorCharacterId: null, authorName: "Narrador", text: `${character.name} se separa del grupo por su cuenta.` } });
  await dissolvePartyIfTooSmall(partyId);

  return { log: ["Te separas de tus nakamas. Puedes volver a unirte cuando quieras si sigues en la misma isla."] };
}

export async function rejoinParty(characterId: string, userId: string): Promise<{ log: string[] }> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.userId !== userId) throw new Error("Personaje no encontrado.");

  await prisma.character.update({ where: { id: character.id }, data: { isSeparatedFromParty: false } });
  await syncPartyForCharacter(characterId);

  const refreshed = await prisma.character.findUnique({ where: { id: characterId } });
  if (refreshed?.partyId) {
    await prisma.partySceneMessage.create({
      data: { partyId: refreshed.partyId, authorCharacterId: null, authorName: "Narrador", text: `${character.name} vuelve a unirse al grupo.` },
    });
    return { log: ["Te reúnes de nuevo con tus nakamas."] };
  }
  return { log: ["No hay nadie de tu tripulación aquí ahora mismo para reunirte."] };
}

export type BeginPartyTurnResult =
  | { ok: true; partyId: string; roster: { name: string; faction: string; level: number }[]; recentLines: string[] }
  | { ok: false; reason: string };

/**
 * Checks whose turn it is and, if it's this character's, locks the party
 * (awaitingNarrator = true) so a second member can't post into the same
 * beat. Read-check-write happens inside one transaction, matching
 * world-tick.ts's existing use of $transaction for a similar
 * check-then-flip. Returns a result object instead of throwing, so this
 * file never needs to depend on perform-action.ts's GameActionError.
 */
export async function beginPartyTurn(characterId: string): Promise<BeginPartyTurnResult> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character?.partyId) return { ok: false, reason: "No estás compartiendo una escena con tu tripulación ahora mismo." };
  const partyId = character.partyId;

  return prisma.$transaction(async (tx) => {
    const party = await tx.party.findUnique({
      where: { id: partyId },
      include: { members: { select: { id: true, name: true, faction: true, level: true } }, messages: { orderBy: { createdAt: "desc" }, take: 14 } },
    });
    if (!party) return { ok: false, reason: "El grupo ya no existe." };
    if (party.awaitingNarrator) return { ok: false, reason: "Espera a que el narrador responda." };

    const turnOrder = JSON.parse(party.turnOrder) as string[];
    if (turnOrder[party.turnIndex] !== characterId) {
      const waitingFor = party.members.find((m) => m.id === turnOrder[party.turnIndex]);
      return { ok: false, reason: `Espera tu turno — le toca a ${waitingFor?.name ?? "otro miembro del grupo"}.` };
    }

    await tx.party.update({ where: { id: party.id }, data: { awaitingNarrator: true } });

    return {
      ok: true as const,
      partyId: party.id,
      roster: party.members.map((m) => ({ name: m.name, faction: m.faction, level: m.level })),
      recentLines: [...party.messages].reverse().map((m) => `${m.authorName}: ${m.text}`),
    };
  });
}

/** Advances to the next member's turn and unlocks the party. Used after a "narrate"/mechanical turn resolves. */
export async function advancePartyTurn(partyId: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return;
  const turnOrder = JSON.parse(party.turnOrder) as string[];
  await prisma.party.update({ where: { id: partyId }, data: { awaitingNarrator: false, turnIndex: nextTurnIndex(turnOrder, party.turnIndex) } });
}

/** Unlocks the party without advancing the turn — used when a beginPartyTurn lock led nowhere (e.g. a leave_party confirmation prompt), so the same member can immediately act again instead of the group getting stuck. */
export async function releasePartyTurnLock(partyId: string): Promise<void> {
  await prisma.party.update({ where: { id: partyId }, data: { awaitingNarrator: false } });
}

export async function writePartyMessage(partyId: string, authorCharacterId: string | null, authorName: string, text: string): Promise<void> {
  await prisma.partySceneMessage.create({ data: { partyId, authorCharacterId, authorName, text } });
}

/** A short narrator-authored line for the shared feed — used to echo a personal (non-party-turn) mechanical outcome, like a solo fight resolving, without touching turn state. */
export async function echoToParty(partyId: string, text: string): Promise<void> {
  await writePartyMessage(partyId, null, "Narrador", text);
}

export interface PartyStateForCharacter {
  id: string;
  turnOrder: string[];
  turnIndex: number;
  awaitingNarrator: boolean;
  members: { id: string; name: string }[];
  messages: { id: string; authorCharacterId: string | null; authorName: string; text: string; createdAt: Date }[];
}

/** Read-only party payload for the character-state poll — never mutates anything. */
export async function getPartyStateForCharacter(characterId: string): Promise<PartyStateForCharacter | null> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character?.partyId) return null;
  const party = await prisma.party.findUnique({
    where: { id: character.partyId },
    include: { members: { select: { id: true, name: true } }, messages: { orderBy: { createdAt: "asc" }, take: 60 } },
  });
  if (!party) return null;
  return {
    id: party.id,
    turnOrder: JSON.parse(party.turnOrder) as string[],
    turnIndex: party.turnIndex,
    awaitingNarrator: party.awaitingNarrator,
    members: party.members,
    messages: party.messages,
  };
}

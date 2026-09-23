import { prisma } from "../db";

export class DeleteCharacterError extends Error {}

/**
 * Permanently erases a character and everything that belongs only to it —
 * not a soft "RETIRED" status flip, a real row-level delete, per the
 * user's explicit "se borre totalmente de toda la base de datos" ask.
 *
 * What's deliberately NOT touched, and why: world history isn't rewritten.
 * NewsItem.characterId, PartySceneMessage.authorCharacterId, and any
 * character id sitting inside a GroupBattle's matchupsJson/resultJson are
 * all plain, non-FK-enforced strings (same convention as Crew.captainId —
 * see the schema's own comment on that field), so they're left as stale
 * historical references on purpose, the same way a permadeath doesn't
 * erase the news that reported it.
 */
export async function deleteCharacter(characterId: string, userId: string): Promise<{ name: string }> {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.userId !== userId) throw new DeleteCharacterError("Personaje no encontrado.");

  await prisma.$transaction(async (tx) => {
    // Clear the equipped-weapon FK first — a common-grade Weapon row about
    // to be deleted below can't still be referenced by Character.equippedWeaponId.
    await tx.character.update({ where: { id: characterId }, data: { equippedWeaponId: null } });

    // Crew.captainId is a plain string, not FK-enforced (see schema), so it
    // would otherwise silently dangle — hand off leadership or dissolve.
    if (character.crewId) {
      const crew = await tx.crew.findUnique({ where: { id: character.crewId }, include: { members: true } });
      if (crew && crew.captainId === character.id) {
        const remaining = crew.members.filter((m) => m.id !== character.id);
        if (remaining.length > 0) {
          await tx.crew.update({ where: { id: crew.id }, data: { captainId: remaining[0].id } });
          await tx.character.update({ where: { id: remaining[0].id }, data: { isCaptain: true } });
        } else {
          await tx.crew.delete({ where: { id: crew.id } });
        }
      }
    }

    // Named 1-of-1 meito return to the world unclaimed, not deleted — only
    // truly per-character instanced common gear (see common-gear.ts note
    // in the schema) is erased with its owner.
    const weapons = await tx.weapon.findMany({ where: { ownerId: characterId } });
    for (const weapon of weapons) {
      if (weapon.grade === "UNIQUE") {
        await tx.weapon.update({ where: { id: weapon.id }, data: { ownerId: null } });
      } else {
        await tx.weapon.delete({ where: { id: weapon.id } });
      }
    }

    await tx.pendingEncounter.deleteMany({ where: { characterId } });
    await tx.imprisonment.deleteMany({ where: { characterId } });
    await tx.nPCCompanion.deleteMany({ where: { characterId } });
    await tx.gameLogEntry.deleteMany({ where: { characterId } });
    await tx.bountyLogEntry.deleteMany({ where: { characterId } });
    await tx.sceneMessage.deleteMany({ where: { characterId } });
    await tx.inventoryItem.deleteMany({ where: { characterId } });
    await tx.groupBattleParticipant.deleteMany({ where: { characterId } });
    // Unlike NewsItem/PartySceneMessage, a Grudge row has no historical
    // value once its character is gone — it only exists to bias that
    // character's own future encounters.
    await tx.grudge.deleteMany({ where: { characterId } });

    await tx.character.delete({ where: { id: characterId } });

    // Party.members has no stored array to prune — deleting the Character
    // row already drops it. Just dissolve the party if that leaves it
    // too small, same threshold party.ts's own dissolvePartyIfTooSmall uses.
    if (character.partyId) {
      const remaining = await tx.character.count({ where: { partyId: character.partyId } });
      if (remaining < 2) {
        await tx.character.updateMany({ where: { partyId: character.partyId }, data: { partyId: null } });
        await tx.party.delete({ where: { id: character.partyId } }).catch(() => {});
      }
    }
  });

  return { name: character.name };
}

import { prisma } from "../db";
import { crewNounForFaction } from "../engine/crew-noun";

export class CrewError extends Error {}

async function loadOwnedCharacter(characterId: string, userId: string) {
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  if (!character || character.userId !== userId) throw new CrewError("Personaje no encontrado.");
  return character;
}

export async function createCrew(characterId: string, userId: string, name: string, flagDesc: string, shipName?: string) {
  const character = await loadOwnedCharacter(characterId, userId);
  if (character.crewId) throw new CrewError(`Ya perteneces a una ${crewNounForFaction(character.faction).toLowerCase()}. Abandónala primero.`);

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 32) throw new CrewError("El nombre debe tener entre 2 y 32 caracteres.");

  const existing = await prisma.crew.findUnique({ where: { name: trimmedName } });
  if (existing) throw new CrewError("Ya existe un grupo con ese nombre.");

  const crew = await prisma.crew.create({
    data: {
      name: trimmedName,
      flagDesc: flagDesc.trim().slice(0, 280) || "Un emblema aún sin forma, esperando ser forjado en leyenda.",
      shipName: shipName?.trim().slice(0, 40) || "Barca sin nombre",
      captainId: character.id,
    },
  });

  await prisma.character.update({ where: { id: character.id }, data: { crewId: crew.id, isCaptain: true } });
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "crew", text: `Fundas la ${crewNounForFaction(character.faction).toLowerCase()} "${trimmedName}".` },
  });

  return crew;
}

export async function joinCrew(characterId: string, userId: string, inviteCode: string) {
  const character = await loadOwnedCharacter(characterId, userId);
  if (character.crewId) throw new CrewError(`Ya perteneces a una ${crewNounForFaction(character.faction).toLowerCase()}. Abandónala primero.`);

  const crew = await prisma.crew.findUnique({ where: { inviteCode: inviteCode.trim() }, include: { members: true } });
  if (!crew) throw new CrewError("Código de invitación inválido.");

  const captain = crew.members.find((m) => m.id === crew.captainId) ?? crew.members[0];
  if (captain && captain.faction !== character.faction) {
    throw new CrewError(`Solo personajes de la facción ${captain.faction} pueden unirse a esta ${crewNounForFaction(captain.faction).toLowerCase()}.`);
  }

  await prisma.character.update({ where: { id: character.id }, data: { crewId: crew.id, isCaptain: false } });
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "crew", text: `Te unes a "${crew.name}".` } });

  return crew;
}

export async function leaveCrew(characterId: string, userId: string) {
  const character = await loadOwnedCharacter(characterId, userId);
  if (!character.crewId) throw new CrewError("No perteneces a ningún grupo.");

  const crew = await prisma.crew.findUnique({ where: { id: character.crewId }, include: { members: true } });
  await prisma.character.update({ where: { id: character.id }, data: { crewId: null, isCaptain: true } });
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "crew", text: `Abandonas "${crew?.name}".` } });

  // If the captain leaves and others remain, hand leadership to the next member so the group isn't orphaned.
  if (crew && crew.captainId === character.id) {
    const remaining = crew.members.filter((m) => m.id !== character.id);
    if (remaining.length > 0) {
      await prisma.crew.update({ where: { id: crew.id }, data: { captainId: remaining[0].id } });
      await prisma.character.update({ where: { id: remaining[0].id }, data: { isCaptain: true } });
    } else {
      await prisma.crew.delete({ where: { id: crew.id } });
    }
  }
}

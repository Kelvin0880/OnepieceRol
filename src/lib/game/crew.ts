import { prisma } from "../db";
import { crewNounForFaction } from "../engine/crew-noun";
import { inviteBlockReason, inviteExpired, INVITE_TTL_MS } from "../engine/crew-invite";
import { notifyCharacters } from "../realtime";

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

// ---------- invitations, candidates, kicking (2026-09-24) ----------


async function crewMemberIds(crewId: string): Promise<string[]> {
  return (await prisma.character.findMany({ where: { crewId }, select: { id: true } })).map((m) => m.id);
}

/** Players who could be invited right now: alive, no crew, same faction — those on your island first, or by name. */
export async function findCrewCandidates(characterId: string, userId: string, name?: string) {
  const me = await loadOwnedCharacter(characterId, userId);
  const query = name?.trim();
  const rows = await prisma.character.findMany({
    where: {
      id: { not: me.id },
      status: "ALIVE",
      crewId: null,
      faction: me.faction,
      ...(query ? { name: { contains: query } } : { currentIslandId: me.currentIslandId }),
    },
    select: { id: true, name: true, level: true, currentIslandId: true, currentIsland: { select: { name: true } } },
    orderBy: { level: "desc" },
    take: 12,
  });
  const pending = await prisma.crewInvite.findMany({ where: { fromCharacterId: me.id, status: "PENDING", toCharacterId: { in: rows.map((r) => r.id) } }, select: { toCharacterId: true } });
  const invited = new Set(pending.map((p) => p.toCharacterId));
  return rows.map((r) => ({ id: r.id, name: r.name, level: r.level, islandName: r.currentIsland.name, sameIsland: r.currentIslandId === me.currentIslandId, alreadyInvited: invited.has(r.id) }));
}

export async function listCrewInvites(characterId: string, userId: string) {
  const me = await loadOwnedCharacter(characterId, userId);
  const now = new Date();
  const [received, sent] = await Promise.all([
    prisma.crewInvite.findMany({ where: { toCharacterId: me.id, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    me.crewId ? prisma.crewInvite.findMany({ where: { crewId: me.crewId, status: "PENDING" }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
  ]);
  const names = new Map((await prisma.character.findMany({ where: { id: { in: sent.map((s) => s.toCharacterId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  return {
    received: received.filter((i) => !inviteExpired(i.createdAt, now)).map((i) => ({ id: i.id, crewName: i.crewName, fromName: i.fromName, expiresInMinutes: Math.max(0, Math.round((INVITE_TTL_MS - (now.getTime() - i.createdAt.getTime())) / 60000)) })),
    sent: sent.filter((i) => !inviteExpired(i.createdAt, now)).map((i) => ({ id: i.id, toName: names.get(i.toCharacterId) ?? "Jugador", fromName: i.fromName })),
  };
}

export async function inviteToCrew(characterId: string, userId: string, target: { characterId?: string; name?: string }) {
  const me = await loadOwnedCharacter(characterId, userId);
  const crew = me.crewId ? await prisma.crew.findUnique({ where: { id: me.crewId }, include: { members: { select: { id: true } } } }) : null;

  let targetChar = null as Awaited<ReturnType<typeof prisma.character.findUnique>>;
  if (target.characterId) targetChar = await prisma.character.findUnique({ where: { id: target.characterId } });
  else if (target.name?.trim()) targetChar = await prisma.character.findFirst({ where: { name: target.name.trim() } });
  if (!targetChar) throw new CrewError("No encuentro a ese jugador. Escribe su nombre exacto o elígelo de la lista.");

  const pending = crew ? await prisma.crewInvite.count({ where: { crewId: crew.id, status: "PENDING" } }) : 0;
  const dup = crew ? await prisma.crewInvite.findFirst({ where: { crewId: crew.id, toCharacterId: targetChar.id, status: "PENDING" } }) : null;
  const reason = inviteBlockReason({
    inviterHasCrew: !!crew,
    targetAlive: targetChar.status === "ALIVE",
    targetHasCrew: !!targetChar.crewId,
    sameFaction: targetChar.faction === me.faction,
    isSelf: targetChar.id === me.id,
    alreadyPending: !!dup && !inviteExpired(dup.createdAt),
    pendingInCrew: pending,
    crewSize: crew?.members.length ?? 0,
  });
  if (reason || !crew) throw new CrewError(reason ?? "Necesitas una tripulación para invitar a alguien.");

  await prisma.crewInvite.create({ data: { crewId: crew.id, crewName: crew.name, fromCharacterId: me.id, fromName: me.name, toCharacterId: targetChar.id } });
  notifyCharacters([targetChar.id], "crew-invite");
  return { message: `Invitación enviada a ${targetChar.name}. Caduca en 24 horas.` };
}

export async function respondToCrewInvite(characterId: string, userId: string, inviteId: string, accept: boolean) {
  const me = await loadOwnedCharacter(characterId, userId);
  const invite = await prisma.crewInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.toCharacterId !== me.id || invite.status !== "PENDING") throw new CrewError("Esa invitación ya no está disponible.");
  if (inviteExpired(invite.createdAt)) {
    await prisma.crewInvite.update({ where: { id: invite.id }, data: { status: "CANCELLED" } });
    throw new CrewError("Esa invitación ha caducado.");
  }
  if (!accept) {
    await prisma.crewInvite.update({ where: { id: invite.id }, data: { status: "DECLINED" } });
    notifyCharacters([invite.fromCharacterId], "crew-invite");
    return { message: "Invitación rechazada." };
  }
  const crew = await prisma.crew.findUnique({ where: { id: invite.crewId }, include: { members: true } });
  if (!crew) {
    await prisma.crewInvite.update({ where: { id: invite.id }, data: { status: "CANCELLED" } });
    throw new CrewError("Esa tripulación ya no existe.");
  }
  // Same rules as joining by code: one crew at a time, same faction as the captain.
  await joinCrew(characterId, userId, crew.inviteCode);
  await prisma.crewInvite.updateMany({ where: { toCharacterId: me.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  await prisma.crewInvite.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
  notifyCharacters(await crewMemberIds(crew.id), "crew-changed");
  return { message: `Te has unido a ${crew.name}.` };
}

export async function cancelCrewInvite(characterId: string, userId: string, inviteId: string) {
  const me = await loadOwnedCharacter(characterId, userId);
  const invite = await prisma.crewInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.crewId !== me.crewId || invite.status !== "PENDING") throw new CrewError("Esa invitación ya no está disponible.");
  await prisma.crewInvite.update({ where: { id: invite.id }, data: { status: "CANCELLED" } });
  notifyCharacters([invite.toCharacterId], "crew-invite");
  return { message: "Invitación cancelada." };
}

export async function kickCrewMember(characterId: string, userId: string, targetId: string) {
  const me = await loadOwnedCharacter(characterId, userId);
  if (!me.crewId || !me.isCaptain) throw new CrewError("Solo el capitán puede expulsar a alguien.");
  if (targetId === me.id) throw new CrewError("Para irte usa «Abandonar».");
  const target = await prisma.character.findUnique({ where: { id: targetId } });
  if (!target || target.crewId !== me.crewId) throw new CrewError("Ese jugador no está en tu tripulación.");
  await prisma.character.update({ where: { id: target.id }, data: { crewId: null, isCaptain: true, partyId: null } });
  await prisma.gameLogEntry.create({ data: { characterId: target.id, kind: "crew", text: "El capitán te ha expulsado de la tripulación." } });
  notifyCharacters([target.id, ...(await crewMemberIds(me.crewId))], "crew-changed");
  return { message: `${target.name} ya no forma parte de la tripulación.` };
}

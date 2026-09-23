import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { attemptPrisonRescue, rescueSucceeded } from "../engine/rescue";
import { combatPower } from "../engine/encounter";
import { computeBailBerries } from "../engine/economy";
import { toCombatant } from "./derive";
import { postNews } from "./death-resolution";
import { CharacterStatus } from "@prisma/client";

export class PrisonError extends Error {}

export async function captureCharacter(
  character: {
    id: string;
    name: string;
    maxHp: number;
    currentIslandId: string;
    currentIsland: { name: string; dangerLevel: number };
    level: number;
    devilFruitId?: string | null;
  },
  capturedByPower: number,
  reason: string,
  newsLog: string[]
) {
  const hasDevilFruit = !!character.devilFruitId;
  await prisma.character.update({
    where: { id: character.id },
    data: { status: CharacterStatus.IMPRISONED, hp: Math.max(1, Math.round(character.maxHp * 0.15)) },
  });
  await prisma.imprisonment.create({
    data: {
      characterId: character.id,
      islandId: character.currentIslandId,
      reason,
      minRescueLevel: Math.round(capturedByPower),
      bailBerries: computeBailBerries(character.currentIsland.dangerLevel, character.level, hasDevilFruit),
    },
  });
  const headline = `${character.name} ha sido capturado en ${character.currentIsland.name}`;
  const kairosekiNote = hasDevilFruit ? " Le colocan grilletes de Kairoseki: su fruta no le servirá de nada mientras siga preso." : "";
  await postNews(
    headline,
    `${reason} Ahora espera tras las rejas: alguien deberá pagar su fianza o venir a rescatarlo.${kairosekiNote}`,
    "Gobierno Mundial",
    character.id,
    "major"
  );
  newsLog.push(headline);
}

async function loadImprisonedOwnedCharacter(characterId: string, userId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { imprisonment: { include: { island: true } } },
  });
  if (!character || character.userId !== userId) throw new PrisonError("Personaje no encontrado.");
  if (character.status !== CharacterStatus.IMPRISONED || !character.imprisonment) {
    throw new PrisonError("Este personaje no está encarcelado.");
  }
  return character;
}

export async function payBail(characterId: string, userId: string) {
  const character = await loadImprisonedOwnedCharacter(characterId, userId);
  const imprisonment = character.imprisonment!;
  if (imprisonment.bailBerries == null) throw new PrisonError("No se admite fianza para esta captura.");
  if (character.berries < imprisonment.bailBerries) throw new PrisonError("No tienes suficientes berries para la fianza.");

  await prisma.character.update({
    where: { id: character.id },
    data: { status: CharacterStatus.ALIVE, berries: character.berries - imprisonment.bailBerries, hp: Math.max(5, Math.round(character.maxHp * 0.3)) },
  });
  await prisma.imprisonment.update({ where: { id: imprisonment.id }, data: { releasedAt: new Date() } });
  await prisma.imprisonment.delete({ where: { id: imprisonment.id } });

  const log = [`Pagas ${imprisonment.bailBerries.toLocaleString("es-ES")} berries y recuperas tu libertad.`];
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "prison", text: log[0] } });
  return { log };
}

export async function attemptRescue(rescuerCharacterId: string, userId: string, prisonerCharacterId: string) {
  const rescuer = await prisma.character.findUnique({
    where: { id: rescuerCharacterId },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true },
  });
  if (!rescuer || rescuer.userId !== userId) throw new PrisonError("Personaje no encontrado.");
  if (rescuer.status !== CharacterStatus.ALIVE) throw new PrisonError("Tu personaje no puede intentar un rescate en este estado.");
  if (rescuer.id === prisonerCharacterId) throw new PrisonError("No puedes rescatarte a ti mismo.");

  const prisoner = await prisma.character.findUnique({
    where: { id: prisonerCharacterId },
    include: { imprisonment: true, currentIsland: true },
  });
  if (!prisoner || prisoner.status !== CharacterStatus.IMPRISONED || !prisoner.imprisonment) {
    throw new PrisonError("Ese personaje no está encarcelado.");
  }
  if (prisoner.imprisonment.islandId !== rescuer.currentIslandId) {
    throw new PrisonError("Debes estar en la misma isla que el prisionero para intentar rescatarlo.");
  }

  const rescuerPower = combatPower(toCombatant(rescuer));
  const check = attemptPrisonRescue(liveRng(), rescuerPower, prisoner.imprisonment.minRescueLevel, !!prisoner.devilFruitId);
  const newsLog: string[] = [];

  if (rescueSucceeded(check)) {
    await prisma.character.update({
      where: { id: prisoner.id },
      data: { status: CharacterStatus.ALIVE, hp: Math.max(5, Math.round(prisoner.maxHp * 0.3)) },
    });
    await prisma.imprisonment.update({ where: { id: prisoner.imprisonment.id }, data: { rescuedById: rescuer.id, releasedAt: new Date() } });
    await prisma.imprisonment.delete({ where: { id: prisoner.imprisonment.id } });

    const log = [`¡Logras liberar a ${prisoner.name}! Ambos escapan antes de que lleguen refuerzos.`];
    await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
    await prisma.gameLogEntry.create({ data: { characterId: prisoner.id, kind: "prison", text: `${rescuer.name} te rescata de tu celda.` } });
    const headline = `${rescuer.name} libera a ${prisoner.name}`;
    await postNews(headline, `En una fuga audaz en ${rescuer.currentIsland.name}, ${rescuer.name} logró sacar a ${prisoner.name} de su celda.`, "Gobierno Mundial", rescuer.id, "major");
    newsLog.push(headline);
    return { success: true, log, newsPosted: newsLog };
  }

  if (check.outcome === "critical_fail") {
    await captureCharacter(
      { ...rescuer, level: rescuer.level, currentIsland: rescuer.currentIsland },
      prisoner.imprisonment.minRescueLevel,
      `El intento de rescate de ${prisoner.name} salió terriblemente mal.`,
      newsLog
    );
    const log = [`El rescate fracasa por completo: ${rescuer.name} también es capturado.`];
    await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
    return { success: false, rescuerCaptured: true, log, newsPosted: newsLog };
  }

  const log = [`El intento de rescate fracasa. ${rescuer.name} logra retirarse antes de ser descubierto.`];
  await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
  return { success: false, rescuerCaptured: false, log, newsPosted: newsLog };
}

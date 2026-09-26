import { CharacterStatus } from "@prisma/client";
import { prisma } from "../db";
import { custodyExpired, custodyHint, isGovernmentIsland } from "../engine/custody";
import { captureReward } from "../engine/duel-outcome";
import { postNews } from "./death-resolution";
import { captureCharacter } from "./prison";
import { notifyCharacters } from "../realtime";

export class CustodyError extends Error {}

async function governmentIslandNames(): Promise<string[]> {
  const islands = await prisma.island.findMany({ select: { name: true, factionControl: true } });
  return islands.filter((i) => isGovernmentIsland(i.name, i.factionControl)).map((i) => i.name);
}

/** The winner of a lethal duel keeps the loser as a prisoner in transit: nothing is paid until the Government takes delivery. */
export async function takeCaptive(captor: { id: string; name: string }, captive: { id: string; name: string; maxHp: number; currentIslandId: string }, captorPower: number, place: string) {
  await prisma.character.update({ where: { id: captive.id }, data: { status: CharacterStatus.IMPRISONED, hp: Math.max(1, Math.round(captive.maxHp * 0.15)) } });
  await prisma.imprisonment.create({
    data: { characterId: captive.id, islandId: captive.currentIslandId, reason: `${captor.name} lo capturó en ${place} y lo lleva a la Marina.`, minRescueLevel: Math.round(captorPower), bailBerries: null, custodianId: captor.id },
  });
  await postNews(
    `${captor.name} captura a ${captive.name}`,
    `${captor.name} ha capturado a ${captive.name} en ${place} y lo lleva a una isla del Gobierno para entregarlo. Quien quiera impedirlo, tiene que alcanzarlos antes.`,
    "Gobierno Mundial",
    captor.id,
    "major",
    { locationName: place, islandId: captive.currentIslandId }
  );
  notifyCharacters([captor.id, captive.id], "custody");
}

/** Captives sail with their captor. */
export async function moveCaptivesWith(captorId: string, islandId: string) {
  const held = await prisma.imprisonment.findMany({ where: { custodianId: captorId, releasedAt: null }, select: { id: true, characterId: true } });
  if (held.length === 0) return;
  await prisma.character.updateMany({ where: { id: { in: held.map((h) => h.characterId) } }, data: { currentIslandId: islandId } });
  await prisma.imprisonment.updateMany({ where: { id: { in: held.map((h) => h.id) } }, data: { islandId } });
}

export async function hasCaptives(captorId: string): Promise<boolean> {
  return (await prisma.imprisonment.count({ where: { custodianId: captorId, releasedAt: null } })) > 0;
}

async function freeCaptive(imprisonmentId: string, characterId: string) {
  await prisma.imprisonment.update({ where: { id: imprisonmentId }, data: { releasedAt: new Date() } });
  await prisma.character.update({ where: { id: characterId }, data: { status: CharacterStatus.ALIVE } });
  notifyCharacters([characterId], "custody");
}

/** A captive escapes when the day is up or the captor is no longer around to hold them. */
export async function settleCustodyFor(characterId: string) {
  const asCaptive = await prisma.imprisonment.findFirst({ where: { characterId, custodianId: { not: null }, releasedAt: null } });
  const asCaptor = await prisma.imprisonment.findMany({ where: { custodianId: characterId, releasedAt: null } });
  for (const im of [...(asCaptive ? [asCaptive] : []), ...asCaptor]) {
    const captor = await prisma.character.findUnique({ where: { id: im.custodianId! }, select: { status: true, currentIslandId: true, name: true } });
    const captive = await prisma.character.findUnique({ where: { id: im.characterId }, select: { name: true, currentIslandId: true } });
    const gone = !captor || captor.status !== CharacterStatus.ALIVE;
    if (gone || custodyExpired(im.capturedAt, new Date())) {
      await freeCaptive(im.id, im.characterId);
      if (captive) await postNews(`${captive.name} escapa de su captor`, gone ? `${captive.name} aprovecha que su captor ya no puede vigilarlo y se libera.` : `${captive.name} logró soltarse de ${captor!.name} antes de llegar a una isla del Gobierno.`, "Gobierno Mundial", im.characterId, "normal");
    }
  }
}

export async function getCaptivesView(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me) return null;
  const held = await prisma.imprisonment.findMany({ where: { custodianId: characterId, releasedAt: null }, include: { character: { select: { id: true, name: true, level: true, faction: true, bounty: true, notoriety: true } } } });
  if (held.length === 0) return null;
  const govNames = await governmentIslandNames();
  const here = isGovernmentIsland(me.currentIsland.name, me.currentIsland.factionControl);
  return {
    islandName: me.currentIsland.name,
    governmentHere: here,
    hint: custodyHint(here, govNames),
    captives: held.map((h) => ({ id: h.character.id, name: h.character.name, level: h.character.level, reward: captureReward(h.character.faction, h.character.bounty, h.character.notoriety), msLeft: Math.max(0, h.capturedAt.getTime() + 24 * 3600_000 - Date.now()) })),
  };
}

async function loadHeld(captorId: string, userId: string, captiveId: string) {
  const me = await prisma.character.findUnique({ where: { id: captorId }, include: { currentIsland: true } });
  if (!me || me.userId !== userId) throw new CustodyError("Personaje no encontrado.");
  if (me.status !== CharacterStatus.ALIVE) throw new CustodyError("No puedes hacer esto en tu estado actual.");
  const im = await prisma.imprisonment.findFirst({ where: { characterId: captiveId, custodianId: captorId, releasedAt: null }, include: { character: { include: { currentIsland: true } } } });
  if (!im) throw new CustodyError("Ese prisionero ya no está a tu cargo.");
  return { me, im };
}

/** At a Government island: hand the captive over (real prison, Impel Down by bounty) and collect the reward. */
export async function deliverCaptive(captorId: string, userId: string, captiveId: string) {
  const { me, im } = await loadHeld(captorId, userId, captiveId);
  if (!isGovernmentIsland(me.currentIsland.name, me.currentIsland.factionControl)) throw new CustodyError("Aquí no hay nadie del Gobierno que reciba al prisionero. Llévalo a una isla de la Marina o del Gobierno.");
  if (im.character.currentIslandId !== me.currentIslandId) throw new CustodyError("El prisionero no está contigo.");
  const captive = im.character;
  await prisma.imprisonment.delete({ where: { id: im.id } });
  const newsLog: string[] = [];
  await captureCharacter(
    { id: captive.id, name: captive.name, maxHp: captive.maxHp, currentIslandId: captive.currentIslandId, currentIsland: captive.currentIsland, level: captive.level, devilFruitId: captive.devilFruitId, faction: captive.faction, bounty: captive.bounty, notoriety: captive.notoriety },
    im.minRescueLevel,
    `${me.name} lo entregó a la Marina en ${me.currentIsland.name}.`,
    newsLog
  );
  const reward = captureReward(captive.faction, captive.bounty, captive.notoriety);
  if (reward > 0) await prisma.character.update({ where: { id: me.id }, data: { berries: { increment: reward } } });
  await postNews(
    `${me.name} entrega a ${captive.name} al Gobierno`,
    `${me.name} ha entregado a ${captive.name} en ${me.currentIsland.name}${reward > 0 ? ` y cobra ฿ ${reward.toLocaleString("es-ES")} de recompensa` : ""}.`,
    "Gobierno Mundial",
    me.id,
    "major"
  );
  notifyCharacters([me.id, captive.id], "custody");
  return { log: [`Entregas a ${captive.name} al Gobierno.${reward > 0 ? ` Cobras ฿ ${reward.toLocaleString("es-ES")}.` : ""}`] };
}

export async function releaseCaptive(captorId: string, userId: string, captiveId: string) {
  const { me, im } = await loadHeld(captorId, userId, captiveId);
  await freeCaptive(im.id, im.characterId);
  await postNews(`${me.name} suelta a ${im.character.name}`, `${me.name} deja libre a su prisionero ${im.character.name}.`, "Gobierno Mundial", me.id, "normal");
  return { log: [`Sueltas a ${im.character.name}.`] };
}

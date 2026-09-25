import { CharacterStatus } from "@prisma/client";
import { prisma } from "../db";
import { DENDEN_HISTORY, channelFor, channelLabel, cleanMessage, crewChannelKey, tooFast, type ChatScope } from "../engine/denden";

export class DenDenError extends Error {}

async function requireOwned(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { id: true, userId: true, name: true, faction: true, status: true, crewId: true, crew: { select: { name: true } } } });
  if (!c || c.userId !== userId) throw new DenDenError("Personaje no encontrado.");
  return c;
}

/** The last messages of this character's own faction channel, oldest first. */
export async function getDenDen(characterId: string, userId: string, scope: ChatScope = "faction") {
  const c = await requireOwned(characterId, userId);
  if (scope === "crew" && !c.crewId) throw new DenDenError("No tienes tripulación: no hay canal de tripulación.");
  const channel = scope === "crew" ? crewChannelKey(c.crewId!) : channelFor(c.faction);
  const rows = await prisma.denDenMessage.findMany({ where: { faction: channel }, orderBy: { createdAt: "desc" }, take: DENDEN_HISTORY });
  return {
    channel: scope === "crew" ? c.crew?.name ?? "Tripulación" : channelLabel(c.faction),
    scope,
    hasCrew: !!c.crewId,
    crewName: c.crew?.name ?? null,
    factionLabel: channelLabel(c.faction),
    messages: rows.reverse().map((m) => ({ id: m.id, authorName: m.authorName, mine: m.authorCharacterId === c.id, text: m.text, at: m.createdAt })),
  };
}

export async function sendDenDen(characterId: string, userId: string, text: string, scope: ChatScope = "faction") {
  const c = await requireOwned(characterId, userId);
  if (c.status !== CharacterStatus.ALIVE) throw new DenDenError("Solo un personaje vivo y libre puede usar el Den Den Mushi.");
  const clean = cleanMessage(text);
  if (!clean) throw new DenDenError("El mensaje está vacío o es demasiado largo.");
  const last = await prisma.denDenMessage.findFirst({ where: { authorCharacterId: c.id }, orderBy: { createdAt: "desc" } });
  if (tooFast(last?.createdAt.getTime() ?? null, Date.now())) throw new DenDenError("Espera un momento antes de volver a hablar.");
  if (scope === "crew" && !c.crewId) throw new DenDenError("No tienes tripulación: no hay canal de tripulación.");
  // The channel always comes from the character (faction or own crew), never from the request: nobody can talk into another one.
  await prisma.denDenMessage.create({ data: { faction: scope === "crew" ? crewChannelKey(c.crewId!) : channelFor(c.faction), authorCharacterId: c.id, authorName: c.name, text: clean } });
  return { ok: true };
}

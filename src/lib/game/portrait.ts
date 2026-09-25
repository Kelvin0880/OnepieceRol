import { prisma } from "../db";
import { parseEmblemDataUrl } from "../engine/crew-emblem";

export class PortraitError extends Error {}

/** Owner-only: sets (or removes, with null) the picture on the character's wanted poster. Same validation as crew flags. */
export async function setCharacterPortrait(characterId: string, userId: string, dataUrl: string | null) {
  const character = await prisma.character.findUnique({ where: { id: characterId }, select: { userId: true } });
  if (!character || character.userId !== userId) throw new PortraitError("Personaje no encontrado.");
  if (dataUrl === null) {
    await prisma.characterPortrait.deleteMany({ where: { characterId } });
    await prisma.character.update({ where: { id: characterId }, data: { portraitUpdatedAt: null } });
    return { message: "Foto eliminada." };
  }
  const parsed = parseEmblemDataUrl(dataUrl);
  if (!parsed.ok) throw new PortraitError(parsed.reason);
  const now = new Date();
  const image = new Uint8Array(parsed.bytes);
  await prisma.characterPortrait.upsert({
    where: { characterId },
    create: { characterId, image, mimeType: parsed.mime, updatedAt: now },
    update: { image, mimeType: parsed.mime, updatedAt: now },
  });
  await prisma.character.update({ where: { id: characterId }, data: { portraitUpdatedAt: now } });
  return { message: "Foto actualizada." };
}

import { prisma } from "../db";
import { eligibleSecrets, pickSecret, HOUR_MS, type IslandSecret } from "../engine/island-secrets";
import { ISLAND_SECRETS } from "./island-secrets-data";
import { grantItem, grantWeapon, grantCatalogFruit } from "./inventory";
import { grantXp } from "./xp";

const FRUIT_BAG_FULL_BERRIES = 25_000;

/** Claims the find atomically: false when a double click or a parallel request already took it. */
async function claim(characterId: string, s: IslandSecret, now: Date, previous: Date | undefined): Promise<boolean> {
  if (previous) {
    const cutoff = new Date(now.getTime() - (s.cooldownHours ?? 0) * HOUR_MS);
    const r = await prisma.islandSecretFound.updateMany({ where: { characterId, secretId: s.id, foundAt: { lte: cutoff } }, data: { foundAt: now } });
    return s.cooldownHours !== null && r.count === 1;
  }
  try {
    await prisma.islandSecretFound.create({ data: { characterId, secretId: s.id, foundAt: now } });
    return true;
  } catch {
    return false;
  }
}

/**
 * After a successful, non-combat exploration: maybe stumble on one of this island's hand-written secrets.
 * Code decides whether it happens (stable hash per character, secret and hour) and what it pays; the text is fixed.
 */
export async function tryIslandSecret(characterId: string, level: number, islandName: string, now = new Date()): Promise<string[]> {
  const rows = await prisma.islandSecretFound.findMany({ where: { characterId } });
  const found = new Map(rows.map((r) => [r.secretId, r.foundAt]));
  const secret = pickSecret(eligibleSecrets(ISLAND_SECRETS, islandName, level, found, now), characterId, now);
  if (!secret) return [];
  if (!(await claim(characterId, secret, now, found.get(secret.id)))) return [];

  const r = secret.reward;
  const log = [`✦ ${secret.title}. ${secret.discovery}`];
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { berries: true, experience: true, level: true } });
  if (!c) return log;
  let berries = r.berries ?? 0;
  const lines: string[] = [];
  if (r.fruit) {
    const got = await grantCatalogFruit(characterId, r.fruit);
    if (got) lines.push(`¡Es una Fruta del Diablo: la ${got}! Está en tu mochila; en el Inventario decides si te la comes.`);
    else berries += FRUIT_BAG_FULL_BERRIES;
    if (!got) lines.push("Había una Fruta del Diablo, pero no tienes dónde guardarla: la cambias al instante por un buen puñado de berries.");
  }
  for (const it of r.items ?? []) {
    const line = await grantItem(characterId, it.id, it.qty);
    if (line) lines.push(line);
  }
  if (r.weapon) {
    const name = await grantWeapon(characterId, r.weapon);
    lines.push(`Entre lo hallado hay un arma: ${name}. La guardas en tu inventario.`);
  }
  if (berries > 0) lines.push(`Te llevas ฿ ${berries.toLocaleString("es-ES")}.`);
  const data: { berries?: number; experience?: number; level?: number } = {};
  if (berries > 0) data.berries = c.berries + berries;
  if (r.xp && r.xp > 0) {
    const g = await grantXp(c.experience, c.level, r.xp);
    data.experience = g.xp;
    data.level = g.level;
    lines.push(`+${r.xp} de experiencia${g.leveledUp ? `; subes al nivel ${g.level}` : ""}.`);
  }
  if (Object.keys(data).length > 0) await prisma.character.update({ where: { id: characterId }, data });
  return [...log, ...lines];
}

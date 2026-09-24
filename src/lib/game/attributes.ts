import { prisma } from "../db";
import { validateAllocation, pointsOwed, type Allocation, type Attributes } from "../engine/attributes";

export class AttributeError extends Error {}

/** Grants the points earned by levelling since the last grant. Race-safe: only one concurrent caller wins the update. */
export async function syncAttributePoints(characterId: string): Promise<number> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { level: true, attrLevelGranted: true, attributePoints: true } });
  if (!c) return 0;
  const owed = pointsOwed(c.attrLevelGranted, c.level);
  if (owed <= 0 && c.attrLevelGranted >= c.level) return c.attributePoints;
  const res = await prisma.character.updateMany({
    where: { id: characterId, attrLevelGranted: c.attrLevelGranted },
    data: { attributePoints: { increment: owed }, attrLevelGranted: Math.max(c.level, c.attrLevelGranted) },
  });
  return c.attributePoints + (res.count > 0 ? owed : 0);
}

export async function spendAttributePoints(characterId: string, userId: string, alloc: Allocation) {
  await syncAttributePoints(characterId);
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.userId !== userId) throw new AttributeError("Personaje no encontrado.");
  if (c.status !== "ALIVE") throw new AttributeError("Este personaje ya no puede entrenar sus atributos.");
  const current: Attributes = { strength: c.strength, agility: c.agility, durability: c.durability, willpower: c.willpower, intellect: c.intellect };
  const check = validateAllocation(current, alloc, c.attributePoints, c.level);
  if (!check.ok) throw new AttributeError(check.reason);
  // updateMany with the observed point balance: two simultaneous submits cannot spend the same points twice.
  const res = await prisma.character.updateMany({
    where: { id: characterId, attributePoints: c.attributePoints },
    data: {
      attributePoints: c.attributePoints - check.total,
      strength: c.strength + check.gains.strength,
      agility: c.agility + check.gains.agility,
      durability: c.durability + check.gains.durability,
      willpower: c.willpower + check.gains.willpower,
      intellect: c.intellect + check.gains.intellect,
      maxHp: c.maxHp + check.maxHpGain,
      hp: c.hp + check.maxHpGain,
      maxStamina: c.maxStamina + check.maxStaminaGain,
    },
  });
  if (res.count === 0) throw new AttributeError("Tus puntos cambiaron mientras repartías: inténtalo de nuevo.");
  await prisma.gameLogEntry.create({ data: { characterId, kind: "attributes", text: `Repartes ${check.total} punto${check.total === 1 ? "" : "s"} de atributo.` } });
  return { spent: check.total, remaining: c.attributePoints - check.total };
}

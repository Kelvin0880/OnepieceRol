import { prisma } from "../db";
import { xpToNextLevel } from "../engine/economy";
import { levelCap, settleBank } from "../engine/training";
import { grantXp } from "./xp";

export const CAP_GIFT_KIND = "gift-level-caps";
export const CAP_GIFT_BERRIES = 100_000;

/**
 * Keeps Haki and fruit mastery within what the level allows, lazily (called from the character GET, like
 * syncAttributePoints): anything above goes to the reserve, banked points come back on a level up. Self-healing for
 * every path that can leave a stat above its ceiling — the one-time cap rollout, a rollback to a lower level, an
 * admin level change. Claims the row by the values it read, so a concurrent training session is never overwritten.
 */
export async function syncProgressionCaps(characterId: string): Promise<void> {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    select: { level: true, armamentHaki: true, observationHaki: true, fruitMastery: true, bankedArmament: true, bankedObservation: true, bankedFruit: true },
  });
  if (!c) return;
  const cap = levelCap(c.level);
  const a = settleBank(c.armamentHaki, c.bankedArmament, cap);
  const o = settleBank(c.observationHaki, c.bankedObservation, cap);
  const f = settleBank(c.fruitMastery, c.bankedFruit, cap);
  const unchanged =
    a.value === c.armamentHaki && a.bank === c.bankedArmament && o.value === c.observationHaki && o.bank === c.bankedObservation && f.value === c.fruitMastery && f.bank === c.bankedFruit;
  if (unchanged) return;
  await prisma.character.updateMany({
    where: {
      id: characterId,
      level: c.level,
      armamentHaki: c.armamentHaki,
      observationHaki: c.observationHaki,
      fruitMastery: c.fruitMastery,
      bankedArmament: c.bankedArmament,
      bankedObservation: c.bankedObservation,
      bankedFruit: c.bankedFruit,
    },
    data: {
      armamentHaki: a.value,
      bankedArmament: a.bank,
      observationHaki: o.value,
      bankedObservation: o.bank,
      fruitMastery: f.value,
      bankedFruit: f.bank,
    },
  });
}

/**
 * The owner's apology gift for the level-cap rollout (2026-10-04), for every living or imprisoned character: one
 * full level (current progress towards the next one kept), berries, and life and stamina refilled. Applied after the
 * caps, so the new level immediately gives back part of whatever went to the reserve. Idempotent per character
 * (a marked log entry), so running the rollout twice can never pay twice.
 */
export async function grantCapRolloutGift(characterId: string): Promise<{ granted: boolean; text: string }> {
  if (await prisma.gameLogEntry.findFirst({ where: { characterId, kind: CAP_GIFT_KIND } })) return { granted: false, text: "" };
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.status === "DEAD") return { granted: false, text: "" };

  await syncProgressionCaps(characterId);
  const before = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
  const lv = await grantXp(before.experience, before.level, xpToNextLevel(before.level));
  await prisma.character.update({
    where: { id: characterId },
    data: { level: lv.level, experience: lv.xp, berries: { increment: CAP_GIFT_BERRIES }, hp: before.maxHp, stamina: before.maxStamina, staminaUpdatedAt: new Date() },
  });
  await syncProgressionCaps(characterId);
  const after = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });

  const reserve = [
    ["Armadura", after.bankedArmament],
    ["Observación", after.bankedObservation],
    ["Dominio de la fruta", after.bankedFruit],
  ].filter(([, n]) => (n as number) > 0);
  const parts = [
    `Regalo por el cambio de reglas: subes al nivel ${after.level}, recibes ฿ ${CAP_GIFT_BERRIES.toLocaleString("es-ES")} y recuperas toda tu vida y tu aguante.`,
    `Desde ahora el Haki y el dominio de la fruta crecen hasta el tope de tu nivel (${levelCap(after.level)} a nivel ${after.level}; el máximo, 100, se abre en el nivel 24).`,
    reserve.length
      ? `Nada de lo que entrenaste se ha perdido: ${reserve.map(([l, n]) => `${l} +${n}`).join(", ")} queda en reserva y vuelve solo a medida que subes de nivel.`
      : "",
  ].filter(Boolean);
  const text = parts.join(" ");
  await prisma.gameLogEntry.create({ data: { characterId, kind: CAP_GIFT_KIND, text } });
  return { granted: true, text };
}

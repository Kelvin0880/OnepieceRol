import type { EnemyKit } from "./enemy-kit";

const SEASTONE = /kairoseki|piedra marina|seastone|agua de mar|seawater/i;

/**
 * True only when the attacker certainly cannot hurt a Logia body. Deliberately conservative: any Haki, any fruit
 * (same element cannot be ruled out) or anything seastone lets the AI's verdict stand untouched.
 */
export function logiaImmuneTo(kit: Pick<EnemyKit, "armamentHaki" | "conqueror" | "fruit" | "secondFruit" | "weapon" | "abilities">): boolean {
  if (kit.armamentHaki > 0 || kit.conqueror) return false;
  if (kit.fruit || kit.secondFruit) return false;
  return ![kit.weapon ?? "", ...kit.abilities].some((t) => SEASTONE.test(t));
}

export type Condition = "ileso" | "rasguñado" | "herido" | "malherido" | "al borde de la muerte";

const LABELS: Record<Condition, string> = {
  ileso: "Ileso",
  rasguñado: "Rasguñado",
  herido: "Herido",
  malherido: "Malherido",
  "al borde de la muerte": "Al borde de la muerte",
};

/**
 * One Piece bodies take an absurd amount of punishment before going down —
 * thresholds sit low on purpose so a character reads as "fine" for most of
 * their health bar and only turns dramatic near the very end.
 */
export function characterCondition(hp: number, maxHp: number): Condition {
  const pct = maxHp <= 0 ? 0 : hp / maxHp;
  if (pct <= 0) return "al borde de la muerte";
  if (pct < 0.15) return "al borde de la muerte";
  if (pct < 0.35) return "malherido";
  if (pct < 0.6) return "herido";
  if (pct < 0.9) return "rasguñado";
  return "ileso";
}

export function conditionLabel(condition: Condition): string {
  return LABELS[condition];
}

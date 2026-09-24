export const ATTRIBUTE_KEYS = ["strength", "agility", "durability", "willpower", "intellect"] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;
export type Allocation = Partial<Record<AttributeKey, number>>;

export const POINTS_PER_LEVEL = 2;
export const HP_PER_DURABILITY_POINT = 3;
export const STAMINA_PER_WILLPOWER_POINT = 2;

export const ATTRIBUTE_INFO: Record<AttributeKey, { label: string; effect: string }> = {
  strength: { label: "Fuerza", effect: "Más daño en cada golpe." },
  agility: { label: "Agilidad", effect: "Golpeas antes, esquivas y huyes mejor." },
  durability: { label: "Resistencia", effect: "Menos daño recibido y +3 de vida máxima por punto." },
  willpower: { label: "Voluntad", effect: "Entrena Haki más rápido, resiste la muerte y +2 de aguante por punto." },
  intellect: { label: "Intelecto", effect: "Mejores tácticas, domina antes la fruta y convence y escapa mejor." },
};

/** Nobody can pour everything into one stat: the ceiling grows with the level. */
export function attributeCap(level: number): number {
  return 12 + 3 * Math.max(1, level);
}

/** Points earned by levelling that have not been granted yet (lazy, idempotent: also covers characters created before this system). */
export function pointsOwed(levelGranted: number, level: number): number {
  return Math.max(0, level - Math.max(1, levelGranted)) * POINTS_PER_LEVEL;
}

export type AllocationCheck =
  | { ok: true; total: number; gains: Attributes; maxHpGain: number; maxStaminaGain: number }
  | { ok: false; reason: string };

export function validateAllocation(current: Attributes, alloc: Allocation, available: number, level: number): AllocationCheck {
  const gains = { strength: 0, agility: 0, durability: 0, willpower: 0, intellect: 0 } as Attributes;
  let total = 0;
  for (const [k, v] of Object.entries(alloc)) {
    if (!(ATTRIBUTE_KEYS as readonly string[]).includes(k)) return { ok: false, reason: "Atributo desconocido." };
    if (!Number.isInteger(v) || (v as number) < 0) return { ok: false, reason: "Cada reparto debe ser un número entero, sin negativos." };
    gains[k as AttributeKey] = v as number;
    total += v as number;
  }
  if (total <= 0) return { ok: false, reason: "No has repartido ningún punto." };
  if (total > available) return { ok: false, reason: `Solo tienes ${available} punto${available === 1 ? "" : "s"} disponible${available === 1 ? "" : "s"}.` };
  const cap = attributeCap(level);
  for (const k of ATTRIBUTE_KEYS) {
    if (current[k] + gains[k] > cap) return { ok: false, reason: `${ATTRIBUTE_INFO[k].label} no puede pasar de ${cap} a nivel ${level}.` };
  }
  return { ok: true, total, gains, maxHpGain: gains.durability * HP_PER_DURABILITY_POINT, maxStaminaGain: gains.willpower * STAMINA_PER_WILLPOWER_POINT };
}

/** A sharp mind turns a described plan into a slightly better roll; a dull one costs a little. Bounded so the dice still rule. */
export function intellectTacticEdge(intellect: number): number {
  return Math.max(-1, Math.min(6, Math.round((intellect - 5) * 0.25)));
}

/** One line for the narrator: the sheet in words, so the story matches the numbers. */
export function describeAttributes(a: Attributes): string {
  const word = (n: number) => (n >= 60 ? "descomunal" : n >= 40 ? "sobresaliente" : n >= 25 ? "notable" : n >= 12 ? "normal" : "modesta");
  return ATTRIBUTE_KEYS.map((k) => `${ATTRIBUTE_INFO[k].label} ${a[k]} (${word(a[k])})`).join(", ");
}

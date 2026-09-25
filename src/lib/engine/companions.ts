/**
 * NPC nakamas: recruitable crewmates who level up with their captain so nobody
 * gets left behind. Their numbers derive from (role, owner level, loyalty) —
 * nothing to grind and nothing to drift out of sync. Pure: no DB.
 */
import type { Rng } from "./rng";

export const MAX_COMPANIONS = 3;

interface Archetype {
  label: string;
  match: RegExp;
  atk: number;
  def: number;
  spd: number;
  hp: number;
  /** Unlocked at levels 1, 5 and 12. */
  abilities: [string, string, string];
}

const ARCHETYPES: Archetype[] = [
  { label: "Espadachín", match: /espad|sam[uú]rai|ronin|guerrer|luchador|soldado/i, atk: 1.15, def: 1.0, spd: 1.0, hp: 1.1, abilities: ["Tajo directo", "Guardia cerrada", "Corte doble"] },
  { label: "Navegante", match: /navegan|piloto|timonel|cart[oó]graf/i, atk: 0.6, def: 0.7, spd: 1.15, hp: 0.8, abilities: ["Lee el mar y el clima", "Traza rutas seguras", "Tormenta táctica"] },
  { label: "Cocinero", match: /cociner|chef|coci/i, atk: 0.9, def: 0.9, spd: 1.0, hp: 1.0, abilities: ["Patadas de cocina", "Raciones que reaniman", "Banquete de batalla"] },
  { label: "Médico", match: /m[eé]dic|doctor|curand|enfermer|sanador/i, atk: 0.5, def: 0.8, spd: 0.95, hp: 0.9, abilities: ["Primeros auxilios", "Estabiliza a un aliado", "Cirugía de campo"] },
  { label: "Francotirador", match: /francotirador|tirador|arquer|ballest|artiller/i, atk: 1.0, def: 0.6, spd: 0.9, hp: 0.85, abilities: ["Tiro certero", "Disparo de cobertura", "Bala de precisión"] },
  { label: "Músico", match: /m[uú]sic|bardo|cantant|juglar/i, atk: 0.7, def: 0.7, spd: 1.0, hp: 0.85, abilities: ["Canción que anima", "Nota discordante", "Himno de la tripulación"] },
  { label: "Carpintero", match: /carpint|ingenier|mec[aá]nic|constructor|herrero|artesan/i, atk: 0.8, def: 1.2, spd: 0.85, hp: 1.1, abilities: ["Repara el barco", "Artilugio de emergencia", "Fortificación improvisada"] },
  { label: "Erudito", match: /arque[oó]log|erudit|sabio|escriba|historiador/i, atk: 0.6, def: 0.7, spd: 0.9, hp: 0.8, abilities: ["Descifra escrituras", "Conoce el mundo", "Punto débil del enemigo"] },
  { label: "Guardaespaldas", match: /guardaespald|escolta|bruto|gigante|coloso|mat[oó]n/i, atk: 1.1, def: 1.3, spd: 0.8, hp: 1.3, abilities: ["Muro humano", "Placaje", "Aguante inquebrantable"] },
];

const FALLBACK: Archetype = { label: "Compañero", match: /./, atk: 0.85, def: 0.85, spd: 0.9, hp: 0.9, abilities: ["Ayuda en lo que puede", "Espíritu de equipo", "Al lado de su capitán"] };

function archetypeFor(role: string): Archetype {
  return ARCHETYPES.find((a) => a.match.test(role)) ?? FALLBACK;
}

export function normalizeRole(text: string | undefined | null): string {
  const t = (text ?? "").trim();
  if (!t) return FALLBACK.label;
  const a = ARCHETYPES.find((x) => x.match.test(t));
  return a ? a.label : t.slice(0, 30);
}

export function companionMaxHp(level: number, role: string): number {
  return Math.max(20, Math.round((60 + 6 * (Math.max(1, level) - 1)) * archetypeFor(role).hp));
}

export function loyaltyRank(loyalty: number): string {
  if (loyalty >= 60) return "Nakama";
  if (loyalty >= 30) return "Compañero";
  return "Recién llegado";
}

export interface CompanionProfile {
  epithet?: string;
  abilities?: string[];
  styleId?: string;
  attrs?: { strength: number; agility: number; durability: number; willpower: number; intellect: number };
}

/** Never trusts stored JSON: anything malformed reads as "no profile". */
export function parseCompanionProfile(json: string | null | undefined): CompanionProfile | null {
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : 0);
    const a = raw.attrs as Record<string, unknown> | undefined;
    return {
      epithet: typeof raw.epithet === "string" ? raw.epithet.slice(0, 60) : undefined,
      abilities: Array.isArray(raw.abilities) ? raw.abilities.filter((x): x is string => typeof x === "string").slice(0, 6) : undefined,
      styleId: typeof raw.styleId === "string" ? raw.styleId : undefined,
      attrs: a ? { strength: num(a.strength), agility: num(a.agility), durability: num(a.durability), willpower: num(a.willpower), intellect: num(a.intellect) } : undefined,
    };
  } catch {
    return null;
  }
}

export interface CompanionSheet {
  level: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  abilities: string[];
  rank: string;
  epithet?: string;
  styleId?: string;
}

/**
 * A companion is always at their captain's level: that is how they "level up with you".
 * A hand-written profile (named commanders) replaces the role's ability list and adds its attributes on top.
 */
export function companionSheet(role: string, ownerLevel: number, loyalty: number, profile?: CompanionProfile | null): CompanionSheet {
  const a = archetypeFor(role);
  const lvl = Math.max(1, ownerLevel);
  const atkBase = 8 + lvl * 2 + Math.round(loyalty / 20);
  const defBase = 5 + lvl;
  const spdBase = 7 + lvl;
  const unlocked = a.abilities.filter((_, i) => lvl >= [1, 5, 12][i]);
  const at = profile?.attrs;
  const abilities = profile?.abilities?.length ? [...profile.abilities, ...unlocked.filter((u) => !profile.abilities!.includes(u))] : unlocked;
  return {
    level: lvl,
    maxHp: companionMaxHp(lvl, role) + (at ? at.durability * 3 : 0),
    atk: Math.max(1, Math.round(atkBase * a.atk + (at ? at.strength * 0.4 : 0))),
    def: Math.max(1, Math.round(defBase * a.def + (at ? at.durability * 0.3 : 0))),
    spd: Math.max(1, Math.round(spdBase * a.spd + (at ? at.agility * 0.3 : 0))),
    abilities,
    rank: loyaltyRank(loyalty),
    epithet: profile?.epithet,
    styleId: profile?.styleId,
  };
}

export type RecruitTier = "weak" | "average" | "tough" | "elite";
const TIER_PENALTY: Record<RecruitTier, number> = { weak: 0, average: 5, tough: 15, elite: 30 };

export interface RecruitInput {
  willpower: number;
  intellect: number;
  /** The pitch quality as judged by the classifier, [-15, 20]. */
  tacticModifier: number;
  tier: RecruitTier;
}

/** Persuasion is a real roll: a good pitch helps, a proud or powerful target resists. */
export function recruitChance(i: RecruitInput): number {
  const raw = 35 + i.willpower * 0.4 + i.intellect * 0.3 + i.tacticModifier * 0.8 - TIER_PENALTY[i.tier];
  return Math.max(15, Math.min(90, Math.round(raw)));
}

export function rollRecruit(rng: Rng, chance: number): boolean {
  return rng() * 100 < chance;
}

/** Starting loyalty: a convincing pitch buys a warmer start. */
export function startingLoyalty(tacticModifier: number): number {
  return Math.max(35, Math.min(75, 50 + Math.round(tacticModifier)));
}

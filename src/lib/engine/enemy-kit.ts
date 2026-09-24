/**
 * What an enemy (or NPC ally) can actually DO in a fight: Haki, Devil Fruit and
 * its phase, weapon and signature moves. The engine already prices their raw
 * strength (atk/def/level); the kit is what the narrator must play in full —
 * an admiral uses his fruit, a veteran hardens his blade with Armament — and
 * nothing beyond it. Named characters declare theirs (WorldActor); random ones
 * get a deterministic kit that grows with level, so the world gets scarier as
 * players climb. Pure.
 */
import type { EnemyTier } from "./scene-enemy";

export type KitFruitPhase = "initial" | "advanced" | "awakened";

export interface EnemyKit {
  armamentHaki: number;
  observationHaki: number;
  conqueror: boolean;
  fruit?: { name: string; phase: KitFruitPhase };
  weapon?: string;
  abilities: string[];
}

export interface KitInput {
  name: string;
  level: number;
  isBoss: boolean;
  tier?: EnemyTier;
  /** Facts a named character declares; anything given here wins over the derived values. */
  declared?: Partial<EnemyKit>;
  /** Non-singleton fruit names a random strong enemy may carry. */
  fruitPool?: string[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Stable small integer from a name, so the same enemy always has the same kit. */
export function nameHash(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

/** Random strong enemies may carry a fruit: none below level 10, then a growing chance for tough/elite/boss enemies. */
export function fruitChance(level: number, tier: EnemyTier | undefined, isBoss: boolean): number {
  if (level < 10) return 0;
  const base = Math.min(0.5, 0.08 + (level - 10) * 0.012);
  if (isBoss || tier === "elite") return Math.min(0.7, base * 1.6);
  if (tier === "tough") return base;
  return base * 0.4;
}

export function fruitPhaseForLevel(level: number, isBoss: boolean): KitFruitPhase {
  const l = level + (isBoss ? 6 : 0);
  if (l >= 45) return "awakened";
  if (l >= 22) return "advanced";
  return "initial";
}

export function deriveEnemyKit(input: KitInput): EnemyKit {
  const { level, isBoss, tier } = input;
  const boost = isBoss || tier === "elite" ? 10 : 0;
  const derived: EnemyKit = {
    armamentHaki: level <= 4 ? 0 : clamp((level - 4) * 2.2 + boost),
    observationHaki: level <= 8 ? 0 : clamp((level - 8) * 2 + boost * 0.6),
    conqueror: isBoss && level >= 40,
    abilities: [],
  };
  const h = nameHash(input.name);
  if (input.fruitPool && input.fruitPool.length > 0 && (h % 1000) / 1000 < fruitChance(level, tier, isBoss)) {
    derived.fruit = { name: input.fruitPool[h % input.fruitPool.length], phase: fruitPhaseForLevel(level, isBoss) };
  }
  const d = input.declared ?? {};
  return {
    armamentHaki: d.armamentHaki ?? derived.armamentHaki,
    observationHaki: d.observationHaki ?? derived.observationHaki,
    conqueror: d.conqueror ?? derived.conqueror,
    fruit: d.fruit ?? derived.fruit,
    weapon: d.weapon ?? derived.weapon,
    abilities: d.abilities && d.abilities.length > 0 ? d.abilities : derived.abilities,
  };
}

function hakiWord(v: number): string {
  if (v <= 0) return "no lo domina";
  if (v < 25) return "básico";
  if (v < 55) return "competente";
  if (v < 80) return "avanzado";
  return "maestro";
}

const PHASE_WORD: Record<KitFruitPhase, string> = { initial: "dominio inicial", advanced: "dominio avanzado", awakened: "DESPERTADA (efectos sobre el entorno)" };

/** The kit in words for the narrator: what to play, and what NOT to invent. */
export function describeEnemyKit(name: string, kit: EnemyKit): string {
  const parts: string[] = [];
  parts.push(`Haki de Armadura: ${hakiWord(kit.armamentHaki)}${kit.armamentHaki > 0 ? ` (${kit.armamentHaki}/100)` : ""}`);
  parts.push(`Haki de Observación: ${hakiWord(kit.observationHaki)}${kit.observationHaki > 0 ? ` (${kit.observationHaki}/100)` : ""}`);
  parts.push(`Haki del Rey: ${kit.conqueror ? "lo posee" : "no lo posee"}`);
  parts.push(kit.fruit ? `Fruta del Diablo: ${kit.fruit.name}, ${PHASE_WORD[kit.fruit.phase]}` : "Fruta del Diablo: ninguna");
  if (kit.weapon) parts.push(`arma: ${kit.weapon}`);
  if (kit.abilities.length) parts.push(`técnicas propias: ${kit.abilities.join("; ")}`);
  return `REPERTORIO REAL DE ${name.toUpperCase()} (juega TODO esto, con inteligencia y variedad, y NADA que no esté aquí): ${parts.join("; ")}.`;
}

/** Shared rule for every fighter the AI voices — enemies and allied NPCs alike. */
export const PLAY_TO_WIN_RULE =
  "COMPETITIVIDAD: cada combatiente que controlas (enemigos y aliados NPC) lucha por GANAR y lo da todo, dentro de su repertorio y su estado físico: usa el Haki que tenga, su fruta en la fase que domine, sus técnicas propias y el terreno, y adapta su estilo a lo que ve del rival (si el otro está fatigado, presiona; si es rápido, lo acorrala). " +
  "Ganar puede significar matar, capturar o someter según su carácter y su bando — nunca rendirse a mitad de la pelea por cortesía. Aun así, el motor decide quién acierta: describe un ataque con todo su potencial cuyo resultado es exactamente el indicado.";

import { fruitPhase, FRUIT_PHASE_LABELS } from "./fruit-mastery";
import { fatigueLevel, FATIGUE_LABELS } from "./stamina";

export interface CapabilitySheet {
  name: string;
  level: number;
  armamentHaki: number;
  observationHaki: number;
  conquerorsHaki: boolean;
  fruitName?: string | null;
  fruitMastery: number;
  fruitAwakened: boolean;
  weaponName?: string | null;
  stamina: number;
  maxStamina: number;
  hp: number;
  maxHp: number;
  companions: string[];
}

function hakiWord(v: number): string {
  if (v <= 0) return "sin despertar (NO puede usarlo)";
  if (v < 20) return "incipiente";
  if (v < 45) return "básico";
  if (v < 70) return "competente";
  if (v < 90) return "avanzado";
  return "maestro";
}

/**
 * What this character can genuinely do right now, in words, so the narrator
 * never grants powers the sheet does not have (and never forgets the ones it does).
 */
export function describeCapabilities(c: CapabilitySheet): string {
  const parts: string[] = [`nivel ${c.level}`];
  parts.push(`Haki de Armadura: ${c.armamentHaki > 0 ? `${hakiWord(c.armamentHaki)} (${c.armamentHaki}/100)` : hakiWord(0)}`);
  parts.push(`Haki de Observación: ${c.observationHaki > 0 ? `${hakiWord(c.observationHaki)} (${c.observationHaki}/100)` : hakiWord(0)}`);
  parts.push(`Haki del Rey: ${c.conquerorsHaki ? "despierto" : "NO lo tiene"}`);
  if (c.fruitName) {
    const phase = fruitPhase(c.fruitMastery, c.fruitAwakened);
    parts.push(`Fruta del Diablo: ${c.fruitName}, ${FRUIT_PHASE_LABELS[phase]} (dominio ${c.fruitMastery}/100)`);
  } else {
    parts.push("Fruta del Diablo: NINGUNA (no puede usar poderes de fruta)");
  }
  parts.push(`arma: ${c.weaponName ?? "ninguna (desarmado)"}`);
  const fatigue = fatigueLevel(c.stamina, c.maxStamina);
  parts.push(`estado: ${FATIGUE_LABELS[fatigue]} (aguante ${c.stamina}/${c.maxStamina}, vida ${c.hp}/${c.maxHp})`);
  if (c.companions.length) parts.push(`nakamas a su lado: ${c.companions.join(", ")}`);
  return `CAPACIDADES REALES DE ${c.name.toUpperCase()} (fuente de verdad: no narres que hace o usa nada que exceda esto, ni olvides lo que sí tiene; un cuerpo fatigado rinde peor y se nota): ${parts.join("; ")}.`;
}

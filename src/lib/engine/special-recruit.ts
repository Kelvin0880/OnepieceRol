/**
 * Special recruits: a resident with a story of their own who only joins a crew that meets a fixed, hand-written
 * condition. The condition is checked by code; the persuasion roll and the narration stay with the AI judge/narrator,
 * which only stage what the code already allows. Nothing here invents a person: the resident is a real IslandNpc row.
 */

export type RecruitFaction = "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER" | "CP0";

export interface RecruitCondition {
  minLevel?: number;
  /** Any of these factions. Omitted = everyone. */
  factions?: RecruitFaction[];
  /** Pirates only: bounty in berries. */
  minBounty?: number;
  /** Everyone else: notoriety. */
  minNotoriety?: number;
  /** An inventory item id the recruiter must be carrying (it is not consumed). */
  item?: string;
  /** Berries paid on joining. */
  berries?: number;
}

export interface SpecialRecruitDef {
  /** Free text matched by the role archetypes (Espadachín, Cocinero, Médico...). */
  role: string;
  epithet: string;
  abilities: string[];
  styleId?: string;
  attrs: { strength: number; agility: number; durability: number; willpower: number; intellect: number };
  /** The resident's story, shown to the recruiter and given to the narrator as a fixed fact. */
  lore: string;
  /** One line in the panel about what it takes to win them over; never reveals the exact numbers. */
  hint: string;
  condition: RecruitCondition;
}

export interface RecruiterState {
  level: number;
  faction: string;
  bounty: number;
  notoriety: number;
  berries: number;
  itemIds: string[];
}

/** null = the condition is met; otherwise a Spanish sentence saying what is still missing. */
export function recruitConditionProblem(c: RecruitCondition, who: RecruiterState): string | null {
  if (c.minLevel && who.level < c.minLevel) return `Aún no te toma en serio: te falta experiencia (nivel ${c.minLevel}).`;
  if (c.factions && c.factions.length > 0 && !c.factions.includes(who.faction as RecruitFaction)) return "No se unirá a alguien de tu bandera.";
  if (c.minBounty && who.faction === "PIRATE" && who.bounty < c.minBounty) return "Tu nombre aún no pesa lo bastante en los carteles para él.";
  if (c.minNotoriety && who.faction !== "PIRATE" && who.notoriety < c.minNotoriety) return "Tu nombre aún no pesa lo bastante entre los tuyos para él.";
  if (c.item && !who.itemIds.includes(c.item)) return "Quiere ver algo que aún no llevas encima.";
  if (c.berries && who.berries < c.berries) return `Su precio es ฿ ${c.berries.toLocaleString("es-ES")} y no los tienes.`;
  return null;
}

export function parseSpecialRecruit(json: string | null | undefined): SpecialRecruitDef | null {
  if (!json) return null;
  try {
    const o = JSON.parse(json) as Partial<SpecialRecruitDef>;
    if (!o || typeof o.role !== "string" || typeof o.lore !== "string" || !o.attrs || !o.condition) return null;
    return o as SpecialRecruitDef;
  } catch {
    return null;
  }
}

export interface RecruitCatalog {
  itemIds: Set<string>;
  styleIds: Set<string>;
}

/** Everything that would make a special recruit broken or unfair. Empty = valid. */
export function validateSpecialRecruit(name: string, d: SpecialRecruitDef, cat: RecruitCatalog): string[] {
  const e: string[] = [];
  const at = `[${name}]`;
  if (d.lore.length < 120) e.push(`${at} lore too short`);
  if (d.hint.length < 20 || /\d{3,}/.test(d.hint)) e.push(`${at} hint too short, or it leaks exact numbers`);
  if (d.abilities.length < 2 || d.abilities.length > 6) e.push(`${at} needs 2 to 6 abilities`);
  if (d.styleId && !cat.styleIds.has(d.styleId)) e.push(`${at} unknown style ${d.styleId}`);
  const total = Object.values(d.attrs).reduce((n, v) => n + v, 0);
  if (Object.values(d.attrs).some((v) => v < 1 || v > 80) || total < 60 || total > 260) e.push(`${at} attributes out of range`);
  const c = d.condition;
  if (c.item && !cat.itemIds.has(c.item)) e.push(`${at} unknown item ${c.item}`);
  if (c.minLevel !== undefined && (c.minLevel < 1 || c.minLevel > 60)) e.push(`${at} bad minLevel`);
  if (c.berries !== undefined && (c.berries < 1_000 || c.berries > 5_000_000)) e.push(`${at} bad berries`);
  if (!c.minLevel && !c.factions?.length && !c.minBounty && !c.minNotoriety && !c.item && !c.berries) e.push(`${at} has no condition`);
  return e;
}

import type { FactionKey } from "./progression";
import { pickBySeed } from "./faction-seats";
import { missionRewards, MISSION_XP_BOOST, missionTier, type MissionSpec } from "./missions";

/**
 * Every island also hands out one job for your own faction: an arrest warrant for a marine, a wanted poster for a
 * hunter, a covert operation for CP-0, an oppressor to topple for the Revolution, a heist for a pirate. It reuses the
 * mission machinery and pays, on top, the faction's own currency (merit/influence/trust, or bounty for pirates).
 */

export interface ContractResident {
  id: string;
  name: string;
  title: string;
  category: string;
  level: number;
}

export interface ContractContext {
  faction: FactionKey;
  level: number;
  danger: number;
  minLevel: number;
  islandName: string;
  residents: ContractResident[];
  /** Residents already targeted by another goal of this batch. */
  excludeIds: string[];
  seed: string;
}

export type ContractSpec = MissionSpec & { factionRep: number };

const FIGHTERS = ["thug", "pirate", "guard", "marine"];

/** Pirates earn bounty in berries; everyone else earns points of their own ladder. */
export function contractRep(faction: FactionKey, tier: number, danger: number): number {
  if (faction === "PIRATE") return 1_500_000 * tier * Math.max(1, danger);
  return 40 * tier + 10 * danger;
}

export function factionContract(ctx: ContractContext): ContractSpec | null {
  const tier = missionTier(ctx.level, ctx.minLevel);
  const rep = contractRep(ctx.faction, tier, ctx.danger);
  const pool = ctx.residents.filter((r) => !ctx.excludeIds.includes(r.id) && FIGHTERS.includes(r.category) && r.level <= ctx.level + 8);
  const outlaws = pool.filter((r) => r.category === "thug" || r.category === "pirate");
  const enforcers = pool.filter((r) => r.category === "guard" || r.category === "marine");
  const base = (kind: MissionSpec["kind"], target: number, title: string, brief: string, extra: Partial<ContractSpec> = {}): ContractSpec => ({
    kind,
    target,
    title,
    brief,
    tier,
    ...missionRewards(tier, ctx.danger, kind),
    isArc: false,
    factionRep: rep,
    ...extra,
  });
  const hunt = (r: ContractResident, title: string, brief: string, berriesMult = 1): ContractSpec =>
    base("defeat_npc", 1, title, brief, {
      targetNpcId: r.id,
      berries: Math.round((missionRewards(tier, ctx.danger, "win_fights").berries + r.level * 250) * berriesMult),
      xp: Math.round(missionRewards(tier, ctx.danger, "win_fights").xp + r.level * 2 * MISSION_XP_BOOST),
    });
  const pickOutlaw = pickBySeed(outlaws, `${ctx.seed}:o`);
  const pickEnforcer = pickBySeed(enforcers, `${ctx.seed}:e`);
  const pickAny = pickBySeed(pool, `${ctx.seed}:a`);

  switch (ctx.faction) {
    case "MARINE":
      return pickOutlaw
        ? hunt(pickOutlaw, `Orden de arresto: ${pickOutlaw.name}`, `El cuartel te ordena detener a ${pickOutlaw.name}, ${pickOutlaw.title.toLowerCase()}, que siembra el desorden en ${ctx.islandName}. Véncelo y entrégalo a la justicia.`)
        : base("explore", 2 + tier, `Patrulla de ${ctx.islandName}`, `Recorre ${ctx.islandName} ${2 + tier} veces en patrulla: calles, muelles y rumores. La presencia de la Marina también es justicia.`);
    case "REVOLUTIONARY":
      return pickEnforcer
        ? hunt(pickEnforcer, `Libera ${ctx.islandName} de ${pickEnforcer.name}`, `${pickEnforcer.name}, ${pickEnforcer.title.toLowerCase()}, es el puño del Gobierno sobre esta gente. Derríbalo y deja que ${ctx.islandName} respire.`)
        : base("explore", 2 + tier, `Siembra la revolución en ${ctx.islandName}`, `Habla con la gente de ${ctx.islandName} ${2 + tier} veces: escucha sus quejas, reparte octavillas y encuentra quién está dispuesto a levantarse.`);
    case "CP0":
      return pickAny && ctx.seed.length % 2 === 0
        ? hunt(pickAny, `Operación encubierta: ${pickAny.name}`, `Orden sellada del Gobierno Mundial: ${pickAny.name} sabe demasiado. Neutralízalo sin dejar rastro que lleve hasta el CP-0.`)
        : base("explore", 2 + tier, `Informe secreto sobre ${ctx.islandName}`, `Infíltrate en ${ctx.islandName} ${2 + tier} veces sin revelar quién eres y averigua quién mueve los hilos. Nadie debe saber que el Gobierno estuvo aquí.`);
    case "BOUNTY_HUNTER":
      return pickOutlaw
        ? hunt(pickOutlaw, `SE BUSCA: ${pickOutlaw.name}`, `Hay un cartel con la cara de ${pickOutlaw.name}, ${pickOutlaw.title.toLowerCase()}, clavado en el tablón de ${ctx.islandName}. Vivo o derrotado, la recompensa es tuya.`, 1.6)
        : base("win_fights", 1 + tier, `Limpieza en ${ctx.islandName}`, `No hay carteles aquí, pero sí gente peligrosa: gana ${1 + tier} peleas en ${ctx.islandName} y tu nombre correrá entre los cazadores.`);
    case "PIRATE":
      return ctx.seed.length % 2 === 0
        ? base("win_fights", 1 + tier, `Golpe en ${ctx.islandName}`, `Gana ${1 + tier} peleas en ${ctx.islandName}: que los carteles del Gobierno lleven tu cara por algo.`)
        : base("explore", 2 + tier, `El tesoro escondido de ${ctx.islandName}`, `Un viejo mapa habla de algo enterrado en ${ctx.islandName}. Búscalo ${2 + tier} veces por la isla y que se entere todo el mar.`, { berries: Math.round(missionRewards(tier, ctx.danger, "explore").berries * 2) });
  }
}

export function contractRepLabel(faction: string, rep: number): string {
  if (!rep) return "";
  if (faction === "PIRATE") return `+฿ ${rep.toLocaleString("es-ES")} de recompensa`;
  const unit = faction === "MARINE" ? "mérito" : faction === "REVOLUTIONARY" ? "influencia" : faction === "CP0" ? "confianza" : "reputación";
  return `+${rep} de ${unit}`;
}

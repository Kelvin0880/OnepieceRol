import { Rng } from "./rng";
import { FruitPhase, fruitPowerMultiplier, fruitStaminaMultiplier } from "./fruit-mastery";

/**
 * What the player *describes* using in a fight (haki, their fruit, or just
 * plain weapon work) becomes a real, stamina-costing bonus for that exchange.
 * The classifier only ever proposes one of these ids; whether it actually
 * works (does the character have that haki? enough stamina?) is decided here,
 * in code — a requested technique that can't be used silently downgrades to
 * "none" and the narrator is told so.
 */
export type TechniqueId = "none" | "armament" | "observation" | "conqueror" | "fruit";

export const TECHNIQUE_IDS: TechniqueId[] = ["none", "armament", "observation", "conqueror", "fruit"];

export const TECHNIQUE_LABELS: Record<TechniqueId, string> = {
  none: "combate básico",
  armament: "Haki de Armadura",
  observation: "Haki de Observación",
  conqueror: "Haki del Rey",
  fruit: "poder de la Akuma no Mi",
};

export function isTechniqueId(value: unknown): value is TechniqueId {
  return typeof value === "string" && (TECHNIQUE_IDS as string[]).includes(value);
}

export interface TechniqueContext {
  armamentHaki: number;
  observationHaki: number;
  conquerorsHaki: boolean;
  /** Base (unscaled) combat bonus of the character's fruit, null when they have none. */
  fruitBase: { atk: number; def: number; spd: number } | null;
  fruitPhase: FruitPhase;
  stamina: number;
}

export interface TechniqueEffect {
  requested: TechniqueId;
  used: TechniqueId;
  downgraded: boolean;
  downgradeReason?: string;
  atk: number;
  def: number;
  spd: number;
  staminaCost: number;
}

const BASIC_COST = 4;

function baseCostAndBonus(id: TechniqueId, ctx: TechniqueContext): { cost: number; atk: number; def: number; spd: number; unavailable?: string } {
  switch (id) {
    case "armament":
      if (ctx.armamentHaki < 1) return { cost: 0, atk: 0, def: 0, spd: 0, unavailable: "todavía no ha despertado el Haki de Armadura" };
      return { cost: 12, atk: Math.round(ctx.armamentHaki * 0.2), def: Math.round(ctx.armamentHaki * 0.15), spd: 0 };
    case "observation":
      if (ctx.observationHaki < 1) return { cost: 0, atk: 0, def: 0, spd: 0, unavailable: "todavía no ha despertado el Haki de Observación" };
      return { cost: 8, atk: 0, def: Math.round(ctx.observationHaki * 0.15), spd: Math.round(ctx.observationHaki * 0.1) };
    case "conqueror":
      if (!ctx.conquerorsHaki) return { cost: 0, atk: 0, def: 0, spd: 0, unavailable: "no posee el Haki del Rey" };
      return { cost: 22, atk: 10, def: 4, spd: 0 };
    case "fruit": {
      if (!ctx.fruitBase) return { cost: 0, atk: 0, def: 0, spd: 0, unavailable: "no tiene ninguna Akuma no Mi" };
      // Passive already grants the other half of the fruit's bonus (see character-stats.ts).
      const scale = fruitPowerMultiplier(ctx.fruitPhase) * 0.5;
      return {
        cost: Math.round(14 * fruitStaminaMultiplier(ctx.fruitPhase)),
        atk: Math.round(ctx.fruitBase.atk * scale),
        def: Math.round(ctx.fruitBase.def * scale),
        spd: Math.round(ctx.fruitBase.spd * scale),
      };
    }
    default:
      return { cost: BASIC_COST, atk: 0, def: 0, spd: 0 };
  }
}

export function resolveTechnique(requested: TechniqueId, ctx: TechniqueContext): TechniqueEffect {
  const wanted = baseCostAndBonus(requested, ctx);
  if (wanted.unavailable) {
    return { requested, used: "none", downgraded: true, downgradeReason: wanted.unavailable, atk: 0, def: 0, spd: 0, staminaCost: BASIC_COST };
  }
  if (wanted.cost > ctx.stamina) {
    return { requested, used: "none", downgraded: true, downgradeReason: "no le queda aliento para sostener la técnica", atk: 0, def: 0, spd: 0, staminaCost: BASIC_COST };
  }
  return { requested, used: requested, downgraded: false, atk: wanted.atk, def: wanted.def, spd: wanted.spd, staminaCost: wanted.cost };
}

/** Haki also grows from being used under pressure, not only from the training button. */
export function hakiGrowthFromUse(rng: Rng, technique: TechniqueId, currentLevel: number): number {
  if (technique !== "armament" && technique !== "observation") return 0;
  if (currentLevel >= 100) return 0;
  const chance = 0.35 * (1 - currentLevel / 130);
  return rng() < chance ? 1 : 0;
}

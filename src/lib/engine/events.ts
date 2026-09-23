import { Rng, rollInt, weightedPick } from "./rng";
import { skillCheck, encounterDifficulty } from "./checks";

export interface OutcomeSpec {
  text: string[]; // one is picked at random for narrative variety
  berries?: [number, number];
  xp?: [number, number];
  bounty?: [number, number];
  hpLoss?: [number, number];
}

export interface EnemySpec {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss?: boolean;
  personality?: string; // short in-character flavor line, fed to AI narration
  worldActorId?: string; // links this fight to a persistent WorldActor's grudge memory (see engine/grudge.ts) — only set for lore-linked subordinate fights
}

export interface EventBody {
  flavorTexts: string[];
  difficultyOverride?: number;
  onCriticalSuccess?: OutcomeSpec;
  onSuccess: OutcomeSpec;
  onFail: OutcomeSpec;
  onCriticalFail?: OutcomeSpec;
  enemy?: EnemySpec;
  fruitDropChance?: number; // 0-1, rolled only on success/critical_success
  poneglyphId?: string; // granted on victory against this event's boss, if the character doesn't already have it
  waterHazard?: boolean; // devil fruit users can't swim at all (canon) — see DEVIL_FRUIT_WATER_PENALTY
}

/**
 * Devil fruit users physically cannot swim — this is absolute in canon, not
 * a skill issue. We don't hard-fail the check (the engine's own critical
 * roll rule already guarantees no outcome is ever 100% certain either way),
 * but this penalty is large enough that only a lucky roll saves them; a
 * non-user resolves the same event on their real modifier.
 */
export const DEVIL_FRUIT_WATER_PENALTY = 60;

export interface EventResolutionResult {
  flavorText: string;
  outcome: "critical_fail" | "fail" | "success" | "critical_success";
  narrative: string;
  berries: number;
  xp: number;
  bounty: number;
  hpLoss: number;
  triggersCombat: boolean;
  enemy?: EnemySpec;
  fruitDropRolled: boolean;
}

function pick<T>(rng: Rng, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function rollRange(rng: Rng, range?: [number, number]): number {
  if (!range) return 0;
  return rollInt(rng, range[0], range[1]);
}

export function parseEventBody(bodyJson: string): EventBody {
  return JSON.parse(bodyJson) as EventBody;
}

/**
 * Resolves a single narrative beat: a d100 check against island/character
 * derived difficulty, picking one of four outcome tiers and rolling its
 * reward/penalty ranges. Combat events additionally hand back the enemy
 * spec so the caller can run `runCombat` for the tactical exchange.
 */
export function resolveEvent(
  rng: Rng,
  body: EventBody,
  modifier: number,
  islandDanger: number,
  characterLevel: number,
  hasDevilFruit: boolean = false
): EventResolutionResult {
  const difficulty = body.difficultyOverride ?? encounterDifficulty(islandDanger, characterLevel);
  const effectiveModifier = body.waterHazard && hasDevilFruit ? modifier - DEVIL_FRUIT_WATER_PENALTY : modifier;
  const check = skillCheck(rng, effectiveModifier, difficulty);

  const spec =
    check.outcome === "critical_success"
      ? body.onCriticalSuccess ?? body.onSuccess
      : check.outcome === "success"
      ? body.onSuccess
      : check.outcome === "critical_fail"
      ? body.onCriticalFail ?? body.onFail
      : body.onFail;

  const succeeded = check.outcome === "success" || check.outcome === "critical_success";
  const fruitDropRolled = succeeded && !!body.fruitDropChance && rng() < body.fruitDropChance;

  return {
    flavorText: pick(rng, body.flavorTexts),
    outcome: check.outcome,
    narrative: pick(rng, spec.text),
    berries: rollRange(rng, spec.berries),
    xp: rollRange(rng, spec.xp),
    bounty: rollRange(rng, spec.bounty),
    hpLoss: rollRange(rng, spec.hpLoss),
    triggersCombat: !!body.enemy,
    enemy: body.enemy,
    fruitDropRolled,
  };
}

export interface WeightedEventTemplate {
  id: string;
  weight: number;
}

export function pickEventTemplate<T extends WeightedEventTemplate>(rng: Rng, templates: T[]): T {
  if (templates.length === 0) throw new Error("pickEventTemplate: no templates available");
  return weightedPick(
    rng,
    templates.map((t) => ({ item: t, weight: t.weight }))
  );
}

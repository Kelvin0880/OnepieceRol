import { Rng, hashString, weightedPick } from "./rng";
import { encounterDifficulty } from "./checks";

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

function pickBy<T>(seed: string, list: T[]): T {
  return list[hashString(seed) % list.length];
}

/** Rewards are the middle of their range: the result of the action is judged, not the amount. */
function middle(range?: [number, number]): number {
  if (!range) return 0;
  return Math.round((range[0] + range[1]) / 2);
}

export function parseEventBody(bodyJson: string): EventBody {
  return JSON.parse(bodyJson) as EventBody;
}

/** How hard the beat is for this character, as a number 0-99 for the AI judge. */
export function eventDifficulty(body: EventBody, islandDanger: number, characterLevel: number, hasDevilFruit = false): number {
  const base = body.difficultyOverride ?? encounterDifficulty(islandDanger, characterLevel);
  // Devil fruit users cannot swim (canon): a water hazard is far harder for them.
  return Math.min(99, base + (body.waterHazard && hasDevilFruit ? DEVIL_FRUIT_WATER_PENALTY : 0));
}

/**
 * Turns an outcome already judged by the AI (ai/judge.ts judgeOutcome) into the beat's text and rewards.
 * `seed` only picks which of the equivalent flavour texts is shown.
 */
export function resolveEvent(seed: string, outcome: EventResolutionResult["outcome"], body: EventBody): EventResolutionResult {
  const spec =
    outcome === "critical_success"
      ? body.onCriticalSuccess ?? body.onSuccess
      : outcome === "success"
      ? body.onSuccess
      : outcome === "critical_fail"
      ? body.onCriticalFail ?? body.onFail
      : body.onFail;

  return {
    flavorText: pickBy(`${seed}:flavor`, body.flavorTexts),
    outcome,
    narrative: pickBy(`${seed}:${outcome}`, spec.text),
    berries: middle(spec.berries),
    xp: middle(spec.xp),
    bounty: middle(spec.bounty),
    hpLoss: middle(spec.hpLoss),
    triggersCombat: !!body.enemy,
    enemy: body.enemy,
    // A treasure that would change a character's life only turns up on a brilliant result.
    fruitDropRolled: outcome === "critical_success" && !!body.fruitDropChance,
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

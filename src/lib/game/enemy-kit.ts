import { prisma } from "../db";
import { KitFruitPhase, EnemyKit, deriveEnemyKit, describeEnemyKit } from "../engine/enemy-kit";
import { estimateLevel } from "../engine/resilience";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";

const FRUIT_POOL = DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton).map((f) => f.name);

export interface KitSubject {
  name: string;
  atk: number;
  def: number;
  isBoss: boolean;
  level?: number;
  worldActorId?: string;
}

interface ActorStats {
  armamentHaki?: number;
  observationHaki?: number;
  conquerorsHaki?: boolean;
  fruitPhase?: KitFruitPhase;
}

/**
 * The full kit of whoever the AI is voicing this fight: a canon actor declares theirs
 * (Haki, fruit and phase, weapon, signature moves); everyone else gets a deterministic
 * kit that grows with level, fruits included from the Grand Line upward.
 */
export async function resolveEnemyKit(subject: KitSubject): Promise<{ kit: EnemyKit; text: string }> {
  const level = subject.level ?? estimateLevel(subject.atk, subject.def);
  let declared: Partial<EnemyKit> | undefined;
  if (subject.worldActorId) {
    const actor = await prisma.worldActor.findUnique({ where: { id: subject.worldActorId }, include: { devilFruit: { select: { name: true } } } }).catch(() => null);
    if (actor) {
      const stats = (actor.statsJson ? JSON.parse(actor.statsJson) : {}) as ActorStats;
      const abilities = actor.abilitiesJson ? (JSON.parse(actor.abilitiesJson) as string[]) : [];
      declared = {
        armamentHaki: stats.armamentHaki,
        observationHaki: stats.observationHaki,
        conqueror: stats.conquerorsHaki,
        weapon: actor.canonWeapon ?? undefined,
        abilities,
        fruit: actor.devilFruit ? { name: actor.devilFruit.name, phase: stats.fruitPhase ?? (actor.powerLevel >= 90 ? "awakened" : actor.powerLevel >= 75 ? "advanced" : "initial") } : undefined,
      };
    }
  }
  const kit = deriveEnemyKit({ name: subject.name, level, isBoss: subject.isBoss, declared, fruitPool: FRUIT_POOL });
  return { kit, text: describeEnemyKit(subject.name, kit) };
}

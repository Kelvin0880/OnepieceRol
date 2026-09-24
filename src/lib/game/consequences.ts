import { prisma } from "../db";
import { Rng } from "../engine/rng";
import {
  consequenceDelayMs,
  consequenceRipe,
  rollConsequenceTrigger,
  rollOutcome,
  boonRewards,
  tributeRewards,
  returningEnemy,
  ConsequenceKind,
  ConsequenceOutcome,
} from "../engine/consequence";
import { addStanding } from "./alliance";
import { postNews } from "./death-resolution";

export interface ReturningEncounter {
  enemyName: string;
  worldActorId?: string;
  consequenceStage: number;
  stats: { hp: number; atk: number; def: number; spd: number };
  intro: string;
}

export interface ConsequenceResult {
  log: string[];
  berries?: number;
  xp?: number;
  /** Bounty (pirates) or notoriety points for the caller to apply through reputation.ts. */
  reputation?: number;
  encounter?: ReturningEncounter;
}

/** Leaves a thread behind a named enemy the player just spared or finished. */
export async function recordConsequence(characterId: string, enemy: { name: string; worldActorId?: string; consequenceStage?: number }, kind: ConsequenceKind, island: { id: string; name: string }) {
  await prisma.consequence.create({
    data: {
      characterId,
      kind,
      enemyName: enemy.name,
      worldActorId: enemy.worldActorId,
      islandId: island.id,
      islandName: island.name,
      stage: (enemy.consequenceStage ?? 0) + 1,
      dueAt: new Date(Date.now() + consequenceDelayMs(kind)),
    },
  });
}

/** On an explore: maybe an old choice comes back. Boons and tribute apply here; a betrayal or an avenger becomes a fight. */
export async function rollConsequenceForExplore(
  character: { id: string; maxHp: number },
  playerStats: { atk: number; def: number; spd: number },
  islandDanger: number,
  rng: Rng
): Promise<ConsequenceResult | null> {
  const ripe = await prisma.consequence.findFirst({ where: { characterId: character.id, resolvedAt: null, dueAt: { lte: new Date() } }, orderBy: { dueAt: "asc" } });
  if (!ripe || !consequenceRipe(ripe.dueAt.getTime(), Date.now()) || !rollConsequenceTrigger(rng)) return null;
  const outcome = rollOutcome(rng, ripe.kind as ConsequenceKind);
  await prisma.consequence.update({ where: { id: ripe.id }, data: { resolvedAt: new Date(), outcome } });

  if (outcome === "boon") {
    const r = boonRewards(ripe.stage, islandDanger);
    if (ripe.worldActorId) await addStanding(ripe.worldActorId, character.id, { mercy: true }, `${ripe.enemyName} te devolvió el favor`);
    await postNews("Una deuda saldada", `Dicen que ${ripe.enemyName} devolvió el favor a quien le perdonó la vida en ${ripe.islandName}. La clemencia, a veces, también paga.`, "Rumores", undefined, "normal", { locationName: ripe.islandName });
    return { log: [`${ripe.enemyName}, a quien perdonaste en ${ripe.islandName}, te encuentra y no ha olvidado tu gesto: te entrega lo que puede y jura estar en deuda contigo (฿ ${r.berries.toLocaleString("es-ES")}).`], berries: r.berries, xp: r.xp };
  }
  if (outcome === "tribute") {
    const r = tributeRewards(ripe.stage, islandDanger);
    return { log: [`En ${ripe.islandName} todavía se habla de lo que hiciste con ${ripe.enemyName}. Los lugareños te temen y te pagan tributo para que sigas de largo (฿ ${r.berries.toLocaleString("es-ES")}).`], berries: r.berries, reputation: r.notoriety };
  }
  const stats = returningEnemy({ maxHp: character.maxHp, ...playerStats }, outcome, ripe.stage);
  const intro =
    outcome === "betrayal"
      ? `${ripe.enemyName}, a quien dejaste con vida en ${ripe.islandName}, no vino a agradecerte: vuelve con una cuenta pendiente.`
      : `Alguien cercano a ${ripe.enemyName} te ha seguido desde ${ripe.islandName}: viene a cobrarse la sangre.`;
  return {
    log: [intro],
    encounter: { enemyName: outcome === "betrayal" ? ripe.enemyName : `Vengador de ${ripe.enemyName}`, worldActorId: ripe.worldActorId ?? undefined, consequenceStage: ripe.stage, stats, intro },
  };
}

export type { ConsequenceOutcome };

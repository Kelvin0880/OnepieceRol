import { prisma } from "../db";
import { Rng, weightedPick } from "../engine/rng";
import { heatAfterGrudgeIncident, heatAfterMercy, decayGrudgeHeat, grudgeAmbushDue } from "../engine/grudge";

export interface EnemySnapshot {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Writes/spikes the memory a specific WorldActor keeps of a specific character. Always overwrites the note/snapshot so narration references the latest incident, not a stale first one. */
export async function recordGrudgeIncident(
  worldActorId: string,
  characterId: string,
  kind: "escape" | "subordinate_defeat" | "actor_defeat",
  note: string,
  enemyName: string,
  enemySnapshot: EnemySnapshot
): Promise<void> {
  const existing = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId, characterId } } });
  const newHeat = heatAfterGrudgeIncident(existing?.heat ?? 0, kind);
  await prisma.grudge.upsert({
    where: { worldActorId_characterId: { worldActorId, characterId } },
    create: { worldActorId, characterId, heat: newHeat, lastIncidentNote: note, enemyName, enemySnapshotJson: JSON.stringify(enemySnapshot) },
    update: { heat: newHeat, lastIncidentAt: new Date(), lastIncidentNote: note, enemyName, enemySnapshotJson: JSON.stringify(enemySnapshot) },
  });
}

/** Sparing a defeated subordinate lowers the actor's heat toward this character — mercy is remembered too, not just hostility. Only touches an existing grudge; nothing to relieve if there's no prior incident. */
export async function recordMercyIncident(worldActorId: string, characterId: string, note: string): Promise<void> {
  const existing = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId, characterId } } });
  if (!existing) return;
  await prisma.grudge.update({
    where: { worldActorId_characterId: { worldActorId, characterId } },
    data: { heat: heatAfterMercy(existing.heat), lastIncidentAt: new Date(), lastIncidentNote: note },
  });
}

/** Called once per explore action, whether or not a grudge-ambush fires — same unconditional-decay rule pursuit.ts's poneglyphHeat already follows. */
export async function decayGrudgesForCharacter(characterId: string): Promise<void> {
  const grudges = await prisma.grudge.findMany({ where: { characterId, heat: { gt: 0 } } });
  await Promise.all(grudges.map((g) => prisma.grudge.update({ where: { id: g.id }, data: { heat: decayGrudgeHeat(g.heat) } })));
}

export interface GrudgeAmbushResult {
  worldActorId: string;
  worldActorName: string;
  worldActorPersonality: string | null;
  enemyName: string;
  enemySnapshot: EnemySnapshot;
  lastIncidentNote: string;
  heat: number;
}

/** The grudge-holder who currently wants this character most, when their ambush is due. Returns null on no grudges or nothing due. */
export async function rollGrudgeAmbushForCharacter(characterId: string): Promise<GrudgeAmbushResult | null> {
  const grudges = await prisma.grudge.findMany({ where: { characterId, heat: { gt: 0 } } });
  if (grudges.length === 0) return null;

  // Whoever wants this character most comes first, and only while the grudge is still hot enough (a fixed cadence, see engine/grudge.ts).
  const chosen = [...grudges].sort((a, b) => b.heat - a.heat)[0];
  if (!grudgeAmbushDue(chosen.heat)) return null;

  const actor = await prisma.worldActor.findUnique({ where: { id: chosen.worldActorId } });
  if (!actor) return null;

  return {
    worldActorId: actor.id,
    worldActorName: actor.name,
    worldActorPersonality: actor.personality,
    enemyName: chosen.enemyName,
    enemySnapshot: JSON.parse(chosen.enemySnapshotJson) as EnemySnapshot,
    lastIncidentNote: chosen.lastIncidentNote,
    heat: chosen.heat,
  };
}

export interface GrudgeContext {
  text: string;
  critical: boolean;
}

const CRITICAL_HEAT_THRESHOLD = 100;

/** Read-only: a short "the NPC remembers this" line for combat narration. Omitted entirely (returns null) when there's no prior grudge — first meeting, nothing to reference. */
export async function getGrudgeContextForNarration(worldActorId: string, characterId: string): Promise<GrudgeContext | null> {
  const grudge = await prisma.grudge.findUnique({ where: { worldActorId_characterId: { worldActorId, characterId } } });
  if (!grudge || grudge.heat <= 0) return null;
  return { text: grudge.lastIncidentNote, critical: grudge.heat > CRITICAL_HEAT_THRESHOLD };
}

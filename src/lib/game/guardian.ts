import { prisma } from "../db";
import { Rng } from "../engine/rng";
import { parseEventBody, EventBody, EnemySpec } from "../engine/events";
import { actorCombatStats, guardianMeeting, isActorHome } from "../engine/guardian";
import { postNews } from "./death-resolution";

export interface GuardianEnemy {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  personality?: string;
  worldActorId?: string;
  isActor?: boolean;
}

export interface GuardianRewardsBase {
  berries: number;
  xp: number;
  bounty: number;
}

export const ACTOR_REWARD_MULTIPLIER = 3;
export const ACTOR_RECOVERY_HOURS = 6;

/** The boss event of an island that holds a Poneglyph: its subordinate spec and the stone it guards. Null when the island has none. */
export async function findPoneglyphGuardian(islandId: string): Promise<{ body: EventBody; enemy: EnemySpec; poneglyphId: string; templateTitle: string } | null> {
  const templates = await prisma.eventTemplate.findMany({ where: { islandId, kind: "BOSS" } });
  for (const t of templates) {
    const body = parseEventBody(t.bodyJson);
    if (body.poneglyphId && body.enemy) return { body, enemy: body.enemy, poneglyphId: body.poneglyphId, templateTitle: t.title };
  }
  return null;
}

/**
 * Who is actually standing guard right now. The seeded enemy is the
 * subordinate; when their holder is home (not busy on the world clock) they
 * usually come out in person instead — with stats from their own power level,
 * meant to be lethal for anyone who arrives unprepared.
 */
export async function applyGuardianPresence(
  subordinate: GuardianEnemy,
  now = new Date()
): Promise<{ enemy: GuardianEnemy; meeting: "actor" | "subordinate"; note: string | null }> {
  if (!subordinate.worldActorId) return { enemy: subordinate, meeting: "subordinate", note: null };
  const actor = await prisma.worldActor.findUnique({ where: { id: subordinate.worldActorId } });
  if (!actor) return { enemy: subordinate, meeting: "subordinate", note: null };
  const home = isActorHome(actor.busyUntil, now);
  const meeting = guardianMeeting(home);
  if (meeting === "subordinate") {
    return { enemy: subordinate, meeting, note: home ? null : `${actor.name} no está aquí ahora mismo: sus hombres guardan el lugar en su ausencia.` };
  }
  const stats = actorCombatStats(actor.powerLevel);
  return {
    enemy: { name: actor.name, ...stats, isBoss: true, personality: actor.personality ?? undefined, worldActorId: actor.id, isActor: true },
    meeting,
    note: `No es un subordinado: ${actor.name} en persona está aquí, y se nota que esto no es un juego.`,
  };
}

/** Mid-range of a success outcome, for fights that must pay out regardless of the exploration roll (a guardian fight always pays). */
export function guardianBaseRewards(body: EventBody): GuardianRewardsBase {
  const mid = (r?: [number, number]) => (r ? Math.round((r[0] + r[1]) / 2) : 0);
  return { berries: mid(body.onSuccess.berries), xp: mid(body.onSuccess.xp) || 100, bounty: mid(body.onSuccess.bounty) };
}

/** A holder beaten in person doesn't die (no such mechanic) — they withdraw to recover, leaving their island to subordinates for a while. */
export async function markActorDefeated(actorId: string, defeatedBy: string, islandName: string): Promise<void> {
  const actor = await prisma.worldActor.findUnique({ where: { id: actorId } });
  if (!actor) return;
  await prisma.worldActor.update({
    where: { id: actorId },
    data: { busyUntil: new Date(Date.now() + ACTOR_RECOVERY_HOURS * 3600_000), currentFocus: `Recuperándose de su derrota ante ${defeatedBy}` },
  });
  await postNews(
    `${defeatedBy} humilla a ${actor.name} en ${islandName}`,
    `Testigos aseguran que ${actor.name} tuvo que replegarse tras enfrentarse en persona a ${defeatedBy}. Nadie duda de que querrá cobrárselo, pero por ahora sus dominios quedan en manos de subordinados.`,
    "Guerra",
    undefined,
    "major",
    { locationName: islandName }
  );
}

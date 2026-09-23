import { prisma } from "../db";
import { notifyCharacters } from "../realtime";

/**
 * Turns "something shared changed" into pushes to exactly the characters who
 * can see it. Always best-effort: a failed lookup must never fail the game
 * action that triggered it — the 10s poll still catches everything.
 */
async function safely(fn: () => Promise<string[]>, reason: string): Promise<void> {
  try {
    notifyCharacters(await fn(), reason);
  } catch {
    // push is an optimisation, never a dependency
  }
}

const humanIds = (ids: string[]) => ids.filter((id) => !id.startsWith("npc:"));

export function notifyFightParticipants(fightId: string): Promise<void> {
  return safely(async () => humanIds((await prisma.jointFightParticipant.findMany({ where: { fightId }, select: { characterId: true } })).map((p) => p.characterId)), "joint-fight");
}

export function notifyParty(partyId: string): Promise<void> {
  return safely(async () => (await prisma.character.findMany({ where: { partyId }, select: { id: true } })).map((c) => c.id), "party");
}

export function notifyIsland(islandId: string, reason = "island"): Promise<void> {
  return safely(async () => (await prisma.character.findMany({ where: { currentIslandId: islandId, status: "ALIVE" }, select: { id: true } })).map((c) => c.id), reason);
}

export function notifyPair(a: string, b: string, reason = "duel"): Promise<void> {
  return safely(async () => [a, b], reason);
}

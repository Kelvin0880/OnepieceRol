import { prisma } from "../db";
import { postNews } from "./death-resolution";
import { grantVictorSpoils } from "./group-battle";
import { notifyCharacters } from "../realtime";

/**
 * A crew battle is now one real duel per matchup (game/duel.ts), each judged by the AI referee with the players'
 * own words. When the last of them ends the battle settles: outcomes per fighter, spoils for the winners, the
 * news and the crews' tally (same result shape the panel already reads).
 */
export async function settleGroupBattleIfDone(battleId: string | null | undefined): Promise<boolean> {
  if (!battleId) return false;
  const battle = await prisma.groupBattle.findUnique({ where: { id: battleId }, include: { participants: true } });
  if (!battle || battle.status !== "ACTIVE") return false;
  const duels = await prisma.duel.findMany({ where: { groupBattleId: battleId } });
  if (duels.length === 0 || duels.some((d) => d.status === "ACTIVE" || d.status === "PROPOSED")) return false;

  // Whoever settles first owns it; a concurrent closer sees 0 rows.
  const claimed = await prisma.groupBattle.updateMany({ where: { id: battleId, status: "ACTIVE" }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  if (claimed.count === 0) return false;

  const newsLog: string[] = [];
  const results = [];
  let winsA = 0;
  let winsB = 0;
  for (const d of duels) {
    const winner: "a" | "b" | "draw" = d.winnerId === d.challengerId ? "a" : d.winnerId === d.opponentId ? "b" : "draw";
    if (winner === "a") winsA++;
    if (winner === "b") winsB++;
    results.push({ aId: d.challengerId, bId: d.opponentId, winner, aHpLeft: d.challengerHp, bHpLeft: d.opponentHp });
    const [aChar, bChar] = await Promise.all([
      prisma.character.findUnique({ where: { id: d.challengerId }, include: { currentIsland: true } }),
      prisma.character.findUnique({ where: { id: d.opponentId }, include: { currentIsland: true } }),
    ]);
    for (const [char, mine] of [[aChar, "a"], [bChar, "b"]] as const) {
      if (!char) continue;
      await prisma.groupBattleParticipant.updateMany({
        where: { battleId, characterId: char.id },
        data: { outcome: winner === "draw" ? "draw" : winner === mine ? "victory" : "defeat", died: char.status === "DEAD" },
      });
      if (winner === mine && char.status === "ALIVE") await grantVictorSpoils(char, char.currentIsland.dangerLevel, newsLog);
    }
  }
  const victor: "a" | "b" | "draw" = winsA > winsB ? "a" : winsB > winsA ? "b" : "draw";
  await prisma.groupBattle.update({ where: { id: battleId }, data: { resultJson: JSON.stringify({ victor, duels: results, log: [], assists: [] }) } });

  const [crewA, crewB] = await Promise.all([prisma.crew.findUnique({ where: { id: battle.crewAId } }), prisma.crew.findUnique({ where: { id: battle.crewBId } })]);
  const victorName = victor === "a" ? crewA?.name : victor === "b" ? crewB?.name : null;
  const headline = victorName ? `${victorName} se impone en el choque contra ${victor === "a" ? crewB?.name : crewA?.name}` : `Empate sangriento entre ${crewA?.name} y ${crewB?.name}`;
  const island = await prisma.island.findUnique({ where: { id: battle.islandId } });
  await postNews(
    headline,
    `Un enfrentamiento de ${duels.length} contra ${duels.length} en ${island?.name ?? "alta mar"} terminó con ${results.filter((r) => r.winner !== "draw").length} duelos decididos.`,
    "Guerra",
    (victor === "b" ? crewB?.captainId : crewA?.captainId) ?? crewA?.captainId,
    "major",
    { locationName: island?.name, islandId: battle.islandId }
  );
  notifyCharacters(battle.participants.map((p) => p.characterId), "battle-settled");
  return true;
}

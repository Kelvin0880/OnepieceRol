import { prisma } from "../db";
import { CharacterStatus } from "@prisma/client";
import { pathSteps } from "../engine/path-guide";
import { rankProgress, type FactionKey } from "../engine/progression";
import { factionCanHaveCrew } from "../engine/crew-noun";
import { isSeatId, ladderFor, seatRank, seatRequirements, SEATS, type SeatId } from "../engine/faction-seats";
import { isEmperor, isWarlord, worldWarsFor } from "./sovereignty";

/** "Mi camino": the character's next steps, computed from the real state of every system. */
export async function getPathState(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c || c.userId !== userId) throw new Error("Personaje no encontrado.");
  const faction = c.faction as FactionKey;
  const rank = rankProgress(faction, c.bounty, c.notoriety);
  const seat = isSeatId(c.seat) ? (c.seat as SeatId) : null;
  const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
  const imprisoned = c.status === CharacterStatus.IMPRISONED || (!!jailed && !jailed.releasedAt);
  const next = ladderFor(faction).find((s) => seatRank(s.id) > seatRank(seat));
  const nextReq = next ? seatRequirements(next.id, { faction, alive: c.status !== CharacterStatus.DEAD, imprisoned, level: c.level, merit: c.notoriety, seat }) : null;
  const readIds = JSON.parse(c.poneglyphsRead || "[]") as string[];
  const [missions, contract, roadRead, historyRead, rubbings, pendingSeat, openEvents, wars] = await Promise.all([
    prisma.mission.count({ where: { characterId: c.id, islandId: c.currentIslandId, status: "ACTIVE" } }),
    prisma.mission.count({ where: { characterId: c.id, islandId: c.currentIslandId, status: "ACTIVE", factionRep: { gt: 0 } } }),
    prisma.poneglyph.count({ where: { kind: "Road", id: { in: readIds } } }),
    prisma.poneglyph.count({ where: { kind: "Historia", id: { in: readIds } } }),
    prisma.inventoryItem.count({ where: { characterId: c.id, kind: "Calco" } }),
    prisma.seatChallenge.count({ where: { defenderId: c.id, status: "PENDING" } }),
    prisma.playerEvent.count({ where: { status: "OPEN" } }),
    worldWarsFor(c),
  ]);
  const steps = pathSteps({
    faction,
    level: c.level,
    imprisoned,
    hp: c.hp,
    maxHp: c.maxHp,
    hasCrew: !!c.crewId,
    canHaveCrew: factionCanHaveCrew(c.faction),
    rankTitle: rank.title,
    nextRankTitle: rank.nextTitle,
    rankRemaining: rank.remaining,
    rankMetric: rank.metric,
    seatTitle: seat ? SEATS[seat].title : null,
    nextSeat: next && nextReq ? { title: next.title, ok: nextReq.ok, missing: nextReq.checks.filter((x) => !x.met).map((x) => x.label) } : null,
    pendingSeatChallenges: pendingSeat,
    activeMissions: missions,
    factionContractActive: contract > 0,
    attributePoints: c.attributePoints,
    roadRead,
    historyRead,
    script: c.ancientScript,
    rubbings,
    isEmperor: isEmperor(c),
    isWarlord: isWarlord(c),
    bounty: c.bounty,
    openWorldWars: wars.map((w) => ({ label: w.label, mySide: !!w.mySide, canEnlist: w.canEnlist.length > 0, governmentCall: w.governmentCall })),
    openEvents,
  });
  return { rank: { title: seat ? SEATS[seat].title : rank.title, next: rank.nextTitle, metric: rank.metric, remaining: rank.remaining, fraction: rank.fraction }, steps };
}

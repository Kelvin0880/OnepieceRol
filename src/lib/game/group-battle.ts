import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { runGroupBattle, BattleFighter, Matchup } from "../engine/group-battle";
import { Combatant } from "../engine/combat";
import { berryReward, bountyReward } from "../engine/economy";
import { combatPower } from "../engine/encounter";
import { toCombatant } from "./derive";
import { handleDeathCheck, postNews, DeathCheckCharacter } from "./death-resolution";
import { applyBountyOrNotoriety, ReputationCharacter } from "./reputation";
import { captureCharacter } from "./prison";
import { CharacterStatus, Faction } from "@prisma/client";

/** 30% base chance to be arrested instead of just limping away, only when the winner is Marine and the loser isn't. */
const MARINE_CAPTURE_CHANCE = 0.55;

export async function resolveDuelLoss(
  loser: DeathCheckCharacter & { faction: Faction; maxHp: number; currentIslandId: string; level: number; devilFruitId?: string | null; bounty?: number; notoriety?: number },
  winner: { faction: Faction; combatant: Combatant },
  reason: string,
  newsLog: string[]
): Promise<{ died: boolean; captured: boolean; finalHp: number }> {
  const death = await handleDeathCheck(loser, 0, reason, newsLog);
  if (death.died) return { died: true, captured: false, finalHp: 0 };

  const capturable = (winner.faction === "MARINE" || winner.faction === "CP0") && loser.faction !== "MARINE" && loser.faction !== "CP0";
  if (capturable && Math.random() < MARINE_CAPTURE_CHANCE) {
    await captureCharacter(
      {
        id: loser.id,
        name: loser.name,
        maxHp: loser.maxHp,
        currentIslandId: loser.currentIslandId,
        currentIsland: loser.currentIsland,
        level: loser.level,
        devilFruitId: loser.devilFruitId,
        faction: loser.faction,
        bounty: loser.bounty,
        notoriety: loser.notoriety,
      },
      combatPower(winner.combatant),
      `Cayó en batalla y fue apresado por la Marina en ${loser.currentIsland.name}.`,
      newsLog
    );
    return { died: false, captured: true, finalHp: death.finalHp };
  }

  return { died: false, captured: false, finalHp: death.finalHp };
}

export class BattleError extends Error {}

async function loadCharacterFull(characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true, crew: true },
  });
  if (!character) throw new BattleError("Personaje no encontrado.");
  return character;
}

export interface ProposedMatchup {
  myCharacterId: string;
  opponentCharacterId: string;
}

export async function proposeBattle(challengerCharacterId: string, userId: string, targetCrewId: string, matchups: ProposedMatchup[]) {
  const challenger = await loadCharacterFull(challengerCharacterId);
  if (challenger.userId !== userId) throw new BattleError("Personaje no encontrado.");
  if (challenger.status !== CharacterStatus.ALIVE) throw new BattleError("Tu personaje no puede desafiar a nadie en este estado.");
  if (!challenger.crew) throw new BattleError("Necesitas pertenecer a un grupo para desafiar a otro.");
  if (challenger.crew.captainId !== challenger.id) throw new BattleError("Solo el capitán puede proponer una batalla.");
  if (challenger.crew.id === targetCrewId) throw new BattleError("No puedes desafiar a tu propio grupo.");
  if (matchups.length === 0) throw new BattleError("Propón al menos un enfrentamiento.");

  const targetCrew = await prisma.crew.findUnique({ where: { id: targetCrewId }, include: { members: true } });
  if (!targetCrew) throw new BattleError("Ese grupo no existe.");

  const myIds = matchups.map((m) => m.myCharacterId);
  const oppIds = matchups.map((m) => m.opponentCharacterId);
  if (new Set(myIds).size !== myIds.length || new Set(oppIds).size !== oppIds.length) {
    throw new BattleError("Cada personaje solo puede participar en un enfrentamiento.");
  }

  const myFighters = await prisma.character.findMany({ where: { id: { in: myIds } } });
  const oppFighters = await prisma.character.findMany({ where: { id: { in: oppIds } } });

  for (const f of myFighters) {
    if (f.crewId !== challenger.crew.id) throw new BattleError(`${f.name} no pertenece a tu grupo.`);
    if (f.currentIslandId !== challenger.currentIslandId) throw new BattleError(`${f.name} no está en esta isla.`);
    if (f.status !== CharacterStatus.ALIVE) throw new BattleError(`${f.name} no puede luchar en este estado.`);
  }
  for (const f of oppFighters) {
    if (f.crewId !== targetCrew.id) throw new BattleError(`${f.name} no pertenece al grupo desafiado.`);
    if (f.currentIslandId !== challenger.currentIslandId) throw new BattleError(`${f.name} no está en esta isla.`);
    if (f.status !== CharacterStatus.ALIVE) throw new BattleError(`${f.name} no puede luchar en este estado.`);
  }
  if (myFighters.length !== myIds.length || oppFighters.length !== oppIds.length) {
    throw new BattleError("Algún personaje propuesto no existe.");
  }

  const battle = await prisma.groupBattle.create({
    data: {
      islandId: challenger.currentIslandId,
      crewAId: challenger.crew.id,
      crewBId: targetCrew.id,
      matchupsJson: JSON.stringify(matchups.map((m) => ({ aId: m.myCharacterId, bId: m.opponentCharacterId }))),
      participants: {
        create: [
          ...myIds.map((id) => ({ characterId: id, side: "A" })),
          ...oppIds.map((id) => ({ characterId: id, side: "B" })),
        ],
      },
    },
  });

  await postNews(
    `${challenger.crew.name} desafía a ${targetCrew.name}`,
    `En ${challenger.currentIsland.name}, "${challenger.crew.name}" ha propuesto un enfrentamiento de ${matchups.length} contra ${matchups.length} a "${targetCrew.name}".`,
    "Tripulaciones",
    challenger.id,
    "normal"
  );

  return battle;
}

export async function respondToBattle(defendingCharacterId: string, userId: string, battleId: string, accept: boolean) {
  const defender = await loadCharacterFull(defendingCharacterId);
  if (defender.userId !== userId) throw new BattleError("Personaje no encontrado.");
  if (!defender.crew) throw new BattleError("No perteneces a ningún grupo.");

  const battle = await prisma.groupBattle.findUnique({ where: { id: battleId } });
  if (!battle) throw new BattleError("Batalla no encontrada.");
  if (battle.status !== "PROPOSED") throw new BattleError("Esta batalla ya fue resuelta.");
  if (battle.crewBId !== defender.crew.id) throw new BattleError("No puedes responder a esta batalla.");
  if (defender.crew.captainId !== defender.id) throw new BattleError("Solo el capitán puede responder a un desafío.");

  if (!accept) {
    await prisma.groupBattle.update({ where: { id: battle.id }, data: { status: "DECLINED", resolvedAt: new Date() } });
    return { status: "DECLINED" as const };
  }

  const matchups = JSON.parse(battle.matchupsJson) as Matchup[];
  const participants = await prisma.character.findMany({
    where: { id: { in: [...matchups.map((m) => m.aId), ...matchups.map((m) => m.bId)] } },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true },
  });
  const byId = new Map(participants.map((p) => [p.id, p]));

  const sideA: BattleFighter[] = matchups.map((m) => ({ id: m.aId, combatant: toCombatant(byId.get(m.aId)!) }));
  const sideB: BattleFighter[] = matchups.map((m) => ({ id: m.bId, combatant: toCombatant(byId.get(m.bId)!) }));

  const result = runGroupBattle(liveRng(), sideA, sideB, matchups);
  const newsLog: string[] = [];
  const combatantById = new Map([...sideA, ...sideB].map((f) => [f.id, f.combatant]));

  for (const duel of result.duels) {
    const aChar = byId.get(duel.aId)!;
    const bChar = byId.get(duel.bId)!;

    const aWon = duel.winner === "a";
    const bWon = duel.winner === "b";

    await prisma.groupBattleParticipant.update({
      where: { battleId_characterId: { battleId: battle.id, characterId: duel.aId } },
      data: { outcome: aWon ? "victory" : bWon ? "defeat" : "draw" },
    });
    await prisma.groupBattleParticipant.update({
      where: { battleId_characterId: { battleId: battle.id, characterId: duel.bId } },
      data: { outcome: bWon ? "victory" : aWon ? "defeat" : "draw" },
    });

    if (duel.aHpLeft <= 0) {
      const outcome = await resolveDuelLoss(aChar, { faction: bChar.faction, combatant: combatantById.get(bChar.id)! }, `Cayó en batalla contra ${bChar.name}.`, newsLog);
      await prisma.groupBattleParticipant.update({
        where: { battleId_characterId: { battleId: battle.id, characterId: duel.aId } },
        data: { died: outcome.died },
      });
      if (!outcome.died && !outcome.captured) await prisma.character.update({ where: { id: aChar.id }, data: { hp: outcome.finalHp } });
    } else {
      await prisma.character.update({ where: { id: aChar.id }, data: { hp: Math.max(1, duel.aHpLeft) } });
    }

    if (duel.bHpLeft <= 0) {
      const outcome = await resolveDuelLoss(bChar, { faction: aChar.faction, combatant: combatantById.get(aChar.id)! }, `Cayó en batalla contra ${aChar.name}.`, newsLog);
      await prisma.groupBattleParticipant.update({
        where: { battleId_characterId: { battleId: battle.id, characterId: duel.bId } },
        data: { died: outcome.died },
      });
      if (!outcome.died && !outcome.captured) await prisma.character.update({ where: { id: bChar.id }, data: { hp: outcome.finalHp } });
    } else {
      await prisma.character.update({ where: { id: bChar.id }, data: { hp: Math.max(1, duel.bHpLeft) } });
    }

    // Winners earn the same baseline reward a solo victory over a same-danger foe would.
    const islandDanger = aChar.currentIsland.dangerLevel;
    if (aWon) await grantVictorSpoils(aChar, islandDanger, newsLog);
    if (bWon) await grantVictorSpoils(bChar, islandDanger, newsLog);
  }

  await prisma.groupBattle.update({
    where: { id: battle.id },
    data: { status: "RESOLVED", resolvedAt: new Date(), resultJson: JSON.stringify(result) },
  });

  const crewA = await prisma.crew.findUnique({ where: { id: battle.crewAId } });
  const crewB = await prisma.crew.findUnique({ where: { id: battle.crewBId } });
  const victorName = result.victor === "a" ? crewA?.name : result.victor === "b" ? crewB?.name : null;
  const headline = victorName
    ? `${victorName} se impone en el choque contra ${result.victor === "a" ? crewB?.name : crewA?.name}`
    : `Empate sangriento entre ${crewA?.name} y ${crewB?.name}`;
  await postNews(headline, `Un enfrentamiento de ${matchups.length} contra ${matchups.length} terminó con ${result.duels.filter((d) => d.winner !== "draw").length} duelos decididos.`, "Guerra", (result.victor === "b" ? crewB?.captainId : crewA?.captainId) ?? crewA?.captainId, "major");
  newsLog.push(headline);

  return { status: "RESOLVED" as const, result, newsPosted: newsLog };
}

export async function grantVictorSpoils(character: ReputationCharacter & { berries: number; level: number }, islandDanger: number, newsLog: string[]) {
  const berries = berryReward(islandDanger, false);
  const bountyOrNotorietyDelta =
    character.faction === "PIRATE" || character.faction === "BOUNTY_HUNTER"
      ? bountyReward(islandDanger, character.level, false)
      : Math.round(bountyReward(islandDanger, character.level, false) / 20_000);
  await prisma.character.update({ where: { id: character.id }, data: { berries: character.berries + berries } });
  await applyBountyOrNotoriety(character, bountyOrNotorietyDelta, newsLog, "Victoria en batalla grupal");
}

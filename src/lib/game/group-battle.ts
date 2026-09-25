import { prisma } from "../db";
import { notifyCharacters } from "../realtime";
import { berryReward, bountyReward } from "../engine/economy";
import { postNews } from "./death-resolution";
import { applyBountyOrNotoriety, ReputationCharacter } from "./reputation";
import { CharacterStatus } from "@prisma/client";

/** 30% base chance to be arrested instead of just limping away, only when the winner is Marine and the loser isn't. */
export class BattleError extends Error {}

async function loadCharacterFull(characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true, crew: true, styles: true, ownedWeapons: { where: { wielded: true } } },
  });
  if (!character) throw new BattleError("Personaje no encontrado.");
  return character;
}

export interface ProposedMatchup {
  myCharacterId: string;
  opponentCharacterId: string;
}

export async function proposeBattle(challengerCharacterId: string, userId: string, targetCrewId: string, matchups: ProposedMatchup[], lethal = false) {
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
      lethal,
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
    `En ${challenger.currentIsland.name}, "${challenger.crew.name}" ha propuesto un enfrentamiento ${lethal ? "a muerte " : ""}de ${matchups.length} contra ${matchups.length} a "${targetCrew.name}".`,
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

  const matchups = JSON.parse(battle.matchupsJson) as { aId: string; bId: string }[];
  const participants = await prisma.character.findMany({ where: { id: { in: [...matchups.map((m) => m.aId), ...matchups.map((m) => m.bId)] } } });
  const byId = new Map(participants.map((p) => [p.id, p]));

  // Everyone in the clash must still be free to fight: a matchup cannot start on someone who is away, hurt or already in another duel.
  const openDuels = await prisma.duel.findMany({ where: { status: { in: ["PROPOSED", "ACTIVE"] }, OR: [{ challengerId: { in: [...byId.keys()] } }, { opponentId: { in: [...byId.keys()] } }] } });
  const pending = await prisma.pendingEncounter.findMany({ where: { characterId: { in: [...byId.keys()] } } });
  for (const m of matchups) {
    for (const id of [m.aId, m.bId]) {
      const c = byId.get(id);
      if (!c || c.status !== CharacterStatus.ALIVE || c.currentIslandId !== battle.islandId) throw new BattleError(`${c?.name ?? "Un luchador"} ya no puede luchar aquí.`);
      if (openDuels.some((d) => d.challengerId === id || d.opponentId === id) || pending.some((p) => p.characterId === id)) throw new BattleError(`${c.name} está metido en otro enfrentamiento.`);
    }
  }

  await prisma.groupBattle.update({ where: { id: battle.id }, data: { status: "ACTIVE" } });
  for (const m of matchups) {
    const a = byId.get(m.aId)!;
    const b = byId.get(m.bId)!;
    const duel = await prisma.duel.create({
      data: {
        islandId: battle.islandId,
        challengerId: a.id,
        opponentId: b.id,
        status: "ACTIVE",
        round: 1,
        lethal: battle.lethal,
        groupBattleId: battle.id,
        challengerHp: battle.lethal ? Math.max(1, a.hp) : a.maxHp,
        opponentHp: battle.lethal ? Math.max(1, b.hp) : b.maxHp,
        challengerMaxHp: a.maxHp,
        opponentMaxHp: b.maxHp,
      },
    });
    await prisma.duelMessage.create({
      data: { duelId: duel.id, authorCharacterId: null, authorName: "Árbitro", text: `Batalla de tripulaciones: ${a.name} contra ${b.name}. ${battle.lethal ? "Es a muerte." : "Es un duelo de combate, no a muerte."} Cada uno escribe su intención (cómo ataca y cómo se defiende); cuando ambos hayáis movido, el árbitro los lee a la vez.` },
    });
  }
  notifyCharacters([...byId.keys()], "battle-started");
  return { status: "ACTIVE" as const, duels: matchups.length };
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

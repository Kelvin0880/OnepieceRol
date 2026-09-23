import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { pickEventTemplate, resolveEvent, parseEventBody, EventBody } from "../engine/events";
import { runCombat, Combatant } from "../engine/combat";
import { trainHaki, rollConquerorsHakiAwakening } from "../engine/haki";
import { bountyReward, berryReward, xpToNextLevel } from "../engine/economy";
import { assessThreat, attemptFlee, ThreatAssessment } from "../engine/encounter";
import { canEnterIsland } from "../engine/travel";
import { toCombatant, generalSkillModifier } from "./derive";
import { tickWorldIfDue } from "./world-tick";
import { postNews, handleDeathCheck } from "./death-resolution";
import { applyBountyOrNotoriety } from "./reputation";
import { CharacterStatus } from "@prisma/client";

export class GameActionError extends Error {}

type LoadedCharacter = Awaited<ReturnType<typeof loadCharacterOrThrow>>;

async function loadCharacterOrThrow(characterId: string, userId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true, pendingEncounter: true },
  });
  if (!character || character.userId !== userId) throw new GameActionError("Personaje no encontrado.");
  if (character.status !== CharacterStatus.ALIVE) throw new GameActionError("Este personaje ya no puede actuar.");
  return character;
}

async function grantXp(currentXp: number, currentLevel: number, gained: number) {
  let xp = currentXp + gained;
  let level = currentLevel;
  let leveledUp = false;
  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
    leveledUp = true;
  }
  return { xp, level, leveledUp };
}

export interface ActionResult {
  log: string[];
  berriesDelta: number;
  xpDelta: number;
  bountyDelta: number;
  hpDelta: number;
  leveledUp: boolean;
  newLevel: number;
  died: boolean;
  deathCause?: string;
  fruitGained?: string;
  poneglyphGained?: string;
  newsPosted: string[];
  conquerorsHakiAwakened?: boolean;
  pendingCombat?: { enemyName: string; assessment: ThreatAssessment; isBoss: boolean };
  awaitingMercyChoice?: { enemyName: string };
}

async function tryDropFruit(characterId: string, newsLog: string[]): Promise<string | undefined> {
  const unclaimed = await prisma.devilFruit.findMany({ where: { claimedBy: { is: null } } });
  if (unclaimed.length === 0) return undefined;
  const fruit = unclaimed[Math.floor(Math.random() * unclaimed.length)];
  await prisma.character.update({ where: { id: characterId }, data: { devilFruitId: fruit.id } });
  const character = await prisma.character.findUnique({ where: { id: characterId } });
  const headline = `¡${character?.name} despierta el poder de la ${fruit.name}!`;
  await postNews(headline, `Un poder que pocos podrán igualar acaba de entrar en juego en los mares.`, "Frutas", characterId);
  newsLog.push(headline);
  return fruit.name;
}

interface StoredEnemy {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
}

interface StoredRewards {
  berries: number;
  xp: number;
  bounty: number;
  islandDanger: number;
  poneglyphId?: string;
}

const emptyResult = (log: string[], newLevel: number): ActionResult => ({
  log,
  berriesDelta: 0,
  xpDelta: 0,
  bountyDelta: 0,
  hpDelta: 0,
  leveledUp: false,
  newLevel,
  died: false,
  newsPosted: [],
});

export async function exploreCharacter(characterId: string, userId: string): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) {
    throw new GameActionError("Tienes un enfrentamiento sin resolver. Decide si luchar o huir primero.");
  }
  const rng = liveRng();

  const templates = await prisma.eventTemplate.findMany({
    where: {
      OR: [{ islandId: character.currentIslandId }, { islandId: null }],
      minDanger: { lte: character.currentIsland.dangerLevel },
      maxDanger: { gte: character.currentIsland.dangerLevel },
    },
  });
  if (templates.length === 0) throw new GameActionError("No hay nada que explorar aquí por ahora.");

  const template = pickEventTemplate(
    rng,
    templates.map((t) => ({ id: t.id, weight: t.weight }))
  );
  const full = templates.find((t) => t.id === template.id)!;
  const body: EventBody = parseEventBody(full.bodyJson);

  const modifier = generalSkillModifier(character);
  const resolution = resolveEvent(rng, body, modifier, character.currentIsland.dangerLevel, character.level);

  const log: string[] = [resolution.flavorText, resolution.narrative];
  const newsLog: string[] = [];

  // Combat events pause here: the player decides fight-or-flee before
  // anything is committed to the database.
  if (resolution.triggersCombat && resolution.enemy) {
    const playerCombatant = toCombatant(character);
    const tierMultiplier =
      resolution.outcome === "critical_success" ? 0.7 : resolution.outcome === "success" ? 0.85 : resolution.outcome === "fail" ? 1 : 1.25;
    const enemy: StoredEnemy = {
      name: resolution.enemy.name,
      hp: resolution.enemy.hp,
      atk: Math.round(resolution.enemy.atk * tierMultiplier),
      def: resolution.enemy.def,
      spd: resolution.enemy.spd,
      isBoss: !!resolution.enemy.isBoss,
    };
    const enemyCombatant: Combatant = { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
    const assessment = assessThreat(playerCombatant, enemyCombatant);

    const rewards: StoredRewards = {
      berries: resolution.berries,
      xp: resolution.xp,
      bounty: resolution.bounty,
      islandDanger: character.currentIsland.dangerLevel,
      poneglyphId: body.poneglyphId,
    };

    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify(rewards),
        narrative: log.join(" "),
        assessment,
      },
    });

    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: full.kind.toLowerCase(), text: log.join(" ") } });

    return {
      ...emptyResult(log, character.level),
      pendingCombat: { enemyName: enemy.name, assessment, isBoss: enemy.isBoss },
    };
  }

  // Non-combat narrative beat: apply everything immediately.
  let hpDelta = -resolution.hpLoss;
  let died = false;
  let deathCause: string | undefined;

  if (character.hp + hpDelta <= 0) {
    const deathCheck = await handleDeathCheck(character, character.hp + hpDelta, "Sucumbió a las heridas de su última aventura.", newsLog);
    died = deathCheck.died;
    if (died) deathCause = "Sucumbió a las heridas de su última aventura.";
    hpDelta = deathCheck.finalHp - character.hp;
  }

  let fruitGained: string | undefined;
  if (!died && resolution.fruitDropRolled && !character.devilFruitId) {
    fruitGained = await tryDropFruit(character.id, newsLog);
    if (fruitGained) log.push(`Sientes un poder extraño recorrer tu cuerpo: has obtenido la ${fruitGained}.`);
  }

  let leveledUp = false;
  let newLevel = character.level;
  if (!died && resolution.xp > 0) {
    const result = await grantXp(character.experience, character.level, resolution.xp);
    leveledUp = result.leveledUp;
    newLevel = result.level;
    if (leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${newLevel}.`);
    await prisma.character.update({ where: { id: character.id }, data: { experience: result.xp, level: result.level } });
  }

  if (!died) {
    const newHp = Math.max(0, Math.min(character.maxHp, character.hp + hpDelta));
    await prisma.character.update({ where: { id: character.id }, data: { hp: newHp, berries: Math.max(0, character.berries + resolution.berries) } });
    await applyBountyOrNotoriety(character, resolution.bounty, newsLog);
  }

  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: full.kind.toLowerCase(), text: log.join(" ") } });

  return {
    log,
    berriesDelta: resolution.berries,
    xpDelta: resolution.xp,
    bountyDelta: resolution.bounty,
    hpDelta,
    leveledUp,
    newLevel,
    died,
    deathCause,
    fruitGained,
    newsPosted: newsLog,
  };
}

/** Companions who are alive and reasonably fresh may lend a hand in a boss fight. */
function rollCompanionAssist(character: LoadedCharacter, rng: () => number): string | null {
  const ready = character.companions.filter((c) => c.status === "ALIVE" && c.hp / c.maxHp > 0.5);
  if (ready.length === 0) return null;
  const candidate = ready[Math.floor(rng() * ready.length)];
  const chance = 0.25 + candidate.loyalty * 0.005;
  return rng() < chance ? candidate.name : null;
}

export async function engageCharacter(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const pending = character.pendingEncounter;
  if (!pending) throw new GameActionError("No tienes ningún enfrentamiento pendiente.");
  if (pending.phase !== "threat") throw new GameActionError("Ya resolviste el combate; solo falta decidir su destino.");
  const rng = liveRng();

  const enemy = JSON.parse(pending.enemyJson) as StoredEnemy;
  const rewards = JSON.parse(pending.rewardsJson) as StoredRewards;
  const log: string[] = [];
  const newsLog: string[] = [];

  let playerCombatant = toCombatant(character);
  const assistName = enemy.isBoss ? rollCompanionAssist(character, rng) : null;
  if (assistName) {
    playerCombatant = { ...playerCombatant, atk: Math.round(playerCombatant.atk * 1.15) };
    log.push(`${assistName} se lanza a tu lado para ayudarte contra ${enemy.name}.`);
  }

  const enemyCombatant: Combatant = { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
  const combatResult = runCombat(rng, { ...playerCombatant, hp: character.hp, maxHp: character.maxHp }, enemyCombatant);
  for (const round of combatResult.rounds) {
    if (round.damage > 0) log.push(`${round.attacker} golpea a ${round.defender} (${round.damage} de daño).`);
  }

  if (combatResult.victor === "player") {
    log.push(`¡${enemy.name} queda derrotado y a tu merced!`);
    await prisma.character.update({ where: { id: character.id }, data: { hp: Math.max(1, combatResult.playerHpLeft) } });
    // Keep the pending encounter around, now representing "awaiting mercy choice".
    await prisma.pendingEncounter.update({ where: { characterId: character.id }, data: { phase: "victory" } });
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });
    return { ...emptyResult(log, character.level), awaitingMercyChoice: { enemyName: enemy.name } };
  }

  log.push(`${enemy.name} te derrota.`);
  const deathCheck = await handleDeathCheck(character, combatResult.playerHpLeft, `Cayó en combate contra ${enemy.name}.`, newsLog);
  await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
  if (!deathCheck.died) {
    await prisma.character.update({ where: { id: character.id }, data: { hp: deathCheck.finalHp } });
  }
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });

  return {
    log,
    berriesDelta: 0,
    xpDelta: 0,
    bountyDelta: 0,
    hpDelta: deathCheck.finalHp - character.hp,
    leveledUp: false,
    newLevel: character.level,
    died: deathCheck.died,
    deathCause: deathCheck.died ? `Cayó en combate contra ${enemy.name}.` : undefined,
    newsPosted: newsLog,
  };
}

export async function fleeCharacter(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const pending = character.pendingEncounter;
  if (!pending) throw new GameActionError("No tienes ningún enfrentamiento pendiente.");
  if (pending.phase !== "threat") throw new GameActionError("Ya derrotaste a tu enemigo; ahora decide su destino, no puedes huir.");
  const rng = liveRng();

  const enemy = JSON.parse(pending.enemyJson) as StoredEnemy;
  const playerCombatant = toCombatant(character);
  const enemyCombatant: Combatant = { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
  const flee = attemptFlee(rng, playerCombatant, enemyCombatant);

  if (flee.success) {
    await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
    const log = [`Logras escabullirte de ${enemy.name} sin que te alcance.`];
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "flee", text: log[0] } });
    return emptyResult(log, character.level);
  }

  const log = [`No logras escapar de ${enemy.name}, que te alcanza mientras huyes. No queda más remedio que luchar.`];
  await prisma.character.update({ where: { id: character.id }, data: { hp: Math.max(0, character.hp - flee.hpLoss) } });

  if (character.hp - flee.hpLoss <= 0) {
    const newsLog: string[] = [];
    const deathCheck = await handleDeathCheck(character, character.hp - flee.hpLoss, `Cayó intentando huir de ${enemy.name}.`, newsLog);
    await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
    if (!deathCheck.died) await prisma.character.update({ where: { id: character.id }, data: { hp: deathCheck.finalHp } });
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "flee", text: log.join(" ") } });
    return {
      log,
      berriesDelta: 0,
      xpDelta: 0,
      bountyDelta: 0,
      hpDelta: deathCheck.finalHp - character.hp,
      leveledUp: false,
      newLevel: character.level,
      died: deathCheck.died,
      deathCause: deathCheck.died ? `Cayó intentando huir de ${enemy.name}.` : undefined,
      newsPosted: newsLog,
    };
  }

  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "flee", text: log.join(" ") } });
  return {
    ...emptyResult(log, character.level),
    hpDelta: -flee.hpLoss,
    pendingCombat: { enemyName: enemy.name, assessment: pending.assessment as ThreatAssessment, isBoss: enemy.isBoss },
  };
}

export async function resolveMercyChoice(characterId: string, userId: string, spare: boolean): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const pending = character.pendingEncounter;
  if (!pending) throw new GameActionError("No hay ninguna decisión pendiente.");
  if (pending.phase !== "victory") throw new GameActionError("Todavía no has derrotado a tu enemigo.");

  const enemy = JSON.parse(pending.enemyJson) as StoredEnemy;
  const rewards = JSON.parse(pending.rewardsJson) as StoredRewards;
  const newsLog: string[] = [];
  const log: string[] = [];

  const mercyMultiplier = spare ? 0.7 : 1;
  const berriesDelta = rewards.berries + Math.round(berryReward(rewards.islandDanger, enemy.isBoss) * mercyMultiplier);
  const baseBounty = rewards.bounty + bountyReward(rewards.islandDanger, character.level, enemy.isBoss);
  const bountyDelta =
    character.faction === "PIRATE" || character.faction === "BOUNTY_HUNTER"
      ? Math.round(baseBounty * mercyMultiplier)
      : Math.round((baseBounty / 20_000) * mercyMultiplier);
  const xpDelta = rewards.xp + 10;

  if (spare) {
    log.push(`Decides perdonar a ${enemy.name} y lo dejas ir con vida.`);
    if (character.faction === "MARINE") log.push("La justicia también puede mostrar clemencia — aunque tus superiores lo cuestionen.");
    if (Math.random() < 0.1) {
      const headline = `${enemy.name} jura no olvidar la piedad de ${character.name}`;
      await postNews(headline, `Testigos aseguran que ${enemy.name}, perdonado en pleno combate, se ha marchado jurando devolver el favor algún día.`, "Tripulaciones", character.id);
      newsLog.push(headline);
    }
  } else {
    log.push(`Acabas el combate contra ${enemy.name} sin darle tregua.`);
    if (enemy.isBoss && Math.random() < 0.15) {
      const headline = `Rumores de venganza tras la caída de ${enemy.name}`;
      await postNews(headline, `Antiguos aliados de ${enemy.name} habrían jurado hacer pagar a ${character.name} por lo ocurrido.`, "Guerra", character.id);
      newsLog.push(headline);
    }
  }

  let leveledUp = false;
  let newLevel = character.level;
  const result = await grantXp(character.experience, character.level, xpDelta);
  leveledUp = result.leveledUp;
  newLevel = result.level;
  if (leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${newLevel}.`);

  await prisma.character.update({
    where: { id: character.id },
    data: { experience: result.xp, level: result.level, berries: Math.max(0, character.berries + berriesDelta) },
  });
  await applyBountyOrNotoriety(character, bountyDelta, newsLog);

  let poneglyphGained: string | undefined;
  if (rewards.poneglyphId) {
    const alreadyRead = (JSON.parse(character.poneglyphsRead) as string[]).includes(rewards.poneglyphId);
    if (!alreadyRead) {
      const poneglyph = await prisma.poneglyph.findUnique({ where: { id: rewards.poneglyphId } });
      if (poneglyph) {
        const updated = [...(JSON.parse(character.poneglyphsRead) as string[]), poneglyph.id];
        await prisma.character.update({ where: { id: character.id }, data: { poneglyphsRead: JSON.stringify(updated) } });
        poneglyphGained = poneglyph.codeName;
        log.push(`Descifras el ${poneglyph.codeName}. Su mensaje quedará grabado en tu memoria para siempre.`);
        const headline = `${character.name} descifra un Poneglifo de Ruta`;
        await postNews(headline, `Pocos en el mundo pueden leer los símbolos antiguos — ${character.name} acaba de hacerlo en ${character.currentIsland.name}.`, "Poneglifos", character.id);
        newsLog.push(headline);
      }
    }
  }

  await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });

  return { log, berriesDelta, xpDelta, bountyDelta, hpDelta: 0, leveledUp, newLevel, died: false, newsPosted: newsLog, poneglyphGained };
}

export async function trainCharacter(characterId: string, userId: string): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  const rng = liveRng();

  const trainArmament = character.armamentHaki <= character.observationHaki;
  const result = trainHaki(rng, trainArmament ? character.armamentHaki : character.observationHaki, character.willpower);

  const log: string[] = [];
  if (result.gained === 0) {
    log.push("Entrenas duro, pero hoy no notas ningún avance real.");
  } else if (result.breakthrough) {
    log.push(`¡Un gran avance! Tu dominio de ${trainArmament ? "Haki de Armadura" : "Haki de Observación"} crece notablemente (+${result.gained}).`);
  } else {
    log.push(`Terminas la sesión con tu ${trainArmament ? "Haki de Armadura" : "Haki de Observación"} un poco más afilado (+${result.gained}).`);
  }

  await prisma.character.update({
    where: { id: character.id },
    data: trainArmament ? { armamentHaki: character.armamentHaki + result.gained } : { observationHaki: character.observationHaki + result.gained },
  });

  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "training", text: log.join(" ") } });

  return emptyResult(log, character.level);
}

export async function travelCharacter(characterId: string, userId: string, targetIslandId: string): Promise<{ log: string[] }> {
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("No puedes zarpar con un enfrentamiento sin resolver.");
  const connections = JSON.parse(character.currentIsland.connections) as string[];
  if (!connections.includes(targetIslandId)) {
    throw new GameActionError("Esa isla no es alcanzable directamente desde tu posición actual.");
  }
  const target = await prisma.island.findUnique({ where: { id: targetIslandId } });
  if (!target) throw new GameActionError("Isla desconocida.");
  if (!canEnterIsland(character.level, target.minLevelToEnter)) {
    throw new GameActionError(`${target.name} es demasiado peligrosa todavía. Necesitas al menos nivel ${target.minLevelToEnter} para sobrevivir allí.`);
  }

  await prisma.character.update({ where: { id: character.id }, data: { currentIslandId: target.id } });
  const line = `Zarpas de ${character.currentIsland.name} y desembarcas en ${target.name}.`;
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "travel", text: line } });

  return { log: [line] };
}

export async function restCharacter(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("No puedes descansar con un enfrentamiento sin resolver.");
  const healed = Math.min(character.maxHp, character.hp + Math.round(character.maxHp * 0.4));
  await prisma.character.update({ where: { id: character.id }, data: { hp: healed } });
  const log = ["Descansas y recuperas fuerzas antes de tu próxima aventura."];
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "rest", text: log[0] } });
  return { ...emptyResult(log, character.level), hpDelta: healed - character.hp };
}

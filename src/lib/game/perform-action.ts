import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { pickEventTemplate, resolveEvent, parseEventBody, EventBody } from "../engine/events";
import { resolveExchange, MAX_ROUNDS, Combatant } from "../engine/combat";
import { trainHaki, rollConquerorsHakiAwakening } from "../engine/haki";
import { bountyReward, berryReward, xpToNextLevel } from "../engine/economy";
import { assessThreat, attemptFlee, ThreatAssessment } from "../engine/encounter";
import { canEnterIsland } from "../engine/travel";
import { rollHunterAmbush, decayPursuitHeat, heatAfterReadingPoneglyph } from "../engine/pursuit";
import { toCombatant, generalSkillModifier } from "./derive";
import { tickWorldIfDue } from "./world-tick";
import { postNews, handleDeathCheck } from "./death-resolution";
import { applyBountyOrNotoriety } from "./reputation";
import { narrateExplore, narrateCombat, narrateScene, narratePartyScene, getRecentScene, updateCharacterMemory } from "../ai/narrate";
import { classifyPlayerAction, ActionId } from "../ai/classify-action";
import {
  beginPartyTurn,
  advancePartyTurn,
  releasePartyTurnLock,
  writePartyMessage,
  echoToParty,
  confirmLeaveParty as partyConfirmLeaveParty,
  rejoinParty as partyRejoinParty,
} from "./party";
import { CharacterStatus } from "@prisma/client";

const TRAINING_COOLDOWN_MS = 30 * 60 * 1000;

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
  /** Set when free text read as wanting to leave a shared party scene — a real confirm step, nothing mutated yet. */
  confirmRequired?: "leave_party";
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
  personality?: string;
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

export async function exploreCharacter(characterId: string, userId: string, intentText?: string): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) {
    throw new GameActionError("Tienes un enfrentamiento sin resolver. Decide si luchar o huir primero.");
  }
  const rng = liveRng();

  // Holding a Poneglyph's secret makes you a target — before anything
  // else, roll whether whoever lost that secret has finally caught up.
  if (rollHunterAmbush(rng, character.poneglyphHeat)) {
    const playerCombatant = toCombatant(character);
    const enemy: StoredEnemy = {
      name: "Cazador de Poneglifos",
      hp: Math.round(character.maxHp * 1.3),
      atk: Math.round(playerCombatant.atk * 1.05),
      def: Math.round(playerCombatant.def * 0.9),
      spd: playerCombatant.spd,
      isBoss: true,
    };
    const enemyCombatant: Combatant = { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
    const assessment = assessThreat(playerCombatant, enemyCombatant);
    const log = [
      "Nadie que lee un Poneglifo queda a salvo por mucho tiempo. Una sombra armada te alcanza, enviada por quienes no pueden permitirse que ese secreto siga vivo.",
    ];

    await prisma.character.update({ where: { id: character.id }, data: { poneglyphHeat: decayPursuitHeat(character.poneglyphHeat) } });
    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify({ berries: 0, xp: 20, bounty: 0, islandDanger: character.currentIsland.dangerLevel } satisfies StoredRewards),
        narrative: log.join(" "),
        assessment,
      },
    });
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "pursuit", text: log.join(" ") } });

    return { ...emptyResult(log, character.level), pendingCombat: { enemyName: enemy.name, assessment, isBoss: true } };
  }
  if (character.poneglyphHeat > 0) {
    await prisma.character.update({ where: { id: character.id }, data: { poneglyphHeat: decayPursuitHeat(character.poneglyphHeat) } });
  }

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
  const resolution = resolveEvent(rng, body, modifier, character.currentIsland.dangerLevel, character.level, !!character.devilFruitId);

  const introLog: string[] = [resolution.flavorText, resolution.narrative];
  const newsLog: string[] = [];

  // Combat events pause here: the player decides fight-or-flee before
  // anything is committed to the database. Not AI-narrated in this phase —
  // only the resolved outcome (here and in engageCharacter) is, since there's
  // no final result yet to narrate.
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
      personality: resolution.enemy.personality,
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
        narrative: introLog.join(" "),
        assessment,
      },
    });

    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: full.kind.toLowerCase(), text: introLog.join(" ") } });

    return {
      ...emptyResult(introLog, character.level),
      pendingCombat: { enemyName: enemy.name, assessment, isBoss: enemy.isBoss },
    };
  }

  // Non-combat narrative beat: apply everything immediately.
  const memory = await getRecentScene(character.id, 10);
  const log: string[] = await narrateExplore(
    {
      characterName: character.name,
      faction: character.faction,
      level: character.level,
      islandName: character.currentIsland.name,
      islandDescription: character.currentIsland.description,
      outcomeTier: resolution.outcome,
      baseFlavorText: resolution.flavorText,
      baseNarrative: resolution.narrative,
      berries: resolution.berries,
      xp: resolution.xp,
      bounty: resolution.bounty,
      hpLoss: resolution.hpLoss,
      intentText,
      recentMemory: memory,
      memorySummary: character.memorySummary ?? undefined,
    },
    { characterId: character.id }
  );

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
    if (fruitGained) {
      log.push(`Sientes un poder extraño recorrer tu cuerpo: has obtenido la ${fruitGained}.`);
      log.push("Pero el mar te rechaza para siempre: nunca más podrás nadar.");
    }
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

/**
 * Combat plays out one exchange (engine/combat.ts's resolveExchange) per
 * call, driven by the player's free text each time — "poco a poco ir
 * peleando, la IA respondiendo a mi ataque", the user's own words. Phase
 * "threat" is the very first fight-or-flee commitment; once the player
 * commits, phase flips to "fighting" and each further call resolves one
 * more exchange until someone's HP hits 0, exactly like runCombat used to
 * do internally in one shot — the only thing that changed is *when* each
 * round happens (one per message) and that the player's described tactic
 * for that exchange feeds a real modifier (`tacticModifier`, judged by the
 * classifier in the same call as the action itself — see classify-action.ts,
 * merged there after live testing showed a separate tactic-assessment call
 * tripling AI calls per round and exhausting OpenRouter's free-tier rate
 * limit) before the engine rolls. The roll itself, and who wins, is still
 * 100% the engine's call — the AI never decides a fight's outcome directly.
 */
export async function engageCharacter(characterId: string, userId: string, intentText?: string, tacticModifier = 0): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const pending = character.pendingEncounter;
  if (!pending) throw new GameActionError("No tienes ningún enfrentamiento pendiente.");
  if (pending.phase !== "threat" && pending.phase !== "fighting") {
    throw new GameActionError("Ya resolviste el combate; solo falta decidir su destino.");
  }
  const rng = liveRng();

  const enemy = JSON.parse(pending.enemyJson) as StoredEnemy;
  const rewards = JSON.parse(pending.rewardsJson) as StoredRewards;
  const log: string[] = [];
  const newsLog: string[] = [];

  let playerCombatant = toCombatant(character);
  const assistName = pending.phase === "threat" && enemy.isBoss ? rollCompanionAssist(character, rng) : null;
  if (assistName) {
    playerCombatant = { ...playerCombatant, atk: Math.round(playerCombatant.atk * 1.15) };
    log.push(`${assistName} se lanza a tu lado para ayudarte contra ${enemy.name}.`);
  }

  if (tacticModifier !== 0) {
    playerCombatant = {
      ...playerCombatant,
      atk: playerCombatant.atk + tacticModifier,
      def: playerCombatant.def + Math.round(tacticModifier / 2),
    };
  }

  const enemyCombatant: Combatant = { name: enemy.name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd };
  const enemyHpBefore = pending.enemyHp ?? enemy.hp;
  const roundNumber = pending.roundNumber + 1;

  const { aHpAfter: playerHpAfter, bHpAfter: enemyHpAfter, log: roundLog } = resolveExchange(
    rng,
    roundNumber,
    { ...playerCombatant, hp: character.hp, maxHp: character.maxHp },
    character.hp,
    enemyCombatant,
    enemyHpBefore
  );

  const concluded = playerHpAfter <= 0 || enemyHpAfter <= 0 || roundNumber >= MAX_ROUNDS;
  // Same tie-break runCombat always used when rounds ran out with both still standing.
  const victor: "player" | "enemy" | undefined = !concluded
    ? undefined
    : enemyHpAfter <= 0 && playerHpAfter > 0
    ? "player"
    : playerHpAfter <= 0 && enemyHpAfter > 0
    ? "enemy"
    : enemyHpAfter < playerHpAfter
    ? "player"
    : "enemy"; // draw or ran out of rounds evenly: same "healthier side wins" rule runCombat used, loss-leaning on an exact tie

  const scene = await getRecentScene(character.id, 10);
  const narrated = await narrateCombat(
    {
      characterName: character.name,
      enemyName: enemy.name,
      enemyPersonality: enemy.personality,
      isBoss: enemy.isBoss,
      rounds: roundLog,
      concluded,
      victor,
      playerHpLeft: Math.max(0, playerHpAfter),
      playerMaxHp: character.maxHp,
      enemyHpLeft: Math.max(0, enemyHpAfter),
      enemyMaxHp: enemy.hp,
      intentText,
      recentMemory: scene,
      memorySummary: character.memorySummary ?? undefined,
    },
    { characterId: character.id }
  );
  log.push(...narrated);

  if (concluded && victor === "player") {
    log.push(`¡${enemy.name} queda derrotado y a tu merced!`);
    await prisma.character.update({ where: { id: character.id }, data: { hp: Math.max(1, playerHpAfter) } });
    // Keep the pending encounter around, now representing "awaiting mercy choice".
    await prisma.pendingEncounter.update({ where: { characterId: character.id }, data: { phase: "victory", enemyHp: Math.max(0, enemyHpAfter), roundNumber } });
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });
    // Fire-and-forget: Render runs a persistent Node process (not per-request
    // serverless), so this keeps running after the response is sent, and
    // updateCharacterMemory never throws — a slow/failed summary never
    // delays or breaks the player's actual turn.
    void updateCharacterMemory(character.id, character.memorySummary, `${character.name} venció a ${enemy.name} en combate${enemy.isBoss ? " (un enemigo formidable)" : ""}.`);
    return { ...emptyResult(log, character.level), awaitingMercyChoice: { enemyName: enemy.name } };
  }

  if (concluded && victor === "enemy") {
    log.push(`${enemy.name} te derrota.`);
    const deathCheck = await handleDeathCheck(character, playerHpAfter, `Cayó en combate contra ${enemy.name}.`, newsLog);
    await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
    if (!deathCheck.died) {
      await prisma.character.update({ where: { id: character.id }, data: { hp: deathCheck.finalHp } });
    }
    await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });
    if (!deathCheck.died) {
      void updateCharacterMemory(character.id, character.memorySummary, `${character.name} perdió un combate contra ${enemy.name} y sobrevivió malherido.`);
    }

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

  // Neither side down yet — persist the round state and wait for the player's next move.
  await prisma.character.update({ where: { id: character.id }, data: { hp: Math.max(0, playerHpAfter) } });
  await prisma.pendingEncounter.update({
    where: { characterId: character.id },
    data: { phase: "fighting", enemyHp: Math.max(0, enemyHpAfter), roundNumber },
  });
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });
  return {
    ...emptyResult(log, character.level),
    hpDelta: playerHpAfter - character.hp,
    pendingCombat: { enemyName: enemy.name, assessment: pending.assessment as ThreatAssessment, isBoss: enemy.isBoss },
  };
}

export async function fleeCharacter(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const pending = character.pendingEncounter;
  if (!pending) throw new GameActionError("No tienes ningún enfrentamiento pendiente.");
  if (pending.phase !== "threat" && pending.phase !== "fighting") {
    throw new GameActionError("Ya derrotaste a tu enemigo; ahora decide su destino, no puedes huir.");
  }
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
        const newHeat = heatAfterReadingPoneglyph(character.poneglyphHeat);
        await prisma.character.update({ where: { id: character.id }, data: { poneglyphsRead: JSON.stringify(updated), poneglyphHeat: newHeat } });
        poneglyphGained = poneglyph.codeName;
        log.push(`Descifras el ${poneglyph.codeName}. Su mensaje quedará grabado en tu memoria para siempre.`);
        log.push("Pero ese conocimiento tiene un precio: ahora eres alguien a quien hay que silenciar.");
        const headline = `${character.name} descifra un Poneglifo de Ruta`;
        await postNews(
          headline,
          `Pocos en el mundo pueden leer los símbolos antiguos — ${character.name} acaba de hacerlo en ${character.currentIsland.name}. No tardarán en venir a silenciar a quien sabe demasiado.`,
          "Poneglifos",
          character.id
        );
        newsLog.push(headline);
      }
    }
  }

  await prisma.pendingEncounter.delete({ where: { characterId: character.id } });
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "combat", text: log.join(" ") } });

  const mercyEvent =
    `${character.name} ${spare ? "perdonó" : "remató"} a ${enemy.name} tras vencerlo.` +
    (poneglyphGained ? ` Además descifró el ${poneglyphGained}.` : "");
  void updateCharacterMemory(character.id, character.memorySummary, mercyEvent);

  return { log, berriesDelta, xpDelta, bountyDelta, hpDelta: 0, leveledUp, newLevel, died: false, newsPosted: newsLog, poneglyphGained };
}

export async function trainCharacter(characterId: string, userId: string): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);

  if (character.lastTrainedAt) {
    const readyAt = character.lastTrainedAt.getTime() + TRAINING_COOLDOWN_MS;
    const remainingMs = readyAt - Date.now();
    if (remainingMs > 0) {
      const remainingMin = Math.ceil(remainingMs / 60_000);
      throw new GameActionError(`Necesitas descansar antes de volver a entrenar en serio. Podrás entrenar de nuevo en ${remainingMin} min.`);
    }
  }

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
    data: {
      ...(trainArmament ? { armamentHaki: character.armamentHaki + result.gained } : { observationHaki: character.observationHaki + result.gained }),
      lastTrainedAt: new Date(),
    },
  });

  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "training", text: log.join(" ") } });

  return emptyResult(log, character.level);
}

export async function travelCharacter(
  characterId: string,
  userId: string,
  targetIslandId: string
): Promise<{ log: string[]; arcIntro?: { islandName: string; hook: string } }> {
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

  const visited = JSON.parse(character.islandsVisited) as string[];
  const firstVisit = !visited.includes(target.id);

  await prisma.character.update({
    where: { id: character.id },
    data: { currentIslandId: target.id, islandsVisited: firstVisit ? JSON.stringify([...visited, target.id]) : character.islandsVisited },
  });
  const line = `Zarpas de ${character.currentIsland.name} y desembarcas en ${target.name}.`;
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "travel", text: line } });

  return { log: [line], arcIntro: firstVisit && target.arcHook ? { islandName: target.name, hook: target.arcHook } : undefined };
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

/**
 * Pure roleplay: no engine call, no stat changes. This is the default for
 * free text outside combat (see classify-action.ts) — a conversation, a
 * drink, a scene the player wants painted — with mechanical resolution
 * saved for when the player actually commits to something risky (explore,
 * engage, flee). Never fails outright — narrateScene has its own
 * never-throws contract with a safe fallback line.
 */
export async function narrateSceneAction(characterId: string, userId: string, freeText: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("Tienes un enfrentamiento sin resolver. Decide si luchar o huir primero.");

  const scene = await getRecentScene(character.id, 12);
  const text = await narrateScene(
    {
      characterName: character.name,
      faction: character.faction,
      level: character.level,
      islandName: character.currentIsland.name,
      islandDescription: character.currentIsland.description,
      playerText: freeText,
      recentScene: scene,
      memorySummary: character.memorySummary ?? undefined,
    },
    { characterId: character.id }
  );

  return emptyResult([text], character.level);
}

const FREE_TEXT_ACTION_LABELS: Record<ActionId, string> = {
  narrate: "",
  explore: "Explorar",
  train: "Entrenar",
  rest: "Descansar",
  travel: "Viajar",
  engage: "Luchar",
  flee: "Huir",
  mercy_spare: "Perdonar",
  mercy_finish: "Rematar",
  leave_party: "Separarse del grupo",
};

/** Confirms a leave_party read from free text — the actual state change (see party.ts's confirmLeaveParty). */
export async function confirmLeaveParty(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const { log } = await partyConfirmLeaveParty(character.id, userId);
  return emptyResult(log, character.level);
}

/** Rejoins a shared party scene, if crewmates are still together on this island. */
export async function rejoinParty(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  const { log } = await partyRejoinParty(character.id, userId);
  return emptyResult(log, character.level);
}

/**
 * Free text is the primary input (per the user's explicit choice over a
 * safer "buttons decide, text only narrates" alternative) — so this is
 * the one place that decides what actually happens from prose. Safety
 * rules, all load-bearing:
 *   1. Only the actions mechanically valid *right now* are ever offered
 *      to the classifier — it cannot return something nonsensical for
 *      the current game state.
 *   2. "unclear" is a hard no-op: no DB write, no turn consumed, the
 *      player is asked to rephrase or use the fallback buttons.
 *   3. Every response is prefixed with what was actually understood, so
 *      a wrong read is immediately visible instead of silently acted on.
 * `travel` is intentionally excluded from free-text classification: it
 * needs a target island id the classifier has no way to extract, so it
 * stays button-only for now.
 */
function summarizeCombatForParty(action: ActionId, characterName: string, result: ActionResult): string {
  if (result.died) return `${characterName} cae en combate.`;
  if (result.awaitingMercyChoice) return `${characterName} vence a su enemigo y decide qué hacer con él.`;
  if (action === "flee") return `${characterName} logra escapar de su enemigo.`;
  if (action === "mercy_spare") return `${characterName} perdona a su enemigo derrotado.`;
  if (action === "mercy_finish") return `${characterName} remata a su enemigo derrotado.`;
  return `${characterName} resuelve su combate.`;
}

/**
 * The turn-gated branch for a character currently sharing a live scene with
 * crewmates (Character.partyId set — see party.ts). Mechanical actions
 * (explore/train/rest) still dispatch to the exact same solo functions as
 * always — the only difference is a short shared line gets echoed to the
 * party feed and the turn passes to the next member. Pure "narrate" text
 * gets one shared AI call (narratePartyScene) instead of the solo
 * narrateScene, addressed to the whole present roster. Never called while
 * this character has their own pendingEncounter — that always resolves
 * immediately via the unchanged solo path in resolveFreeTextAction below,
 * bypassing party turn order entirely (you can't be blocked from fighting
 * for your life by whose turn it is in the group chat).
 */
async function resolvePartyFreeTextAction(character: LoadedCharacter, freeText: string): Promise<ActionResult> {
  const begin = await beginPartyTurn(character.id);
  if (!begin.ok) throw new GameActionError(begin.reason);

  const validActions: ActionId[] = ["narrate", "explore", "train", "rest", "leave_party"];
  const { action } = await classifyPlayerAction(freeText, validActions);

  if (action === "unclear") {
    await releasePartyTurnLock(begin.partyId);
    throw new GameActionError("No logro entender qué quieres hacer. Prueba a describirlo de otra forma.");
  }

  if (action === "leave_party") {
    await releasePartyTurnLock(begin.partyId);
    return {
      ...emptyResult(["¿Quieres separarte de tus nakamas? Puedes reunirte con ellos más tarde si sigues en la misma isla."], character.level),
      confirmRequired: "leave_party",
    };
  }

  if (action === "narrate") {
    const text = await narratePartyScene(
      {
        islandName: character.currentIsland.name,
        islandDescription: character.currentIsland.description,
        partyRoster: begin.roster,
        actingCharacterName: character.name,
        playerText: freeText,
        recentParty: begin.recentLines,
      },
      { partyId: begin.partyId }
    );
    await writePartyMessage(begin.partyId, character.id, character.name, freeText);
    await writePartyMessage(begin.partyId, null, "Narrador", text);
    await advancePartyTurn(begin.partyId);
    await prisma.sceneMessage.createMany({
      data: [
        { characterId: character.id, role: "player", text: freeText },
        { characterId: character.id, role: "narrator", text },
      ],
    });
    return emptyResult([text], character.level);
  }

  let result: ActionResult;
  let sharedLine: string;
  switch (action) {
    case "explore":
      result = await exploreCharacter(character.id, character.userId, freeText);
      sharedLine = result.pendingCombat
        ? `${character.name} se topa con problemas mientras exploraba por su cuenta — ¡combate!`
        : `${character.name} explora por su cuenta y vuelve con algo que contar.`;
      break;
    case "train":
      result = await trainCharacter(character.id, character.userId);
      sharedLine = `${character.name} se aparta un momento a entrenar.`;
      break;
    case "rest":
    default:
      result = await restCharacter(character.id, character.userId);
      sharedLine = `${character.name} se toma un respiro para descansar.`;
      break;
  }

  const finalLog = [`(interpretado como: ${FREE_TEXT_ACTION_LABELS[action]})`, ...result.log];
  await prisma.sceneMessage.createMany({
    data: [
      { characterId: character.id, role: "player", text: freeText },
      { characterId: character.id, role: "narrator", text: finalLog.join("\n\n") },
    ],
  });
  await writePartyMessage(begin.partyId, character.id, character.name, freeText);
  await writePartyMessage(begin.partyId, null, "Narrador", sharedLine);
  await advancePartyTurn(begin.partyId);

  return { ...result, log: finalLog };
}

export async function resolveFreeTextAction(characterId: string, userId: string, freeText: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);

  if (character.partyId && !character.isSeparatedFromParty && !character.pendingEncounter) {
    return resolvePartyFreeTextAction(character, freeText);
  }

  const validActions: ActionId[] = character.pendingEncounter
    ? character.pendingEncounter.phase === "victory"
      ? ["mercy_spare", "mercy_finish"]
      : ["engage", "flee"] // both "threat" (first commit) and "fighting" (ongoing exchanges) share this set
    : ["narrate", "explore", "train", "rest"];

  const { action, tacticModifier } = await classifyPlayerAction(freeText, validActions);
  if (action === "unclear") {
    throw new GameActionError("No logro entender qué quieres hacer. Prueba a describirlo de otra forma, o usa los botones de abajo.");
  }

  let result: ActionResult;
  switch (action) {
    case "narrate":
      result = await narrateSceneAction(characterId, userId, freeText);
      break;
    case "explore":
      result = await exploreCharacter(characterId, userId, freeText);
      break;
    case "train":
      result = await trainCharacter(characterId, userId);
      break;
    case "rest":
      result = await restCharacter(characterId, userId);
      break;
    case "engage":
      result = await engageCharacter(characterId, userId, freeText, tacticModifier);
      break;
    case "flee":
      result = await fleeCharacter(characterId, userId);
      break;
    case "mercy_spare":
      result = await resolveMercyChoice(characterId, userId, true);
      break;
    case "mercy_finish":
      result = await resolveMercyChoice(characterId, userId, false);
      break;
    default:
      // Unreachable given validActions above, kept for exhaustiveness/defense.
      throw new GameActionError("Esa acción todavía no se puede hacer por texto libre — usa los botones.");
  }

  // "narrate" is the expected default for free-roam text, not a special
  // read worth flagging — the interpreted-as line is only useful for the
  // mechanical actions, where a wrong read has real (stat-changing) stakes.
  const finalLog = action === "narrate" ? result.log : [`(interpretado como: ${FREE_TEXT_ACTION_LABELS[action]})`, ...result.log];

  // The full chat transcript — every free-text action, mechanical or pure
  // roleplay alike — so the scene panel and future narration prompts see
  // the whole conversation, not just the mechanical summary (Bitácora).
  await prisma.sceneMessage.createMany({
    data: [
      { characterId, role: "player", text: freeText },
      { characterId, role: "narrator", text: finalLog.join("\n\n") },
    ],
  });

  // Reaching here with a partyId set means this character was mid-fight
  // (see the branch above) — their own combat always resolves immediately,
  // never gated by party turn order, but once it's no longer "still
  // fighting" the group should see the headline.
  if (character.partyId && !result.pendingCombat) {
    await echoToParty(character.partyId, summarizeCombatForParty(action, character.name, result));
  }

  return { ...result, log: finalLog };
}

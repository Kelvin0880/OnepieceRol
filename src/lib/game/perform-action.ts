import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { pickEventTemplate, resolveEvent, parseEventBody, EventBody } from "../engine/events";
import { maybeAutoCheckpoint } from "./ooc";
import { dangerBlockReason } from "../engine/safety";
import { recruitCompanion, CompanionError } from "./companions";
import { resolveEnemyKit } from "./enemy-kit";
import { estimateLevel, applyFatigueToCombatant, npcStaminaAfterExchange, npcBaseEffort } from "../engine/resilience";
import type { EffortLevel } from "../engine/stamina";
import { resolveExchange, Combatant } from "../engine/combat";
import { trainHaki, rollConquerorsHakiAwakening } from "../engine/haki";
import { trainFruitMastery, canAwaken, FRUIT_PHASE_LABELS, fruitPhase } from "../engine/fruit-mastery";
import { TechniqueId, TECHNIQUE_LABELS } from "../engine/techniques";
import { buildSceneEnemy, tierXp, EnemyTier } from "../engine/scene-enemy";
import { FATIGUE_LABELS, fatigueLevel, restStamina, spendStamina } from "../engine/stamina";
import { prepareFighter, combatProgressData, currentStamina } from "./combat-prep";
import { bountyReward, berryReward, xpToNextLevel } from "../engine/economy";
import { assessThreat, attemptFlee, ThreatAssessment } from "../engine/encounter";
import { settleVoyage, assertNotAtSea, startVoyage } from "./voyage";
import { canSailAnywhere, hopsBetween, voyageDurationMs, rollSeaAmbush, pickSeaAmbush, seaAmbushPower } from "../engine/voyage";
import { canEnterIsland, travelWaitMs, TRAVEL_STAMINA_COST, tideStatus, knowsTheRoad } from "../engine/travel";
import { rollHunterAmbush, decayPursuitHeat, heatAfterReadingPoneglyph } from "../engine/pursuit";
import { recordGrudgeIncident, recordMercyIncident, decayGrudgesForCharacter, rollGrudgeAmbushForCharacter, getGrudgeContextForNarration } from "./grudges";
import { toCombatant, generalSkillModifier } from "./derive";
import { tickWorldIfDue } from "./world-tick";
import { getOpenDuelFor, submitDuelAction } from "./duel";
import { maybeCompactCharacterScene, maybeCompactPartyScene } from "./scene-compaction";
import { postNews, handleDeathCheck } from "./death-resolution";
import { grantPoneglyphRead } from "./poneglyph";
import { grantXp } from "./xp";
import { grantLoot, storeFruitInBag } from "./inventory";
import { intellectTacticEdge } from "../engine/attributes";
import { applyGuardianPresence, guardianBaseRewards, markActorDefeated, findPoneglyphGuardian, ACTOR_REWARD_MULTIPLIER } from "./guardian";
import { isActorHome, stealthDifficulty, stealthModifier, attemptStealthRead, STEALTH_HEAT, STEALTH_STAMINA_COST, CAUGHT_HP_FRACTION } from "../engine/guardian";
import { getOpenJointFightFor, submitJointAction, startJointFight, freePartyMemberIds } from "./joint-fight";
import { DEVIL_FRUIT_CATALOG } from "./devil-fruit-catalog";
import { applyBountyOrNotoriety } from "./reputation";
import { narrateExplore, narrateEncounterIntro, narrateCombat, narrateScene, narratePartyScene, getRecentScene, updateCharacterMemory } from "../ai/narrate";
import { classifyPlayerAction, ActionId } from "../ai/classify-action";
import { beginPartyTurn, advancePartyTurn, releasePartyTurnLock, writePartyMessage, echoToParty, confirmLeaveParty as partyConfirmLeaveParty, rejoinParty as partyRejoinParty } from "./party";
import { CharacterStatus } from "@prisma/client";
import { addStanding } from "./alliance";
import { recordMissionEvent } from "./missions";
import { recordConsequence, rollConsequenceForExplore } from "./consequences";
import { ONE_PIECE_TRUTH, ONE_PIECE_TRUTH_TITLE, truthNewsBody } from "./endgame-lore";

const TRAINING_COOLDOWN_MS = 30 * 60 * 1000;
const EXPLORE_STAMINA_COST = 8;
const TRAIN_STAMINA_COST = 20;
const MIN_STAMINA_TO_ADVENTURE = 8;

export class GameActionError extends Error {}

type LoadedCharacter = Awaited<ReturnType<typeof loadCharacterOrThrow>>;

async function loadCharacterOrThrow(characterId: string, userId: string) {
  await settleVoyage(characterId);
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      devilFruit: true,
      equippedWeapon: true,
      currentIsland: true,
      companions: true,
      pendingEncounter: true,
      styles: true,
      ownedWeapons: { where: { wielded: true } },
    },
  });
  if (!character || character.userId !== userId) throw new GameActionError("Personaje no encontrado.");
  if (character.status !== CharacterStatus.ALIVE) throw new GameActionError("Este personaje ya no puede actuar.");
  return character;
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
  pendingCombat?: {
    enemyName: string;
    assessment: ThreatAssessment;
    isBoss: boolean;
  };
  awaitingMercyChoice?: { enemyName: string };
  /** Set when free text read as wanting to leave a shared party scene — a real confirm step, nothing mutated yet. */
  confirmRequired?: "leave_party";
  /** The action opened or advanced a shared fight with allies (see joint-fight.ts). */
  jointFight?: boolean;
}

export async function tryDropFruit(characterId: string, newsLog: string[]): Promise<string | undefined> {
  // Singleton (main/canon) fruits never drop randomly — they only ever exist
  // as the one seeded row, locked to their canon WorldActor. Common fruits
  // get a FRESH row per grant (mirrors Weapon.name/common-gear.ts exactly),
  // which is what actually makes them duplicable across characters instead
  // of the old "pick from the one unclaimed row" model.
  const commonKinds = DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton);
  if (commonKinds.length === 0) return undefined;
  const kind = commonKinds[Math.floor(Math.random() * commonKinds.length)];
  const fruit = await prisma.devilFruit.create({
    data: {
      name: kind.name,
      englishName: kind.englishName,
      type: kind.type,
      rarity: kind.rarity,
      description: kind.description,
      effectsJson: JSON.stringify(kind.effects),
      isSingleton: false,
    },
  });
  // The fruit is FOUND, not eaten: it goes to the bag and the player decides whether to bite it (game/inventory.ts eatFruit).
  const stored = await storeFruitInBag(characterId, fruit);
  if (!stored) {
    await prisma.devilFruit.delete({ where: { id: fruit.id } });
    return undefined;
  }
  newsLog.push(`${(await prisma.character.findUnique({ where: { id: characterId }, select: { name: true } }))?.name ?? "Alguien"} encuentra la ${fruit.name}.`);
  return fruit.name;
}

interface StoredEnemy {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  /** Experience level (soaks damage, tires slower). Absent on older enemies: estimated from atk/def. */
  level?: number;
  personality?: string;
  worldActorId?: string;
  /** The holder themself, not the subordinate standing in — see game/guardian.ts. */
  isActor?: boolean;
  /** Set when this fight is the return of an earlier kill/spare choice (game/consequences.ts). */
  consequenceStage?: number;
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

async function exploreCharacterInner(characterId: string, userId: string, intentText?: string): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  assertNotAtSea(character);
  if (character.pendingEncounter) {
    throw new GameActionError("Tienes un enfrentamiento sin resolver. Decide si luchar o huir primero.");
  }
  const rng = liveRng();

  // Peaceful phases restore you; adventuring while spent does not — that is
  // the "días inhábiles" rule: exhausted characters must rest first.
  const staminaNow = currentStamina(character);
  if (staminaNow < MIN_STAMINA_TO_ADVENTURE) {
    throw new GameActionError("Estás exhausto: tu cuerpo no da para más aventuras por ahora. Descansa antes de volver a salir.");
  }
  await prisma.character.update({
    where: { id: character.id },
    data: {
      stamina: spendStamina(staminaNow, EXPLORE_STAMINA_COST),
      staminaUpdatedAt: new Date(),
    },
  });

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
    const enemyCombatant: Combatant = {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
    };
    const assessment = assessThreat(playerCombatant, enemyCombatant);
    const log = ["Nadie que lee un Poneglifo queda a salvo por mucho tiempo. Una sombra armada te alcanza, enviada por quienes no pueden permitirse que ese secreto siga vivo."];

    await prisma.character.update({
      where: { id: character.id },
      data: { poneglyphHeat: decayPursuitHeat(character.poneglyphHeat) },
    });
    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify({
          berries: 0,
          xp: 20,
          bounty: 0,
          islandDanger: character.currentIsland.dangerLevel,
        } satisfies StoredRewards),
        narrative: log.join(" "),
        assessment,
      },
    });
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "pursuit", text: log.join(" ") },
    });

    return {
      ...emptyResult(log, character.level),
      pendingCombat: { enemyName: enemy.name, assessment, isBoss: true },
    };
  }
  if (character.poneglyphHeat > 0) {
    await prisma.character.update({
      where: { id: character.id },
      data: { poneglyphHeat: decayPursuitHeat(character.poneglyphHeat) },
    });
  }

  // A grudge-holder's own subordinate may come looking for you, independent
  // of the poneglyph pursuit above — same lazy per-explore check (and same
  // "at most one ambush per explore" rule, since we've already returned by
  // now if the poneglyph one fired), just keyed to a specific WorldActor
  // instead of one global "how hunted are you."
  const grudgeAmbush = await rollGrudgeAmbushForCharacter(character.id, rng);
  await decayGrudgesForCharacter(character.id);
  if (grudgeAmbush) {
    const playerCombatant = toCombatant(character);
    const enemy: StoredEnemy = {
      name: grudgeAmbush.enemyName,
      hp: grudgeAmbush.enemySnapshot.hp,
      atk: grudgeAmbush.enemySnapshot.atk,
      def: grudgeAmbush.enemySnapshot.def,
      spd: grudgeAmbush.enemySnapshot.spd,
      isBoss: true,
      personality: grudgeAmbush.worldActorPersonality ?? undefined,
      worldActorId: grudgeAmbush.worldActorId,
    };
    const enemyCombatant: Combatant = {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
    };
    const assessment = assessThreat(playerCombatant, enemyCombatant);
    const log = [`${grudgeAmbush.worldActorName} no olvidó lo ocurrido: ${grudgeAmbush.lastIncidentNote}. Uno de sus hombres te encuentra de nuevo.`];

    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify({
          berries: 0,
          xp: 25,
          bounty: 0,
          islandDanger: character.currentIsland.dangerLevel,
        } satisfies StoredRewards),
        narrative: log.join(" "),
        assessment,
      },
    });
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "grudge", text: log.join(" ") },
    });

    return {
      ...emptyResult(log, character.level),
      pendingCombat: { enemyName: enemy.name, assessment, isBoss: true },
    };
  }

  const thread = await rollConsequenceForExplore(character, toCombatant(character), character.currentIsland.dangerLevel, rng);
  if (thread?.encounter) {
    const e = thread.encounter;
    const enemy: StoredEnemy = {
      name: e.enemyName,
      ...e.stats,
      isBoss: true,
      worldActorId: e.worldActorId,
      consequenceStage: e.consequenceStage,
    };
    const enemyCombatant: Combatant = {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
    };
    const assessment = assessThreat(toCombatant(character), enemyCombatant);
    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: JSON.stringify(enemy),
        rewardsJson: JSON.stringify({
          berries: 0,
          xp: 30 * e.consequenceStage,
          bounty: 0,
          islandDanger: character.currentIsland.dangerLevel,
        } satisfies StoredRewards),
        narrative: thread.log.join(" "),
        assessment,
      },
    });
    await prisma.gameLogEntry.create({
      data: {
        characterId: character.id,
        kind: "consequence",
        text: thread.log.join(" "),
      },
    });
    return {
      ...emptyResult(thread.log, character.level),
      pendingCombat: { enemyName: enemy.name, assessment, isBoss: true },
    };
  }
  if (thread) {
    const gained = await grantXp(character.experience, character.level, thread.xp ?? 0);
    await prisma.character.update({
      where: { id: character.id },
      data: {
        berries: character.berries + (thread.berries ?? 0),
        experience: gained.xp,
        level: gained.level,
      },
    });
    const newsLog: string[] = [];
    if (thread.reputation) await applyBountyOrNotoriety(character, character.faction === "PIRATE" || character.faction === "BOUNTY_HUNTER" ? thread.reputation * 1_000_000 : thread.reputation * 10, newsLog, "Tributo por tu fama");
    await prisma.gameLogEntry.create({
      data: {
        characterId: character.id,
        kind: "consequence",
        text: thread.log.join(" "),
      },
    });
    return {
      ...emptyResult(thread.log, character.level),
      berriesDelta: thread.berries ?? 0,
      xpDelta: thread.xp ?? 0,
      leveledUp: gained.leveledUp,
      newLevel: gained.level,
    };
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
    const tierMultiplier = resolution.outcome === "critical_success" ? 0.7 : resolution.outcome === "success" ? 0.85 : resolution.outcome === "fail" ? 1 : 1.25;
    let enemy: StoredEnemy = {
      name: resolution.enemy.name,
      hp: resolution.enemy.hp,
      atk: Math.round(resolution.enemy.atk * tierMultiplier),
      def: resolution.enemy.def,
      spd: resolution.enemy.spd,
      isBoss: !!resolution.enemy.isBoss,
      personality: resolution.enemy.personality,
      worldActorId: resolution.enemy.worldActorId,
    };
    // A Poneglyph's guardian is whoever the holder's schedule says: the
    // subordinate when they're away, usually the holder themself when home.
    let guardianRewards: {
      berries: number;
      xp: number;
      bounty: number;
    } | null = null;
    if (body.poneglyphId && enemy.worldActorId) {
      const g = await applyGuardianPresence(enemy, rng);
      enemy = g.enemy;
      if (g.note) introLog.push(g.note);
      if (g.enemy.isActor) {
        const base = guardianBaseRewards(body);
        guardianRewards = {
          berries: base.berries * ACTOR_REWARD_MULTIPLIER,
          xp: base.xp * ACTOR_REWARD_MULTIPLIER,
          bounty: base.bounty * ACTOR_REWARD_MULTIPLIER,
        };
      }
    }
    const enemyCombatant: Combatant = {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
    };
    const assessment = assessThreat(playerCombatant, enemyCombatant);
    // The threat is introduced by the narrator in the context of what the
    // player was actually doing — never a disconnected canned line.
    const introScene = await getRecentScene(character.id, 8);
    const introNarrated = await narrateEncounterIntro(
      {
        characterName: character.name,
        faction: character.faction,
        islandName: character.currentIsland.name,
        islandDescription: character.currentIsland.description,
        intentText,
        enemyName: enemy.name,
        enemyPersonality: enemy.personality,
        situation: introLog.join(" "),
        threat: assessment,
        recentScene: introScene,
        memorySummary: character.memorySummary ?? undefined,
      },
      introLog,
      { characterId: character.id }
    );
    introLog.splice(0, introLog.length, ...introNarrated);

    const rewards: StoredRewards = {
      berries: guardianRewards?.berries ?? resolution.berries,
      xp: guardianRewards?.xp ?? resolution.xp,
      bounty: guardianRewards?.bounty ?? resolution.bounty,
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

    await prisma.gameLogEntry.create({
      data: {
        characterId: character.id,
        kind: full.kind.toLowerCase(),
        text: introLog.join(" "),
      },
    });

    return {
      ...emptyResult(introLog, character.level),
      pendingCombat: {
        enemyName: enemy.name,
        assessment,
        isBoss: enemy.isBoss,
      },
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
  if (!died && resolution.fruitDropRolled) {
    fruitGained = await tryDropFruit(character.id, newsLog);
    if (fruitGained) {
      log.push(`¡Encuentras una Fruta del Diablo: la ${fruitGained}! La guardas en la mochila. En el Inventario decides si te la comes: quien la muerde no podrá volver a nadar, y solo se puede comer una.`);
    } else {
      log.push("Tocas una fruta de forma extraña, pero no tienes dónde guardarla y la pierdes entre las olas.");
    }
  }

  let leveledUp = false;
  let newLevel = character.level;
  if (!died && resolution.xp > 0) {
    const result = await grantXp(character.experience, character.level, resolution.xp);
    leveledUp = result.leveledUp;
    newLevel = result.level;
    if (leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${newLevel}.`);
    await prisma.character.update({
      where: { id: character.id },
      data: { experience: result.xp, level: result.level },
    });
  }

  if (!died) {
    const newHp = Math.max(0, Math.min(character.maxHp, character.hp + hpDelta));
    await prisma.character.update({
      where: { id: character.id },
      data: {
        hp: newHp,
        berries: Math.max(0, character.berries + resolution.berries),
      },
    });
    await applyBountyOrNotoriety(character, resolution.bounty, newsLog);
    if (resolution.outcome === "success" || resolution.outcome === "critical_success") {
      const found = await grantLoot(character.id, character.currentIsland.dangerLevel, resolution.outcome);
      if (found) log.push(found);
    }
  }

  await prisma.gameLogEntry.create({
    data: {
      characterId: character.id,
      kind: full.kind.toLowerCase(),
      text: log.join(" "),
    },
  });

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
export async function engageCharacter(
  characterId: string,
  userId: string,
  intentText?: string,
  tacticModifier = 0,
  opts: {
    technique?: TechniqueId;
    openingStrike?: boolean;
    effort?: EffortLevel;
  } = {}
): Promise<ActionResult> {
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

  // Technique (haki/fruit), tactic and fatigue are folded into one Combatant
  // by the engine layer — the classifier only proposed them, code decided.
  const prepared = prepareFighter(character, opts.technique ?? "none", tacticModifier, character.hp, opts.effort, intentText ?? "");
  let playerCombatant = prepared.combatant;
  const assistName = pending.phase === "threat" && enemy.isBoss ? rollCompanionAssist(character, rng) : null;
  if (assistName) {
    playerCombatant = {
      ...playerCombatant,
      atk: Math.round(playerCombatant.atk * 1.15),
    };
    log.push(`${assistName} se lanza a tu lado para ayudarte contra ${enemy.name}.`);
  }

  const enemyLevel = enemy.level ?? estimateLevel(enemy.atk, enemy.def);
  const enemyStaminaBefore = pending.enemyStamina;
  // A tired enemy hits, defends and moves worse — and a fresh one can punish an exhausted player.
  const enemyCombatant: Combatant = applyFatigueToCombatant(
    {
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      atk: enemy.atk,
      def: enemy.def,
      spd: enemy.spd,
      level: enemyLevel,
    },
    enemyStaminaBefore
  );
  const enemyHpBefore = pending.enemyHp ?? enemy.hp;
  const roundNumber = pending.roundNumber + 1;

  const { aHpAfter: exchangeHpAfter, bHpAfter: enemyHpAfter, log: roundLog } = resolveExchange(rng, roundNumber, { ...playerCombatant, hp: character.hp, maxHp: character.maxHp }, character.hp, enemyCombatant, enemyHpBefore);

  // Straining on an empty tank tears something — never lethal by itself, and only if the exchange left the player standing.
  const playerHpAfter = exchangeHpAfter > 0 ? Math.max(1, exchangeHpAfter - prepared.strainHp) : exchangeHpAfter;
  const damageTaken = Math.max(0, character.hp - exchangeHpAfter);
  const enemyStaminaAfter = npcStaminaAfterExchange({
    stamina: enemyStaminaBefore,
    level: enemyLevel,
    effort: npcBaseEffort(enemy.isBoss),
    damageTaken: Math.max(0, enemyHpBefore - enemyHpAfter),
    maxHp: enemy.hp,
  });
  if (prepared.strainHp > 0 && exchangeHpAfter > 0) log.push("Forzar el cuerpo sin aliento te pasa factura: sientes un tirón que te hace daño.");
  const concluded = playerHpAfter <= 0 || enemyHpAfter <= 0;
  // Same tie-break runCombat always used when rounds ran out with both still standing.
  const victor: "player" | "enemy" | undefined = !concluded ? undefined : enemyHpAfter <= 0 && playerHpAfter > 0 ? "player" : playerHpAfter <= 0 && enemyHpAfter > 0 ? "enemy" : enemyHpAfter < playerHpAfter ? "player" : "enemy"; // draw or ran out of rounds evenly: same "healthier side wins" rule runCombat used, loss-leaning on an exact tie

  const enemyKitText = (await resolveEnemyKit({ name: enemy.name, atk: enemy.atk, def: enemy.def, isBoss: enemy.isBoss, level: enemyLevel, worldActorId: enemy.worldActorId })).text;
  const scene = await getRecentScene(character.id, 10);
  const grudgeContext = enemy.worldActorId ? await getGrudgeContextForNarration(enemy.worldActorId, character.id) : null;
  const narrated = await narrateCombat(
    {
      characterName: character.name,
      enemyName: enemy.name,
      enemyPersonality: enemy.personality,
      isBoss: enemy.isBoss,
      rounds: roundLog,
      concluded,
      victor,
      endedByExhaustion: concluded && playerHpAfter > 0 && enemyHpAfter > 0,
      playerHpLeft: Math.max(0, playerHpAfter),
      playerMaxHp: character.maxHp,
      enemyHpLeft: Math.max(0, enemyHpAfter),
      enemyMaxHp: enemy.hp,
      intentText,
      recentMemory: scene,
      memorySummary: character.memorySummary ?? undefined,
      openingStrike: opts.openingStrike,
      technique:
        opts.technique && opts.technique !== "none"
          ? {
              label: TECHNIQUE_LABELS[opts.technique],
              downgradedReason: prepared.effect.downgraded ? prepared.effect.downgradeReason : undefined,
            }
          : undefined,
      fatigue: prepared.fatigue !== "fresh" ? FATIGUE_LABELS[prepared.fatigue] : undefined,
      enemyFatigue: fatigueLevel(enemyStaminaBefore, 100) !== "fresh" ? FATIGUE_LABELS[fatigueLevel(enemyStaminaBefore, 100)] : undefined,
      playerLevel: character.level,
      enemyLevel,
      enemyKit: enemyKitText,
      grudgeContext: grudgeContext
        ? `${enemy.name} ya se enfrentó a este personaje antes y no lo olvida: ${grudgeContext.text}.` + (grudgeContext.critical ? " La situación se ha vuelto crítica para ellos — podrían amenazar con pedir refuerzos." : "")
        : undefined,
    },
    { characterId: character.id }
  );
  log.push(...narrated);

  if (concluded && victor === "player") {
    log.push(`¡${enemy.name} queda derrotado y a tu merced!`);
    const progress = combatProgressData(character, prepared, rng, damageTaken);
    const growth: Record<string, unknown> = {};
    const mastery = progress.fruitMastery ?? character.fruitMastery;
    if (progress.fruitMastery !== undefined && fruitPhase(character.fruitMastery, false) !== fruitPhase(mastery, false)) {
      log.push(`Sientes que dominas mejor tu fruta: entras en la ${FRUIT_PHASE_LABELS[fruitPhase(mastery, false)]}.`);
    }
    const hpRatio = playerHpAfter / character.maxHp;
    // A fight that pushed you to the edge is the breaking point both an
    // Awakening and (rarely) Conqueror's Haki wait for.
    if (
      character.devilFruitId &&
      canAwaken(mastery, character.fruitAwakened, {
        enemyIsBoss: enemy.isBoss,
        playerHpRatio: hpRatio,
      })
    ) {
      growth.fruitAwakened = true;
      log.push("En el límite de tus fuerzas, algo se rompe y despierta: tu fruta alcanza el Despertar.");
      const headline = `${character.name} logra el Despertar de su Akuma no Mi`;
      await postNews(headline, `Quienes presenciaron el combate aseguran que el poder de ${character.name} cambió por completo en mitad de la pelea.`, "Frutas", character.id, "major");
      newsLog.push(headline);
    }
    if (!character.conquerorsHaki && (enemy.isBoss || hpRatio <= 0.25) && rollConquerorsHakiAwakening(rng, character.willpower)) {
      growth.conquerorsHaki = true;
      log.push("Un estremecimiento recorre el lugar: has despertado el Haki del Rey.");
      const headline = `${character.name} despierta el Haki del Rey`;
      await postNews(headline, `Los presentes juran haber sentido una presión aplastante emanar de ${character.name}.`, "Frutas", character.id, "major");
      newsLog.push(headline);
    }
    await prisma.character.update({
      where: { id: character.id },
      data: { hp: Math.max(1, playerHpAfter), ...progress, ...growth },
    });
    // Keep the pending encounter around, now representing "awaiting mercy choice".
    await prisma.pendingEncounter.update({
      where: { characterId: character.id },
      data: {
        phase: "victory",
        enemyHp: Math.max(0, enemyHpAfter),
        enemyStamina: enemyStaminaAfter,
        roundNumber,
      },
    });
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "combat", text: log.join(" ") },
    });
    // Fire-and-forget: Render runs a persistent Node process (not per-request
    // serverless), so this keeps running after the response is sent, and
    // updateCharacterMemory never throws — a slow/failed summary never
    // delays or breaks the player's actual turn.
    void updateCharacterMemory(character.id, character.memorySummary, `${character.name} venció a ${enemy.name} en combate${enemy.isBoss ? " (un enemigo formidable)" : ""}.`);
    return {
      ...emptyResult(log, character.level),
      awaitingMercyChoice: { enemyName: enemy.name },
    };
  }

  if (concluded && victor === "enemy") {
    log.push(`${enemy.name} te derrota.`);
    const deathCheck = await handleDeathCheck(character, playerHpAfter, `Cayó en combate contra ${enemy.name}.`, newsLog);
    await prisma.pendingEncounter.delete({
      where: { characterId: character.id },
    });
    if (!deathCheck.died) {
      await prisma.character.update({
        where: { id: character.id },
        data: {
          hp: deathCheck.finalHp,
          ...combatProgressData(character, prepared, rng, damageTaken),
        },
      });
    }
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "combat", text: log.join(" ") },
    });
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
  await prisma.character.update({
    where: { id: character.id },
    data: {
      hp: Math.max(0, playerHpAfter),
      ...combatProgressData(character, prepared, rng, damageTaken),
    },
  });
  await prisma.pendingEncounter.update({
    where: { characterId: character.id },
    data: {
      phase: "fighting",
      enemyHp: Math.max(0, enemyHpAfter),
      enemyStamina: enemyStaminaAfter,
      roundNumber,
    },
  });
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "combat", text: log.join(" ") },
  });
  return {
    ...emptyResult(log, character.level),
    hpDelta: playerHpAfter - character.hp,
    pendingCombat: {
      enemyName: enemy.name,
      assessment: pending.assessment as ThreatAssessment,
      isBoss: enemy.isBoss,
    },
  };
}

function cleanTargetName(target?: string): string {
  const t = (target ?? "").trim().replace(/^["'“”]+|["'“”.]+$/g, "");
  if (!t) return "Un rival del lugar";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * The player went for someone in the scene (a bar patron, a guard). Whoever
 * they named becomes a real enemy sized from the player's own numbers (see
 * engine/scene-enemy.ts) and the player's own move is resolved as round 1 of
 * the fight — narrated as a direct answer to what they wrote, not a random
 * template that has nothing to do with it. The classifier only picked who and
 * how tough; hit or miss is the engine's roll.
 */
export async function attackCharacter(
  characterId: string,
  userId: string,
  freeText: string,
  opts: {
    target?: string;
    tier?: EnemyTier;
    technique?: TechniqueId;
    tacticModifier?: number;
    effort?: EffortLevel;
  } = {}
): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("Ya estás en medio de un enfrentamiento.");

  const tier = opts.tier ?? "average";
  const name = cleanTargetName(opts.target);
  const playerBase = toCombatant(character);
  const built = buildSceneEnemy(name, { ...playerBase, hp: character.maxHp, maxHp: character.maxHp }, tier);
  const enemy: StoredEnemy = {
    name,
    hp: built.maxHp,
    atk: built.atk,
    def: built.def,
    spd: built.spd,
    isBoss: tier === "elite",
    level: built.level,
  };
  const assessment = assessThreat(playerBase, built);

  // With crewmates sharing the scene, the fight is everyone's: they each act every round.
  const allies = await freePartyMemberIds(character.id);
  if (allies.length >= 2) {
    const started = await startJointFight({
      kind: "party",
      characterIds: allies,
      enemy,
      rewards: {
        berries: 0,
        xp: tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      },
      stakes: `${character.name} ha atacado a ${name}.`,
      opening: {
        characterId: character.id,
        text: freeText,
        tactic: opts.tacticModifier ?? 0,
        technique: opts.technique ?? "none",
      },
    });
    return {
      ...emptyResult(started.log.length ? started.log : [`${character.name} ataca a ${name} y sus nakamas se suman: la pelea es de todos. Esperando los movimientos de cada uno.`], character.level),
      jointFight: true,
    };
  }

  await prisma.pendingEncounter.create({
    data: {
      characterId: character.id,
      enemyJson: JSON.stringify(enemy),
      rewardsJson: JSON.stringify({
        berries: 0,
        xp: tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      } satisfies StoredRewards),
      narrative: `${character.name} ataca a ${name}.`,
      assessment,
      phase: "fighting",
      enemyHp: enemy.hp,
      roundNumber: 0,
    },
  });

  return engageCharacter(characterId, userId, freeText, opts.tacticModifier ?? 0, { technique: opts.technique, openingStrike: true, effort: opts.effort });
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
  const enemyCombatant: Combatant = {
    name: enemy.name,
    hp: enemy.hp,
    maxHp: enemy.hp,
    atk: enemy.atk,
    def: enemy.def,
    spd: enemy.spd,
  };
  const flee = attemptFlee(rng, playerCombatant, enemyCombatant);

  if (flee.success) {
    await prisma.pendingEncounter.delete({
      where: { characterId: character.id },
    });
    const log = [`Logras escabullirte de ${enemy.name} sin que te alcance.`];
    const newsLog: string[] = [];
    let bountyDelta = 0;

    // A grudge-holder doesn't let go easily — escaping still has to matter,
    // not be a free action: it makes news, moves the needle on reputation,
    // and (the durable part) the actor now personally holds this against
    // this character, biasing future explores toward another run-in.
    if (enemy.worldActorId) {
      const note = `escapó de ${enemy.name} en ${character.currentIsland.name}`;
      await recordGrudgeIncident(enemy.worldActorId, character.id, "escape", note, enemy.name, {
        hp: enemy.hp,
        atk: enemy.atk,
        def: enemy.def,
        spd: enemy.spd,
      });
      bountyDelta = Math.round(bountyReward(character.currentIsland.dangerLevel, character.level, true) * 0.25);
      const headline = `${character.name} escapa de ${enemy.name}`;
      await postNews(headline, `${character.name} logró escabullirse de ${enemy.name} tras un enfrentamiento tenso. No parece ser algo que se olvide fácilmente.`, "Tripulaciones", character.id);
      newsLog.push(headline);
      if (bountyDelta > 0) await applyBountyOrNotoriety(character, bountyDelta, newsLog, `Escapó de ${enemy.name}`);
    }

    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "flee", text: log[0] },
    });
    return {
      ...emptyResult(log, character.level),
      bountyDelta,
      newsPosted: newsLog,
    };
  }

  const log = [`No logras escapar de ${enemy.name}, que te alcanza mientras huyes. No queda más remedio que luchar.`];
  await prisma.character.update({
    where: { id: character.id },
    data: { hp: Math.max(0, character.hp - flee.hpLoss) },
  });

  if (character.hp - flee.hpLoss <= 0) {
    const newsLog: string[] = [];
    const deathCheck = await handleDeathCheck(character, character.hp - flee.hpLoss, `Cayó intentando huir de ${enemy.name}.`, newsLog);
    await prisma.pendingEncounter.delete({
      where: { characterId: character.id },
    });
    if (!deathCheck.died)
      await prisma.character.update({
        where: { id: character.id },
        data: { hp: deathCheck.finalHp },
      });
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "flee", text: log.join(" ") },
    });
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

  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "flee", text: log.join(" ") },
  });
  return {
    ...emptyResult(log, character.level),
    hpDelta: -flee.hpLoss,
    pendingCombat: {
      enemyName: enemy.name,
      assessment: pending.assessment as ThreatAssessment,
      isBoss: enemy.isBoss,
    },
  };
}

async function resolveMercyChoiceInner(characterId: string, userId: string, spare: boolean): Promise<ActionResult> {
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
  const bountyDelta = character.faction === "PIRATE" || character.faction === "BOUNTY_HUNTER" ? Math.round(baseBounty * mercyMultiplier) : Math.round((baseBounty / 20_000) * mercyMultiplier);
  const xpDelta = rewards.xp + 10;

  if (enemy.isBoss || enemy.worldActorId || enemy.consequenceStage) {
    await recordConsequence(character.id, enemy, spare ? "spared" : "killed", {
      id: character.currentIslandId,
      name: character.currentIsland.name,
    });
  }

  if (spare) {
    log.push(`Decides perdonar a ${enemy.name} y lo dejas ir con vida.`);
    if (character.faction === "MARINE") log.push("La justicia también puede mostrar clemencia — aunque tus superiores lo cuestionen.");
    if (enemy.worldActorId) {
      // The durable memory always updates; whether it makes the news stays a coin flip, same feel as before.
      await recordMercyIncident(enemy.worldActorId, character.id, `perdonó a ${enemy.name} en ${character.currentIsland.name}`);
      await addStanding(enemy.worldActorId, character.id, { mercy: true }, `perdonaste a ${enemy.name}`);
    }
    if (Math.random() < 0.1) {
      const headline = `${enemy.name} jura no olvidar la piedad de ${character.name}`;
      await postNews(headline, `Testigos aseguran que ${enemy.name}, perdonado en pleno combate, se ha marchado jurando devolver el favor algún día.`, "Tripulaciones", character.id);
      newsLog.push(headline);
    }
  } else {
    log.push(`Acabas el combate contra ${enemy.name} sin darle tregua.`);
    // Beating a lieutenant isn't the same as beating the power behind them
    // — this only ever records against the subordinate fought, not the
    // WorldActor itself, and the heat bump reflects that (see engine/grudge.ts).
    if (enemy.worldActorId) {
      await recordGrudgeIncident(enemy.worldActorId, character.id, enemy.isActor ? "actor_defeat" : "subordinate_defeat", `derrotó a ${enemy.name} en ${character.currentIsland.name}`, enemy.name, {
        hp: enemy.hp,
        atk: enemy.atk,
        def: enemy.def,
        spd: enemy.spd,
      });
    }
    if (enemy.isBoss && Math.random() < 0.15) {
      const headline = `Rumores de venganza tras la caída de ${enemy.name}`;
      await postNews(headline, `Antiguos aliados de ${enemy.name} habrían jurado hacer pagar a ${character.name} por lo ocurrido.`, "Guerra", character.id);
      newsLog.push(headline);
    }
  }

  if (enemy.isActor && enemy.worldActorId) {
    await markActorDefeated(enemy.worldActorId, character.name, character.currentIsland.name);
    log.push(`${enemy.name} se repliega, humillado en su propio territorio. No lo olvidará.`);
  }

  let leveledUp = false;
  let newLevel = character.level;
  const result = await grantXp(character.experience, character.level, xpDelta);
  leveledUp = result.leveledUp;
  newLevel = result.level;
  if (leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${newLevel}.`);

  await prisma.character.update({
    where: { id: character.id },
    data: {
      experience: result.xp,
      level: result.level,
      berries: Math.max(0, character.berries + berriesDelta),
    },
  });
  await applyBountyOrNotoriety(character, bountyDelta, newsLog);

  let poneglyphGained: string | undefined;
  if (rewards.poneglyphId) {
    poneglyphGained = await grantPoneglyphRead(character, rewards.poneglyphId, log, newsLog);
  }

  await prisma.pendingEncounter.delete({
    where: { characterId: character.id },
  });
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "combat", text: log.join(" ") },
  });

  const mercyEvent = `${character.name} ${spare ? "perdonó" : "remató"} a ${enemy.name} tras vencerlo.` + (poneglyphGained ? ` Además descifró el ${poneglyphGained}.` : "");
  void updateCharacterMemory(character.id, character.memorySummary, mercyEvent);

  return {
    log,
    berriesDelta,
    xpDelta,
    bountyDelta,
    hpDelta: 0,
    leveledUp,
    newLevel,
    died: false,
    newsPosted: newsLog,
    poneglyphGained,
  };
}

/** Rest and serious training need calm: asks the game layer what is happening and lets engine/safety.ts refuse. */
async function assertSafeToRecover(character: LoadedCharacter, what: "descansar" | "entrenar" | "usar objetos"): Promise<void> {
  const [duel, joint, buster] = await Promise.all([
    getOpenDuelFor(character.id),
    getOpenJointFightFor(character.id),
    prisma.busterCall.findFirst({
      where: { islandId: character.currentIslandId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  const reason = dangerBlockReason(
    {
      hasPendingEncounter: !!character.pendingEncounter,
      activeDuel: duel?.status === "ACTIVE",
      hostileChallengePending: !!duel && duel.status === "PROPOSED" && duel.hostile && duel.opponentId === character.id,
      inJointFight: !!joint,
      busterCallOnIsland: !!buster,
    },
    what
  );
  if (reason) throw new GameActionError(reason);
}

/** For other game modules (inventory): refuses with the same danger rules as resting. */
export async function assertCalm(characterId: string, userId: string, what: "usar objetos"): Promise<void> {
  await assertSafeToRecover(await loadCharacterOrThrow(characterId, userId), what);
}

async function trainCharacterInner(characterId: string, userId: string, focus: "armament" | "observation" | "fruit" | "auto" = "auto"): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  assertNotAtSea(character);
  await assertSafeToRecover(character, "entrenar");

  if (character.lastTrainedAt) {
    const readyAt = character.lastTrainedAt.getTime() + TRAINING_COOLDOWN_MS;
    const remainingMs = readyAt - Date.now();
    if (remainingMs > 0) {
      const remainingMin = Math.ceil(remainingMs / 60_000);
      throw new GameActionError(`Necesitas descansar antes de volver a entrenar en serio. Podrás entrenar de nuevo en ${remainingMin} min.`);
    }
  }

  const staminaNow = currentStamina(character);
  if (staminaNow < TRAIN_STAMINA_COST) {
    throw new GameActionError("Estás demasiado agotado para entrenar en serio. Descansa primero.");
  }

  const rng = liveRng();
  const hasFruit = !!character.devilFruitId;
  // "auto" trains whatever is furthest behind, so a fruit user's mastery
  // isn't neglected in favour of haki (and vice versa).
  let chosen: "armament" | "observation" | "fruit";
  if (focus === "fruit" && !hasFruit) {
    chosen = character.armamentHaki <= character.observationHaki ? "armament" : "observation";
  } else if (focus !== "auto") {
    chosen = focus;
  } else if (hasFruit && character.fruitMastery < Math.min(character.armamentHaki, character.observationHaki)) {
    chosen = "fruit";
  } else {
    chosen = character.armamentHaki <= character.observationHaki ? "armament" : "observation";
  }

  const log: string[] = [];
  const data: {
    armamentHaki?: number;
    observationHaki?: number;
    fruitMastery?: number;
    lastTrainedAt: Date;
    stamina: number;
    staminaUpdatedAt: Date;
  } = {
    lastTrainedAt: new Date(),
    stamina: spendStamina(staminaNow, TRAIN_STAMINA_COST),
    staminaUpdatedAt: new Date(),
  };

  if (chosen === "fruit") {
    const result = trainFruitMastery(rng, character.fruitMastery, character.intellect);
    if (result.gained === 0) {
      log.push(character.fruitMastery >= 100 ? "Tu dominio de la fruta ya no puede crecer con simple práctica: solo un momento límite lo llevará más allá." : "Practicas con tu fruta hasta el agotamiento, pero hoy no notas ningún avance real.");
    } else {
      const before = fruitPhase(character.fruitMastery, character.fruitAwakened);
      data.fruitMastery = character.fruitMastery + result.gained;
      const after = fruitPhase(data.fruitMastery, character.fruitAwakened);
      log.push(result.breakthrough ? `¡Un gran avance! Comprendes tu fruta como nunca (+${result.gained} de dominio).` : `Afinas el control de tu fruta (+${result.gained} de dominio).`);
      if (before !== after) log.push(`Tu dominio entra en la ${FRUIT_PHASE_LABELS[after]}: nuevas variantes y menos desgaste.`);
    }
  } else {
    const level = chosen === "armament" ? character.armamentHaki : character.observationHaki;
    const label = chosen === "armament" ? "Haki de Armadura" : "Haki de Observación";
    const result = trainHaki(rng, level, character.willpower);
    if (result.gained === 0) {
      log.push("Entrenas duro, pero hoy no notas ningún avance real.");
    } else {
      if (chosen === "armament") data.armamentHaki = level + result.gained;
      else data.observationHaki = level + result.gained;
      log.push(result.breakthrough ? `¡Un gran avance! Tu dominio de ${label} crece notablemente (+${result.gained}).` : `Terminas la sesión con tu ${label} un poco más afilado (+${result.gained}).`);
    }
  }

  await prisma.character.update({ where: { id: character.id }, data });
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "training", text: log.join(" ") },
  });

  return emptyResult(log, character.level);
}

async function travelCharacterInner(characterId: string, userId: string, targetIslandId: string): Promise<{ log: string[]; arcIntro?: { islandName: string; hook: string } }> {
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("No puedes zarpar con un enfrentamiento sin resolver.");
  if (await getOpenDuelFor(character.id)) throw new GameActionError("No puedes zarpar en mitad de un duelo.");
  assertNotAtSea(character);
  if (targetIslandId === character.currentIslandId) throw new GameActionError("Ya estás en esa isla.");
  const connections = JSON.parse(character.currentIsland.connections) as string[];
  let hops = 1;
  if (!connections.includes(targetIslandId)) {
    if (!canSailAnywhere(character.level)) {
      throw new GameActionError("Esa isla no es alcanzable directamente desde tu posición actual. Desde el nivel 20 podrás trazar rumbo a cualquier isla.");
    }
    const all = await prisma.island.findMany({ select: { id: true, connections: true } });
    const graph = Object.fromEntries(all.map((i) => [i.id, JSON.parse(i.connections) as string[]]));
    const found = hopsBetween(graph, character.currentIslandId, targetIslandId);
    if (found === null) throw new GameActionError("No hay ruta marítima conocida hasta esa isla.");
    hops = found;
  }
  const target = await prisma.island.findUnique({
    where: { id: targetIslandId },
  });
  if (!target) throw new GameActionError("Isla desconocida.");
  if (!canEnterIsland(character.level, target.minLevelToEnter)) {
    throw new GameActionError(`${target.name} es demasiado peligrosa todavía. Necesitas al menos nivel ${target.minLevelToEnter} para sobrevivir allí.`);
  }
  if (target.tidal) {
    const tide = tideStatus();
    if (!tide.open) throw new GameActionError(`${target.name} está sumergida bajo las mareas ahora mismo. Volverá a emerger en ${Math.ceil(tide.msUntilChange / 60_000)} min.`);
  }
  if (target.requiresRoadPoneglyphs) {
    const roadIds = (
      await prisma.poneglyph.findMany({
        where: { kind: "Road" },
        select: { id: true },
      })
    ).map((p) => p.id);
    if (!knowsTheRoad(JSON.parse(character.poneglyphsRead) as string[], roadIds)) {
      throw new GameActionError(`Nadie sabe cómo llegar a ${target.name}. Solo quien haya leído los cuatro Poneglifos de Ruta puede trazar el rumbo.`);
    }
  }

  // Sailing is a real decision: a crew moves together (nobody leaves with a
  // fight or duel still open), the ship needs time between crossings, and the
  // crossing itself wears you down.
  if (character.crewId) {
    const mates = await prisma.character.findMany({
      where: {
        crewId: character.crewId,
        id: { not: character.id },
        status: "ALIVE",
        currentIslandId: character.currentIslandId,
      },
      select: {
        id: true,
        name: true,
        pendingEncounter: { select: { id: true } },
      },
    });
    const busyMate =
      mates.find((m) => m.pendingEncounter) ??
      (await (async () => {
        for (const m of mates) if (await getOpenDuelFor(m.id)) return m;
        return undefined;
      })());
    if (busyMate) throw new GameActionError(`No puedes zarpar todavía: ${busyMate.name} sigue con un enfrentamiento sin resolver y la tripulación no se separa así.`);
  }
  const waitMs = travelWaitMs(character.lastTravelAt, target.dangerLevel);
  if (waitMs > 0) {
    throw new GameActionError(`El barco aún no está listo para volver a zarpar. Podrás hacerlo de nuevo en ${Math.ceil(waitMs / 60_000)} min.`);
  }
  const staminaNow = currentStamina(character);
  if (staminaNow < TRAVEL_STAMINA_COST) throw new GameActionError("Estás demasiado exhausto para gobernar el barco. Descansa antes de zarpar.");

  if (hops > 1) {
    const ambushRng = liveRng();
    const ambush = rollSeaAmbush(ambushRng, hops) ? { ...pickSeaAmbush(ambushRng, character.faction), power: seaAmbushPower(hops) } : null;
    const log = await startVoyage(character, character.currentIsland.name, target, voyageDurationMs(hops), { stamina: spendStamina(staminaNow, TRAVEL_STAMINA_COST), staminaUpdatedAt: new Date() }, ambush);
    return { log };
  }

  const visited = JSON.parse(character.islandsVisited) as string[];
  const firstVisit = !visited.includes(target.id);

  await prisma.character.update({
    where: { id: character.id },
    data: {
      currentIslandId: target.id,
      islandsVisited: firstVisit ? JSON.stringify([...visited, target.id]) : character.islandsVisited,
      lastTravelAt: new Date(),
      stamina: spendStamina(staminaNow, TRAVEL_STAMINA_COST),
      staminaUpdatedAt: new Date(),
    },
  });
  const line = `Zarpas de ${character.currentIsland.name} y desembarcas en ${target.name}.`;
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "travel", text: line },
  });

  const revealed = target.requiresRoadPoneglyphs && !character.knowsTruth;
  if (revealed) {
    await prisma.character.update({
      where: { id: character.id },
      data: { knowsTruth: true },
    });
    await postNews(`${character.name} llega a Laugh Tale`, truthNewsBody(character.name), "Gobierno Mundial", character.id, "major");
  }

  return {
    log: revealed ? [line, `— ${ONE_PIECE_TRUTH_TITLE} —`, ONE_PIECE_TRUTH] : [line],
    arcIntro: firstVisit && target.arcHook ? { islandName: target.name, hook: target.arcHook } : undefined,
  };
}

export async function restCharacter(characterId: string, userId: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  assertNotAtSea(character);
  await assertSafeToRecover(character, "descansar");
  const healed = Math.min(character.maxHp, character.hp + Math.round(character.maxHp * 0.4));
  await prisma.character.update({
    where: { id: character.id },
    data: {
      hp: healed,
      stamina: restStamina(currentStamina(character), character.maxStamina),
      staminaUpdatedAt: new Date(),
    },
  });
  const log = ["Descansas y recuperas fuerzas y aliento antes de tu próxima aventura."];
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "rest", text: log[0] },
  });
  return {
    ...emptyResult(log, character.level),
    hpDelta: healed - character.hp,
  };
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

/**
 * The cautious path to a Poneglyph: slip in, read, get out. The engine rolls
 * agility/wits/observation against a difficulty that grows when the holder is
 * home, when you're already hunted and when this holder remembers you; the
 * player's described approach only shifts the roll (like a combat tactic). A
 * failed attempt doesn't end the story — it brings the guardian, exactly as
 * exploring the island would have, only with you on the back foot.
 */
export async function sneakPoneglyph(characterId: string, userId: string, freeText: string, tacticModifier = 0): Promise<ActionResult> {
  await tickWorldIfDue();
  const character = await loadCharacterOrThrow(characterId, userId);
  if (character.pendingEncounter) throw new GameActionError("Tienes un enfrentamiento sin resolver.");
  const island = character.currentIsland;
  if (!island.poneglyphId) throw new GameActionError("No hay ningún Poneglifo en esta isla que puedas alcanzar a escondidas.");
  if ((JSON.parse(character.poneglyphsRead) as string[]).includes(island.poneglyphId)) throw new GameActionError("Ya descifraste el Poneglifo de esta isla.");
  const staminaNow = currentStamina(character);
  if (staminaNow < STEALTH_STAMINA_COST) throw new GameActionError("Estás demasiado agotado para infiltrarte sin ser visto. Descansa primero.");
  const guardian = await findPoneglyphGuardian(island.id);
  if (!guardian) throw new GameActionError("Este Poneglifo no tiene ninguna ruta de acceso conocida.");

  const now = new Date();
  const actor = guardian.enemy.worldActorId
    ? await prisma.worldActor.findUnique({
        where: { id: guardian.enemy.worldActorId },
      })
    : null;
  const home = actor ? isActorHome(actor.busyUntil, now) : false;
  const grudge = actor
    ? await prisma.grudge.findUnique({
        where: {
          worldActorId_characterId: {
            worldActorId: actor.id,
            characterId: character.id,
          },
        },
      })
    : null;
  const difficulty = stealthDifficulty({
    islandDanger: island.dangerLevel,
    actorHome: home,
    poneglyphHeat: character.poneglyphHeat,
    grudgeHeat: grudge?.heat ?? 0,
  });
  const modifier = stealthModifier({
    agility: character.agility,
    intellect: character.intellect,
    observationHaki: character.observationHaki,
    level: character.level,
    tacticModifier,
  });
  const rng = liveRng();
  const result = attemptStealthRead(rng, modifier, difficulty);
  await prisma.character.update({
    where: { id: character.id },
    data: {
      stamina: spendStamina(staminaNow, STEALTH_STAMINA_COST),
      staminaUpdatedAt: new Date(),
    },
  });

  const newsLog: string[] = [];
  const tier = result === "clean" ? "critical_success" : result === "noticed" ? "success" : result === "spotted" ? "fail" : "critical_fail";
  const baseNarrative =
    result === "clean"
      ? "Te deslizas entre las sombras hasta el Poneglifo, lo lees sin que nadie lo note y sales como llegaste."
      : result === "noticed"
        ? "Consigues leer el Poneglifo, pero al salir un centinela cree ver una silueta escurrirse entre las columnas."
        : result === "spotted"
          ? "Un paso en falso, un destello, y la alarma corre por el lugar antes de que llegues a la piedra."
          : "Justo cuando alargas la mano hacia la piedra, alguien te está esperando: te habían visto entrar desde el principio.";
  const memory = await getRecentScene(character.id, 8);
  const hpLoss = result === "caught" ? Math.round(character.maxHp * CAUGHT_HP_FRACTION) : 0;
  const log = await narrateExplore(
    {
      characterName: character.name,
      faction: character.faction,
      level: character.level,
      islandName: island.name,
      islandDescription: island.description,
      outcomeTier: tier,
      baseFlavorText: `${character.name} intenta llegar al Poneglifo de ${island.name} sin ser visto${actor ? `, en los dominios de ${actor.name}` : ""}.`,
      baseNarrative,
      berries: 0,
      xp: 0,
      bounty: 0,
      hpLoss,
      intentText: freeText,
      recentMemory: memory,
      memorySummary: character.memorySummary ?? undefined,
    },
    { characterId: character.id }
  );

  if (result === "clean" || result === "noticed") {
    const codeName = await grantPoneglyphRead(character, island.poneglyphId, log, newsLog, { heat: STEALTH_HEAT[result], quiet: result === "clean" });
    if (result === "noticed" && actor) {
      await recordGrudgeIncident(actor.id, character.id, "escape", `se coló en ${island.name} y leyó el Poneglifo bajo su nariz`, guardian.enemy.name, {
        hp: guardian.enemy.hp,
        atk: guardian.enemy.atk,
        def: guardian.enemy.def,
        spd: guardian.enemy.spd,
      });
    }
    const xp = result === "clean" ? 120 : 70;
    const lvl = await grantXp(character.experience, character.level, xp);
    await prisma.character.update({
      where: { id: character.id },
      data: { experience: lvl.xp, level: lvl.level },
    });
    if (lvl.leveledUp) log.push(`¡Subes de nivel! Ahora eres nivel ${lvl.level}.`);
    await prisma.gameLogEntry.create({
      data: { characterId: character.id, kind: "stealth", text: log.join(" ") },
    });
    void updateCharacterMemory(character.id, character.memorySummary, `${character.name} se coló en ${island.name} y descifró un Poneglifo${result === "clean" ? " sin ser visto" : ", aunque alguien vio una silueta"}.`);
    return {
      ...emptyResult(log, lvl.level),
      xpDelta: xp,
      leveledUp: lvl.leveledUp,
      poneglyphGained: codeName,
      newsPosted: newsLog,
    };
  }

  // Spotted or caught: the guardian comes out. Same fight as exploring would bring.
  const subordinate: StoredEnemy = {
    name: guardian.enemy.name,
    hp: guardian.enemy.hp,
    atk: guardian.enemy.atk,
    def: guardian.enemy.def,
    spd: guardian.enemy.spd,
    isBoss: true,
    personality: guardian.enemy.personality,
    worldActorId: guardian.enemy.worldActorId,
  };
  const g = await applyGuardianPresence(subordinate, rng, now);
  const base = guardianBaseRewards(guardian.body);
  const mult = g.enemy.isActor ? ACTOR_REWARD_MULTIPLIER : 1;
  const enemy: StoredEnemy = g.enemy;
  if (g.note) log.push(g.note);
  const playerCombatant = toCombatant(character);
  const assessment = assessThreat(playerCombatant, {
    name: enemy.name,
    hp: enemy.hp,
    maxHp: enemy.hp,
    atk: enemy.atk,
    def: enemy.def,
    spd: enemy.spd,
  });
  await prisma.pendingEncounter.create({
    data: {
      characterId: character.id,
      enemyJson: JSON.stringify(enemy),
      rewardsJson: JSON.stringify({
        berries: base.berries * mult,
        xp: base.xp * mult,
        bounty: base.bounty * mult,
        islandDanger: island.dangerLevel,
        poneglyphId: guardian.poneglyphId,
      } satisfies StoredRewards),
      narrative: log.join(" "),
      assessment,
    },
  });
  if (hpLoss > 0)
    await prisma.character.update({
      where: { id: character.id },
      data: { hp: Math.max(1, character.hp - hpLoss) },
    });
  await prisma.gameLogEntry.create({
    data: { characterId: character.id, kind: "stealth", text: log.join(" ") },
  });
  return {
    ...emptyResult(log, character.level),
    hpDelta: -hpLoss,
    pendingCombat: { enemyName: enemy.name, assessment, isBoss: true },
  };
}

const FREE_TEXT_ACTION_LABELS: Record<ActionId, string> = {
  narrate: "",
  attack: "Atacar",
  sneak: "Infiltrarse hasta el Poneglifo",
  explore: "Explorar",
  train: "Entrenar",
  rest: "Descansar",
  travel: "Viajar",
  engage: "Luchar",
  flee: "Huir",
  mercy_spare: "Perdonar",
  mercy_finish: "Rematar",
  leave_party: "Separarse del grupo",
  recruit: "Reclutar",
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

  const validActions: ActionId[] = ["narrate", "explore", "attack", "recruit", "train", "rest", "leave_party", ...(canSneak(character) ? (["sneak"] as ActionId[]) : [])];
  const partyClassified = await classifyPlayerAction(freeText, validActions, {
    sceneContext: begin.recentLines.slice(-2).join(" ").slice(-700),
  });
  const { action } = partyClassified;

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
        memorySummary: begin.memorySummary,
      },
      { partyId: begin.partyId }
    );
    await writePartyMessage(begin.partyId, character.id, character.name, freeText);
    await writePartyMessage(begin.partyId, null, "Narrador", text);
    await advancePartyTurn(begin.partyId);
    await prisma.sceneMessage.createMany({ data: exchangeRows(character.id, freeText, text) });
    void maybeCompactPartyScene(begin.partyId);
    return emptyResult([text], character.level);
  }

  let result: ActionResult;
  let sharedLine: string;
  try {
    switch (action) {
      case "explore":
        result = await exploreCharacter(character.id, character.userId, freeText);
        sharedLine = result.pendingCombat ? `${character.name} se topa con problemas mientras exploraba por su cuenta — ¡combate!` : `${character.name} explora por su cuenta y vuelve con algo que contar.`;
        break;
      case "attack":
        result = await attackCharacter(character.id, character.userId, freeText, {
          target: partyClassified.target,
          tier: partyClassified.targetTier,
          technique: partyClassified.technique,
          tacticModifier: partyClassified.tacticModifier,
          effort: partyClassified.effort,
        });
        sharedLine = result.jointFight
          ? `${character.name} se lanza contra ${partyClassified.target ?? "alguien de la escena"} y sus nakamas entran en la pelea: ¡el combate es de todos!`
          : `${character.name} se lanza a la pelea contra ${partyClassified.target ?? "alguien de la escena"}: ${result.log.join(" ").slice(0, 600)}`;
        break;
      case "sneak":
        result = await sneakPoneglyph(character.id, character.userId, freeText, partyClassified.tacticModifier);
        sharedLine = `${character.name} se aparta del grupo para infiltrarse a escondidas hacia el Poneglifo.`;
        break;
      case "recruit": {
        try {
          const r = await recruitCompanion(character.id, character.userId, {
            target: partyClassified.target,
            role: partyClassified.recruitRole,
            tier: partyClassified.targetTier,
            tacticModifier: partyClassified.tacticModifier,
          });
          result = emptyResult(r.log, character.level);
          sharedLine = r.accepted ? `${character.name} invita a ${r.companionName} a la tripulación y ${r.companionName} acepta.` : `${character.name} intenta reclutar a alguien de la escena, sin éxito por ahora.`;
        } catch (err) {
          if (err instanceof CompanionError) throw new GameActionError(err.message);
          throw err;
        }
        break;
      }
      case "train":
        result = await trainCharacter(character.id, character.userId, partyClassified.trainFocus);
        sharedLine = `${character.name} se aparta un momento a entrenar.`;
        break;
      case "rest":
      default:
        result = await restCharacter(character.id, character.userId);
        sharedLine = `${character.name} se toma un respiro para descansar.`;
        break;
    }
  } catch (err) {
    // An action that fails (training cooldown, no room for a nakama...) must not leave the whole group waiting on a narrator that will never answer.
    await releasePartyTurnLock(begin.partyId);
    throw err;
  }

  const finalLog = [`(interpretado como: ${FREE_TEXT_ACTION_LABELS[action]})`, ...result.log];
  await prisma.sceneMessage.createMany({ data: exchangeRows(character.id, freeText, finalLog.join("\n\n")) });
  await writePartyMessage(begin.partyId, character.id, character.name, freeText);
  await writePartyMessage(begin.partyId, null, "Narrador", sharedLine);
  await advancePartyTurn(begin.partyId);

  return { ...result, log: finalLog };
}

/** A guarded Poneglyph on this island the character hasn't read yet — the only place sneaking in makes sense. */
function canSneak(character: LoadedCharacter): boolean {
  const id = character.currentIsland.poneglyphId;
  return !!id && !(JSON.parse(character.poneglyphsRead) as string[]).includes(id);
}

/** Turns a solo threat the player just committed to into a shared fight, when free crewmates are with them. Null = stays solo. */
async function escalateToJointFight(character: LoadedCharacter, freeText: string, tacticModifier: number, technique?: TechniqueId): Promise<ActionResult | null> {
  const pending = character.pendingEncounter;
  if (!pending) return null;
  const allies = await freePartyMemberIds(character.id);
  if (allies.length < 2) return null;
  const enemy = JSON.parse(pending.enemyJson) as StoredEnemy;
  const rewards = JSON.parse(pending.rewardsJson) as StoredRewards;
  await prisma.pendingEncounter.delete({
    where: { characterId: character.id },
  });
  try {
    const started = await startJointFight({
      kind: "party",
      characterIds: allies,
      enemy,
      rewards,
      stakes: pending.narrative,
      opening: {
        characterId: character.id,
        text: freeText,
        tactic: tacticModifier,
        technique: technique ?? "none",
      },
    });
    return {
      ...emptyResult(started.log.length ? started.log : [`${character.name} planta cara a ${enemy.name} y sus nakamas se suman a la pelea. Esperando los movimientos de cada uno.`], character.level),
      jointFight: true,
    };
  } catch (err) {
    // Couldn't gather the group (someone got busy): put the solo encounter back exactly as it was.
    await prisma.pendingEncounter.create({
      data: {
        characterId: character.id,
        enemyJson: pending.enemyJson,
        rewardsJson: pending.rewardsJson,
        narrative: pending.narrative,
        assessment: pending.assessment,
        phase: pending.phase,
        enemyHp: pending.enemyHp,
        roundNumber: pending.roundNumber,
      },
    });
    return null;
  }
}

/** The narrator's most recent message — lets the classifier work out who "el primero que se me acerque" refers to. */
async function lastNarratorLine(characterId: string): Promise<string | undefined> {
  const last = await prisma.sceneMessage.findFirst({
    where: { characterId, role: "narrator" },
    orderBy: { createdAt: "desc" },
  });
  return last?.text.slice(-700);
}

/** The player's line is stamped a few ms before the narrator's reply: equal timestamps used to shuffle the transcript, so the narrator sometimes answered the wrong message. */
function exchangeRows(characterId: string, playerText: string, narratorText: string) {
  const now = Date.now();
  return [
    { characterId, role: "player", text: playerText, createdAt: new Date(now - 5) },
    { characterId, role: "narrator", text: narratorText, createdAt: new Date(now) },
  ];
}

export async function resolveFreeTextAction(characterId: string, userId: string, freeText: string): Promise<ActionResult> {
  const character = await loadCharacterOrThrow(characterId, userId);
  void maybeAutoCheckpoint(character.id, userId, "antes de actuar");

  // A live duel takes over the input: your text IS your move for the round.
  const openDuel = await getOpenDuelFor(character.id);
  if (openDuel?.status === "ACTIVE") {
    const outcome = await submitDuelAction(character.id, userId, freeText);
    return emptyResult(outcome.log, character.level);
  }

  // Same for a shared fight with allies: text is this character's move for the round.
  if (await getOpenJointFightFor(character.id)) {
    const outcome = await submitJointAction(character.id, userId, freeText);
    return { ...emptyResult(outcome.log, character.level), jointFight: true };
  }

  if (character.partyId && !character.isSeparatedFromParty && !character.pendingEncounter) {
    return resolvePartyFreeTextAction(character, freeText);
  }

  const validActions: ActionId[] = character.pendingEncounter
    ? character.pendingEncounter.phase === "victory"
      ? ["mercy_spare", "mercy_finish"]
      : ["engage", "flee"] // both "threat" (first commit) and "fighting" (ongoing exchanges) share this set
    : ["narrate", "explore", "attack", "recruit", "train", "rest", ...(canSneak(character) ? (["sneak"] as ActionId[]) : [])];

  const classified = await classifyPlayerAction(freeText, validActions, {
    sceneContext: await lastNarratorLine(character.id),
  });
  const { action } = classified;
  // A sharp mind turns the same described plan into a slightly better roll (bounded, the dice still rule).
  const tacticModifier = classified.tacticModifier + intellectTacticEdge(character.intellect);
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
    case "attack":
      result = await attackCharacter(characterId, userId, freeText, {
        target: classified.target,
        tier: classified.targetTier,
        technique: classified.technique,
        tacticModifier,
        effort: classified.effort,
      });
      break;
    case "sneak":
      result = await sneakPoneglyph(characterId, userId, freeText, tacticModifier);
      break;
    case "recruit": {
      try {
        const r = await recruitCompanion(characterId, userId, {
          target: classified.target,
          role: classified.recruitRole,
          tier: classified.targetTier,
          tacticModifier,
        });
        result = emptyResult(r.log, character.level);
      } catch (err) {
        if (err instanceof CompanionError) throw new GameActionError(err.message);
        throw err;
      }
      break;
    }
    case "train":
      result = await trainCharacter(characterId, userId, classified.trainFocus);
      break;
    case "rest":
      result = await restCharacter(characterId, userId);
      break;
    case "engage": {
      // Committing to a threat while crewmates share the scene pulls them in too.
      const escalated = character.pendingEncounter?.phase === "threat" ? await escalateToJointFight(character, freeText, tacticModifier, classified.technique) : null;
      result =
        escalated ??
        (await engageCharacter(characterId, userId, freeText, tacticModifier, {
          technique: classified.technique,
          effort: classified.effort,
        }));
      break;
    }
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
  await prisma.sceneMessage.createMany({ data: exchangeRows(characterId, freeText, finalLog.join("\n\n")) });

  // Silent, background, never awaited: keeps long sessions in context without a token blow-up.
  void maybeCompactCharacterScene(characterId);

  // Reaching here with a partyId set means this character was mid-fight
  // (see the branch above) — their own combat always resolves immediately,
  // never gated by party turn order, but once it's no longer "still
  // fighting" the group should see the headline.
  if (character.partyId) {
    // Crewmates should be able to read a fight as it happens, not just its verdict.
    const line = result.pendingCombat ? `${character.name} sigue en combate: ${result.log.join(" ").slice(0, 500)}` : summarizeCombatForParty(action, character.name, result);
    await echoToParty(character.partyId, line);
  }

  return { ...result, log: finalLog };
}

/** Island missions (game/missions.ts) advance off the ordinary actions; their progress lines ride along in the action's log. */
async function withMissions<T extends { log: string[] }>(characterId: string, result: T, events: Parameters<typeof recordMissionEvent>[1][]): Promise<T> {
  for (const e of events) result.log.push(...(await recordMissionEvent(characterId, e)));
  return result;
}

export async function exploreCharacter(characterId: string, userId: string, intentText?: string): Promise<ActionResult> {
  return withMissions(characterId, await exploreCharacterInner(characterId, userId, intentText), [{ kind: "explore" }]);
}

export async function resolveMercyChoice(characterId: string, userId: string, spare: boolean): Promise<ActionResult> {
  return withMissions(characterId, await resolveMercyChoiceInner(characterId, userId, spare), spare ? [{ kind: "win" }, { kind: "spare" }] : [{ kind: "win" }]);
}

export async function trainCharacter(characterId: string, userId: string, focus: "armament" | "observation" | "fruit" | "auto" = "auto"): Promise<ActionResult> {
  return withMissions(characterId, await trainCharacterInner(characterId, userId, focus), [{ kind: "train" }]);
}

export async function travelCharacter(characterId: string, userId: string, targetIslandId: string): Promise<{ log: string[]; arcIntro?: { islandName: string; hook: string } }> {
  const result = await travelCharacterInner(characterId, userId, targetIslandId);
  const target = await prisma.island.findUnique({
    where: { id: targetIslandId },
  });
  return withMissions(characterId, result, target ? [{ kind: "travel", destination: target.name }] : []);
}

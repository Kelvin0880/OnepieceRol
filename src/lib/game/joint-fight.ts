import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { Combatant } from "../engine/combat";
import { attemptFlee } from "../engine/encounter";
import { berryReward, bountyReward } from "../engine/economy";
import { resolveJointRound, scaleEnemyForGroup, JointFighter } from "../engine/joint-fight";
import { TECHNIQUE_LABELS, TechniqueId } from "../engine/techniques";
import { classifyPlayerAction } from "../ai/classify-action";
import { narrateJointFight, getRecentScene } from "../ai/narrate";
import { isOnErrand } from "../engine/empire";
import { companionSheet, parseCompanionProfile, type CompanionProfile } from "../engine/companions";
import { estimateLevel, applyFatigueToCombatant, npcStaminaAfterExchange, npcBaseEffort } from "../engine/resilience";
import { prepareFighter, combatProgressData, PreparedFighter, characterCapabilityText } from "./combat-prep";
import { resolveEnemyKit } from "./enemy-kit";
import { toCombatant } from "./derive";
import { postNews, handleDeathCheck } from "./death-resolution";
import { applyBountyOrNotoriety } from "./reputation";
import { grantPoneglyphRead } from "./poneglyph";
import { recordGrudgeIncident } from "./grudges";
import { grantXp } from "./xp";
import { markActorDefeated } from "./guardian";
import { notifyFightParticipants, notifyIsland } from "./notify";
import { getOpenDuelFor } from "./duel";
import { CharacterStatus } from "@prisma/client";

export class JointFightError extends Error {}

export interface JointEnemy {
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  isBoss: boolean;
  level?: number;
  personality?: string;
  worldActorId?: string;
  isActor?: boolean;
}

export interface JointRewards {
  berries: number;
  xp: number;
  bounty: number;
  islandDanger: number;
  poneglyphId?: string;
}

export type JointFightKind = "party" | "poneglyph" | "conquest" | "raid" | "arc";

const STALE_FIGHT_MS = 45 * 60 * 1000;
const RECENT_FINISHED_MS = 15 * 60 * 1000;
const FLEE_FAILED_TACTIC = -10;
const GUARD_TACTIC = -5;
const FLEE_TOKEN = "__flee__";
const NPC_PREFIX = "npc:";

const loadFull = (id: string) =>
  prisma.character.findUnique({ where: { id }, include: { devilFruit: true, equippedWeapon: true, currentIsland: true, companions: true, styles: true, ownedWeapons: { where: { wielded: true } } } });

/** The active joint fight this character is part of (fighting or downed), lazily cancelling abandoned ones. */
export async function getOpenJointFightFor(characterId: string) {
  const part = await prisma.jointFightParticipant.findFirst({
    where: { characterId, status: { in: ["FIGHTING", "DOWN"] }, fight: { status: "ACTIVE" } },
    include: { fight: true },
    orderBy: { joinedAt: "desc" },
  });
  if (!part) return null;
  if (Date.now() - part.fight.updatedAt.getTime() > STALE_FIGHT_MS) {
    await prisma.jointFight.update({ where: { id: part.fightId }, data: { status: "CANCELLED" } });
    return null;
  }
  return part.fight;
}

/** Crewmates who share this character's live scene and are free to join a fight. */
export async function freePartyMemberIds(characterId: string): Promise<string[]> {
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!me) return [];
  if (!me.partyId || me.isSeparatedFromParty) return [me.id];
  const mates = await prisma.character.findMany({
    where: { partyId: me.partyId, currentIslandId: me.currentIslandId, status: CharacterStatus.ALIVE, isSeparatedFromParty: false, pendingEncounter: null },
  });
  const free: string[] = [];
  for (const m of mates) {
    if (m.id !== me.id && ((await getOpenDuelFor(m.id)) || (await getOpenJointFightFor(m.id)))) continue;
    free.push(m.id);
  }
  return free.includes(me.id) ? free : [me.id, ...free];
}

function npcCombatant(c: { name: string; hp: number; maxHp: number; loyalty: number; role: string; profile?: CompanionProfile | null }, ownerLevel: number): Combatant {
  const sheet = companionSheet(c.role, ownerLevel, c.loyalty, c.profile);
  return { name: c.name, hp: c.hp, maxHp: c.maxHp, atk: sheet.atk, def: sheet.def, spd: sheet.spd, level: sheet.level };
}

export interface AllyNpc {
  actorId: string;
  name: string;
  stats: { hp: number; atk: number; def: number; spd: number };
}

export interface StartJointFightOpts {
  kind: JointFightKind;
  characterIds: string[];
  /** NPC allies that are not anyone's personal companion (pledged WorldActors in the final raid). */
  extraNpcs?: AllyNpc[];
  enemy: JointEnemy;
  rewards: JointRewards;
  stakes?: string;
  context?: Record<string, unknown>;
  /** The move of whoever started the fight, so they don't have to type it twice. */
  opening?: { characterId: string; text: string; tactic: number; technique: TechniqueId };
}

/**
 * Opens one shared fight for several players (plus their able companions,
 * who fight on their own). The enemy is scaled up for the headcount so a
 * group can't trivialise a boss, and every participant then acts each round.
 */
export async function startJointFight(opts: StartJointFightOpts): Promise<{ fightId: string; log: string[]; waiting: boolean; finished?: boolean }> {
  const chars = (await Promise.all([...new Set(opts.characterIds)].map(loadFull))).filter((c): c is NonNullable<typeof c> => !!c);
  if (chars.length === 0) throw new JointFightError("Nadie puede unirse a esta pelea.");
  const island = chars[0].currentIslandId;
  for (const c of chars) {
    if (c.status !== CharacterStatus.ALIVE) throw new JointFightError(`${c.name} no está en condiciones de luchar.`);
    if (c.currentIslandId !== island) throw new JointFightError(`${c.name} no está en la misma isla.`);
    if (await getOpenJointFightFor(c.id)) throw new JointFightError(`${c.name} ya está metido en otra pelea.`);
    if (await getOpenDuelFor(c.id)) throw new JointFightError(`${c.name} está en pleno duelo.`);
    if (await prisma.pendingEncounter.findUnique({ where: { characterId: c.id } })) throw new JointFightError(`${c.name} tiene un enfrentamiento sin resolver.`);
    const jailed = await prisma.imprisonment.findUnique({ where: { characterId: c.id } });
    if (jailed && !jailed.releasedAt) throw new JointFightError(`${c.name} está preso.`);
  }

  const npcs = chars.flatMap((c) => c.companions.filter((n) => n.status === "ALIVE" && n.hp / n.maxHp > 0.5 && !isOnErrand(n.profileJson, Date.now())).map((n) => ({ owner: c, n })));
  const extra = opts.extraNpcs ?? [];
  const headcount = chars.length + npcs.length + extra.length;
  const base: Combatant = { name: opts.enemy.name, hp: opts.enemy.hp, maxHp: opts.enemy.hp, atk: opts.enemy.atk, def: opts.enemy.def, spd: opts.enemy.spd };
  const scaled = scaleEnemyForGroup(base, headcount);
  const stored: JointEnemy = { ...opts.enemy, hp: scaled.maxHp, atk: scaled.atk, def: scaled.def };

  const fight = await prisma.jointFight.create({
    data: {
      islandId: island,
      kind: opts.kind,
      contextJson: JSON.stringify(opts.context ?? {}),
      enemyJson: JSON.stringify(stored),
      enemyHp: scaled.maxHp,
      enemyMaxHp: scaled.maxHp,
      rewardsJson: JSON.stringify(opts.rewards),
      stakes: opts.stakes,
      participants: {
        create: [
          ...chars.map((c) => {
            const open = opts.opening?.characterId === c.id ? opts.opening : null;
            return { characterId: c.id, name: c.name, hp: Math.max(1, c.hp), maxHp: c.maxHp, action: open?.text ?? null, tactic: open?.tactic ?? 0, technique: open?.technique ?? "none" };
          }),
          ...npcs.map(({ n }) => ({ characterId: `${NPC_PREFIX}${n.id}`, name: n.name, isNpc: true, hp: n.hp, maxHp: n.maxHp })),
          ...extra.map((a) => ({ characterId: `${NPC_PREFIX}ally:${a.actorId}`, name: a.name, isNpc: true, hp: a.stats.hp, maxHp: a.stats.hp, npcStatsJson: JSON.stringify(a.stats) })),
        ],
      },
    },
  });
  const names = chars.map((c) => c.name).join(", ");
  await prisma.jointFightMessage.create({
    data: {
      fightId: fight.id,
      authorCharacterId: null,
      authorName: "Narrador",
      text:
        `${names}${npcs.length ? ` (con ${npcs.map((x) => x.n.name).join(", ")})` : ""} se planta${chars.length + npcs.length > 1 ? "n" : ""} frente a ${opts.enemy.name}` +
        (opts.stakes ? ` — ${opts.stakes}` : "") +
        `. Cada uno describe su movimiento; cuando todos hayan respondido, se resuelve a la vez.`,
    },
  });
  if (opts.opening) {
    const opener = chars.find((c) => c.id === opts.opening!.characterId);
    if (opener) await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: opener.id, authorName: opener.name, text: opts.opening.text } });
  }
  // A lone starter with no companions has already answered for everyone.
  const status = opts.opening ? await advanceIfReady(fight.id) : { log: [] as string[], waiting: true };
  await notifyFightParticipants(fight.id);
  return { fightId: fight.id, ...status };
}

/**
 * A player's move in their joint fight. Recorded until every standing human
 * has answered (or the round times out); the last one in triggers the
 * engine's resolution for everybody at once.
 */
export async function submitJointAction(characterId: string, userId: string, freeText: string) {
  const fight = await getOpenJointFightFor(characterId);
  if (!fight) throw new JointFightError("No estás en ninguna pelea conjunta.");
  const me = await prisma.character.findUnique({ where: { id: characterId } });
  if (!me || me.userId !== userId) throw new JointFightError("Personaje no encontrado.");
  const part = await prisma.jointFightParticipant.findFirst({ where: { fightId: fight.id, characterId } });
  if (!part) throw new JointFightError("No estás en esta pelea.");
  if (part.status === "DOWN") throw new JointFightError("Estás caído: tus aliados deciden ahora el desenlace.");
  if (part.status === "FLED") throw new JointFightError("Ya huiste de esta pelea.");
  if (part.action) throw new JointFightError("Ya enviaste tu movimiento de esta ronda; espera a tus aliados.");

  const last = await prisma.jointFightMessage.findFirst({ where: { fightId: fight.id, authorCharacterId: null }, orderBy: { createdAt: "desc" } });
  const classified = await classifyPlayerAction(freeText, ["engage", "flee"], { sceneContext: last?.text.slice(-500) });
  const fleeing = classified.action === "flee";

  await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: characterId, authorName: me.name, text: freeText } });
  await prisma.jointFightParticipant.update({
    where: { id: part.id },
    data: { action: fleeing ? FLEE_TOKEN : freeText, tactic: classified.tacticModifier, technique: classified.technique ?? "none" },
  });
  await notifyFightParticipants(fight.id);
  return advanceIfReady(fight.id);
}

async function advanceIfReady(fightId: string) {
  const fight = await prisma.jointFight.findUnique({ where: { id: fightId }, include: { participants: true } });
  if (!fight || fight.status !== "ACTIVE") return { log: ["La pelea ya terminó."], waiting: false };
  const humans = fight.participants.filter((p) => !p.isNpc && p.status === "FIGHTING");
  const pending = humans.filter((p) => !p.action);
  if (pending.length === 0) return resolveJointRoundFor(fightId);
  return { log: [`Movimiento registrado. Esperando a: ${pending.map((p) => p.name).join(", ")}.`], waiting: true };
}

async function resolveJointRoundFor(fightId: string) {
  const start = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } });
  // Whoever bumps the round counter first owns this resolution; concurrent submitters see 0 rows and just wait.
  const claimed = await prisma.jointFight.updateMany({ where: { id: fightId, round: start.round, status: "ACTIVE" }, data: { round: { increment: 1 }, roundStartedAt: new Date() } });
  if (claimed.count === 0) return { log: ["Movimiento registrado. Esperando a tus aliados..."], waiting: true };

  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId }, include: { participants: true } });
  const round = start.round;
  const enemy = JSON.parse(fight.enemyJson) as JointEnemy;
  const rewards = JSON.parse(fight.rewardsJson) as JointRewards;
  const rng = liveRng();
  const enemyLevel = enemy.level ?? estimateLevel(enemy.atk, enemy.def);
  // The enemy tires as the fight drags on, exactly like the players do.
  const enemyBase: Combatant = applyFatigueToCombatant(
    { name: enemy.name, hp: fight.enemyMaxHp, maxHp: fight.enemyMaxHp, atk: enemy.atk, def: enemy.def, spd: enemy.spd, level: enemyLevel },
    fight.enemyStamina
  );

  const fighting = fight.participants.filter((p) => p.status === "FIGHTING");
  const chars = new Map<string, NonNullable<Awaited<ReturnType<typeof loadFull>>>>();
  for (const p of fighting.filter((x) => !x.isNpc)) {
    const c = await loadFull(p.characterId);
    if (c) chars.set(p.characterId, c);
  }
  const companions = new Map<string, { name: string; loyalty: number; ownerLevel: number; role: string; profile: CompanionProfile | null }>();
  for (const c of chars.values()) for (const n of c.companions) companions.set(`${NPC_PREFIX}${n.id}`, { name: n.name, loyalty: n.loyalty, ownerLevel: c.level, role: n.role, profile: parseCompanionProfile(n.profileJson) });

  const fled: string[] = [];
  const failedFlight: string[] = [];
  const guarding: string[] = [];
  const prepared = new Map<string, PreparedFighter>();
  const fighters: JointFighter[] = [];
  const actionsForNarration: { name: string; text: string; technique?: string; isNpc?: boolean }[] = [];
  const consumedIds: string[] = [];

  for (const p of fighting) {
    if (p.isNpc && p.npcStatsJson) {
      const st = JSON.parse(p.npcStatsJson) as { hp: number; atk: number; def: number; spd: number };
      fighters.push({ id: p.characterId, hp: p.hp, combatant: applyFatigueToCombatant({ name: p.name, hp: p.hp, maxHp: st.hp, atk: st.atk, def: st.def, spd: st.spd, level: estimateLevel(st.atk, st.def) }, p.stamina) });
      actionsForNarration.push({ name: p.name, text: "lucha junto a la coalición", isNpc: true });
      continue;
    }
    if (p.isNpc) {
      const info = companions.get(p.characterId);
      const combatant = applyFatigueToCombatant(npcCombatant({ name: p.name, hp: p.hp, maxHp: p.maxHp, loyalty: info?.loyalty ?? 50, role: info?.role ?? "", profile: info?.profile }, info?.ownerLevel ?? 1), p.stamina);
      fighters.push({ id: p.characterId, hp: p.hp, combatant });
      actionsForNarration.push({ name: p.name, text: "lucha junto a su capitán", isNpc: true });
      continue;
    }
    const c = chars.get(p.characterId);
    if (!c) continue;
    consumedIds.push(p.id);
    let tactic = p.tactic;
    let text = p.action ?? "";
    if (p.action === FLEE_TOKEN) {
      const flee = attemptFlee(rng, toCombatant(c), enemyBase);
      if (flee.success) {
        fled.push(p.characterId);
        actionsForNarration.push({ name: p.name, text: "huye de la pelea con éxito" });
        continue;
      }
      failedFlight.push(p.name);
      tactic = FLEE_FAILED_TACTIC;
      text = "intenta huir pero no lo consigue";
    } else if (!p.action) {
      guarding.push(p.name);
      tactic = GUARD_TACTIC;
      text = "se cubre y aguanta, sin decidirse a tiempo";
    }
    const prep = prepareFighter(c, p.technique as TechniqueId, tactic, p.hp, undefined, p.action ?? "");
    prepared.set(p.characterId, prep);
    fighters.push({ id: p.characterId, hp: p.hp, combatant: { ...prep.combatant, hp: p.hp, maxHp: c.maxHp } });
    actionsForNarration.push({ name: p.name, text, technique: p.technique !== "none" ? TECHNIQUE_LABELS[p.technique as TechniqueId] : undefined });
  }

  const result = fighters.length
    ? resolveJointRound(rng, round, fighters, enemyBase, fight.enemyHp, { maxEnemyAttacks: (JSON.parse(fight.contextJson) as { maxEnemyAttacks?: number }).maxEnemyAttacks })
    : { fighters: [], enemyHpAfter: fight.enemyHp, log: [], finished: true, outcome: "defeat" as const };
  // Everyone escaped: nobody won, nobody died.
  const allFled = fighters.length === 0 && fled.length > 0;
  const finished = result.finished || allFled;
  const outcome = allFled ? null : result.outcome;

  for (const r of result.fighters) {
    const part = fighting.find((p) => p.characterId === r.id);
    const npcTired = part?.isNpc
      ? {
          stamina: npcStaminaAfterExchange({
            stamina: part.stamina,
            level: fighters.find((f) => f.id === r.id)?.combatant.level,
            effort: npcBaseEffort(false),
            damageTaken: Math.max(0, part.hp - r.hpAfter),
            maxHp: part.maxHp,
          }),
        }
      : {};
    await prisma.jointFightParticipant.updateMany({ where: { fightId, characterId: r.id }, data: { hp: r.hpAfter, status: r.down ? "DOWN" : "FIGHTING", ...npcTired } });
  }
  if (fled.length) await prisma.jointFightParticipant.updateMany({ where: { fightId, characterId: { in: fled } }, data: { status: "FLED" } });
  await prisma.jointFightParticipant.updateMany({ where: { id: { in: consumedIds } }, data: { action: null, tactic: 0, technique: "none" } });

  for (const [id, prep] of prepared) {
    const c = chars.get(id)!;
    const after = result.fighters.find((f) => f.id === id);
    const startHp = fighting.find((p) => p.characterId === id)?.hp ?? c.hp;
    await prisma.character.update({ where: { id }, data: { hp: Math.max(0, after?.hpAfter ?? c.hp), ...combatProgressData(c, prep, rng, Math.max(0, startHp - (after?.hpAfter ?? startHp))) } });
  }

  const enemyKitText = (await resolveEnemyKit({ name: enemy.name, atk: enemy.atk, def: enemy.def, isBoss: enemy.isBoss, level: enemyLevel, worldActorId: enemy.worldActorId })).text;
  const allyKits = [
    ...[...chars.values()].slice(0, 6).map((c) => characterCapabilityText(c)),
    ...[...companions.entries()].slice(0, 4).map(([, n]) => {
      const sheet = companionSheet(n.role, n.ownerLevel, n.loyalty, n.profile);
      return `NAKAMA ${n.name.toUpperCase()} (${n.role}${sheet.epithet ? `, «${sheet.epithet}»` : ""}, nivel ${sheet.level}, ${sheet.rank}): técnicas ${sheet.abilities.join("; ")}. Lucha por ganar con ellas.`;
    }),
  ];
  const roster = (await prisma.jointFightParticipant.findMany({ where: { fightId } })).map((p) => ({ name: p.name, hp: p.hp, maxHp: p.maxHp, down: p.status === "DOWN", fled: p.status === "FLED" }));
  const recent = await getRecentScene(fight.participants.find((p) => !p.isNpc)?.characterId ?? "", 4).catch(() => [] as string[]);
  const narration = await narrateJointFight(
    {
      round,
      enemyName: enemy.name,
      enemyPersonality: enemy.personality,
      isBoss: enemy.isBoss,
      actions: actionsForNarration,
      rounds: result.log,
      roster,
      enemyHp: result.enemyHpAfter,
      enemyMaxHp: fight.enemyMaxHp,
      finished,
      outcome: outcome ?? undefined,
      stakes: fight.stakes ?? undefined,
      enemyKit: enemyKitText,
      allyKits,
      recentScene: recent,
    },
    { fightId }
  );
  const extra = [
    ...(failedFlight.length ? [`Intentaron huir sin éxito: ${failedFlight.join(", ")}.`] : []),
    ...(guarding.length ? [`Sin decidirse a tiempo, aguantan a la defensiva: ${guarding.join(", ")}.`] : []),
  ];
  await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: "Narrador", text: [narration, ...extra].join("\n\n") } });
  await prisma.jointFight.update({
    where: { id: fightId },
    data: {
      enemyHp: result.enemyHpAfter,
      enemyStamina: npcStaminaAfterExchange({
        stamina: fight.enemyStamina,
        level: enemyLevel,
        effort: npcBaseEffort(enemy.isBoss),
        damageTaken: Math.max(0, fight.enemyHp - result.enemyHpAfter) / Math.max(1, fighters.length),
        maxHp: fight.enemyMaxHp,
      }),
    },
  });

  if (finished) {
    if (outcome === "victory") {
      // Who dealt the last damage matters for disputes over spoils (territory claims).
      const last = [...result.log].reverse().find((l) => l.defender === enemy.name && l.damage > 0);
      const striker = last ? fight.participants.find((p) => p.name === last.attacker && !p.isNpc) : undefined;
      if (striker) {
        const ctx = JSON.parse(fight.contextJson) as Record<string, unknown>;
        await prisma.jointFight.update({ where: { id: fightId }, data: { contextJson: JSON.stringify({ ...ctx, finalBlowCharacterId: striker.characterId }) } });
      }
    }
    await settleJointFight(fightId, outcome, enemy, rewards);
  }
  await notifyFightParticipants(fightId);
  if (finished) await notifyIsland(fight.islandId, "joint-fight-settled");
  return { log: [narration, ...extra], waiting: false, finished, outcome: outcome ?? undefined };
}

async function settleJointFight(fightId: string, outcome: "victory" | "defeat" | null, enemy: JointEnemy, rewards: JointRewards) {
  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId }, include: { participants: true } });
  const newsLog: string[] = [];
  const closing: string[] = [];
  const humans = fight.participants.filter((p) => !p.isNpc && p.status !== "FLED");
  const npcs = fight.participants.filter((p) => p.isNpc);

  await prisma.jointFight.update({ where: { id: fightId }, data: { status: outcome === "victory" ? "WON" : outcome === "defeat" ? "LOST" : "CANCELLED" } });

  for (const npc of npcs) {
    if (npc.characterId.startsWith(`${NPC_PREFIX}ally:`)) continue; // a pledged actor is not a row we own
    const id = npc.characterId.slice(NPC_PREFIX.length);
    const down = npc.status === "DOWN";
    if (down && outcome === "defeat" && Math.random() < 0.5) {
      await prisma.nPCCompanion.update({ where: { id }, data: { status: CharacterStatus.DEAD, hp: 0, deathCause: `Cayó luchando contra ${enemy.name}.`, diedAt: new Date() } });
      closing.push(`${npc.name} no sobrevive a la derrota.`);
    } else {
      await prisma.nPCCompanion.update({ where: { id }, data: { hp: Math.max(1, npc.hp) } });
    }
  }

  if (outcome === "victory") {
    const names: string[] = [];
    for (const p of humans) {
      const c = await loadFull(p.characterId);
      if (!c || c.status !== CharacterStatus.ALIVE) continue;
      const down = p.status === "DOWN";
      names.push(c.name);
      const xpGain = down ? Math.round((rewards.xp + 10) / 2) : rewards.xp + 10;
      const lvl = await grantXp(c.experience, c.level, xpGain);
      const berries = rewards.berries + Math.round(berryReward(rewards.islandDanger, enemy.isBoss) * 0.8);
      const baseBounty = rewards.bounty + bountyReward(rewards.islandDanger, c.level, enemy.isBoss);
      const bountyDelta = c.faction === "PIRATE" || c.faction === "BOUNTY_HUNTER" ? baseBounty : Math.round(baseBounty / 20_000);
      // A downed ally is carried out by the others: alive, but badly hurt.
      const hp = down ? Math.max(5, Math.round(c.maxHp * 0.1)) : Math.max(1, p.hp);
      await prisma.character.update({ where: { id: c.id }, data: { experience: lvl.xp, level: lvl.level, berries: c.berries + berries, hp } });
      await applyBountyOrNotoriety(c, bountyDelta, newsLog, `Derrotó a ${enemy.name} en grupo`);
      if (enemy.worldActorId) {
        await recordGrudgeIncident(enemy.worldActorId, c.id, enemy.isActor ? "actor_defeat" : "subordinate_defeat", `derrotó a ${enemy.name} en ${c.currentIsland.name}`, enemy.name, { hp: fight.enemyMaxHp, atk: enemy.atk, def: enemy.def, spd: enemy.spd });
      }
      if (rewards.poneglyphId && !down) {
        const lines: string[] = [];
        const got = await grantPoneglyphRead(c, rewards.poneglyphId, lines, newsLog);
        if (got) closing.push(`${c.name} descifra el ${got}.`);
      }
      if (lvl.leveledUp) closing.push(`${c.name} sube a nivel ${lvl.level}.`);
    }
    await postNews(
      `${names.join(", ")} derrota${names.length > 1 ? "n" : ""} a ${enemy.name}`,
      `Un grupo de ${names.length} plantó cara a ${enemy.name}${fight.stakes ? ` (${fight.stakes})` : ""} y salió victorioso.`,
      "Guerra",
      humans[0]?.characterId,
      enemy.isBoss ? "major" : "normal"
    );
    closing.push(`¡${enemy.name} cae ante el grupo!`);
    if (enemy.isActor && enemy.worldActorId) {
      await markActorDefeated(enemy.worldActorId, names.join(" y "), (await prisma.island.findUnique({ where: { id: fight.islandId } }))?.name ?? "su isla");
      closing.push(`${enemy.name} se repliega, humillado en su propio territorio.`);
    }
  } else if (outcome === "defeat") {
    for (const p of humans) {
      const c = await loadFull(p.characterId);
      if (!c || c.status !== CharacterStatus.ALIVE) continue;
      if (p.status === "DOWN") {
        // Real stakes: a fallen ally who wasn't rescued by a win faces the ordinary death roll.
        const death = await handleDeathCheck(c, 0, `Cayó en grupo contra ${enemy.name}.`, newsLog);
        if (death.died) closing.push(`${c.name} ha muerto.`);
        else {
          await prisma.character.update({ where: { id: c.id }, data: { hp: death.finalHp } });
          closing.push(`${c.name} sobrevive, malherido.`);
        }
      } else {
        await prisma.character.update({ where: { id: c.id }, data: { hp: Math.max(1, p.hp) } });
        closing.push(`${c.name} logra retirarse con vida.`);
      }
    }
    await postNews(`${enemy.name} vence a un grupo de aventureros`, `${humans.map((h) => h.name).join(", ")} cayeron ante ${enemy.name}.`, "Guerra", humans[0]?.characterId, enemy.isBoss ? "major" : "normal");
  } else {
    closing.push("Todos logran escapar.");
  }
  if (fight.kind === "conquest") {
    // Dynamic import: territory.ts itself starts joint fights, so a static import would be circular.
    const { handleConquestSettled } = await import("./territory");
    const fresh = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId }, include: { participants: true } });
    closing.push(...(await handleConquestSettled({ contextJson: fresh.contextJson, outcome, humans: fresh.participants.filter((p) => !p.isNpc).map((p) => ({ characterId: p.characterId, status: p.status, name: p.name })) })));
  }
  if (fight.kind === "raid") {
    const { handleBusterWaveSettled } = await import("./buster-call");
    closing.push(...(await handleBusterWaveSettled(fight.contextJson, outcome)));
    const { handleRaidPhaseSettled } = await import("./raid");
    const fresh = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId }, include: { participants: true } });
    closing.push(...(await handleRaidPhaseSettled({ contextJson: fresh.contextJson, outcome, humans: fresh.participants.filter((p) => !p.isNpc).map((p) => ({ characterId: p.characterId, status: p.status, name: p.name })) })));
  }
  if (fight.kind === "arc") {
    const { handleArcFightSettled } = await import("./world-arcs");
    const fresh = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId }, include: { participants: true } });
    closing.push(...(await handleArcFightSettled({ contextJson: fresh.contextJson, outcome, humans: fresh.participants.filter((p) => !p.isNpc).map((p) => ({ characterId: p.characterId, status: p.status, name: p.name })) })));
  }
  if (closing.length) await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: "Narrador", text: closing.join(" ") } });
}

/** What the play page needs to render the joint-fight panel for one character. Rounds have no clock: everyone answers at their own pace. */
export async function getJointFightStateForCharacter(characterId: string) {
  const open = await getOpenJointFightFor(characterId);
  const fight =
    (open ? await prisma.jointFight.findUnique({ where: { id: open.id } }) : null) ??
    (await prisma.jointFight.findFirst({
      where: { status: { in: ["WON", "LOST"] }, updatedAt: { gt: new Date(Date.now() - RECENT_FINISHED_MS) }, participants: { some: { characterId } } },
      orderBy: { updatedAt: "desc" },
    }));
  if (!fight) return null;
  const enemy = JSON.parse(fight.enemyJson) as JointEnemy;
  const participants = await prisma.jointFightParticipant.findMany({ where: { fightId: fight.id }, orderBy: { joinedAt: "asc" } });
  const messages = await prisma.jointFightMessage.findMany({ where: { fightId: fight.id }, orderBy: { createdAt: "asc" }, take: 50 });
  const mine = participants.find((p) => p.characterId === characterId);
  return {
    id: fight.id,
    kind: fight.kind,
    status: fight.status,
    round: fight.round,
    stakes: fight.stakes,
    enemy: { name: enemy.name, hp: fight.enemyHp, maxHp: fight.enemyMaxHp, isBoss: enemy.isBoss },
    me: mine ? { status: mine.status, submitted: !!mine.action, hp: mine.hp, maxHp: mine.maxHp } : null,
    participants: participants.map((p) => ({ name: p.name, isNpc: p.isNpc, hp: p.hp, maxHp: p.maxHp, status: p.status, submitted: !!p.action })),
    messages: messages.map((m) => ({ id: m.id, authorName: m.authorName, isNarrator: m.authorCharacterId === null, mine: m.authorCharacterId === characterId, text: m.text })),
  };
}

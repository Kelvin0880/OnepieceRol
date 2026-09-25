import { belongingsFor } from "../engine/inventory";
import { prisma } from "../db";
import { CharacterStatus } from "@prisma/client";
import { liveRng } from "../engine/rng";
import { MAX_COMPANIONS, RecruitTier, companionMaxHp, companionSheet, parseCompanionProfile, normalizeRole, recruitChance, rollRecruit, startingLoyalty } from "../engine/companions";
import { narrateRecruit, getRecentScene } from "../ai/narrate";

export class CompanionError extends Error {}

const RECRUIT_RETRY_COOLDOWN_MS = 30 * 60 * 1000;

export interface CompanionView {
  id: string;
  name: string;
  role: string;
  status: string;
  level: number;
  hp: number;
  maxHp: number;
  loyalty: number;
  rank: string;
  atk: number;
  def: number;
  spd: number;
  abilities: string[];
  nextAbilityAtLevel: number | null;
  personality: string | null;
  epithet: string | null;
  styleId: string | null;
  /** What this nakama carries (engine/inventory.ts belongingsFor): shown on the card and told to the narrator. */
  belongings: string[];
}

const ABILITY_LEVELS = [1, 5, 12];

/**
 * Companions are always at their captain's level. Keeps max HP in step with it
 * (scaling current HP proportionally) — cheap, so it rides on every character read.
 */
export async function syncCompanions(characterId: string, ownerLevel: number): Promise<void> {
  const rows = await prisma.nPCCompanion.findMany({ where: { characterId, status: CharacterStatus.ALIVE } });
  for (const c of rows) {
    const max = companionSheet(c.role, ownerLevel, c.loyalty, parseCompanionProfile(c.profileJson)).maxHp;
    if (max === c.maxHp) continue;
    await prisma.nPCCompanion.update({ where: { id: c.id }, data: { maxHp: max, hp: Math.max(1, Math.min(max, Math.round((c.hp * max) / Math.max(1, c.maxHp)))) } });
  }
}

export async function getCompanionViews(characterId: string, ownerLevel: number): Promise<CompanionView[]> {
  await syncCompanions(characterId, ownerLevel);
  const rows = await prisma.nPCCompanion.findMany({ where: { characterId }, orderBy: { joinedAt: "asc" } });
  return rows.map((c) => {
    const sheet = companionSheet(c.role, ownerLevel, c.loyalty, parseCompanionProfile(c.profileJson));
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      status: c.status,
      level: sheet.level,
      hp: c.hp,
      maxHp: c.maxHp,
      loyalty: c.loyalty,
      rank: sheet.rank,
      atk: sheet.atk,
      def: sheet.def,
      spd: sheet.spd,
      abilities: sheet.abilities,
      nextAbilityAtLevel: ABILITY_LEVELS.find((l) => l > ownerLevel) ?? null,
      personality: c.personality,
      epithet: sheet.epithet ?? null,
      styleId: sheet.styleId ?? null,
      belongings: belongingsFor(c.role),
    };
  });
}

function cleanNpcName(raw: string | undefined): string | null {
  const t = (raw ?? "").replace(/\s+/g, " ").replace(/^(el|la|los|las|un|una)\s+/i, "").trim();
  if (t.length < 2) return null;
  return t.slice(0, 40);
}

export interface RecruitOpts {
  target?: string;
  role?: string;
  tier?: RecruitTier;
  tacticModifier?: number;
}

/**
 * Turns an in-scene invitation ("Jorge, únete a mi tripulación") into a real, tracked nakama —
 * decided by a persuasion roll (engine/companions.ts), staged by the narrator. The AI never decides acceptance.
 */
export async function recruitCompanion(characterId: string, userId: string, opts: RecruitOpts): Promise<{ log: string[]; accepted: boolean; companionName?: string }> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true, companions: true } });
  if (!c || c.userId !== userId) throw new CompanionError("Personaje no encontrado.");
  if (c.status !== CharacterStatus.ALIVE) throw new CompanionError("Este personaje ya no puede actuar.");

  const name = cleanNpcName(opts.target);
  if (!name) throw new CompanionError("No tengo claro a quién quieres reclutar. Nómbralo en tu mensaje (por ejemplo: «Jorge, únete a mi tripulación»).");
  const alive = c.companions.filter((n) => n.status === CharacterStatus.ALIVE);
  if (alive.length >= MAX_COMPANIONS) throw new CompanionError(`Tu tripulación NPC ya está completa (${MAX_COMPANIONS} nakamas). Un nakama nuevo tendría que ocupar un sitio libre.`);
  if (alive.some((n) => n.name.toLowerCase() === name.toLowerCase())) throw new CompanionError(`${name} ya es tu nakama.`);

  const recentFail = await prisma.gameLogEntry.findFirst({
    where: { characterId, kind: "recruit_fail", text: { startsWith: `${name.toLowerCase()}|` }, createdAt: { gt: new Date(Date.now() - RECRUIT_RETRY_COOLDOWN_MS) } },
  });
  if (recentFail) throw new CompanionError(`${name} ya te dijo que no hace poco. Dale tiempo antes de insistir.`);

  const role = normalizeRole(opts.role);
  const tacticModifier = opts.tacticModifier ?? 0;
  const chance = recruitChance({ willpower: c.willpower, intellect: c.intellect, tacticModifier, tier: opts.tier ?? "average" });
  const accepted = rollRecruit(liveRng(), chance);

  const recentScene = await getRecentScene(characterId, 8);
  const prose = await narrateRecruit({ characterName: c.name, npcName: name, role, accepted, islandName: c.currentIsland.name, recentScene }, { characterId });

  if (accepted) {
    const loyalty = startingLoyalty(tacticModifier);
    const max = companionMaxHp(c.level, role);
    await prisma.nPCCompanion.create({ data: { characterId, name, role, hp: max, maxHp: max, loyalty } });
    const line = `${name} (${role}) se une a tu tripulación como nakama. Estará siempre a tu nivel.`;
    await prisma.gameLogEntry.create({ data: { characterId, kind: "recruit", text: line } });
    return { log: [prose, line], accepted: true, companionName: name };
  }
  const line = `${name} declina por ahora (probabilidad de convencerle: ${chance}%).`;
  await prisma.gameLogEntry.create({ data: { characterId, kind: "recruit_fail", text: `${name.toLowerCase()}|${line}` } });
  return { log: [prose, line], accepted: false };
}

export async function dismissCompanion(characterId: string, userId: string, companionId: string): Promise<string> {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { userId: true } });
  if (!c || c.userId !== userId) throw new CompanionError("Personaje no encontrado.");
  const n = await prisma.nPCCompanion.findFirst({ where: { id: companionId, characterId } });
  if (!n) throw new CompanionError("Ese nakama no existe.");
  await prisma.nPCCompanion.delete({ where: { id: n.id } });
  return `${n.name} se despide de tu tripulación y sigue su propio camino.`;
}

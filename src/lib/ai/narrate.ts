import { prisma } from "../db";
import { logError } from "../log-error";
import {
  buildExploreNarrationPrompt,
  buildCombatNarrationPrompt,
  buildMemoryUpdatePrompt,
  buildSceneNarrationPrompt,
  buildPartySceneNarrationPrompt,
  buildNewsNarrationPrompt,
  buildBountyDigestPrompt,
  buildEncounterIntroPrompt,
  buildDuelNarrationPrompt,
  buildJointFightNarrationPrompt,
  JointFightNarrationInput,
  EncounterIntroInput,
  DuelNarrationInput,
  ExploreNarrationInput,
  CombatNarrationInput,
  SceneNarrationInput,
  PartySceneNarrationInput,
  NewsNarrationInput,
  BountyDigestInput,
  buildIslandBriefingPrompt,
  buildStaticBriefing,
  IslandBriefingInput,
  directivesBlock,
  buildRecruitNarrationPrompt,
  RecruitNarrationInput,
  buildWorldEventPrompt,
  WorldEventNarrationInput,
} from "./narrate-prompt";
import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { describeCapabilities } from "../engine/capabilities";
import { rankProgress, type FactionKey } from "../engine/progression";
import { currentStamina } from "../game/combat-prep";

// Long, inspiring scenes need real time to write: a 6+ paragraph reply is normal now.
const NARRATION_TIMEOUT_MS = 30_000;
const MEMORY_TIMEOUT_MS = 8_000;
const MEMORY_SUMMARY_MAX_CHARS = 1_500;

/**
 * A free-tier model occasionally returns something that isn't narration at
 * all — a moderation/safety-classifier artifact ("User Safety: safe"), a
 * refusal, or just near-nothing — and without a check that garbage would
 * be shown to the player as if it were real prose. Rejecting it here (via
 * callOpenRouter's `validate` option) makes the model-fallback loop treat
 * it exactly like an outright failure and try the next model instead.
 */
export function isValidNarration(text: string): boolean {
  const t = text.trim();
  if (t.length < 15) return false;
  if (/^(user safety|safety:|i cannot|i can't|i'm sorry|as an ai|i am an ai)/i.test(t)) return false;
  return true;
}

/**
 * The actual back-and-forth roleplay transcript (SceneMessage), oldest
 * first — every free-text turn, mechanical or pure roleplay alike, so the
 * AI remembers what was actually said, not just what numbers changed.
 * Used as short-term context by scene narration and by combat/explore
 * prompts once a scene has some history.
 */
/** Tone + standing out-of-role notes + the sheet of what the character can really do; never throws (defaults if the row is missing). */
export async function loadDirectives(characterId: string): Promise<string> {
  try {
    const c = await prisma.character.findUnique({
      where: { id: characterId },
      include: { devilFruit: { select: { name: true } }, equippedWeapon: { select: { name: true } }, companions: { where: { status: "ALIVE" }, select: { name: true } } },
    });
    if (!c) return directivesBlock();
    const caps = describeCapabilities({
      name: c.name, level: c.level, armamentHaki: c.armamentHaki, observationHaki: c.observationHaki, conquerorsHaki: c.conquerorsHaki,
      fruitName: c.devilFruit?.name, fruitMastery: c.fruitMastery, fruitAwakened: c.fruitAwakened, weaponName: c.equippedWeapon?.name,
      stamina: currentStamina(c), maxStamina: c.maxStamina, hp: c.hp, maxHp: c.maxHp, companions: c.companions.map((n) => n.name),
      rank: (() => {
        const r = rankProgress((c.faction === "CP0" ? "CP0" : c.faction) as FactionKey, c.bounty, c.notoriety);
        return r.nextTitle ? `${r.title} (le faltan ${r.remaining?.toLocaleString("es-ES")} de ${r.metric.toLowerCase()} para ${r.nextTitle})` : `${r.title} (el escalón más alto)`;
      })(),
    });
    // Dynamic import: game/world-arcs imports this module for its own narration.
    const presence = await import("../game/world-arcs").then((m) => m.worldPresenceFor(c.currentIslandId)).catch(() => "");
    return `

${caps}${presence ? `

${presence}` : ""}${directivesBlock(c.narratorTone, c.oocNotes)}`;
  } catch {
    return directivesBlock();
  }
}

export async function getRecentScene(characterId: string, take = 12): Promise<string[]> {
  const ch = await prisma.character.findUnique({ where: { id: characterId }, select: { sceneClearedAt: true } });
  const entries = await prisma.sceneMessage.findMany({
    where: { characterId, ...(ch?.sceneClearedAt ? { createdAt: { gt: ch.sceneClearedAt } } : {}) },
    orderBy: [{ createdAt: "desc" }, { role: "asc" }],
    take,
  });
  // Long posts stay complete on screen, but only their tail rides along as prompt context.
  const clip = (t: string) => (t.length > 1800 ? `…${t.slice(-1800)}` : t);
  return entries.reverse().map((e) => (e.role === "player" ? `[Jugador]: ${clip(e.text)}` : clip(e.text)));
}

/**
 * Narrates an explore outcome. Never throws: on any AI failure it falls
 * back to the exact static flavor/narrative text the caller already
 * computed, so a broken AI provider degrades quality, never availability.
 */
export async function narrateExplore(input: ExploreNarrationInput, meta: { characterId: string }): Promise<string[]> {
  const fallback = [input.baseFlavorText, input.baseNarrative];
  try {
    const { system: baseSystem, user, maxTokens } = buildExploreNarrationPrompt(input);
    const system = baseSystem + (await loadDirectives(meta.characterId));
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-explore", err, meta);
    return fallback;
  }
}

/** Same never-throws contract as narrateExplore, falling back to the existing per-round dry lines. */
export async function narrateCombat(input: CombatNarrationInput, meta: { characterId: string }): Promise<string[]> {
  const fallback = input.rounds.map((r) =>
    r.damage > 0 ? `${r.attacker} golpea a ${r.defender} (${r.damage} de daño).` : `${r.attacker} ataca a ${r.defender}, pero no logra hacerle daño.`
  );
  try {
    const { system: baseSystem, user, maxTokens } = buildCombatNarrationPrompt(input);
    const system = baseSystem + (await loadDirectives(meta.characterId));
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-combat", err, meta);
    return fallback;
  }
}

/** Narrates a threat appearing (before combat starts). Falls back to the template's static text. */
export async function narrateEncounterIntro(input: EncounterIntroInput, fallback: string[], meta: { characterId: string }): Promise<string[]> {
  try {
    const { system: baseSystem, user, maxTokens } = buildEncounterIntroPrompt(input);
    const system = baseSystem + (await loadDirectives(meta.characterId));
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-encounter-intro", err, meta);
    return fallback;
  }
}

/** 1-vs-1 duel narration; never throws, falls back to plain per-round lines. */
export async function narrateDuel(input: DuelNarrationInput, meta: { duelId: string }): Promise<string> {
  const fallback = input.rounds
    .map((r) => (r.damage > 0 ? `${r.attacker} golpea a ${r.defender} (${r.damage} de daño).` : `${r.attacker} ataca a ${r.defender}, pero no le hace daño.`))
    .join(" ");
  try {
    const { system, user, maxTokens } = buildDuelNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-duel", err, meta);
    return fallback;
  }
}

export async function narrateJointFight(input: JointFightNarrationInput, meta: { fightId: string }): Promise<string> {
  const fallback = input.rounds
    .map((r) => (r.damage > 0 ? `${r.attacker} golpea a ${r.defender} (${r.damage} de daño).` : `${r.attacker} ataca a ${r.defender}, pero no le hace daño.`))
    .join(" ");
  try {
    const { system, user, maxTokens } = buildJointFightNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-joint-fight", err, meta);
    return fallback;
  }
}

/**
 * Pure roleplay turns: no engine call, no stat changes — the AI just acts
 * as game master and reacts to the player. Falls back to a short generic
 * acknowledgement (never a made-up mechanical outcome) on AI failure, same
 * never-throws contract as the others.
 */
export async function narrateScene(input: SceneNarrationInput, meta: { characterId: string }): Promise<string> {
  try {
    const { system: baseSystem, user, maxTokens } = buildSceneNarrationPrompt(input);
    const system = baseSystem + (await loadDirectives(meta.characterId));
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-scene", err, meta);
    return "El mundo sigue su curso a tu alrededor, pero por ahora nada más que contar. (La IA no respondió a tiempo — prueba de nuevo en un momento.)";
  }
}

/** Staging of a recruitment answer (the roll was already decided). Never throws; falls back to a plain line. */
export async function narrateRecruit(input: RecruitNarrationInput, meta: { characterId: string }): Promise<string> {
  const fallback = input.accepted
    ? `${input.npcName} sonríe y asiente: a partir de hoy es tu nakama.`
    : `${input.npcName} niega despacio: todavía no está listo para zarpar contigo.`;
  try {
    const { system: baseSystem, user, maxTokens } = buildRecruitNarrationPrompt(input);
    const system = baseSystem + (await loadDirectives(meta.characterId));
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-recruit", err, meta);
    return fallback;
  }
}

/** Same never-throws contract as narrateScene, for a shared party scene (see Party in schema.prisma). */
export async function narratePartyScene(input: PartySceneNarrationInput, meta: { partyId: string }): Promise<string> {
  try {
    const { system: baseSystem, user, maxTokens } = buildPartySceneNarrationPrompt(input);
    const pact = (await prisma.party.findUnique({ where: { id: meta.partyId }, select: { scenePact: true } }))?.scenePact;
    const system = baseSystem + directivesBlock("balanced", pact ? `PACTO DE ESCENA acordado por los jugadores fuera de rol (móntalo dentro de la historia con naturalidad, dando protagonismo a todos y respetando lo pactado): ${pact}` : undefined);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-party-scene", err, meta);
    return "El mundo sigue su curso alrededor del grupo, pero por ahora nada más que contar. (La IA no respondió a tiempo — prueba de nuevo en un momento.)";
  }
}

/** A memory summary must be JSON with a real "summary" string: a free model sometimes answers with a moderation artifact ("User Safety: safe"), which must count as a failed model, not as the summary. */
export function isValidSummaryJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.summary === "string" && parsed.summary.trim().length > 10;
  } catch {
    return false;
  }
}

/** Rejects malformed JSON or missing fields the same way isValidNarration rejects garbage prose — treated as a failed model, moves to the next one. */
function isValidNewsJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.headline === "string" && parsed.headline.trim().length > 3 && typeof parsed?.body === "string" && parsed.body.trim().length > 3;
  } catch {
    return false;
  }
}

/**
 * Narrates one background world-news beat. Never throws: falls back to one
 * of the template's static fallback lines (passed in by the caller,
 * world-tick.ts) on any AI failure, same safety net every other narration
 * type already has.
 */
export async function narrateNews(
  input: NewsNarrationInput,
  fallback: { headline: string; body: string },
  meta: { category: string }
): Promise<{ headline: string; body: string }> {
  try {
    const { system, user } = buildNewsNarrationPrompt(input);
    const raw = await callOpenRouter(system, user, {
      models: OPENROUTER_MODELS,
      jsonMode: true,
      timeoutMs: NARRATION_TIMEOUT_MS,
      maxTokens: 300,
      validate: isValidNewsJson,
    });
    const parsed = JSON.parse(raw);
    return { headline: String(parsed.headline).trim(), body: String(parsed.body).trim() };
  } catch (err) {
    await logError("ai/narrate-news", err, meta);
    return fallback;
  }
}

/** One chapter (or the verdict) of a world event. Never throws: on failure the caller-provided static text is used. */
export async function narrateWorldEvent(input: WorldEventNarrationInput, fallback: { headline: string; body: string }, meta: Record<string, string>): Promise<{ headline: string; body: string }> {
  try {
    const { system, user } = buildWorldEventPrompt(input);
    const raw = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, jsonMode: true, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 500, validate: isValidNewsJson });
    const parsed = JSON.parse(raw);
    return { headline: String(parsed.headline).trim(), body: String(parsed.body).trim() };
  } catch (err) {
    await logError("ai/narrate-world-event", err, meta);
    return fallback;
  }
}

/** Same never-throws contract, for the periodic bounty roundup (see tickBountyDigestIfDue in world-tick.ts). */
export async function narrateBountyDigest(
  input: BountyDigestInput,
  fallback: { headline: string; body: string }
): Promise<{ headline: string; body: string }> {
  try {
    const { system, user } = buildBountyDigestPrompt(input);
    const raw = await callOpenRouter(system, user, {
      models: OPENROUTER_MODELS,
      jsonMode: true,
      timeoutMs: NARRATION_TIMEOUT_MS,
      maxTokens: 400,
      validate: isValidNewsJson,
    });
    const parsed = JSON.parse(raw);
    return { headline: String(parsed.headline).trim(), body: String(parsed.body).trim() };
  } catch (err) {
    await logError("ai/narrate-bounty-digest", err, {});
    return fallback;
  }
}

/**
 * Folds an older stretch of scene transcript into the bounded memory summary
 * (silent context compaction — see game/scene-compaction.ts). Returns null on
 * any failure so the caller simply leaves the old summary and tries later.
 */
export async function summarizeTranscript(currentSummary: string | null, lines: string[], meta: Record<string, string>): Promise<string | null> {
  try {
    const { system, user } = buildMemoryUpdatePrompt(
      currentSummary ?? undefined,
      "Esta parte de la escena en curso ya no cabe en la memoria reciente; incorpórala al resumen conservando lo que importe para seguir la historia " +
        "(nombres de NPC y lo que quieren, promesas, deudas, conflictos abiertos, lugares, decisiones del jugador):\n" +
        lines.join("\n")
    );
    const raw = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, jsonMode: true, temperature: 0.3, timeoutMs: 20_000, maxTokens: 700, validate: isValidSummaryJson });
    const parsed = JSON.parse(raw);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    return summary ? summary.slice(0, MEMORY_SUMMARY_MAX_CHARS) : null;
  } catch (err) {
    await logError("ai/summarize-transcript", err, meta);
    return null;
  }
}

/**
 * Compresses "what just happened" into a character's persistent, bounded
 * memory summary — the long-term counterpart to getRecentMemory's raw
 * rolling log lines. Deliberately NOT called on every action (only combat
 * and mercy-choice beats, from perform-action.ts) to keep AI call volume
 * and token growth bounded: important events get remembered, routine ones
 * don't crowd out the summary. Never throws and never awaited by its
 * callers — a failure here should never slow down or break the action
 * that triggered it; it just leaves the old summary in place.
 */
export async function updateCharacterMemory(characterId: string, currentSummary: string | null, latestEvent: string): Promise<void> {
  try {
    const epoch = (await prisma.character.findUnique({ where: { id: characterId }, select: { timelineEpoch: true } }))?.timelineEpoch;
    const { system, user } = buildMemoryUpdatePrompt(currentSummary ?? undefined, latestEvent);
    const raw = await callOpenRouter(system, user, {
      models: OPENROUTER_MODELS,
      jsonMode: true,
      temperature: 0.3,
      timeoutMs: MEMORY_TIMEOUT_MS,
      maxTokens: 350,
      validate: isValidSummaryJson,
    });
    const parsed = JSON.parse(raw);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    if (summary && epoch !== undefined) {
      // Dropped if a rollback happened while the model was thinking: that event belongs to a timeline that no longer exists.
      await prisma.character.updateMany({ where: { id: characterId, timelineEpoch: epoch }, data: { memorySummary: summary.slice(0, MEMORY_SUMMARY_MAX_CHARS) } });
    }
  } catch (err) {
    await logError("ai/update-memory", err, { characterId });
  }
}

/** Never throws: any AI failure yields the static panorama so the player always gets the briefing and the goals. */
export async function narrateIslandBriefing(input: IslandBriefingInput, meta: { characterId: string }): Promise<string> {
  try {
    const { system, user } = buildIslandBriefingPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 2200, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/island-briefing", err, meta);
    return buildStaticBriefing(input);
  }
}

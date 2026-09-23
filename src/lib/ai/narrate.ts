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
  EncounterIntroInput,
  DuelNarrationInput,
  ExploreNarrationInput,
  CombatNarrationInput,
  SceneNarrationInput,
  PartySceneNarrationInput,
  NewsNarrationInput,
  BountyDigestInput,
} from "./narrate-prompt";
import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";

const NARRATION_TIMEOUT_MS = 10_000;
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
export async function getRecentScene(characterId: string, take = 12): Promise<string[]> {
  const entries = await prisma.sceneMessage.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return entries.reverse().map((e) => (e.role === "player" ? `[Jugador]: ${e.text}` : e.text));
}

/**
 * Narrates an explore outcome. Never throws: on any AI failure it falls
 * back to the exact static flavor/narrative text the caller already
 * computed, so a broken AI provider degrades quality, never availability.
 */
export async function narrateExplore(input: ExploreNarrationInput, meta: { characterId: string }): Promise<string[]> {
  const fallback = [input.baseFlavorText, input.baseNarrative];
  try {
    const { system, user } = buildExploreNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 500, validate: isValidNarration });
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
    const { system, user } = buildCombatNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 900, validate: isValidNarration });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-combat", err, meta);
    return fallback;
  }
}

/** Narrates a threat appearing (before combat starts). Falls back to the template's static text. */
export async function narrateEncounterIntro(input: EncounterIntroInput, fallback: string[], meta: { characterId: string }): Promise<string[]> {
  try {
    const { system, user } = buildEncounterIntroPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 600, validate: isValidNarration });
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
    const { system, user } = buildDuelNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 800, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-duel", err, meta);
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
    const { system, user } = buildSceneNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 700, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-scene", err, meta);
    return "El mundo sigue su curso a tu alrededor, pero por ahora nada más que contar. (La IA no respondió a tiempo — prueba de nuevo en un momento.)";
  }
}

/** Same never-throws contract as narrateScene, for a shared party scene (see Party in schema.prisma). */
export async function narratePartyScene(input: PartySceneNarrationInput, meta: { partyId: string }): Promise<string> {
  try {
    const { system, user } = buildPartySceneNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS, maxTokens: 700, validate: isValidNarration });
    return text.trim();
  } catch (err) {
    await logError("ai/narrate-party-scene", err, meta);
    return "El mundo sigue su curso alrededor del grupo, pero por ahora nada más que contar. (La IA no respondió a tiempo — prueba de nuevo en un momento.)";
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
    const { system, user } = buildMemoryUpdatePrompt(currentSummary ?? undefined, latestEvent);
    const raw = await callOpenRouter(system, user, {
      models: OPENROUTER_MODELS,
      jsonMode: true,
      temperature: 0.3,
      timeoutMs: MEMORY_TIMEOUT_MS,
      maxTokens: 350,
    });
    const parsed = JSON.parse(raw);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.trim() : "";
    if (summary) {
      await prisma.character.update({ where: { id: characterId }, data: { memorySummary: summary.slice(0, MEMORY_SUMMARY_MAX_CHARS) } });
    }
  } catch (err) {
    await logError("ai/update-memory", err, { characterId });
  }
}

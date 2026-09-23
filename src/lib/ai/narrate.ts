import { prisma } from "../db";
import { logError } from "../log-error";
import { buildExploreNarrationPrompt, buildCombatNarrationPrompt, ExploreNarrationInput, CombatNarrationInput } from "./narrate-prompt";
import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";

const NARRATION_TIMEOUT_MS = 10_000;

/** Last N log lines for this character, oldest first — lightweight rolling context for prompts. */
export async function getRecentMemory(characterId: string, take = 8): Promise<string[]> {
  const entries = await prisma.gameLogEntry.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return entries.map((e) => e.text).reverse();
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
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-explore", err, meta);
    return fallback;
  }
}

/** Same never-throws contract as narrateExplore, falling back to the existing per-round dry lines. */
export async function narrateCombat(input: CombatNarrationInput, meta: { characterId: string }): Promise<string[]> {
  const fallback = input.rounds.filter((r) => r.damage > 0).map((r) => `${r.attacker} golpea a ${r.defender} (${r.damage} de daño).`);
  try {
    const { system, user } = buildCombatNarrationPrompt(input);
    const text = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: NARRATION_TIMEOUT_MS });
    return [text.trim()];
  } catch (err) {
    await logError("ai/narrate-combat", err, meta);
    return fallback;
  }
}

import { logError } from "../log-error";
import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { buildOocPrompt, parseOocReply, OocPromptContext, OocProposal } from "./ooc-prompt";

const OOC_TIMEOUT_MS = 25_000;

/** One out-of-role turn. Never throws: on AI failure the player still gets a useful pointer to the manual tools. */
export async function askOocAssistant(ctx: OocPromptContext, playerText: string, meta: { characterId: string }): Promise<{ reply: string; proposal: OocProposal | null }> {
  try {
    const { system, user } = buildOocPrompt(ctx, playerText);
    const raw = await callOpenRouter(system, user, {
      models: OPENROUTER_MODELS,
      timeoutMs: OOC_TIMEOUT_MS,
      maxTokens: 700,
      temperature: 0.4,
      jsonMode: true,
      validate: (t) => t.trim().length > 2,
    });
    return parseOocReply(raw);
  } catch (err) {
    await logError("ai/ooc", err, meta);
    return { reply: "Ahora mismo no puedo pensar bien (la IA no respondió). Puedes usar las herramientas de abajo directamente: deshacer, punto de restauración, reparar, tono del narrador o reportar.", proposal: null };
  }
}

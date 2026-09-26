import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { logError } from "../log-error";
import { canonBriefFallback } from "../engine/canon-encounter";
import { inventedNames } from "../engine/island-npc";

const SYSTEM =
  "Eres el narrador de un juego de rol de One Piece en español. Un personaje canon le encarga una tarea a un aventurero. Escribe SOLO el encargo: 2 o 3 frases, en la voz y personalidad del personaje (puede hablar en primera persona entre comillas), concreto y con un motivo. " +
  "REGLA ABSOLUTA: no inventes ningún personaje con nombre; usa únicamente los nombres que se te dan (el que encarga, el objetivo y el aventurero). Sin markdown, sin números de recompensa, sin anunciar que la misión está completada.";

export interface CanonBriefInput {
  actorName: string;
  rank: string | null;
  personality: string | null;
  factionName: string;
  islandName: string;
  characterName: string;
  targetName: string | null;
  targetTitle: string | null;
}

/** The task a canon character hands out, in their own voice. Falls back to a plain template; never invents names. */
export async function narrateCanonBrief(input: CanonBriefInput, meta: { characterId: string }): Promise<string> {
  const fallback = canonBriefFallback({ actorName: input.actorName, rank: input.rank, personality: input.personality, targetName: input.targetName, targetTitle: input.targetTitle, islandName: input.islandName });
  const allowed = [input.actorName, input.characterName, input.islandName, ...(input.targetName ? [input.targetName] : [])];
  const user =
    `Quien encarga: ${input.actorName}${input.rank ? `, ${input.rank}` : ""} (${input.factionName}). Personalidad: ${input.personality ?? "reservada"}.\n` +
    `Lugar: ${input.islandName}. Aventurero: ${input.characterName}.\n` +
    (input.targetName ? `Objetivo del encargo: acabar con ${input.targetName}${input.targetTitle ? ` (${input.targetTitle})` : ""}, que causa problemas en la isla.` : "Encargo: recorrer la isla, escuchar y traerle noticias de lo que se cuece.");
  try {
    const raw = await callOpenRouter(SYSTEM, user, { models: OPENROUTER_MODELS, timeoutMs: 30_000, maxTokens: 300, validate: (t) => t.trim().length >= 40 && t.trim().length <= 700 && inventedNames(t, allowed).length === 0 });
    return raw.trim();
  } catch (err) {
    await logError("ai/canon-brief", err, meta);
    return fallback;
  }
}

/**
 * The AI judge (replaces every dice roll): weighs what a character can really do against the difficulty and
 * what they wrote, and answers with a small JSON. The prose is written elsewhere (narrate.ts) from this result.
 * When no model answers, the fallback is the safe reading of each case, never a made-up random result.
 */
import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { logError } from "../log-error";
import { ROLE_RULES } from "./narrate-prompt";
import { difficultyLabel, parseChoiceVerdict, parseFateVerdict, parseMatchVerdict, parseOutcomeVerdict, stubFate, stubMatch, stubOutcome, type FateVerdict, type MatchVerdict, type OutcomeVerdict } from "../engine/judge";

const TIMEOUT_MS = 25_000;

const JUDGE_LAW =
  "Eres el JUEZ de un juego de rol por escrito de One Piece. NO existen los dados: decides con lógica, coherencia y justicia. " +
  "Compara lo que el personaje PUEDE hacer de verdad (nivel, atributos, Haki, fruta, arma, estilo, estado) con la dificultad de la situación y con lo que ESCRIBIÓ. " +
  "Lo que escribe el jugador es su INTENCIÓN, no un hecho: una intención verosímil y bien planteada de alguien capaz tiende a salir bien; una inverosímil o muy por encima de sus capacidades falla. " +
  "Nunca inventes acciones del personaje que el jugador no escribió. Responde ÚNICAMENTE con el JSON pedido, sin markdown. " +
  ROLE_RULES;

async function ask<T>(system: string, user: string, parse: (raw: string) => T | null, context: string, characterId?: string): Promise<T | null> {
  try {
    const raw = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, timeoutMs: TIMEOUT_MS, maxTokens: 350, temperature: 0.5, validate: (t) => parse(t) !== null });
    return parse(raw);
  } catch (err) {
    await logError(`ai/judge-${context}`, err, characterId ? { characterId } : undefined);
    return null;
  }
}

export interface OutcomeInput {
  /** What kind of thing is being decided ("un suceso al explorar", "persuadir a un candidato"...). */
  situation: string;
  actor: { name: string; level: number; kit?: string; power: number };
  /** What the player wrote, if anything. */
  intent?: string;
  /** Difficulty class 0-99 of the situation. */
  difficulty: number;
  /** What happens on each result, so the judge knows the stakes. */
  stakes?: string;
  context?: string[];
  characterId?: string;
}

/** Success, total success, failure or a bad failure. Falls back to a plain failure-safe reading when nobody answers. */
export async function judgeOutcome(input: OutcomeInput): Promise<OutcomeVerdict> {
  if (process.env.JUDGE_STUB === "1") return { outcome: stubOutcome(input.actor.power, input.difficulty), reason: "stub" };
  const system =
    JUDGE_LAW +
    ' Formato: {"resultado":"exito_total"|"exito"|"fallo"|"fallo_grave","motivo":"una frase que explique por qué"}. ' +
    "exito_total solo con un plan brillante y capacidad sobrada; fallo_grave solo con un plan absurdo o muy por encima de sus capacidades; lo normal es exito o fallo.";
  const user =
    `Situación: ${input.situation}\nDificultad: ${difficultyLabel(input.difficulty)} (${input.difficulty}/99).\n` +
    `Personaje: ${input.actor.name}, nivel ${input.actor.level}, poder ${input.actor.power}.${input.actor.kit ? `\n${input.actor.kit}` : ""}\n` +
    (input.intent ? `Lo que escribió: "${input.intent.slice(0, 1200)}"\n` : "") +
    (input.stakes ? `En juego: ${input.stakes}\n` : "") +
    (input.context?.length ? `Contexto reciente:\n${input.context.join("\n")}\n` : "");
  const v = await ask(system, user, parseOutcomeVerdict, "outcome", input.characterId);
  // Nobody answered: the safe middle, judged only by whether the character clearly outclasses the challenge.
  return v ?? { outcome: input.actor.power >= input.difficulty + 15 ? "success" : "fail", reason: "sin respuesta del juez" };
}

export interface FateInput {
  victim: { name: string; level: number; durability: number; willpower: number; faction: string; bounty?: number };
  cause: string;
  killer?: { name: string; personality?: string; faction?: string; isBoss?: boolean };
  islandName: string;
  islandDanger: number;
  companions?: string[];
  characterId?: string;
}

/** What becomes of someone who fell to 0 life against an NPC: dies, is captured, or survives. Never a coin flip. */
export async function judgeFate(input: FateInput): Promise<FateVerdict> {
  if (process.env.JUDGE_STUB === "1") {
    return { fate: stubFate({ islandDanger: input.islandDanger, level: input.victim.level, durability: input.victim.durability, killerFaction: input.killer?.faction }), reason: "stub", companionsLost: [] };
  }
  const system =
    JUDGE_LAW +
    " Decides el DESTINO de alguien que acaba de caer a 0 de vida contra un rival controlado por el juego. La muerte es real y permanente, así que solo la eliges cuando el rival tiene motivo y capacidad y es coherente con su personalidad y su facción; " +
    "un rival de la Marina o del CP-0 captura a un forajido antes que matarlo; un rival común y piadoso, o un lugar tranquilo, deja sobrevivir malherido; un enemigo despiadado en un lugar mortal puede matar. " +
    'Formato: {"destino":"muerte"|"captura"|"sobrevive","motivo":"una frase","companeros_caidos":["nombres de nakamas que mueren con él, normalmente ninguno"]}.';
  const user =
    `Caído: ${input.victim.name}, ${input.victim.faction}, nivel ${input.victim.level}, resistencia ${input.victim.durability}, voluntad ${input.victim.willpower}${input.victim.bounty ? `, recompensa ${input.victim.bounty}` : ""}.\n` +
    `Causa: ${input.cause}\nLugar: ${input.islandName} (peligro ${input.islandDanger}/10).\n` +
    (input.killer ? `Rival vencedor: ${input.killer.name}${input.killer.faction ? ` (${input.killer.faction})` : ""}${input.killer.isBoss ? ", enemigo formidable" : ""}${input.killer.personality ? `. Personalidad: ${input.killer.personality}` : ""}.\n` : "") +
    (input.companions?.length ? `Nakamas presentes: ${input.companions.join(", ")}.\n` : "");
  const v = await ask(system, user, parseFateVerdict, "fate", input.characterId);
  // Nobody answered: nobody dies on an unjudged fall.
  return v ?? { fate: "survives", reason: "sin respuesta del juez", companionsLost: [] };
}

export interface MatchFighter {
  name: string;
  level: number;
  atk: number;
  def: number;
  kit?: string;
}

/** Who wins a bout that nobody plays out (NPC vs NPC, or a player's automatic bout in the Coliseum). */
export async function judgeMatch(a: MatchFighter, b: MatchFighter, context: string, characterId?: string): Promise<MatchVerdict> {
  if (process.env.JUDGE_STUB === "1") return { winner: stubMatch(a, b), reason: "stub" };
  const system = JUDGE_LAW + ' Decides quién gana un combate de exhibición entre dos luchadores, por capacidades, nivel y estilo; el más fuerte suele ganar pero no siempre. Formato: {"ganador":"a"|"b","motivo":"una frase"}.';
  const line = (tag: string, f: MatchFighter) => `${tag}: ${f.name}, nivel ${f.level}, ataque ${f.atk}, defensa ${f.def}.${f.kit ? ` ${f.kit}` : ""}`;
  const v = await ask(system, `${context}\n${line("A", a)}\n${line("B", b)}`, parseMatchVerdict, "match", characterId);
  return v ?? { winner: stubMatch(a, b), reason: "sin respuesta del juez" };
}

/**
 * A branch in the story that an NPC decides (does the spared enemy repay the favour or betray it?). The judge picks one of
 * the offered ids from who the character is; the first option is the default when nobody answers.
 */
export async function judgeChoice<T extends string>(situation: string, options: { id: T; label: string }[], characterId?: string): Promise<T> {
  if (process.env.JUDGE_STUB === "1") return options[0].id;
  const system = JUDGE_LAW + ' Eliges UNA opción de la lista según la personalidad y los motivos del personaje. Formato: {"eleccion":"id","motivo":"una frase"}.';
  const user = `${situation}\nOpciones:\n${options.map((o) => `- ${o.id}: ${o.label}`).join("\n")}`;
  const ids = options.map((o) => o.id);
  const v = await ask(system, user, (raw) => parseChoiceVerdict(raw, ids), "choice", characterId);
  return v?.choice ?? options[0].id;
}

import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { logError } from "../log-error";
import { NPC_RIVALS, parseTrialScores, stubTrialScores, type JudgedEntry } from "../engine/player-events";

export interface EventDraft {
  title: string;
  description: string;
  islandName: string;
  rivals: { name: string; concept: string; level: number }[];
}

export interface EventInput {
  islands: { name: string; danger: number }[];
  recentTitles: string[];
  maxLevel: number;
  fruit: { name: string; description: string } | null;
  idea?: string | null;
  forceIsland?: string | null;
}

const EVENT_SYSTEM =
  "Eres el organizador de eventos de un mundo de One Piece en español. Inventas una PRUEBA original y atractiva para aventureros de nivel bajo: un torneo de cocina pirata, una cacería en la jungla, un rescate, una carrera, un enigma, una pesca legendaria, un duelo de ingenio... lo que se te ocurra, sorpréndeme. " +
  "La prueba se resuelve escribiendo cómo la afrontas (no hay dados: un juez lee los intentos), así que debe poder resolverse con imaginación, plan y habilidades del personaje. " +
  "Reglas: nada de muertes ni capturas de personajes canon; el premio lo fija el sistema (no lo inventes); sitúalo en UNA isla de la lista, tal cual se llama; da nombres propios a los personajes nuevos. " +
  "Incluye 3 rivales NPC con un nombre propio, un concepto de cómo afrontarían la prueba y un nivel razonable para la banda. " +
  'Responde SOLO JSON: {"title":"título corto","island":"nombre exacto","description":"anuncio de 80 a 160 palabras que explique la prueba y qué debe escribir el participante","rivals":[{"name":"","concept":"","level":3}]}.';

export function parseEventDraft(raw: string, islandNames: string[], maxLevel: number): EventDraft | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    const o = JSON.parse(a >= 0 && b > a ? cleaned.slice(a, b + 1) : cleaned) as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    if (title.length < 4 || description.length < 60) return null;
    const wanted = typeof o.island === "string" ? o.island.trim().toLowerCase() : "";
    const islandName = islandNames.find((n) => n.toLowerCase() === wanted);
    if (!islandName) return null;
    const rivals = (Array.isArray(o.rivals) ? o.rivals : [])
      .map((r) => {
        const x = r as Record<string, unknown>;
        const name = typeof x.name === "string" ? x.name.trim().slice(0, 40) : "";
        const concept = typeof x.concept === "string" ? x.concept.trim().slice(0, 240) : "";
        const level = typeof x.level === "number" ? Math.max(1, Math.min(maxLevel, Math.round(x.level))) : Math.max(1, Math.round(maxLevel / 2));
        return { name, concept, level };
      })
      .filter((r) => r.name && r.concept)
      .slice(0, NPC_RIVALS);
    if (rivals.length === 0) return null;
    return { title: title.slice(0, 90), description: description.slice(0, 1400), islandName, rivals };
  } catch {
    return null;
  }
}

/** Offline draft, also used by scripted checks (EVENT_STUB=1). */
export function stubEvent(input: EventInput): EventDraft {
  const island = input.forceIsland ?? input.islands[0]?.name ?? "Pueblo Foosha";
  return {
    title: input.idea?.trim() ? input.idea.trim().slice(0, 60) : "La gran prueba del puerto",
    islandName: island,
    description: `${input.idea?.trim() || "Los vecinos de la isla organizan una prueba abierta a los recién llegados"}. Cada participante debe escribir cómo la afronta: su plan, sus habilidades y cómo sortea los imprevistos. Gana quien mejor la resuelva; hay premio para el vencedor y algo de consuelo para quien la termine.`,
    rivals: [
      { name: "Tobías Ola-Brava", concept: "Muchacho impulsivo que confía en su fuerza", level: Math.max(1, Math.round(input.maxLevel / 2)) },
      { name: "Marga la Zurda", concept: "Astuta pescadora que prepara trampas y atajos", level: Math.max(1, Math.round(input.maxLevel / 2)) },
      { name: "Bruno el Tranquilo", concept: "Veterano paciente que estudia antes de actuar", level: Math.max(1, Math.round(input.maxLevel / 2) + 1) },
    ],
  };
}

export async function inventEvent(input: EventInput): Promise<EventDraft> {
  if (process.env.EVENT_STUB === "1") return stubEvent(input);
  const user =
    `Islas del mundo:\n${input.islands.map((i) => `- ${i.name} (peligro ${i.danger})`).join("\n")}\n\n` +
    `Banda de nivel del evento: hasta nivel ${input.maxLevel}.\n` +
    `Eventos recientes (NO los repitas):\n${input.recentTitles.length ? input.recentTitles.map((t) => `- ${t}`).join("\n") : "- (ninguno)"}\n` +
    (input.fruit ? `El premio incluye una fruta del Diablo única: «${input.fruit.name}» — ${input.fruit.description}. Diseña la prueba para que encaje con ese poder (sin nombrarlo en el anuncio si prefieres que sea sorpresa).\n` : "") +
    (input.forceIsland ? `Debe ocurrir en: ${input.forceIsland}.\n` : "") +
    (input.idea ? `Idea del organizador a desarrollar: ${input.idea}\n` : "");
  const names = input.islands.map((i) => i.name);
  try {
    const raw = await callOpenRouter(EVENT_SYSTEM, user, { models: OPENROUTER_MODELS, jsonMode: true, timeoutMs: 75_000, maxTokens: 1200, validate: (t) => parseEventDraft(t, names, input.maxLevel) !== null });
    const draft = parseEventDraft(raw, names, input.maxLevel);
    if (draft) return input.forceIsland && draft.islandName !== input.forceIsland ? { ...draft, islandName: input.forceIsland } : draft;
  } catch (err) {
    await logError("ai/player-event-invent", err, {});
  }
  return stubEvent(input);
}

export interface TrialEntry {
  name: string;
  level: number;
  isNpc: boolean;
  concept?: string | null;
  sheet?: string | null;
  text: string | null;
}

const TRIAL_SYSTEM =
  "Eres el juez imparcial de una prueba en un mundo de One Piece. Recibes el anuncio de la prueba y los intentos de cada participante (los humanos escribieron su intento; los NPC tienen un concepto y un nivel). " +
  "Puntúa a CADA uno de 0 a 100 según: originalidad y plan, ajuste a lo que su personaje puede hacer de verdad (nivel, habilidades y equipo que figuran en su ficha; si se inventa poderes que no tiene, penaliza), coherencia con la prueba y cómo resuelve los imprevistos. " +
  "NO premies la longitud por sí sola ni tu simpatía: sé justo y exigente, distingue bien a los buenos de los mediocres, y no des puntuaciones iguales si hay diferencia. Los NPC puntúan según su concepto y nivel, con la misma vara. " +
  'Responde SOLO JSON: {"resultados":[{"indice":0,"puntos":0-100,"motivo":"una frase"}]} con una entrada por participante, usando el índice dado.';

export async function judgeTrial(title: string, description: string, entries: TrialEntry[]): Promise<JudgedEntry[] | null> {
  if (process.env.JUDGE_STUB === "1") return stubTrialScores(entries);
  const user =
    `PRUEBA: ${title}\n${description}\n\nPARTICIPANTES:\n` +
    entries.map((e, i) => `[${i}] ${e.name} (nivel ${e.level}, ${e.isNpc ? "NPC" : "jugador"})${e.sheet ? `\nFicha: ${e.sheet}` : ""}${e.isNpc ? `\nConcepto: ${e.concept ?? ""}` : `\nIntento: ${e.text ?? ""}`}`).join("\n\n");
  try {
    const raw = await callOpenRouter(TRIAL_SYSTEM, user, { models: OPENROUTER_MODELS, jsonMode: true, timeoutMs: 75_000, maxTokens: 1200, validate: (t) => parseTrialScores(t, entries.length) !== null });
    return parseTrialScores(raw, entries.length);
  } catch (err) {
    await logError("ai/player-event-judge", err, {});
    return null;
  }
}

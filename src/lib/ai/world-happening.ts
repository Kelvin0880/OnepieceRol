import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { logError } from "../log-error";
import { allowedNamesEverywhere } from "../game/island-npcs";
import { inventedNames } from "../engine/island-npc";
import { parseHappening, type Happening, type HappeningSeed } from "../engine/world-happenings";

export interface HappeningInput {
  islands: { name: string; sea: string; danger: number; control: string | null; residents?: string[] }[];
  recentHeadlines: string[];
  seeds: HappeningSeed[];
  heat: number;
  /** The owner's own idea to develop (admin panel); the AI writes it up as a news item instead of inventing from scratch. */
  idea?: string | null;
  forceIsland?: string | null;
}

const SYSTEM =
  "Eres el narrador de un mundo vivo de One Piece en español. Cada día inventas UN suceso nuevo, original e interesante en una isla del mundo. " +
  "Puede ser de cualquier tipo: fiestas, catástrofes, hallazgos, crímenes, mercados, criaturas, misterios, política, romances, inventos, rumores, competiciones, milagros... Sé creativo y sorprendente, no genérico. " +
  "Reglas duras: (1) No mates, captures ni derroques a ningún personaje canon (Luffy, Shanks, Barbanegra, almirantes, etc.); puedes mencionarlos de pasada, pero sin hechos permanentes. " +
  "(2) No entregues frutas del diablo, armas ni objetos concretos a nadie: es una noticia, no un premio. (3) NO inventes personajes con nombre: los protagonistas del suceso son SOLO habitantes de la lista de la isla elegida (con su oficio) o gente anónima (\"un pescador\"). Nunca mates ni captures a un habitante en la noticia. " +
  "(4) Sitúalo en UNA isla de la lista, tal cual se llama. (5) Que sea un gancho: algo que un aventurero en esa isla querría investigar. (6) No repitas los sucesos recientes ni su tipo. " +
  'Responde SOLO JSON: {"kind":"tipo en 1-3 palabras","island":"nombre exacto de la isla","headline":"titular corto","body":"noticia de 80 a 160 palabras"}.';

export async function inventHappening(input: HappeningInput): Promise<Happening | null> {
  const user =
    `Islas del mundo:\n${input.islands.map((i) => `- ${i.name} (${i.sea}, peligro ${i.danger}${i.control ? `, controla: ${i.control}` : ""})${i.residents?.length ? ` — habitantes: ${i.residents.join("; ")}` : ""}`).join("\n")}\n\n` +
    `Tensión general del mundo: ${input.heat}/100.\n` +
    `Sucesos recientes (NO los repitas ni su tipo):\n${input.recentHeadlines.length ? input.recentHeadlines.map((h) => `- ${h}`).join("\n") : "- (ninguno todavía)"}\n\n` +
    `Ideas de tipo, solo como inspiración (mejor inventa algo propio): ${input.seeds.map((s) => s.kind).join(", ")}.` +
    (input.idea ? `\n\nEL DUEÑO DEL JUEGO PROPONE ESTE SUCESO, DESARROLLALO fielmente (respetando las reglas duras): ${input.idea}` : "") +
    (input.forceIsland ? `\nDebe ocurrir en: ${input.forceIsland}.` : "");
  const allowed = await allowedNamesEverywhere().catch(() => [] as string[]);
  try {
    const raw = await callOpenRouter(SYSTEM, user, {
      models: OPENROUTER_MODELS,
      jsonMode: true,
      timeoutMs: 75_000,
      maxTokens: 900,
      validate: (t) => { const h = parseHappening(t, input.islands.map((i) => i.name)); return h !== null && inventedNames(`${h.headline} ${h.body}`, allowed).length === 0; },
    });
    const h = parseHappening(raw, input.islands.map((i) => i.name));
    return h && input.forceIsland ? { ...h, islandName: input.forceIsland } : h;
  } catch (err) {
    await logError("ai/world-happening", err, {});
    return null;
  }
}

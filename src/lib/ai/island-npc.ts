import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { logError } from "../log-error";
import { parseGeneratedNpc, type GeneratedNpc, type IslandNpcRow } from "../engine/island-npc";

const STYLE =
  "Escribes en español para un juego de rol de One Piece. Personajes de RELLENO de una isla: gente corriente del lugar (no héroes ni personajes canon del manga), con nombre propio original con sabor One Piece, un oficio claro, una personalidad marcada y una pequeña historia. ";

const SUCCESSOR_SYSTEM =
  STYLE +
  "Un habitante murió y su puesto queda libre: inventa a su SUCESOR, alguien distinto (otro nombre, otro aspecto, otra manía) que hace el mismo trabajo y encaja con el ambiente de la isla. No tiene relación de sangre con el muerto salvo que sea natural. " +
  'Responde SOLO JSON: {"name":"Nombre Apellido o apodo","title":"oficio y lugar","description":"2-3 frases de aspecto, pasado y manías","personality":"1-2 frases de cómo habla y actúa","weapon":"arma o herramienta que usa, o vacío","abilities":["hasta 3 cosas que sabe hacer en una pelea, acordes a un habitante normal"]}.';

export async function generateSuccessor(p: { islandName: string; islandDescription: string; dead: IslandNpcRow; takenNames: Set<string> }): Promise<GeneratedNpc | null> {
  const user =
    `Isla: ${p.islandName}. ${p.islandDescription}\n` +
    `Puesto: ${p.dead.title} (categoría ${p.dead.category}, nivel ${p.dead.level}).\n` +
    `Murió: ${p.dead.name} — ${p.dead.description}${p.dead.diedNote ? ` (${p.dead.diedNote})` : ""}.\n` +
    `Nombres ya usados (no repitas ninguno): ${[...p.takenNames].slice(0, 80).join(", ")}.`;
  try {
    const raw = await callOpenRouter(SUCCESSOR_SYSTEM, user, { models: OPENROUTER_MODELS, jsonMode: true, timeoutMs: 45_000, maxTokens: 500, validate: (t) => parseGeneratedNpc(t, p.takenNames) !== null });
    return parseGeneratedNpc(raw, p.takenNames);
  } catch (err) {
    await logError("ai/island-npc-successor", err, { island: p.islandName });
    return null;
  }
}

export interface SeedNpc extends GeneratedNpc {
  slot: string;
  category: string;
  level: number;
}

const ROSTER_SYSTEM =
  STYLE +
  "Para la isla dada, escribe su REPARTO DE RELLENO fijo: entre 6 y 9 personajes con oficio distinto que un aventurero puede encontrar (tabernero, guardias, matones, marines o piratas del lugar, comerciantes, un funcionario, gente con historias, etc.). " +
  "Incluye a TODOS los personajes secundarios que menciona la descripción o el gancho de la isla, con su nombre si lo tienen, y completa con gente nueva. Al menos dos deben poder pelear (categorías guard, thug, marine o pirate). " +
  "Nunca uses personajes canon del manga ni nombres de la lista de prohibidos. Los niveles deben ser coherentes con el peligro de la isla (peligro 1 = niveles 1-4; peligro 5 = 8-16; peligro 9-10 = 30-50). " +
  'Responde SOLO JSON: {"npcs":[{"slot":"clave-corta-sin-espacios","name":"...","title":"oficio y lugar","category":"guard|thug|civilian|merchant|marine|pirate|official|other","level":3,"description":"2-3 frases","personality":"1-2 frases","weapon":"","abilities":["..."]}]}.';

export function parseRoster(raw: string, taken: Set<string>): SeedNpc[] | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]) as { npcs?: Record<string, unknown>[] };
    if (!Array.isArray(v.npcs)) return null;
    const out: SeedNpc[] = [];
    const seen = new Set(taken);
    const slots = new Set<string>();
    for (const n of v.npcs) {
      const base = parseGeneratedNpc(JSON.stringify(n), seen);
      if (!base) continue;
      const slot = String(n.slot ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || `puesto-${out.length + 1}`;
      const category = ["guard", "thug", "civilian", "merchant", "marine", "pirate", "official", "other"].includes(String(n.category)) ? String(n.category) : "other";
      const level = Math.max(1, Math.min(60, Math.round(Number(n.level) || 2)));
      let s = slot;
      for (let i = 2; slots.has(s); i++) s = `${slot}-${i}`;
      slots.add(s);
      seen.add(base.name);
      out.push({ ...base, slot: s, category, level });
    }
    return out.length >= 4 ? out.slice(0, 16) : null;
  } catch {
    return null;
  }
}

export async function generateIslandRoster(p: { name: string; description: string; arcHook: string | null; danger: number; control: string | null; forbidden: string[]; extra?: string }): Promise<SeedNpc[] | null> {
  const user =
    `Isla: ${p.name}. Peligro ${p.danger}/10${p.control ? `, controla: ${p.control}` : ""}.\nDescripción: ${p.description}\nGancho actual: ${p.arcHook ?? "(ninguno)"}\n` +
    `Nombres prohibidos (canon o ya usados): ${p.forbidden.slice(0, 250).join(", ")}.` + (p.extra ? `
${p.extra}` : "");
  const taken = new Set(p.forbidden);
  try {
    const raw = await callOpenRouter(ROSTER_SYSTEM, user, { models: OPENROUTER_MODELS, jsonMode: true, timeoutMs: 90_000, maxTokens: 2600, validate: (t) => parseRoster(t, taken) !== null });
    return parseRoster(raw, taken);
  } catch (err) {
    await logError("ai/island-roster", err, { island: p.name });
    return null;
  }
}


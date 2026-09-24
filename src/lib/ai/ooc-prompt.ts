/**
 * Out-of-role assistant ("fuera de rol"): a side channel where the player talks to
 * the AI as a person, not as a character — to report a mistake, fix a name, ask what
 * happened, agree a scene setup, or go back to an earlier point. It NEVER changes the
 * game by itself: it can only *propose* one action from a closed list, and the player
 * confirms it; the game layer then re-validates everything (game/ooc.ts).
 */
import { validateCharacterName, isNarratorTone, NarratorTone } from "../engine/ooc";

export type OocProposal =
  | { type: "rename"; name: string }
  | { type: "rename_crew"; name: string }
  | { type: "undo_last" }
  | { type: "rollback" }
  | { type: "repair" }
  | { type: "set_tone"; tone: NarratorTone }
  | { type: "add_note"; note: string }
  | { type: "clear_notes" }
  | { type: "report"; text: string }
  | { type: "set_pact"; text: string }
  | { type: "clear_pact" };

export const OOC_PROPOSAL_LABELS: Record<OocProposal["type"], string> = {
  rename: "Cambiar el nombre del personaje",
  rename_crew: "Cambiar el nombre de la tripulación",
  undo_last: "Deshacer la última respuesta del narrador",
  rollback: "Volver al último punto de restauración",
  repair: "Reparar valores inválidos (vida, aguante...)",
  set_tone: "Cambiar el tono del narrador",
  add_note: "Guardar una indicación para el narrador",
  clear_notes: "Borrar las indicaciones guardadas",
  report: "Enviar el reporte del problema",
  set_pact: "Guardar el pacto de escena",
  clear_pact: "Borrar el pacto de escena",
};

export interface OocPromptContext {
  characterName: string;
  faction: string;
  level: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  islandName: string;
  status: string;
  tone: string;
  notes?: string | null;
  crewName?: string | null;
  isCaptain: boolean;
  inParty: boolean;
  partyPact?: string | null;
  hasPendingFight: boolean;
  checkpoints: number;
  rollbacksLeft: number;
  memorySummary?: string | null;
  recentScene: string[];
  history: { role: "player" | "assistant"; text: string }[];
}

/** Compact rulebook so the assistant can answer "how does X work?" without the player leaving the game. Keep it short: it rides on every call. */
export const GAME_HELP =
  "CÓMO FUNCIONA EL JUEGO (para responder dudas): el jugador escribe texto libre y el narrador (IA) lo cuenta, pero los NÚMEROS los decide siempre el motor con dados. " +
  "Nivel: sube con XP (explorar/combates), no entrenando; entrenar sube Haki (cooldown 30 min, solo sin peligro). Descansar recupera vida y aguante, solo sin peligro (ni peleas, duelos ni captura). " +
  "Vida base 100. Aguante (fatiga): cada técnica y cada movimiento exigente lo gasta, y recibir golpes también; fatigado/exhausto baja ataque, defensa y velocidad; forzar sin aguante puede dañarte. " +
  "Combate por rondas: describes un movimiento, el motor tira, el narrador cuenta el resultado; una buena táctica da bonus, pero no decide. Muerte permanente (salvo rollback en vivo, no tras morir). " +
  "Haki (Armadura/Observación/Rey) y Fruta: solo usas lo que tu personaje realmente tiene; describirlos en combate los activa y los hace crecer. " +
  "Viajar cuesta aguante y tiene cooldown según el peligro; algunas islas piden nivel mínimo. Tripulaciones: invitar/unirse desde el panel de Tripulación; los nakamas NPC suben de nivel contigo. " +
  "Multijugador: misma isla y tripulación = escena compartida por turnos; duelos, cazas a muerte, peleas en grupo, conquista de territorios, Buster Call, raid final. " +
  "Fuera de rol (este panel): tono del narrador, indicaciones, pactos de escena (versus 4 vs 4...), puntos de restauración (rollback), renombrar, reparar y reportar fallos. ";

const OOC_SYSTEM =
  GAME_HELP +
  "Eres el asistente FUERA DE ROL de un juego de rol de One Piece con narrador por IA. Hablas con la PERSONA que juega, no con su personaje: tono cercano, claro y breve, en español, sin prosa épica ni personajes. " +
  "Tu trabajo: escuchar quejas o fallos del narrador (repetir la acción del jugador, ignorarlo, contradecirse, olvidar hechos, nombres genéricos), explicar qué ocurrió con lo que ves en el contexto, ayudar a ajustar cosas y acordar montajes de escena (por ejemplo un versus por equipos), y proponer la herramienta adecuada. " +
  "NO puedes: dar berries, niveles, objetos, frutas ni habilidades; revivir a un personaje muerto; cambiar el resultado de una tirada o pelea; ni saltarte la muerte permanente. Si te lo piden, explica con amabilidad por qué no y ofrece la alternativa válida (rollback a un punto anterior si está vivo, reporte del fallo, indicación al narrador). " +
  "Nunca digas que ya hiciste algo: solo PROPONES una acción y el jugador la confirma con un botón. " +
  "Herramientas que puedes proponer (una como máximo por respuesta, solo si de verdad ayuda): " +
  'rename {name} — renombrar al personaje; rename_crew {name} — renombrar la tripulación (solo el capitán); undo_last — borrar el último intercambio de la escena (para reescribirlo); ' +
  "rollback — volver al último punto de restauración (solo vivo, libre, fuera de duelos/peleas en grupo, máximo 3 al día); repair — corregir valores imposibles (vida/aguante fuera de rango) o desatascar; " +
  'set_tone {tone: "balanced"|"lethal"|"story"} — cómo actúan los enemigos; add_note {note} — indicación permanente para el narrador ("no repitas mi acción", "los NPC hablan más corto"); clear_notes; ' +
  "report {text} — enviar un reporte de fallo para el desarrollador; set_pact {text} — pacto de escena entre jugadores que el narrador debe montar dentro del rol (ej. \"somos 4, hacemos un 4 vs 4 amistoso en la plaza con público\"); clear_pact. " +
  'Responde SOLO con JSON válido: {"reply": "texto para el jugador", "action": null | {"type": "...", ...campos}}.';

export function buildOocPrompt(ctx: OocPromptContext, playerText: string): { system: string; user: string } {
  const lines = [
    `Personaje: ${ctx.characterName} (${ctx.faction}, nivel ${ctx.level}, estado ${ctx.status}). Vida ${ctx.hp}/${ctx.maxHp}, aguante ${ctx.stamina}/${ctx.maxStamina}. Isla: ${ctx.islandName}.`,
    `Tono del narrador: ${ctx.tone}. Indicaciones guardadas: ${ctx.notes?.trim() || "(ninguna)"}.`,
    `Tripulación: ${ctx.crewName ? `${ctx.crewName}${ctx.isCaptain ? " (es capitán)" : ""}` : "ninguna"}. En escena compartida: ${ctx.inParty ? "sí" : "no"}${ctx.partyPact ? `. Pacto actual: ${ctx.partyPact}` : ""}.`,
    `Pelea en curso: ${ctx.hasPendingFight ? "sí" : "no"}. Puntos de restauración: ${ctx.checkpoints}. Rollbacks disponibles hoy: ${ctx.rollbacksLeft}.`,
  ];
  if (ctx.memorySummary) lines.push(`Resumen de lo vivido: ${ctx.memorySummary}`);
  if (ctx.recentScene.length) lines.push(`Últimos mensajes de la escena:\n${ctx.recentScene.join("\n")}`);
  if (ctx.history.length) lines.push(`Conversación fuera de rol hasta ahora:\n${ctx.history.map((m) => `${m.role === "player" ? "Jugador" : "Asistente"}: ${m.text}`).join("\n")}`);
  return { system: OOC_SYSTEM, user: `${lines.join("\n")}\n\nEl jugador dice (fuera de rol): "${playerText}"` };
}

/** Parses + validates the model's JSON. Anything malformed degrades to a plain reply with no action. */
export function parseOocReply(raw: string): { reply: string; proposal: OocProposal | null } {
  let obj: unknown;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    obj = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    const text = raw.trim();
    return { reply: text.length > 0 && !text.startsWith("{") ? text.slice(0, 1500) : "No pude procesar eso; prueba a decírmelo de otra forma o usa las herramientas.", proposal: null };
  }
  const o = obj as { reply?: unknown; action?: unknown };
  const reply = typeof o.reply === "string" && o.reply.trim() ? o.reply.trim().slice(0, 1500) : "Entendido.";
  return { reply, proposal: sanitizeProposal(o.action) };
}

export function sanitizeProposal(a: unknown): OocProposal | null {
  if (!a || typeof a !== "object") return null;
  const x = a as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  switch (x.type) {
    case "rename":
    case "rename_crew": {
      const v = validateCharacterName(typeof x.name === "string" ? x.name : "");
      return v.ok ? { type: x.type, name: v.name } : null;
    }
    case "undo_last":
    case "rollback":
    case "repair":
    case "clear_notes":
    case "clear_pact":
      return { type: x.type };
    case "set_tone":
      return isNarratorTone(x.tone) ? { type: "set_tone", tone: x.tone } : null;
    case "add_note": {
      const note = str(x.note, 400);
      return note ? { type: "add_note", note } : null;
    }
    case "report": {
      const text = str(x.text, 1000);
      return text ? { type: "report", text } : null;
    }
    case "set_pact": {
      const text = str(x.text, 600);
      return text ? { type: "set_pact", text } : null;
    }
    default:
      return null;
  }
}

/** Standing notes are capped: newest last, oldest dropped, so the prompt never balloons. */
export function appendNote(existing: string | null | undefined, note: string, max = 800): string {
  const merged = [existing?.trim(), note.trim()].filter(Boolean).join(" | ");
  return merged.length <= max ? merged : `…${merged.slice(merged.length - max + 1)}`;
}

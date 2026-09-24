export type BeatKind = "chat" | "action" | "combat_round" | "combat_end" | "intro" | "recruit" | "group" | "briefing";

export interface LengthPlan {
  label: "breve" | "media" | "larga";
  maxWords: number;
  maxTokens: number;
  instruction: string;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * How long the narrator's reply should be. The player's own effort sets the
 * baseline (a one-line question gets a short answer, a long developed post can
 * get a longer one) and the kind of beat only nudges it — a fight round stays
 * tight, a finishing blow or a group scene earns more room. Never above ~300
 * words: long is the exception, not the default.
 */
export function planLength(kind: BeatKind, playerText: string): LengthPlan {
  const w = countWords(playerText);
  let maxWords: number;
  if (w <= 15) maxWords = 70;
  else if (w <= 45) maxWords = 120;
  else if (w <= 110) maxWords = 190;
  else maxWords = 260;

  switch (kind) {
    case "combat_round":
      maxWords = Math.min(maxWords, 130);
      break;
    case "combat_end":
    case "group":
      maxWords = Math.max(maxWords, 150);
      break;
    case "intro":
    case "recruit":
      maxWords = Math.min(maxWords, 110);
      break;
    case "briefing":
      maxWords = 220;
      break;
    case "action":
      maxWords += 20;
      break;
    case "chat":
      break;
  }
  maxWords = Math.min(maxWords, 300);

  const label = maxWords <= 90 ? "breve" : maxWords <= 160 ? "media" : "larga";
  const paragraphs = label === "breve" ? "1 o 2 párrafos cortos" : label === "media" ? "2 o 3 párrafos cortos" : "hasta 4 párrafos cortos";
  const instruction =
    `EXTENSIÓN DE ESTA RESPUESTA: ${label}, ${paragraphs}, alrededor de ${maxWords} palabras como máximo. ` +
    "Responde con lo justo: una acción simple o una pregunta merece una respuesta corta y directa. " +
    "Solo te alargas cuando el momento lo pide de verdad (un giro importante, el final de una pelea, algo que el jugador desarrolló con detalle). " +
    "Lenguaje sencillo y claro, frases cortas, sin metáforas recargadas ni descripciones de cielo, olores o ambiente que no aporten nada.";
  return { label, maxWords, maxTokens: Math.round(maxWords * 2.6) + 80, instruction };
}

/**
 * The player's message of THIS turn, placed last and framed so the model
 * answers it and not an earlier line of the transcript, taking it literally.
 */
export function currentActionBlock(playerText: string, who = "El jugador"): string {
  return (
    `\n\nACCIÓN ACTUAL (responde a ESTO ahora, no a mensajes anteriores). ${who} escribe:\n"""\n${playerText.trim()}\n"""\n` +
    "Tómalo literalmente: es exactamente lo que hace y dice el personaje. No le añadas contexto, intenciones, emociones ni acciones que no escribió, y no lo reinterpretes. " +
    "Si pregunta algo a un NPC, ese NPC contesta. Si se va, se va. Narra solo la consecuencia directa y deja que el jugador siga."
  );
}

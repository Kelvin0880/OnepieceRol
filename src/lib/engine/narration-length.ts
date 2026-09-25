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
 * How long the narrator's reply should be. The owner ordered that the AI is never held back (2026-09-25): the reply
 * matches the player's own effort (a one-line question naturally gets a short answer, a long structured post gets a long,
 * detailed one) and a fight is never trimmed: rival attacks and results may be as long and structured as the scene needs.
 */
export function planLength(kind: BeatKind, playerText: string): LengthPlan {
  const w = countWords(playerText);
  let maxWords: number;
  if (w <= 15) maxWords = 100;
  else if (w <= 45) maxWords = 220;
  else if (w <= 110) maxWords = 400;
  else if (w <= 250) maxWords = 650;
  else maxWords = 900;

  switch (kind) {
    case "combat_round":
      maxWords = Math.max(maxWords, 550);
      break;
    case "combat_end":
    case "group":
      maxWords = Math.max(maxWords, 450);
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
  maxWords = Math.min(maxWords, 1000);

  const label = maxWords <= 120 ? "breve" : maxWords <= 300 ? "media" : "larga";
  const paragraphs = label === "breve" ? "1 o 2 párrafos" : label === "media" ? "2 a 4 párrafos" : "los párrafos que la escena necesite (6 o más si hace falta)";
  const instruction =
    `EXTENSIÓN DE ESTA RESPUESTA: ${label}, ${paragraphs}; hasta unas ${maxWords} palabras si la escena lo pide. ` +
    "NUNCA te limites ni recortes: iguala el nivel de detalle y de estructura de lo que escribió el jugador (si desarrolla algo largo y planificado, responde con la misma riqueza), y una pregunta simple merece naturalmente una respuesta directa. " +
    "Lenguaje claro, sin relleno ni descripciones de ambiente que no aporten nada.";
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

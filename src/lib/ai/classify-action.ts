import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";

/**
 * Free text now decides which mechanical action fires — in a game with
 * real permadeath, a wrong guess is a real-state-changing mistake, not a
 * cosmetic one. So this classifier is deliberately conservative:
 *
 *  - The model is only ever offered the actions that are actually valid
 *    for the character's current state (e.g. only "engage"/"flee" during
 *    a pending threat) — it cannot return something that wouldn't make
 *    sense right now.
 *  - Whatever it returns is re-validated against that same set in code;
 *    anything else becomes "unclear".
 *  - "unclear" (the model genuinely can't tell) is NEVER guessed at via
 *    keywords — it's a real no-op, the player is asked to rephrase.
 *  - The keyword fallback below fires ONLY when the OpenRouter call
 *    itself fails outright (network/timeout/all models down) — it's a
 *    last-resort "keep the game playable during an outage" path, not a
 *    substitute for the model's judgment on ambiguous phrasing it did
 *    manage to see.
 */
export type ActionId = "explore" | "train" | "rest" | "travel" | "engage" | "flee" | "mercy_spare" | "mercy_finish";

export interface ClassifyResult {
  action: ActionId | "unclear";
  source: "ai" | "keyword_fallback";
}

const KEYWORD_RULES: Array<{ action: ActionId; pattern: RegExp }> = [
  { action: "flee", pattern: /huy|corr|escap|retroced/i },
  { action: "engage", pattern: /atac|luch|pele|golpe|desenfund|ataco/i },
  { action: "mercy_spare", pattern: /perdon|deja.*vivir|suelt|no lo mat/i },
  { action: "mercy_finish", pattern: /remat|acaba con|elimin|termina con|\bmata\b/i },
  { action: "train", pattern: /entrena|practic/i },
  { action: "rest", pattern: /descans|duerm/i },
  { action: "travel", pattern: /viaj|zarp|navega|parte hacia/i },
  { action: "explore", pattern: /explor|camin|voy a|investiga|busca|recorr/i },
];

function keywordClassify(freeText: string, validActions: ActionId[]): ActionId | "unclear" {
  for (const rule of KEYWORD_RULES) {
    if (validActions.includes(rule.action) && rule.pattern.test(freeText)) return rule.action;
  }
  return "unclear";
}

function buildClassifyPrompt(freeText: string, validActions: ActionId[]): { system: string; user: string } {
  const system =
    "Clasificas la acción de un jugador de un rol de texto en una de las acciones válidas. " +
    `Responde EXCLUSIVAMENTE con un objeto JSON como {"action": "..."} usando uno de estos valores exactos: ${validActions.join(", ")}, ` +
    'o {"action": "unclear"} solo si el texto realmente no tiene relación con ninguna. ' +
    "Sé generoso interpretando: cualquier texto que describa moverse, buscar, investigar o merodear cuenta como explore; " +
    "cualquier texto agresivo o de combate cuenta como engage; cualquier texto de escapar/correr cuenta como flee. " +
    "No añadas explicación, ni markdown, ni texto extra: responde solo el JSON, nada más.";
  const user = `Acciones válidas ahora mismo: ${validActions.join(", ")}.\nTexto del jugador: "${freeText}"`;
  return { system, user };
}

function parseClassifyResponse(raw: string, validActions: ActionId[]): ActionId | "unclear" {
  try {
    const parsed = JSON.parse(raw);
    const action = parsed?.action;
    if (typeof action === "string" && validActions.includes(action as ActionId)) return action as ActionId;
    return "unclear";
  } catch {
    return "unclear";
  }
}

/**
 * `openrouter/free` (first in the fallback list) picks a random free model
 * per call, so quality varies call to call — a weak pick can misfire on
 * clearly-phrased text. One retry (still AI-only, still validated the same
 * way) meaningfully improves reliability without weakening the safety
 * contract: "unclear" is only final after two genuine attempts.
 */
const MAX_ATTEMPTS = 2;

export async function classifyPlayerAction(freeText: string, validActions: ActionId[]): Promise<ClassifyResult> {
  if (validActions.length === 0) return { action: "unclear", source: "ai" };

  const { system, user } = buildClassifyPrompt(freeText, validActions);
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, jsonMode: true, temperature: 0.1, timeoutMs: 8_000 });
      const action = parseClassifyResponse(raw, validActions);
      if (action !== "unclear") return { action, source: "ai" };
    }
    return { action: "unclear", source: "ai" };
  } catch {
    // The OpenRouter call itself failed (network/timeout/all models down) —
    // this is the only case the keyword fallback exists for.
    return { action: keywordClassify(freeText, validActions), source: "keyword_fallback" };
  }
}

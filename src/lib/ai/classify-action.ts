import { callOpenRouter } from "./openrouter-client";
import { OPENROUTER_MODELS } from "./models";
import { EnemyTier, isEnemyTier } from "../engine/scene-enemy";
import { TechniqueId, isTechniqueId } from "../engine/techniques";

/**
 * Free text now decides which mechanical action fires — in a game with
 * real permadeath, a wrong guess is a real-state-changing mistake, not a
 * cosmetic one. So this classifier is deliberately conservative where it
 * matters and deliberately generous everywhere else:
 *
 *  - The model is only ever offered the actions that are actually valid
 *    for the character's current state (e.g. only "engage"/"flee" during
 *    a pending threat) — it cannot return something that wouldn't make
 *    sense right now.
 *  - Whatever it returns is re-validated against that same set in code;
 *    anything else becomes "unclear".
 *  - During a pending threat/mercy choice (a real binary, permadeath-
 *    adjacent decision), "unclear" stays a genuine no-op — the player is
 *    asked to rephrase rather than have the game guess fight-or-flee.
 *  - Outside combat there are two non-mechanical-vs-mechanical buckets:
 *    "narrate" (default) is pure roleplay/chat — the AI just reacts in
 *    character, no engine call, no stat change, zero risk of a wrong
 *    numeric outcome because there isn't one. "explore" is reserved for
 *    text that reads as a real decisive commitment — pushing forward,
 *    investigating something risky, seeking out danger or opportunity —
 *    which does call the engine and can cost HP/grant rewards. This split
 *    exists because two different asks converged on it: (a) a live bug
 *    where a bar/social scene got rejected outright for not matching a
 *    narrow "explore" keyword set, and (b) the user explicitly wanting
 *    mechanical resolution to happen only when THEY commit to it, not on
 *    every conversational beat. "narrate" being the default (not
 *    "explore") solves both: free-roam text always gets a reply instead
 *    of "no entendí", and it no longer silently spends a game turn/roll
 *    just because the player was making small talk.
 *  - The keyword fallback fires ONLY when the OpenRouter call itself
 *    fails outright (network/timeout/all models down) — a last-resort
 *    "keep the game playable during an outage" path, not a substitute
 *    for the model's judgment on phrasing it did manage to see.
 */
export type ActionId = "narrate" | "explore" | "train" | "rest" | "travel" | "attack" | "engage" | "flee" | "mercy_spare" | "mercy_finish" | "leave_party";

export type TrainFocus = "armament" | "observation" | "fruit" | "auto";
const TRAIN_FOCUSES: TrainFocus[] = ["armament", "observation", "fruit", "auto"];

export interface ClassifyResult {
  action: ActionId | "unclear";
  source: "ai" | "keyword_fallback";
  /**
   * Only meaningful when action is "engage": how clever/well-suited the
   * described tactic is, bounded [MIN_TACTIC_MODIFIER, MAX_TACTIC_MODIFIER].
   * Folded into this same classification call (rather than a second AI
   * call) after live testing showed combat rounds firing 3 separate AI
   * calls (classify + tactic + narrate) tripped OpenRouter's free-tier
   * rate limit almost every round, silently degrading every fight to dry
   * fallback text. 0 whenever no tactic info is available (defaults,
   * keyword fallback, non-engage actions).
   */
  tacticModifier: number;
  /**
   * The fields below are only present when the model actually supplied a
   * valid value — absent otherwise, so callers default them (technique →
   * "none", targetTier → "average", trainFocus → "auto").
   *  - technique: which haki/fruit the player described using in a fight;
   *    still validated against what the character can really do in code.
   *  - target/targetTier: for "attack", who the player is going after and how
   *    tough the scene suggests they are — code turns the tier into stats.
   *  - trainFocus: for "train", what the player wants to train.
   */
  technique?: TechniqueId;
  target?: string;
  targetTier?: EnemyTier;
  trainFocus?: TrainFocus;
}

export const MIN_TACTIC_MODIFIER = -15;
export const MAX_TACTIC_MODIFIER = 20;

function clampTacticModifier(n: number): number {
  return Math.max(MIN_TACTIC_MODIFIER, Math.min(MAX_TACTIC_MODIFIER, Math.round(n)));
}

const KEYWORD_RULES: Array<{ action: ActionId; pattern: RegExp }> = [
  { action: "leave_party", pattern: /me separo|voy solo|me alejo|por mi cuenta|me bajo del (barco|grupo)/i },
  { action: "flee", pattern: /huy|corr|escap|retroced/i },
  { action: "attack", pattern: /\b(atac[oa]|apu[ñn]al|degüell|desenv?ain[oa]|desenfund|le (corto|pego|disparo|clavo)|intent[oa] (cortar|matar|golpear))/i },
  { action: "engage", pattern: /atac|luch|pele|golpe|desenfund|embist|arremet|presion|contraataq|bloque|esquiv|defiend/i },
  { action: "mercy_spare", pattern: /perdon|deja.*vivir|suelt|no lo mat/i },
  { action: "mercy_finish", pattern: /remat|acaba con|elimin|termina con|\bmata\b/i },
  { action: "train", pattern: /entrena|practic/i },
  { action: "rest", pattern: /descans|duerm/i },
  { action: "travel", pattern: /viaj|zarp|navega|parte hacia/i },
  { action: "explore", pattern: /explor|investig|me interno|me adentro|busco pelea|me arriesgo/i },
];

function keywordClassify(freeText: string, validActions: ActionId[]): ActionId | "unclear" {
  for (const rule of KEYWORD_RULES) {
    if (validActions.includes(rule.action) && rule.pattern.test(freeText)) return rule.action;
  }
  // Nothing specific matched — outside combat that just means ordinary
  // roleplay/chat, which "narrate" covers with zero mechanical risk.
  if (validActions.includes("narrate")) return "narrate";
  // Once already in a fight-or-flee/ongoing-exchange choice (never true
  // during the mercy_spare/mercy_finish choice, which stays strict), text
  // with no clear "flee" signal defaults to continuing the fight — the
  // engine's roll still decides what actually happens either way, this
  // just picks which button it's equivalent to pressing.
  if (validActions.includes("engage")) return "engage";
  return "unclear";
}

const TECHNIQUE_GUIDANCE =
  `"technique": ${'"none"'} si solo pelea de forma normal; "armament" si describe endurecer su cuerpo/arma con Haki de Armadura; "observation" si describe sentir/prever los movimientos con Haki de Observación; ` +
  '"conqueror" si describe liberar el Haki del Rey / una presencia aplastante; "fruit" si describe usar activamente el poder de su Fruta del Diablo. ' +
  "Solo lo que el jugador describa claramente — no lo supongas.";

function buildClassifyPrompt(freeText: string, validActions: ActionId[], sceneContext?: string): { system: string; user: string } {
  const narrateIsDefault = validActions.includes("narrate");
  const isCombatChoice = validActions.includes("engage");
  const canLeaveParty = validActions.includes("leave_party");
  const guidance = narrateIsDefault
    ? "Esto es un rol libre de verdad: el jugador puede escribir cualquier cosa — caminar, hablar con alguien, coquetear, comprar, beber, merodear, pensar, lo que sea. " +
      "Usa 'narrate' (pura interacción de rol, sin dados) para CUALQUIER texto que no sea claramente entrenar físicamente/técnicas, descansar/dormir, " +
      "ni una decisión arriesgada y decisiva de avanzar la trama (como 'exploro la isla a fondo', 'me interno en la jungla a buscar algo', 'busco pelea con quien sea', 'me arriesgo a robar esto'). " +
      "Esas decisiones arriesgadas y decisivas van en 'explore' (salir a buscar peligro u oportunidad SIN un objetivo concreto). " +
      "Si el jugador ejecuta (o declara que ejecuta) violencia física o un ataque armado directo contra alguien concreto presente en la escena (atacar, apuñalar, disparar, desenfundar para herir, golpear, emboscar), usa 'attack' — NUNCA 'explore' para eso. " +
      "Insultos, retos o amenazas SOLO de palabra, sin pasar a la acción física, son 'narrate'. " +
      "Cuando la acción sea 'attack' incluye también: \"target\" (una descripción corta de a quién ataca, tomada de la escena reciente si el jugador no lo nombra, p. ej. \"el hombre de la gorra y el parche\"), " +
      "\"target_tier\" (weak, average, tough o elite según lo que la escena sugiera de esa persona: un borracho o matón de taberna = weak/average, un veterano curtido = tough, un capitán/oficial/élite = elite), " +
      "\"technique\" y \"tactic_modifier\" (ver abajo). Cuando la acción sea 'train' incluye \"focus\": armament, observation, fruit o auto (auto si no especifica qué entrena). " +
      "Ante la duda, o si es solo conversación/ambiente, usa siempre 'narrate' — nunca respondas unclear solo porque la acción sea social, graciosa, atrevida o no encaje perfecto en una categoría." +
      (canLeaveParty
        ? " El jugador está ahora mismo en una escena compartida con sus compañeros de tripulación. Si el texto describe explícitamente alejarse físicamente del grupo o irse por su cuenta " +
          "(p. ej. 'me bajo del barco y me voy solo', 'me separo del grupo', 'voy por mi lado'), usa 'leave_party' en vez de 'narrate' — es distinto de simplemente hablar o actuar dentro de la escena compartida."
        : "")
    : isCombatChoice
    ? "Es un combate en curso: el jugador está describiendo su movimiento (atacar, esquivar, bloquear, una táctica, cualquier acción física de pelea) — todo eso es engage. " +
      "Usa 'flee' solo si el texto describe claramente intentar escapar, huir o retirarse. Ante cualquier duda, o si el texto describe seguir peleando de cualquier forma, usa 'engage' — " +
      "en un combate ya empezado casi nunca debería quedar sin clasificar. " +
      `Cuando action sea "engage", incluye también "tactic_modifier": un entero entre ${MIN_TACTIC_MODIFIER} y ${MAX_TACTIC_MODIFIER} que indique qué tan inteligente y bien adaptada es la táctica descrita ` +
      "(0 = un ataque normal/directo; positivo = inteligente, aprovecha una debilidad del enemigo o el entorno; negativo = torpe, imprudente, ignora un peligro obvio). No lo decides tú quién gana — solo qué tan buena es la idea. " +
      TECHNIQUE_GUIDANCE
    : "Sé generoso: cualquier texto de piedad o dejar con vida cuenta como mercy_spare; cualquier texto de rematar/acabar cuenta como mercy_finish.";
  const system =
    "Clasificas la acción de un jugador de un rol de texto libre en una de las acciones válidas. " +
    `Responde EXCLUSIVAMENTE con un objeto JSON como {"action": "..."}${isCombatChoice ? ' (y "tactic_modifier" cuando aplique, ver abajo)' : ""} usando uno de estos valores exactos para "action": ${validActions.join(", ")}, ` +
    `o {"action": "unclear"} ${narrateIsDefault || isCombatChoice ? "SOLO si el texto es literalmente ininteligible o no dice nada" : "si el texto realmente no tiene relación con ninguna"}. ` +
    guidance +
    " No añadas explicación, ni markdown, ni texto extra: responde solo el JSON, nada más.";
  const user =
    `Acciones válidas ahora mismo: ${validActions.join(", ")}.` +
    (sceneContext ? `\nÚltimo mensaje del narrador (para identificar a quién se refiere el jugador): "${sceneContext}"` : "") +
    `\nTexto del jugador: "${freeText}"`;
  return { system, user };
}

function parseClassifyResponse(raw: string, validActions: ActionId[]): Omit<ClassifyResult, "source"> {
  try {
    const parsed = JSON.parse(raw);
    const action = parsed?.action;
    if (typeof action !== "string" || !validActions.includes(action as ActionId)) return { action: "unclear", tacticModifier: 0 };
    const result: Omit<ClassifyResult, "source"> = { action: action as ActionId, tacticModifier: 0 };
    const rawModifier = Number(parsed?.tactic_modifier);
    if ((action === "engage" || action === "attack") && Number.isFinite(rawModifier)) result.tacticModifier = clampTacticModifier(rawModifier);
    if ((action === "engage" || action === "attack") && isTechniqueId(parsed?.technique) && parsed.technique !== "none") result.technique = parsed.technique;
    if (action === "attack") {
      if (typeof parsed?.target === "string" && parsed.target.trim()) result.target = parsed.target.trim().slice(0, 80);
      if (isEnemyTier(parsed?.target_tier)) result.targetTier = parsed.target_tier;
    }
    if (action === "train" && TRAIN_FOCUSES.includes(parsed?.focus)) result.trainFocus = parsed.focus;
    return result;
  } catch {
    return { action: "unclear", tacticModifier: 0 };
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

export async function classifyPlayerAction(freeText: string, validActions: ActionId[], opts: { sceneContext?: string } = {}): Promise<ClassifyResult> {
  if (validActions.length === 0) return { action: "unclear", source: "ai", tacticModifier: 0 };

  const { system, user } = buildClassifyPrompt(freeText, validActions, opts.sceneContext);
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await callOpenRouter(system, user, { models: OPENROUTER_MODELS, jsonMode: true, temperature: 0.1, timeoutMs: 8_000 });
      const parsed = parseClassifyResponse(raw, validActions);
      if (parsed.action !== "unclear") return { ...parsed, source: "ai" };
    }
    // Even a weak free-tier model couldn't pin it down twice — outside combat
    // that's still not a reason to block the player. Prefer "narrate" (zero
    // mechanical stakes, always safe) over "explore" (spends a real roll) as
    // the fallback, since a genuinely ambiguous read shouldn't cost a turn.
    if (validActions.includes("narrate")) return { action: "narrate", source: "ai", tacticModifier: 0 };
    if (validActions.includes("explore")) return { action: "explore", source: "ai", tacticModifier: 0 };
    // An ongoing fight (never the mercy_spare/mercy_finish choice, which has
    // no "engage" in its set) shouldn't stall on two weak-model misses either
    // — default to continuing the fight, same reasoning as the keyword fallback.
    if (validActions.includes("engage")) return { action: "engage", source: "ai", tacticModifier: 0 };
    return { action: "unclear", source: "ai", tacticModifier: 0 };
  } catch {
    // The OpenRouter call itself failed (network/timeout/all models down) —
    // this is the only case the keyword fallback exists for.
    return { action: keywordClassify(freeText, validActions), source: "keyword_fallback", tacticModifier: 0 };
  }
}

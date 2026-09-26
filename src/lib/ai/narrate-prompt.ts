/**
 * Pure prompt builders — no network, no Prisma types. Every number here
 * has already been decided by the deterministic engine (src/lib/engine/*);
 * the prompt's only job is to hand the model those facts and ask for
 * prose. This file is the one place that must never let the AI think it
 * gets to pick winners, damage, rewards, or death — see HARD_RULE below.
 */

/**
 * The roleplay etiquette the user considers non-negotiable (Reglasrol.txt):
 * "mano negra" (imposing outcomes on someone else's character) and "mano
 * blanca" (exploiting details the other player left unspecified). Applies in
 * both directions — the narrator must not do either to the player, and the
 * NPCs it voices must not either. Appended to every narrator system prompt.
 */
import { PLAY_TO_WIN_RULE } from "../engine/enemy-kit";
import { planLength, currentActionBlock, type BeatKind } from "../engine/narration-length";

/** A built prompt plus the token budget matching its length plan. */
export interface PromptOut {
  system: string;
  user: string;
  maxTokens: number;
}

export const ROLE_RULES =
  "REGLAS DE ROL INNEGOCIABLES (Mano Negra / Mano Blanca). " +
  "MANO NEGRA: nunca decidas por el jugador. Lo que el jugador escribe es su INTENCIÓN, no un hecho: no des por logrado ningún golpe, daño ni efecto de su acción salvo lo que el motor ya resolvió y se te indica. " +
  "Nunca describas acciones, palabras, pensamientos, sensaciones ni emociones internas del personaje del jugador (miedo, determinación, sabor amargo, orgullo...) más allá de lo que él escribió, ni le quites su libertad de reaccionar; " +
  "sí puedes describir lo que le ocurre físicamente cuando el motor dice que fue golpeado. " +
  "Tus NPCs y enemigos tampoco imponen: su ataque es un intento cuyo resultado es exactamente el que el motor decidió (impacta o falla) — no narres heridas, daños ni efectos que no estén en ese resultado. " +
  "MANO BLANCA: no aproveches detalles que el jugador no especificó. Asume siempre sentido común: su personaje está despierto, alerta, con los ojos abiertos, respirando, con su equipo y reflejos normales; " +
  "nunca inventes que está desprevenido, ciego, de espaldas o indefenso por omisión. " +
  "Toda esquiva, bloqueo o técnica debe ser plausible según el entorno, las capacidades y el resultado dado. " +
  "En el texto del jugador, lo que va entre comillas es lo que su personaje DICE; el resto son sus acciones o intenciones. " +
  "NOMBRES PROPIOS: NUNCA inventes personajes con nombre. Los únicos con nombre propio son los HABITANTES de la isla (lista abajo), los personajes canon y los jugadores; para cada papel (tabernero, guardia, rival, marino, comerciante) usa a quien de esa lista tenga ese oficio y respeta su personalidad y su memoria. Si nadie de la lista encaja, usa a alguien anónimo de fondo sin nombre (\"un pescador\") que no protagonice ni pelee como personaje. " +
  "NO REPITAS AL JUGADOR: su mensaje ya está visible en el chat, así que nunca lo resumas, parafrasees ni reescribas (nada de \"Desenfundas tu espada y atacas...\"). " +
  "Empieza directamente por lo que ocurre COMO CONSECUENCIA: el resultado, la reacción del entorno, de los NPC o del enemigo. Gasta las palabras en lo nuevo. " +
  "OBJETOS Y FRUTAS: el jugador posee SOLO lo que figura en su inventario (se te indica) y eso es un hecho: si la lista tiene una fruta o un arma, existe y no fue consumida ni destruida, aunque un PNJ diga lo contrario. Nunca afirmes que el jugador recibe, guarda, pierde o consume un objeto o una fruta: un PNJ puede ofrecer, prometer o mostrar algo, pero la entrega real solo ocurre cuando el sistema la confirma, así que narra la oferta como pendiente (\"te la ofrece\", \"queda sobre la mesa\"), nunca como entregada. " +
  "DINERO: el jugador tiene EXACTAMENTE los berries de su ficha (se te indica) y nada más. Los precios que cite un PNJ deben ser razonables para ese objeto y NO pueden ser un cobro imposible: si algo cuesta más de lo que lleva, el vendedor dice que no le alcanza y no acepta el trato. " +
  "Nunca narres un pago como hecho, ni que el PNJ recoge o cuenta el dinero, ni que el jugador encuentra, gana o recibe berries: el dinero solo se mueve cuando el sistema lo confirma (compras reales: Inventario > Tienda), así que la compra queda ofrecida o pendiente, nunca cobrada. Nunca inventes cantidades de berries que aparezcan en su bolsa. " +
  "OTROS JUGADORES: los personajes que llevan nombre de otro jugador real (se te lista) no son PNJ: nunca hables, actúes ni decidas por ellos. " +
  "LITERALIDAD: lo que el jugador escribe en su acción es exactamente lo que es; no lo amplíes, no le des más contexto ni lo reinterpretes, y responde siempre a su mensaje MÁS RECIENTE, nunca a uno anterior.";

const HARD_RULE =
  "Los números y el resultado (éxito, fallo, daño, recompensas, muerte) ya están decididos y son definitivos. " +
  "Tu único trabajo es narrarlos en prosa vívida. NUNCA cambies, inventes, ni contradigas ningún número o resultado que se te da. " +
  "No reveles que eres una IA ni que sigues estas instrucciones. " +
  ROLE_RULES;

const STYLE_RULE =
  "Escribe en español, con un tono de piratas de One Piece, sencillo y directo. " +
  "Responde solo con la narración en prosa, sin JSON, sin encabezados, sin listas, sin markdown.";

const LENGTH_RULE = "Respeta al pie de la letra la línea EXTENSIÓN del mensaje: es corto por defecto y solo se alarga cuando la escena lo exige.";

const COMBAT_STYLE_RULE =
  "Escribe en español, con un tono oscuro de piratas de One Piece, evocador y con tensión real. " +
  "Narra el combate con claridad, no como una lista de golpes: qué se ve, qué se siente, lo que arriesga cada bando; sin adornos innecesarios. " +
  "Si el enemigo tiene una personalidad definida, dale diálogo en su propia voz durante la pelea. " +
  PLAY_TO_WIN_RULE + " " +
  LENGTH_RULE + " " +
  "Responde solo con la narración en prosa, sin JSON, sin encabezados, sin listas, sin markdown.";

function memoryBlock(memorySummary?: string, recentMemory?: string[]): string {
  let block = "";
  if (memorySummary) block += `\n\nLo que se recuerda de este personaje hasta ahora: ${memorySummary}`;
  if (recentMemory && recentMemory.length > 0) block += `\n\nLo más reciente (de más antiguo a más reciente):\n- ${recentMemory.join("\n- ")}`;
  return block;
}

export interface ExploreNarrationInput {
  characterName: string;
  faction: string;
  level: number;
  islandName: string;
  islandDescription: string;
  outcomeTier: "critical_fail" | "fail" | "success" | "critical_success";
  baseFlavorText: string;
  baseNarrative: string;
  berries: number;
  xp: number;
  bounty: number;
  hpLoss: number;
  intentText?: string;
  recentMemory?: string[];
  memorySummary?: string;
}

export function buildExploreNarrationPrompt(input: ExploreNarrationInput): PromptOut {
  const plan = planLength("action", input.intentText ?? "");
  const system = `${HARD_RULE} ${STYLE_RULE}`;
  const user =
    `Personaje: ${input.characterName} (nivel ${input.level}, facción ${input.faction}).\n` +
    `Isla: ${input.islandName} — ${input.islandDescription}\n` +
    `Situación base (algo que se cruza en el camino, NO el tema principal): ${input.baseFlavorText}\n` +
    `Resultado ya decidido: ${input.outcomeTier} — ${input.baseNarrative}\n` +
    `Cambios numéricos (definitivos, no los alteres): berries ${input.berries >= 0 ? "+" : ""}${input.berries}, ` +
    `xp +${input.xp}, bounty +${input.bounty}, vida -${input.hpLoss}.` +
    memoryBlock(input.memorySummary, input.recentMemory) +
    "\n\nLO PRINCIPAL es lo que el jugador propone en su ACCIÓN ACTUAL: hazlo avanzar de forma coherente con lo que se venía hablando (si va a un barco, a un lugar o tras una pista, narra eso). " +
    "La situación base solo se integra si encaja o como un giro breve, sin abandonar el hilo ni cambiar de tema." +
    (input.intentText ? currentActionBlock(input.intentText) : "") +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface CombatRoundInput {
  attacker: string;
  defender: string;
  damage: number;
  outcome: "critical_fail" | "fail" | "success" | "critical_success";
}

export interface CombatNarrationInput {
  characterName: string;
  enemyName: string;
  enemyPersonality?: string;
  isBoss: boolean;
  rounds: CombatRoundInput[]; // just the exchange(s) being narrated right now, in the order they happened
  /** Undefined while the fight is still going — the engine hasn't decided a winner yet. */
  concluded: boolean;
  victor?: "player" | "enemy";
  playerHpLeft: number;
  playerMaxHp: number;
  enemyHpLeft: number;
  enemyMaxHp: number;
  intentText?: string;
  recentMemory?: string[];
  memorySummary?: string;
  /** Set only when this enemy is a WorldActor's tracked grudge-holder with a prior incident against this character — see engine/grudge.ts. Omitted entirely on a first meeting. */
  grudgeContext?: string;
  /** True when the player's own attack is what started this fight (a target from the scene, not a random encounter). */
  openingStrike?: boolean;
  /** The technique the player described and what the engine actually allowed. */
  technique?: { label: string; downgradedReason?: string };
  /** Physical condition of the player, only set when not fully fresh. */
  fatigue?: string;
  /** The fight ended because the round cap was hit with both still standing (nobody was knocked out). */
  endedByExhaustion?: boolean;
  /** The enemy's physical condition, only set when not fresh. */
  enemyFatigue?: string;
  /** Full repertoire of the enemy (engine/enemy-kit.ts describeEnemyKit): play all of it, invent nothing else. */
  enemyKit?: string;
  /** Experience of each side: the veteran endures more, the rookie breaks sooner. */
  playerLevel?: number;
  enemyLevel?: number;
}

/** One engine result, in words: hits and misses both matter, since a block is a fact the narrator must not lose. */
export function describeRound(r: CombatRoundInput): string {
  switch (r.outcome) {
    case "critical_success":
      return `${r.attacker} conecta un golpe crítico contra ${r.defender} (${r.damage} de daño)`;
    case "success":
      return r.damage > 0
        ? `${r.attacker} impacta a ${r.defender} (${r.damage} de daño)`
        : `${r.attacker} roza a ${r.defender} sin causar daño real`;
    case "fail":
      return `${r.attacker} falla: ${r.defender} lo bloquea, lo esquiva o lo aguanta sin daño`;
    case "critical_fail":
      return `${r.attacker} falla de forma torpe y queda expuesto (${r.defender} no recibe daño)`;
  }
}

/**
 * Combat plays out round-by-round (one exchange per player message, via
 * the AI referee) — the user wants "the AI acts, I
 * respond, the AI acts": each reply must answer the player's move with its
 * exact engine result, then show the enemy acting on its own initiative, then
 * hand the turn back. `concluded` decides whether to invite the next move or
 * narrate the fight's actual end.
 */
export function buildCombatNarrationPrompt(input: CombatNarrationInput): PromptOut {
  const plan = planLength(input.concluded ? "combat_end" : "combat_round", input.intentText ?? "");
  const system = `${HARD_RULE} ${COMBAT_STYLE_RULE} Este es un combate ${input.isBoss ? "importante, contra un enemigo formidable" : "menor"} — ajusta la intensidad de la prosa a eso.`;
  const roundLines = input.rounds.map((r, i) => `${i + 1}. ${describeRound(r)}`).join("\n");
  const outcomeLine = input.concluded
    ? input.endedByExhaustion
      ? `El combate termina por agotamiento: ambos siguen en pie pero ya no pueden más, y ${input.victor === "player" ? input.characterName : input.enemyName} lleva la mejor parte (menos herido). Narra ese final de forma clara: nadie cayó inconsciente, uno cede terreno y se declara vencido.`
      : `El combate termina en este intercambio: gana ${input.victor === "player" ? input.characterName : input.enemyName}.`
    : "El combate sigue — ninguno de los dos ha caído todavía, vendrán más intercambios.";
  const techniqueLine = input.technique
    ? input.technique.downgradedReason
      ? `El jugador quiso recurrir a ${input.technique.label}, pero ${input.technique.downgradedReason}: narra ese intento frustrado, sin darle ningún bono.`
      : `El jugador recurre a: ${input.technique.label}.`
    : "";
  const user =
    `Personaje del jugador: ${input.characterName}${input.fatigue ? ` (${input.fatigue})` : ""}${input.playerLevel ? `, nivel ${input.playerLevel}` : ""}.\n` +
    `Enemigo: ${input.enemyName}${input.enemyPersonality ? ` — personalidad: ${input.enemyPersonality}` : ""}${input.enemyLevel ? `, nivel ${input.enemyLevel}` : ""}${input.enemyFatigue ? ` (${input.enemyFatigue})` : ""}.\n` +
    (input.fatigue
      ? `El cuerpo de ${input.characterName} está ${input.fatigue}: CUALQUIER cosa que intente le sale peor (más lenta, torpe, débil o corta), aunque el plan sea bueno; muéstralo en el cuerpo y en el resultado, y no lo narres como si estuviera fresco.\n`
      : "") +
    (input.enemyFatigue
      ? `${input.enemyName} está ${input.enemyFatigue}: sus movimientos pierden precisión y fuerza, y eso se nota.\n`
      : input.fatigue
      ? `${input.enemyName} conserva aliento: si el resultado indicado lo permite, puede aprovechar el cansancio de ${input.characterName} para presionar o contraatacar con claridad.\n`
      : "") +
    (input.playerLevel && input.enemyLevel && Math.abs(input.playerLevel - input.enemyLevel) >= 5
      ? `Hay una diferencia de experiencia clara (${input.playerLevel} vs ${input.enemyLevel}): quien tiene más nivel aguanta golpes y esfuerzo con más entereza; deja que se note sin cambiar el resultado del motor.\n`
      : "") +
    (input.enemyKit ? `${input.enemyKit}\n` : "") +
    (input.grudgeContext ? `${input.grudgeContext}\n` : "") +
    (input.openingStrike
      ? `${input.characterName} acaba de iniciar la agresión contra ${input.enemyName}, que estaba en la escena: su reacción debe ser coherente con quién es y con lo que estaba haciendo un instante antes.\n`
      : "") +
    (techniqueLine ? `${techniqueLine}\n` : "") +
    `Resultado de este intercambio, EN ESTE ORDEN, ya decidido por el motor (definitivo, no lo alteres ni lo reordenes):\n${roundLines || "(ningún golpe)"}\n` +
    `Vida de ${input.characterName}: ${input.playerHpLeft}/${input.playerMaxHp}. Vida de ${input.enemyName}: ${input.enemyHpLeft}/${input.enemyMaxHp}.\n` +
    outcomeLine +
    memoryBlock(input.memorySummary, input.recentMemory) +
    (input.concluded
      ? "\n\nNarra el final de este combate con claridad, con una línea de diálogo si el enemigo tiene personalidad. Si el jugador ganó, el enemigo queda derrotado y a su merced, vivo: su destino lo decide el jugador después."
      : "\n\nNo describas de nuevo lo que el jugador intentó (ya lo escribió): empieza directo por el resultado indicado de su movimiento (impacta o es bloqueado/esquivado, y por qué es plausible)." +
        "Luego narra al enemigo actuando por iniciativa propia, según su personalidad, motivos y rango (siempre buscando GANAR: matar, capturar o someter según quién sea, usando todo su repertorio), con el resultado indicado, y una o dos líneas suyas si tiene personalidad. " +
        "Termina dejando la iniciativa al jugador, sin decidir cómo reacciona ni qué hace después.") +
    (input.intentText ? currentActionBlock(input.intentText) : "") +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface EncounterIntroInput {
  characterName: string;
  faction: string;
  islandName: string;
  islandDescription: string;
  intentText?: string;
  enemyName: string;
  enemyPersonality?: string;
  situation: string; // the template's static flavor, as raw material
  threat: string; // assessment label, e.g. "even"
  recentScene?: string[];
  memorySummary?: string;
}

/** The moment a threat shows up (before any combat): narrated, ties into what the player was doing, decides nothing. */
export function buildEncounterIntroPrompt(input: EncounterIntroInput): PromptOut {
  const plan = planLength("intro", input.intentText ?? "");
  const system =
    "Eres el narrador de un rol de piratas de One Piece. Narra la aparición de una amenaza en medio de lo que el jugador estaba haciendo. " +
    "NO resuelvas ningún combate, no des golpes ni daño: solo presenta al enemigo y la tensión, y deja la decisión de qué hacer (luchar, huir, hablar) al jugador. " +
    "No reveles que eres una IA. " +
    ROLE_RULES +
    " " +
    SCENE_STYLE_RULE;
  const transcriptBlock = input.recentScene && input.recentScene.length > 0 ? `\n\nEscena reciente:\n${input.recentScene.join("\n")}` : "";
  const user =
    `Personaje: ${input.characterName} (${input.faction}). Isla: ${input.islandName} — ${input.islandDescription}\n` +
    `La amenaza: ${input.enemyName}${input.enemyPersonality ? ` (${input.enemyPersonality})` : ""}. Situación base: ${input.situation}\n` +
    `Lectura de peligro respecto al jugador: ${input.threat}.` +
    memoryBlock(input.memorySummary, undefined) +
    transcriptBlock +
    "\n\nNarra cómo aparece o se revela esta amenaza, y termina preguntando implícitamente qué hace el jugador." +
    (input.intentText ? currentActionBlock(input.intentText) : "") +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface DuelNarrationInput {
  round: number;
  aName: string;
  bName: string;
  aAction: string;
  bAction: string;
  aTechnique?: string;
  bTechnique?: string;
  rounds: CombatRoundInput[];
  aHp: number;
  aMax: number;
  bHp: number;
  bMax: number;
  finished: boolean;
  winnerName?: string;
  /** Set when someone slipped away from a fight instead of being beaten — nobody wins, nobody dies. */
  escapedName?: string;
  /** A duel to the death (a hunt or an agreed fight to the finish) — real stakes, vs. a friendly bout. */
  lethal?: boolean;
  /** Fighters who tried to flee this round and failed — narrate the failed attempt. */
  failedFlight?: string[];
  /** What each fighter can really do (engine/capabilities.ts): play all of it, nothing beyond. */
  aKit?: string;
  bKit?: string;
}

/** 1-vs-1 player duel: the AI only narrates what the engine resolved for BOTH fighters' simultaneous moves. */
export function buildDuelNarrationPrompt(input: DuelNarrationInput): PromptOut {
  const plan = planLength(input.finished ? "combat_end" : "combat_round", `${input.aAction} ${input.bAction}`);
  const system =
    "Eres el narrador de un duelo 1 contra 1 entre dos jugadores en un rol de piratas de One Piece. Ambos actuaron a la vez; el motor ya resolvió el resultado. " +
    "Tu único trabajo es narrar ese resultado con justicia hacia ambos, sin favorecer a nadie ni cambiar quién golpea o falla. " +
    "Si el duelo es amistoso, nadie muere: quien cae queda fuera de combate. Si es a muerte, las heridas son graves y letales, pero NO decidas tú quién muere: el motor lo decide después; narra al perdedor caído y al borde del final. " +
    "No decidas nada del siguiente turno. No reveles que eres una IA. " +
    ROLE_RULES +
    " " +
    COMBAT_STYLE_RULE;
  const roundLines = input.rounds.map((r, i) => `${i + 1}. ${describeRound(r)}`).join("\n");
  const user =
    `Ronda ${input.round}. ${input.aName} intentó: "${input.aAction}"${input.aTechnique ? ` (usando ${input.aTechnique})` : ""}. ` +
    `${input.bName} intentó: "${input.bAction}"${input.bTechnique ? ` (usando ${input.bTechnique})` : ""}.\n` +
    `Resultado, en orden, ya decidido (definitivo):\n${roundLines || "(ningún golpe)"}\n` +
    `Vida: ${input.aName} ${input.aHp}/${input.aMax}; ${input.bName} ${input.bHp}/${input.bMax}.\n` +
    (input.aKit ? `${input.aKit}\n` : "") +
    (input.bKit ? `${input.bKit}\n` : "") +
    (input.lethal ? "Es un duelo A MUERTE: tono grave, sin contemplaciones.\n" : "") +
    (input.failedFlight && input.failedFlight.length > 0 ? `Intentó huir y NO lo logró: ${input.failedFlight.join(", ")}.
` : "") +
    (input.escapedName
      ? `${input.escapedName} logra escapar del duelo: nadie gana ni muere. Narra la huida con verosimilitud.`
      : input.finished
      ? `El duelo termina aquí: gana ${input.winnerName}. Narra el desenlace y cómo queda el perdedor (${input.lethal ? "abatido, a merced del vencedor" : "fuera de combate, vivo"}).`
      : "El duelo continúa: termina la narración dejando a ambos listos para su siguiente movimiento.") +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface JointFightNarrationInput {
  round: number;
  enemyName: string;
  enemyPersonality?: string;
  isBoss: boolean;
  /** What each fighter tried this round, in their own words (NPC allies get a generic line). */
  actions: { name: string; text: string; technique?: string; isNpc?: boolean }[];
  rounds: CombatRoundInput[];
  roster: { name: string; hp: number; maxHp: number; down: boolean; fled?: boolean }[];
  enemyHp: number;
  enemyMaxHp: number;
  finished: boolean;
  outcome?: "victory" | "defeat";
  /** Context of what the group is fighting for ("proteger el Poneglifo", "tomar la isla"...). */
  stakes?: string;
  /** Full repertoire of the enemy, and of each ally that has one (NPC nakamas, pledged actors). */
  enemyKit?: string;
  allyKits?: string[];
  recentScene?: string[];
}

/** N-vs-1 fight: the AI narrates one shared beat covering EVERY participant's simultaneous move and the enemy's answers. */
export function buildJointFightNarrationPrompt(input: JointFightNarrationInput): PromptOut {
  const plan = planLength(input.finished ? "combat_end" : "group", "");
  const system =
    "Eres el narrador de una pelea en grupo de un rol de piratas de One Piece: varios aliados contra un mismo enemigo. Todos actuaron a la vez; el motor ya resolvió cada golpe. " +
    "Narra UNA sola escena coral y viva que dé protagonismo a cada participante según lo que intentó y el resultado indicado, sin favorecer a nadie ni cambiar quién golpea, falla o cae. " +
    "Quien queda caído (vida 0) está fuera de combate pero NO está muerto todavía: el motor decide después su destino, no lo narres como muerto. " +
    "No decidas nada del siguiente turno. No reveles que eres una IA. " +
    ROLE_RULES +
    " " +
    COMBAT_STYLE_RULE;
  const actionLines = input.actions.map((a) => `- ${a.name}${a.isNpc ? " (aliado NPC)" : ""}: "${a.text}"${a.technique ? ` (usando ${a.technique})` : ""}`).join("\n");
  const roundLines = input.rounds.map((r, i) => `${i + 1}. ${describeRound(r)}`).join("\n");
  const rosterLine = input.roster.map((r) => `${r.name} ${r.fled ? "huyó" : r.down ? "caído" : `${r.hp}/${r.maxHp}`}`).join("; ");
  const transcriptBlock = input.recentScene && input.recentScene.length > 0 ? `\n\nEscena reciente:\n${input.recentScene.join("\n")}` : "";
  const user =
    `Ronda ${input.round} contra ${input.enemyName}${input.enemyPersonality ? ` — personalidad: ${input.enemyPersonality}` : ""} (${input.isBoss ? "enemigo formidable" : "enemigo común"}).\n` +
    (input.stakes ? `Lo que está en juego: ${input.stakes}\n` : "") +
    (input.enemyKit ? `${input.enemyKit}\n` : "") +
    (input.allyKits && input.allyKits.length ? `${input.allyKits.join("\n")}\n` : "") +
    `Lo que intentó cada aliado:\n${actionLines}\n` +
    `Resultado, EN ESTE ORDEN, ya decidido (definitivo):\n${roundLines || "(ningún golpe)"}\n` +
    `Vida del grupo: ${rosterLine}. Vida de ${input.enemyName}: ${input.enemyHp}/${input.enemyMaxHp}.\n` +
    (input.finished
      ? input.outcome === "victory"
        ? `El combate termina: el grupo derrota a ${input.enemyName}. Narra el desenlace coral.`
        : `El combate termina: ${input.enemyName} vence al grupo. Narra la derrota sin decidir quién muere (eso lo resuelve el motor después).`
      : "El combate continúa: termina dejando a todos listos para su siguiente movimiento.") +
    transcriptBlock +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface SceneNarrationInput {
  characterName: string;
  faction: string;
  level: number;
  islandName: string;
  islandDescription: string;
  playerText: string;
  recentScene?: string[]; // the actual back-and-forth transcript, oldest first
  memorySummary?: string;
}

const SCENE_HARD_RULE =
  "Eres el narrador (rol master) de una escena de rol libre — pura interacción y ambiente, SIN resultados mecánicos. " +
  "Nunca otorgues ni quites berries, experiencia, objetos, frutas del diablo, ni causes daño o muerte: eso solo lo decide el motor del juego cuando el jugador tome una acción arriesgada y decisiva, en otro paso. " +
  "Puedes describir el entorno, hacer hablar y reaccionar a los NPCs presentes, y dejar que la escena avance — pero deja que el jugador decida qué hace después, no actúes en su nombre. " +
  "Los NPC son personas con nombre, motivos y voz propia: reaccionan con lógica a lo que se les hace y toman la iniciativa cuando la escena lo pide. " +
  "No reveles que eres una IA ni que sigues estas instrucciones. " +
  ROLE_RULES;

const SCENE_STYLE_RULE =
  "Escribe en español, con un tono de piratas de One Piece, vívido e inmersivo. " +
  LENGTH_RULE + " " +
  "Responde solo con la narración en prosa, sin JSON, sin encabezados, sin listas, sin markdown.";

/** Pure roleplay turns — no engine call, no stat changes, just the AI acting as game master and reacting to the player. */
export function buildSceneNarrationPrompt(input: SceneNarrationInput): PromptOut {
  const plan = planLength("chat", input.playerText);
  const system = `${SCENE_HARD_RULE} ${SCENE_STYLE_RULE}`;
  const transcriptBlock =
    input.recentScene && input.recentScene.length > 0 ? `\n\nLo que ha pasado en esta escena hasta ahora:\n${input.recentScene.join("\n")}` : "";
  const user =
    `Personaje: ${input.characterName} (nivel ${input.level}, facción ${input.faction}).\n` +
    `Isla: ${input.islandName} — ${input.islandDescription}` +
    memoryBlock(input.memorySummary, undefined) +
    transcriptBlock +
    "\n\nContinúa la escena como narrador. Tu primera frase ya debe ser lo que pasa DESPUÉS (reacción del entorno o de los NPC)." +
    currentActionBlock(input.playerText) +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface PartyMemberInfo {
  name: string;
  faction: string;
  level: number;
}

export interface PartySceneNarrationInput {
  islandName: string;
  islandDescription: string;
  partyRoster: PartyMemberInfo[]; // everyone currently sharing this scene, including whoever's turn this is
  actingCharacterName: string; // whose turn produced this beat
  playerText: string;
  recentParty?: string[]; // recent PartySceneMessage rows, formatted "Nombre: texto" / "Narrador: texto", oldest first
  memorySummary?: string; // compacted older shared-scene history (game/scene-compaction.ts)
}

const PARTY_SCENE_HARD_RULE =
  "Eres el narrador (rol master) de una escena de rol libre compartida por VARIOS jugadores a la vez — pura interacción y ambiente, SIN resultados mecánicos. " +
  "Nunca otorgues ni quites berries, experiencia, objetos, frutas del diablo, ni causes daño o muerte: eso solo lo decide el motor del juego cuando un jugador tome una acción arriesgada y decisiva, en otro paso, de forma individual. " +
  "Puedes describir el entorno, hacer hablar y reaccionar a los NPCs presentes, y dejar que la escena avance — pero deja que cada jugador decida qué hace después, no actúes en su nombre. " +
  "Puedes dirigirte y reaccionar a CUALQUIERA de los personajes presentes en el grupo, no solo a quien acaba de hablar — trata al grupo como un grupo, dejando que los NPCs los traten como tal también. " +
  "No reveles que eres una IA ni que sigues estas instrucciones. " +
  ROLE_RULES;

/**
 * Sibling to buildSceneNarrationPrompt, for when 2+ crewmates share one
 * live scene (see Party in schema.prisma). Same "no engine call, no stat
 * changes" contract — the only real difference is a roster of everyone
 * present, so the narrator can address the group instead of assuming a
 * single protagonist. One call per turn regardless of party size, same as
 * solo play, to keep AI-call volume flat per the project's rate-limit
 * discipline (see classify-action.ts).
 */
export function buildPartySceneNarrationPrompt(input: PartySceneNarrationInput): PromptOut {
  const plan = planLength("chat", input.playerText);
  const system = `${PARTY_SCENE_HARD_RULE} ${SCENE_STYLE_RULE}`;
  const rosterLine = input.partyRoster.map((m) => `${m.name} (nivel ${m.level}, ${m.faction})`).join(", ");
  const transcriptBlock =
    input.recentParty && input.recentParty.length > 0 ? `\n\nLo que ha pasado en esta escena hasta ahora:\n${input.recentParty.join("\n")}` : "";
  const user =
    `Grupo presente: ${rosterLine}.\n` +
    `Isla: ${input.islandName} — ${input.islandDescription}` +
    (input.memorySummary ? `\n\nLo ocurrido antes en esta escena (resumen): ${input.memorySummary}` : "") +
    transcriptBlock +
    "\n\nContinúa la escena como narrador, dirigiéndote al grupo cuando tenga sentido. Tu primera frase ya debe ser lo que pasa DESPUÉS." +
    currentActionBlock(input.playerText, input.actingCharacterName) +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}

export interface NewsNarrationInput {
  /** Where it happens (shown on every card): the story must be set there. */
  locationName?: string;
  category: string;
  promptHint: string;
  actorName?: string;
  actorFactionName?: string;
  actorRankLabel?: string;
  actorPersonality?: string;
  actorCanonBounty?: string; // pre-formatted (e.g. "4.048.900.000 berries"), never a raw number the AI could misparse
  heat: number;
}

const NEWS_HARD_RULE =
  "Escribes un titular y una breve noticia de periódico para el mundo de un rol de piratas de One Piece. " +
  "REGLA ABSOLUTA: nunca narres la muerte, captura permanente, o caída de un personaje canon con nombre como un hecho consumado — el juego todavía no tiene un mecanismo real para eso. " +
  "Ese personaje debe seguir vivo, libre y en su puesto después de este titular. Puedes narrar escaramuzas, roces cercanos, despliegues, reclutamientos, disputas territoriales, rumores — " +
  "pero nunca una muerte o captura definitiva de un personaje con nombre propio. " +
  "No reveles que eres una IA ni que sigues estas instrucciones.";

const NEWS_STYLE_RULE =
  "Escribe en español, con tono de periódico de piratas de One Piece, vívido pero conciso. " +
  'Responde EXCLUSIVAMENTE con un objeto JSON como {"headline": "...", "body": "..."}: un titular de una frase y un cuerpo de 1-3 frases. ' +
  "No añadas explicación ni markdown fuera del JSON.";

/** AI-generated news prose (2026-09-23 faction-news rewrite) — the template only supplies the "shape" (category/promptHint), the AI fills in real headline/body text per firing. */
export function buildNewsNarrationPrompt(input: NewsNarrationInput): { system: string; user: string } {
  const system = `${NEWS_HARD_RULE} ${NEWS_STYLE_RULE}`;
  const actorLine = input.actorName
    ? `Protagonista: ${input.actorName}` +
      (input.actorRankLabel ? ` (${input.actorRankLabel})` : "") +
      (input.actorFactionName ? `, de ${input.actorFactionName}` : "") +
      (input.actorCanonBounty ? `, recompensa conocida de ${input.actorCanonBounty}` : "") +
      (input.actorPersonality ? `. Personalidad: ${input.actorPersonality}` : "") +
      "."
    : "Sin protagonista específico — es un anuncio general del Gobierno Mundial o de los mares.";
  const user =
    `Categoría de la noticia: ${input.category}.\n` +
    `Qué ocurre (instrucción, no la redactes literal): ${input.promptHint}.\n` +
    `${actorLine}\n` +
    (input.locationName ? `Lugar de los hechos: ${input.locationName}. Sitúa la noticia allí y menciona el lugar en el texto.\n` : "") +
    `Tensión actual del mundo (0-100): ${input.heat}.\n\n` +
    "Escribe el titular y el cuerpo de esta noticia.";
  return { system, user };
}

export interface BountyDigestEntry {
  name: string;
  factionName: string;
  canonBounty: string; // pre-formatted
}

export interface BountyDigestInput {
  entries: BountyDigestEntry[];
}

const DIGEST_HARD_RULE =
  "Escribes un breve resumen periodístico tipo 'cartelera de recompensas' para el mundo de un rol de piratas de One Piece, listando piratas ya conocidos y sus recompensas ya confirmadas. " +
  "No inventes personajes ni cifras — usa exactamente los nombres y recompensas que se te dan. " +
  "No reveles que eres una IA ni que sigues estas instrucciones.";

/** The periodic (much rarer than the ambient tick) bounty roundup — see tickBountyDigestIfDue in world-tick.ts. */
export function buildBountyDigestPrompt(input: BountyDigestInput): { system: string; user: string } {
  const system = `${DIGEST_HARD_RULE} ${NEWS_STYLE_RULE}`;
  const list = input.entries.map((e) => `${e.name} (${e.factionName}) — ${e.canonBounty}`).join("; ");
  const user = `Redacta el titular y cuerpo de la cartelera de recompensas del día con esta lista confirmada: ${list}.`;
  return { system, user };
}

export function buildMemoryUpdatePrompt(currentSummary: string | undefined, latestEvent: string): { system: string; user: string } {
  const system =
    "Mantienes un resumen breve y persistente de la historia de un personaje de un rol de texto, para que una IA narradora lo recuerde en el futuro. " +
    'Responde EXCLUSIVAMENTE con un objeto JSON como {"summary": "..."}. ' +
    "El resumen debe tener como máximo 5-8 frases, en español, en tercera persona, priorizando lo que importa para el futuro del personaje: " +
    "relaciones, promesas, enemigos y rivalidades, heridas o cicatrices importantes, frutas del diablo, Poneglifos leídos, hazañas o fracasos notables. " +
    "Nunca inventes hechos que no se te den. Si el evento nuevo no aporta nada memorable a largo plazo, puedes dejar el resumen casi igual. " +
    "No añadas explicación ni markdown: responde solo el JSON.";
  const user =
    (currentSummary ? `Resumen actual: ${currentSummary}` : "Resumen actual: (todavía no hay ninguno, este es el primer evento memorable)") +
    `\n\nEvento reciente a incorporar: ${latestEvent}\n\nDevuelve el resumen actualizado.`;
  return { system, user };
}

export interface IslandBriefingInput {
  characterName: string;
  faction: string;
  level: number;
  islandName: string;
  islandDescription: string;
  arcHook?: string | null;
  factionControl?: string | null;
  danger: number;
  minLevel: number;
  isStart: boolean;
  /** Canon figures tied to this island (holders, rulers): name plus a short description. */
  powers: { name: string; description: string }[];
  missions: { title: string; brief: string }[];
}

const BRIEFING_HARD_RULE =
  "Eres el narrador (rol master) de un juego de rol de One Piece. El jugador acaba de llegar a una isla (o de empezar su aventura en ella) y tu deber es darle el PANORAMA COMPLETO de la isla: su historia y ambiente, quién manda, " +
  "los villanos o poderes que la marcan y qué está pasando ahora mismo — usando SOLO los datos que se te dan, sin inventar personajes nombrados nuevos ni cambiar nada de lo que ya está decidido. " +
  "Después presenta, dentro de la ficción y con la voz de un personaje o del propio ambiente (un vigía, un tabernero, un rumor), las MISIONES que se te dan como oportunidades concretas para progresar a su nivel, sin cambiar sus objetivos ni inventar recompensas. " +
  "No otorgues ni quites nada ni decidas lo que hace el jugador: solo informa y ofrece. No reveles que eres una IA. " +
  "Escribe en español, tono oscuro y evocador de One Piece, 4-6 párrafos en prosa, sin JSON, sin encabezados, sin listas, sin markdown. " +
  ROLE_RULES;

export function buildIslandBriefingPrompt(input: IslandBriefingInput): { system: string; user: string } {
  const powers = input.powers.length ? input.powers.map((p) => `- ${p.name}: ${p.description}`).join("\n") : "- (ninguna figura destacada: la isla se gobierna sola)";
  const missions = input.missions.map((m, i) => `${i + 1}. ${m.title}: ${m.brief}`).join("\n");
  const user =
    `Personaje: ${input.characterName} (nivel ${input.level}, facción ${input.faction}).\n` +
    `${input.isStart ? "Es el lugar donde comienza su leyenda." : "Acaba de desembarcar por primera vez."}\n` +
    `Isla: ${input.islandName} — peligro ${input.danger}/10, nivel recomendado ${input.minLevel}+. Control: ${input.factionControl ?? "sin gobierno claro"}.\n` +
    `Ambiente: ${input.islandDescription}\n` +
    `Lo que está pasando ahora: ${input.arcHook ?? "la vida sigue su curso, pero hay tensión bajo la superficie."}\n\n` +
    `Poderes y villanos vinculados a la isla:\n${powers}\n\n` +
    `Misiones que se le ofrecen (preséntalas de forma natural):\n${missions}`;
  return { system: BRIEFING_HARD_RULE, user };
}

/** Used verbatim when the AI is unavailable: the player still gets the panorama and the goals. */
export function buildStaticBriefing(input: IslandBriefingInput): string {
  const parts = [
    `${input.isStart ? "Comienzas tu leyenda en" : "Desembarcas en"} ${input.islandName}. ${input.islandDescription}`,
    input.arcHook ? `Lo que se cuece ahora mismo: ${input.arcHook}` : "",
    input.factionControl ? `Aquí manda: ${input.factionControl}.` : "",
    input.powers.length ? `Nombres que conviene conocer: ${input.powers.map((p) => `${p.name} (${p.description})`).join("; ")}.` : "",
    `Para progresar, esto es lo que se te ofrece: ${input.missions.map((m) => `«${m.title}» — ${m.brief}`).join(" ")}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** How the narrator plays the world's antagonists for this character (set out of role). */
export function toneDirective(tone?: string): string {
  switch (tone) {
    case "lethal":
      return "TONO DEL NARRADOR — LETAL: el mundo es peligroso y los enemigos combaten con intención de matar; casi nadie perdona, los riesgos se sienten reales. Sigue sin cambiar ningún resultado del motor.";
    case "story":
      return "TONO DEL NARRADOR — HISTORIA: prioriza la aventura y el drama. Los enemigos tienen motivos, dudas y personalidad: antes y después de la pelea hablan, se burlan, ofrecen tratos; ya en pleno combate luchan por ganar con todo. Sigue sin cambiar ningún resultado del motor.";
    default:
      return "TONO DEL NARRADOR — EQUILIBRADO: los enemigos actúan según su carácter y su rango (unos matan, otros intimidan, capturan, negocian o se retiran). No busques matar al jugador por defecto ni lo protejas: manda el resultado del motor.";
  }
}

/** Tone + the player's standing out-of-role feedback, appended to a narrator's system prompt. */
export function directivesBlock(tone?: string, notes?: string | null): string {
  let block = `

${toneDirective(tone)}`;
  if (notes && notes.trim()) block += `

INDICACIONES FUERA DE ROL DEL JUGADOR (respétalas siempre, son sobre tu forma de narrar): ${notes.trim().slice(0, 800)}`;
  return block;
}

export interface RecruitNarrationInput {
  characterName: string;
  npcName: string;
  role: string;
  accepted: boolean;
  islandName: string;
  recentScene?: string[];
}

/** The persuasion roll was decided by the engine; the narrator only stages the answer of the NPC. */
export function buildRecruitNarrationPrompt(input: RecruitNarrationInput): PromptOut {
  const plan = planLength("recruit", "");
  const system =
    "Eres el narrador de un rol de piratas de One Piece. Un jugador acaba de invitar a un personaje no jugador a unirse a su tripulación como nakama. " +
    "El resultado ya está decidido por el motor y es definitivo: narra la respuesta del PNJ con voz y motivos propios, sin cambiarlo. " +
    "No inventes números, poderes ni objetos. No decidas nada del jugador más allá de lo que escribió. No reveles que eres una IA. " +
    ROLE_RULES +
    " " +
    SCENE_STYLE_RULE;
  const transcript = input.recentScene && input.recentScene.length > 0 ? `\n\nLo que ha pasado en esta escena hasta ahora:\n${input.recentScene.join("\n")}` : "";
  const user =
    `${input.characterName} (isla: ${input.islandName}) invita a ${input.npcName} (${input.role}) a unirse a su tripulación.\n` +
    (input.accepted
      ? `Resultado decidido: ${input.npcName} ACEPTA. Narra el momento con emoción y deja claro que desde ahora es su nakama y qué aporta (${input.role}).`
      : `Resultado decidido: ${input.npcName} RECHAZA (por ahora). Narra sus razones con respeto y deja la puerta abierta, sin hostilidad.`) +
    transcript +
    "\n\nNo repitas lo que el jugador escribió: empieza por la reacción de la otra persona." +
    `\n\n${plan.instruction}`;
  return { system, user, maxTokens: plan.maxTokens };
}


export interface WorldEventNarrationInput {
  kind: "death" | "capture";
  /** True when the arc is a former Yonko going for a sitting Yonko's throne. */
  reclaim?: boolean;
  /** 1..totalStages = a build-up chapter; totalStages + 1 = the verdict. */
  stage: number;
  totalStages: number;
  chapterLabel: string;
  /** Chapter instruction, already filled with the names. */
  brief: string;
  targetName: string;
  aggressorName?: string | null;
  locationName: string;
  /** One line per chapter already published, oldest first: the story so far. */
  storySoFar: string[];
  /** Set only on the verdict, once the game owner has decided. */
  verdict?: "death" | "capture" | "survived" | "reclaimed";
}

const WORLD_EVENT_BUILDUP_RULE =
  "Escribes un capítulo de un EVENTO MUNDIAL en desarrollo, para el periódico de un rol de piratas de One Piece. Es una saga lenta: cada capítulo añade contexto y tensión, y el desenlace lo decidirá otra persona más adelante. " +
  "REGLA ABSOLUTA: en este capítulo NADIE muere, es capturado ni cae definitivamente, y no insinúes ni anticipes el resultado final: los personajes canon siguen vivos, libres y en su puesto al terminar el texto. " +
  "Puedes narrar rumores, movimientos, bajas menores sin nombre, daños, traiciones, alianzas y miedo. Continúa la historia sin contradecir los capítulos anteriores ni repetirlos. " +
  "Sitúa SIEMPRE los hechos en el lugar indicado y menciónalo en el texto. No reveles que eres una IA.";

const WORLD_EVENT_VERDICT_RULE =
  "Escribes el DESENLACE de un evento mundial para el periódico de un rol de piratas de One Piece. El resultado YA está decidido y es definitivo (te lo dan abajo): narralo como un hecho consumado, con peso, dignidad y consecuencias para el mundo, enlazando con la historia de los capítulos anteriores sin contradecirla. " +
  "No cambies el resultado ni lo dejes ambiguo. Sitúa los hechos en el lugar indicado y menciónalo. No reveles que eres una IA.";

const WORLD_EVENT_STYLE_RULE =
  "Escribe en español, con tono de periódico de piratas de One Piece, vívido y serio. " +
  'Responde EXCLUSIVAMENTE con un objeto JSON como {"headline": "...", "body": "..."}: un titular de una frase y un cuerpo de 3 a 5 frases. ' +
  "No añadas explicación ni markdown fuera del JSON.";

export function buildWorldEventPrompt(input: WorldEventNarrationInput): { system: string; user: string } {
  const isVerdict = input.verdict !== undefined;
  const system = `${isVerdict ? WORLD_EVENT_VERDICT_RULE : WORLD_EVENT_BUILDUP_RULE} ${WORLD_EVENT_STYLE_RULE}`;
  const story = input.storySoFar.length ? `\nLa historia hasta ahora:\n${input.storySoFar.map((l, i) => `${i + 1}. ${l}`).join("\n")}\n` : "\n(Este es el primer capítulo.)\n";
  const verdictLine = !isVerdict
    ? ""
    : input.verdict === "death"
    ? `RESULTADO DECIDIDO: ${input.targetName} MUERE en este enfrentamiento${input.aggressorName ? ` a manos de ${input.aggressorName} o de sus fuerzas` : ""}.\n`
    : input.verdict === "reclaimed"
    ? `RESULTADO DECIDIDO: ${input.aggressorName} DERROTA a ${input.targetName}, recupera el título de Yonko y se queda con su territorio. ${input.targetName} sigue vivo pero pierde el trono y huye. Narra el cambio de poder y sus consecuencias en el mundo.
`
    : input.verdict === "capture"
    ? `RESULTADO DECIDIDO: ${input.targetName} es CAPTURADO${input.aggressorName ? ` por ${input.aggressorName}` : ""} y queda preso.\n`
    : `RESULTADO DECIDIDO: ${input.targetName} SOBREVIVE y escapa contra todo pronóstico; ${input.aggressorName ?? "sus perseguidores"} fracasa(n). Narra la huida y sus consecuencias.\n`;
  const user =
    `Evento: ${input.reclaim ? "el intento de recuperar el trono de Yonko de" : input.kind === "capture" ? "la caza de" : "el enfrentamiento mortal de"} ${input.targetName}${input.aggressorName ? ` contra ${input.aggressorName}` : ""}.\n` +
    `Lugar de los hechos: ${input.locationName}.\n` +
    (isVerdict ? `Capítulo final (desenlace).\n` : `Capítulo ${input.stage} de ${input.totalStages}: ${input.chapterLabel}.\nQué muestra este capítulo: ${input.brief}\n`) +
    verdictLine +
    story +
    "\nEscribe el titular y el cuerpo.";
  return { system, user };
}

export interface ColiseumMatchInput {
  a: string;
  b: string;
  winner: string;
  aHpPct: number;
  bHpPct: number;
  walkover?: boolean;
}

export interface ColiseumNarrationInput {
  roundLabel: string;
  matches: ColiseumMatchInput[];
  prize: string;
  finalRound: boolean;
  champion?: string;
}

/** A round of the Dressrosa Coliseum: every result is already decided (and non-lethal); the narrator only stages the crowd and the fights. */
export function buildColiseumPrompt(input: ColiseumNarrationInput): PromptOut {
  const words = Math.min(300, 70 + input.matches.length * 30);
  const system =
    "Eres el cronista del Coliseo de Dressrosa en un rol de piratas de One Piece. Los resultados de cada combate ya están decididos y son definitivos: cuéntalos con ritmo, sin cambiarlos. " +
    "Es un torneo de gladiadores NO letal: nadie muere ni queda mutilado, los derrotados salen del arena por su propio pie o en camilla. No inventes combates, participantes ni premios que no se te den. " +
    "Usa los nombres tal cual. No reveles que eres una IA. Escribe en español, con lenguaje sencillo, sin listas ni markdown. " +
    `EXTENSIÓN: alrededor de ${words} palabras como máximo; una o dos frases por combate y una mención al público.`;
  const lines = input.matches.map((m, i) => `${i + 1}. ${m.a} vs ${m.b}: ${m.walkover ? `${m.winner} avanza porque su rival no se presentó` : `gana ${m.winner} (salud final: ${m.a} ${m.aHpPct}%, ${m.b} ${m.bHpPct}%)`}`).join("\n");
  const user =
    `${input.roundLabel}.\nResultados ya decididos:\n${lines}\n` +
    `Premio del torneo: ${input.prize}.\n` +
    (input.finalRound && input.champion ? `Es la FINAL: ${input.champion} es el campeón y se lleva el premio. Cierra con la ceremonia.` : "Termina anunciando que los ganadores pasan a la siguiente ronda.");
  return { system, user, maxTokens: Math.round(words * 2.6) + 80 };
}

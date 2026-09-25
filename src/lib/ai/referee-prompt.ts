/**
 * The referee prompt. There are no dice in this game any more: the model judges every exchange by logic and
 * answers with JSON (a narration plus what each fighter loses). Code only bounds and applies it (engine/referee.ts).
 */
import { PLAY_TO_WIN_RULE } from "../engine/enemy-kit";
import { ROLE_RULES, type PromptOut } from "./narrate-prompt";
import { planLength, currentActionBlock } from "../engine/narration-length";
import { MAX_HP_LOSS_FRACTION, MAX_STAMINA_LOSS } from "../engine/referee";

export interface RefereeActor {
  name: string;
  /** "player" and "ally" are people or friends of people; "enemy" is voiced by you. */
  side: "player" | "ally" | "enemy";
  level?: number;
  hp: number;
  maxHp: number;
  stamina?: number;
  /** Physical condition in words, only when not fresh. */
  fatigue?: string;
  /** Full repertoire (Haki, fruit, weapon, style, abilities): the ceiling of what this fighter can do. */
  kit?: string;
  personality?: string;
  /** Rough combat sheet (attack/defence/speed) as a relative strength hint. */
  sheet?: string;
}

export interface RefereeAction {
  name: string;
  text: string;
  technique?: string;
}

export interface RefereeInput {
  mode: "solo" | "duel" | "joint";
  actors: RefereeActor[];
  actions: RefereeAction[];
  /** What the rival(s) announced last beat and is still coming (the last narrator message). Absent = nothing pending. */
  pendingThreat?: string;
  /** The player started this fight: nothing pending, the rival has not attacked yet. */
  openingStrike?: boolean;
  lethal?: boolean;
  isBoss?: boolean;
  stakes?: string;
  recentScene?: string[];
  memorySummary?: string;
  /** Tone/notes directives of the player (loadDirectives), appended verbatim. */
  directives?: string;
  /** Round number, only to reason about a long fight. */
  round?: number;
}

const CORE_RULES =
  "Eres el ÁRBITRO y narrador de un combate de rol de One Piece. NO existen los dados en este juego: TÚ decides cada resultado con lógica, coherencia y justicia, " +
  "y respondes con un JSON que trae tu narración y cuánta vida y aguante pierde cada bando. " +
  "CÓMO JUZGAR: compara lo que cada combatiente PUEDE hacer de verdad (nivel, vida y aguante actuales, cansancio, Haki, fruta, arma, estilo, habilidades) con lo que se DESCRIBE y con el entorno. " +
  "El más fuerte suele imponerse, pero no siempre ni sin coste; una jugada ingeniosa y verosímil puede sorprenderlo; una técnica fuera del alcance de quien la intenta falla, sale corta o le pasa factura. " +
  "Un golpe que se bloquea, esquiva, desvía o contraataca con éxito no hace daño. Lo débil no arrasa a lo fuerte con un solo golpe, y lo fuerte no es invulnerable. El cansancio empeora todo. " +
  "ESCALA DE PÉRDIDA DE VIDA (sobre la vida MÁXIMA del que la sufre): roce o golpe flojo 2-6%; golpe sólido 8-18%; golpe muy fuerte 20-35%; golpe devastador hasta " +
  `${Math.round(MAX_HP_LOSS_FRACTION * 100)}%. Nadie pierde más de la mitad de su vida máxima en un solo intercambio, así que solo se puede rematar a quien ya está por debajo de la mitad; ` +
  `si el golpe lo deja sin vida, su pérdida de vida debe ser igual a su vida actual. Aguante: esfuerzo, impactos y técnicas costosas pesan (0 a ${MAX_STAMINA_LOSS} puntos por intercambio). ` +
  "ORDEN OBLIGATORIO DE LA NARRACIÓN, con estos tres pasos siempre presentes: " +
  "(1) Si había un ataque del rival PENDIENTE (el último mensaje del narrador terminaba con él), resuélvelo AHORA según cómo el jugador dijo recibirlo (bloquea, esquiva, desvía, aguanta, contraataca...). " +
  "Si el jugador no dijo nada sobre defenderse, usa sus reflejos normales y el sentido común: puede recibir parte del golpe, ni indefenso ni invulnerable (mano blanca). " +
  "(2) El ataque del jugador y la REACCIÓN OBLIGATORIA del rival: cómo lo recibe (bloquea, esquiva, contraataca, lo encaja), en qué estado queda (ileso, herido, tambaleante, de rodillas, caído, inconsciente) y si sigue respondiendo. " +
  "Jamás dejes al rival sin reacción ni sin estado visible. " +
  "(3) El rival pasa a la ofensiva con creatividad y ganas de destrozar a su enemigo aunque sea más fuerte (combos, encadenados, su repertorio completo): descríbelo lanzando su próximo ataque, ANUNCIADO y todavía sin resolver. " +
  "Ese ataque nuevo NO causa ningún daño en este veredicto: el jugador decidirá en su siguiente mensaje cómo lo recibe. Termina justo ahí, dejando la iniciativa al jugador. " +
  "SOLO SE HIERE LO QUE SE ATACA DE VERDAD: si el jugador golpea el suelo, clava su arma en un muelle, provoca, habla o hace ostentación, el rival NO pierde vida por eso (puede reaccionar, burlarse o atacar). Ningún daño sin un ataque real contra él. " +
  "NUNCA le apliques al jugador un golpe que no haya tenido opción de recibir: no escribas \"sientes el golpe en tu costado\" ni similares sobre un ataque nuevo del rival. " +
  "El rival siempre tiene NOMBRE propio (si no lo tenía, ponle uno con sabor One Piece y úsalo siempre). " +
  "MANO NEGRA: nunca decidas qué hace, siente o piensa el personaje del jugador; solo qué le ocurre físicamente por los ataques ya lanzados y según cómo escribió recibirlos. " +
  "Cada NPC actúa según su personalidad, motivos y capacidades reales, inventando nada fuera de su repertorio. " +
  PLAY_TO_WIN_RULE +
  " No reveles que eres una IA. " +
  ROLE_RULES;

const STRUCTURE_RULE =
  "ESTRUCTURA FIJA de la narración (en modo solo o grupo): PÁRRAFO 1 = cómo se resuelve lo pendiente y lo que hizo el jugador (impacta, se bloquea, se esquiva...). " +
  "PÁRRAFO 2 = el estado y la reacción del rival ante ese golpe, con su nombre y en su voz (¿sigue en pie?, ¿herido?, ¿tambaleante?, ¿contraataca?, una línea de diálogo si tiene personalidad). " +
  "PÁRRAFO 3 (el último, SIEMPRE) = el rival lanza su siguiente ataque, con creatividad y usando su repertorio, descrito en el aire y SIN resolver, terminando ahí. Si el rival cae o queda inconsciente, en su lugar el último párrafo dice claramente que no puede seguir. " +
  "Dirígete al jugador en SEGUNDA persona (\"tú\", \"tu espada\") y no escribas su nombre en tercera persona. No cuentes lo que el jugador siente o piensa: solo lo que ocurre.";

const JSON_RULE =
  "FORMATO DE SALIDA: responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto fuera de él: " +
  '{"narracion":"texto en español, en prosa, sin listas","cambios":[{"nombre":"Nombre exacto","vida":0,"aguante":0}]}. ' +
  "En \"cambios\" incluye a CADA combatiente con la vida y el aguante que PIERDE en este veredicto (enteros >= 0; 0 si no pierde nada). Usa los nombres exactos que se te dan.";

function actorLine(a: RefereeActor): string {
  const role = a.side === "enemy" ? "RIVAL (lo narras tú)" : a.side === "ally" ? "ALIADO" : "JUGADOR";
  return (
    `- ${a.name} [${role}]${a.level ? `, nivel ${a.level}` : ""}: vida ${a.hp}/${a.maxHp}` +
    (a.stamina !== undefined ? `, aguante ${a.stamina}` : "") +
    (a.fatigue ? `, ${a.fatigue}` : "") +
    (a.personality ? `. Personalidad: ${a.personality}` : "") +
    (a.sheet ? `. Ficha: ${a.sheet}` : "") +
    (a.kit ? `\n  ${a.kit.replace(/\n/g, "\n  ")}` : "")
  );
}

export function buildRefereePrompt(input: RefereeInput): PromptOut {
  const lastAction = input.actions.map((a) => a.text).join(" ");
  const plan = planLength(input.mode === "solo" ? "combat_round" : "group", lastAction);
  // The referee must fit three beats plus the reaction, so it never gets the tight default budget.
  const maxWords = input.mode === "duel" ? 90 : Math.max(plan.maxWords, input.mode === "joint" ? 240 : 190);

  const modeRules =
    input.mode === "duel"
      ? "MODO DUELO ENTRE JUGADORES: aquí eres un ÁRBITRO IMPARCIAL, no un narrador. Ambos jugadores actuaron a la vez; lee lo que CADA UNO escribió (cómo ataca y cómo se defiende) y decide con justicia cómo aterriza cada ataque sobre el otro: impacta, es bloqueado, esquivado, desviado o parcial, y cuánto cuesta en vida y aguante, teniendo en cuenta nivel, cansancio y capacidades reales de cada uno. " +
        "REGLA DE ROL: cada jugador es responsable de sus propias acciones y de cómo recibe las del otro; solo resulta herido si su propio texto lo permite (no se defiende, decide encajar el golpe) o si su defensa no es plausible para sus capacidades y su cansancio ACTUALES. Un bloqueo o esquiva verosímil descrito por un jugador se respeta; si nadie se hizo daño, dilo. Si un jugador escribió por el otro, ignóralo. NO cuentes una historia ni des voz a nadie: 2 a 4 frases neutras que digan cómo terminó cada ataque y cómo queda cada uno. NO decidas por ellos lo que hacen después. Si alguien se queda sin vida, dilo con claridad. Los pasos (1), (2) y (3) de arriba NO aplican. " +
        (input.lethal ? "Es un duelo A MUERTE: las heridas son graves. " : "Es un duelo amistoso: quien cae queda fuera de combate, vivo. ")
      : input.mode === "joint"
      ? "MODO GRUPO: varios aliados contra el mismo rival, todos actuaron a la vez. Narra UNA escena coral con protagonismo para cada uno según lo que escribió, y la REACCIÓN del rival a cada golpe. " +
        "Los aliados NPC (sin texto propio) actúan según su ficha y su papel. Si había un ataque pendiente del rival, resuélvelo contra quien corresponda según cómo cada jugador dijo recibirlo. " +
        "Quien queda con vida 0 está fuera de combate, pero no lo narres como muerto: el destino lo decide el juego después. Si el rival cae, añade al JSON el campo \"golpe_final\" con el nombre exacto del aliado que le da el golpe decisivo."
      : "MODO COMBATE SOLO CONTRA UN RIVAL.";
  const openingRule = input.openingStrike
    ? "El jugador ACABA de iniciar la agresión: el rival todavía no ha atacado, así que no hay ataque pendiente que resolver y el jugador NO pierde vida ni aguante en este veredicto; el rival reacciona y prepara su respuesta."
    : "";

  const system = `${CORE_RULES} ${modeRules} ${openingRule} ${input.mode === "duel" ? "" : STRUCTURE_RULE + " "}${JSON_RULE} ` +
    `Extensión de la narración: como máximo unas ${maxWords} palabras, frases claras; es un combate ${input.isBoss ? "importante contra un enemigo formidable" : "menor"}.` +
    (input.directives ?? "");

  const user =
    (input.stakes ? `Lo que está en juego: ${input.stakes}\n` : "") +
    (input.round ? `Intercambio número ${input.round}.\n` : "") +
    `Combatientes:\n${input.actors.map(actorLine).join("\n")}\n\n` +
    (input.mode === "duel" ? "Movimientos simultáneos:\n" : "Lo que escribió el jugador en su mensaje:\n") +
    input.actions.map((a) => `- ${a.name}: "${a.text}"${a.technique ? ` (usando ${a.technique})` : ""}`).join("\n") +
    "\n\n" +
    (input.mode !== "duel"
      ? input.pendingThreat
        ? `ATAQUE PENDIENTE DEL RIVAL (es el final del último mensaje del narrador; lo resuelves ahora según cómo el jugador dijo recibirlo):\n"""${input.pendingThreat.slice(-900)}"""\n\n`
        : "No hay ataque pendiente del rival.\n\n"
      : "") +
    (input.memorySummary ? `Lo que se recuerda hasta ahora: ${input.memorySummary}\n` : "") +
    (input.recentScene && input.recentScene.length > 0 ? `Escena reciente:\n${input.recentScene.join("\n")}\n` : "") +
    (input.actions[0] && input.mode !== "duel" ? currentActionBlock(input.actions[0].text) : "") +
    "\n\nResponde solo con el JSON.";
  return { system, user, maxTokens: Math.round(maxWords * 2.6) + 260 };
}

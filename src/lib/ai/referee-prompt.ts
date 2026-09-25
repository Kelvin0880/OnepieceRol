/**
 * The referee prompt. There are no dice in this game: the model judges every exchange by logic and answers with
 * JSON. Its rules are the owner's own roleplay rules (Reglasrol.txt): Mano Negra (never decide the result of an
 * attack against someone before they can react; attacks are written as INTENTIONS) and Mano Blanca (never exploit
 * what the player left unwritten, and never invent acts for them). Code then bounds and applies the numbers
 * (engine/referee.ts) and strips whatever still breaks those rules (sanitizeVerdict).
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
  /** Every exchange of this fight so far (getFightLog); when present it replaces recentScene. */
  fightLog?: string[];
  memorySummary?: string;
  /** Tone/notes directives of the player (loadDirectives), appended verbatim. */
  directives?: string;
  /** Round number, only to reason about a long fight. */
  round?: number;
  /** The player's message is an attempt to flee the fight (solo). */
  fleeAttempt?: boolean;
}

const ROLE_LAW =
  "REGLAS DE ROL OBLIGATORIAS (las del dueño del juego, Reglasrol.txt). " +
  "MANO NEGRA = decidir el resultado de un ataque contra alguien sin darle opción de reaccionar. Por eso TODO ataque nuevo (del jugador, de un rival o de un aliado) se escribe SIEMPRE como INTENCIÓN, en grado de tentativa: " +
  "\"intenta\", \"dirige\", \"con la intención de\", y puede incluir su alcance para que el otro lo valore (\"si llega a conectar, le abriría un corte profundo en diagonal\", \"tiene fuerza para lanzarlo diez metros\"). " +
  "Un ataque nuevo NUNCA se da por conectado: se resuelve en el turno siguiente, cuando el defensor escriba cómo lo recibe. " +
  "MANO BLANCA = aprovecharse de lo que el otro no escribió. Usa sentido común (su personaje está despierto, alerta, con reflejos normales) y respeta lo que SÍ escribió. " +
  "Y sobre todo: NUNCA escribas por el jugador un movimiento, esquiva, bloqueo, contraataque, ataque, salto, palabra ni pensamiento que él no escribió. " +
  "Si solo escribe \"activo mi Haki de observación\", su personaje percibe mejor; NO esquiva, NO bloquea, NO ataca. Solo el propio usuario decide qué hace su personaje.";

const CORE_RULES =
  "Eres el ÁRBITRO de un combate de rol por escrito de One Piece. NO existen los dados: TÚ decides los resultados con lógica, coherencia y justicia, " +
  "y respondes con un JSON con tu texto y la vida y el aguante que pierde cada bando. " +
  ROLE_LAW + " " +
  "CÓMO RESOLVER: compara lo que cada combatiente PUEDE hacer de verdad (nivel, vida y aguante actuales, cansancio, Haki, fruta, arma, estilo, habilidades) con lo que se ESCRIBIÓ y con el entorno. " +
  "Lo declarado son INTENCIONES, no garantías: una intención inverosímil para las capacidades de quien la escribe falla, sale corta o le pasa factura; una jugada ingeniosa y verosímil puede sorprender a alguien más fuerte. " +
  "Los alcances que declaran (\"si le llega a dar lo dejaría atontado\") sirven para medir el NIVEL del ataque; tú decides el resultado real y el daño. " +
  "(1) El ataque PENDIENTE del rival (el último mensaje del narrador terminaba con su intención) se resuelve AHORA contra lo que el jugador escribió para recibirlo. " +
  "Si declaró una defensa, esquiva o contra, respétala como intención y decide si funciona (velocidad, nivel, Haki, cansancio, distancia). " +
  "Si NO declaró cómo recibirlo, el golpe se resuelve solo con sus capacidades pasivas y su estado, y normalmente llega. " +
  "Describe ese resultado SIN atribuirle movimientos: \"el puñetazo te alcanza el costado\", \"el golpe pasa a un palmo de tu cara\"; nunca \"esquivas\", \"bloqueas\" o \"logras\" si él no lo escribió. " +
  "(2) El ataque que el jugador ESCRIBIÓ es una intención: decide con lógica si el rival lo esquiva, bloquea, contraataca o lo encaja, y con qué resultado. El rival juega para GANAR y reacciona siempre que pueda. " +
  "Un golpe bloqueado, esquivado, desviado o contraatacado con éxito no hace daño. El cansancio empeora todo. " +
  "ESCALA DE PÉRDIDA DE VIDA (sobre la vida MÁXIMA del que la sufre): roce o golpe flojo 2-6%; golpe sólido 8-18%; golpe muy fuerte 20-35%; devastador hasta " +
  `${Math.round(MAX_HP_LOSS_FRACTION * 100)}%. Nadie pierde más de la mitad de su vida máxima en un intercambio, así que solo se puede rematar a quien ya está por debajo de la mitad; ` +
  `si el golpe lo deja sin vida, su pérdida de vida debe ser igual a su vida actual. Aguante: esfuerzo, impactos y técnicas costosas pesan (0 a ${MAX_STAMINA_LOSS} por intercambio). ` +
  "COHERENCIA OBLIGATORIA: la vida y el aguante de \"cambios\" deben corresponder EXACTAMENTE a lo que narras. Si un golpe alcanza con fuerza a alguien, no puede costar 0; si nadie recibe daño, todo va a 0; si narras una herida profunda, usa la escala de arriba. " +
  "NUNCA escribas cifras de vida ni de aguante en la narración (ni \"434 de vida\" ni porcentajes): el estado de cada uno se cuenta con el cuerpo, la respiración, las heridas y la postura; solo el JSON lleva números. " +
  "MEMORIA: recuerda TODO lo ocurrido en este combate (heridas acumuladas, técnicas y trucos ya usados, lo que el rival ya vio); un rival ya castigado no vuelve a estar fresco, y uno que ya vio un truco no cae dos veces igual. " +
  "NO repitas ni resumas lo que el jugador escribió (ya está en pantalla): empieza directamente por el resultado. " +
  "SOLO SE HIERE LO QUE SE ATACA DE VERDAD: si el jugador golpea el suelo, clava su arma en un muelle, provoca, habla o presume, el rival NO pierde vida por eso. " +
  "PODER RELATIVO: el daño que alguien puede causar depende de SU poder frente a la resistencia del otro (nivel, ficha, Haki). Un rival mucho más débil (diferencia de 10 o más niveles) no puede infligir golpes sólidos ni muy fuertes a alguien mucho más fuerte: como mucho roces, y solo si el más fuerte se lo permite; y al revés, un ataque bien descrito de alguien muy superior hace daño real. " +
  "El rival siempre tiene NOMBRE propio (si no lo tenía, ponle uno con sabor One Piece y úsalo siempre). " +
  PLAY_TO_WIN_RULE +
  " No reveles que eres una IA. " +
  ROLE_RULES;

// Reported: the rival threw the same fireball line every round and never learned from a repeated trick.
const RIVAL_CRAFT =
  "OFICIO DEL RIVAL (obligatorio): su \"intencion_rival\" es una SECUENCIA larga y estructurada (de 5 a 10 frases, o más si la jugada lo pide; sin tope), no un golpe suelto; el rival NUNCA se contiene ni se limita al atacar y escribe con el mismo nivel de detalle, planificación y ambición que un jugador experto que desarrolla sus ataques por fases (cada fase con su técnica, su intención y su alcance): una finta o preparación, el golpe principal con su técnica (nómbrala) y un seguimiento o contraataque listo por si el jugador esquiva o bloquea (\"y si se aparta, gira y ...\"). MODELO DE ATAQUE LARGO (el estilo de los mejores jugadores de este juego, aprende de él): una frase de diálogo o burla en voz alta, luego la preparación (activa su Haki o su fruta en una fase concreta), luego el movimiento principal con el nombre de la técnica y cómo afecta al terreno y al ambiente, luego lo que INTENTA lograr con su alcance (\"con la intención de que, si llega a conectar, ...\"), y por último el plan B según cómo responda el otro. Escribe así de largo y completo siempre que la situación lo permita; jamás resumas un ataque a una línea. Ejemplo de forma: \"Rocco intenta amagar un derechazo alto para hacerte subir la guardia y, en cuanto lo haga, con la intención de clavar su rodilla cubierta de Haki en tu costado (Rompecostillas); si llega a conectar, te dejaría sin aire. Si te apartas del rodillazo, gira sobre su pie de apoyo para intentar un codazo descendente; si bloqueas, intenta agarrarte la muñeca para arrastrarte contra su cabezazo.\" " +
  "NUNCA repitas la técnica, el ángulo ni la estructura del ataque anterior del rival (el pendiente): cambia de técnica, de distancia, de zona del cuerpo o usa el terreno, la multitud, un arma o un objeto. " +
  "APRENDE: si el jugador ya usó el mismo truco (cambiar de sitio, contraatacar con lo mismo, un Haki), el rival lo nota, lo dice o lo piensa y cambia de plan (ataca desde otro flanco, rompe el contacto visual, engaña primero, ataca al espacio donde el jugador aparecería). " +
  "NIVEL DE ESTRATEGA: el rival combate como un maestro que estudia a su enemigo: lee su estilo, su fatiga, sus heridas y lo que ya le vio hacer en el REGISTRO DEL COMBATE, y prepara jugadas ingeniosas: fintas (amaga un golpe para ejecutar otro), cebos, trampas, ataques en pinza, cambios de ritmo, uso del terreno, del público y de los objetos, presión sobre la debilidad conocida del jugador, y su carta oculta cuando la pelea se pone seria. " +
  "Cada turno usa una pieza distinta y concreta de su repertorio (Haki, fruta y fase, arma, estilo, habilidades nombradas), combinándolas en cadena, y ESCALA con el avance del combate (más ingenio y riesgo cuanto más se alarga o más peligro corre). Sabe con exactitud sus límites y los de todos a su alrededor: nunca usa lo que no tiene, pero exprime al máximo lo que sí. " +
  "Da continuidad (continuidad total): su nuevo plan responde a lo ocurrido en las rondas anteriores (retoma una amenaza, un truco visto, una promesa) sin mezclar personajes, escenas ni hechos ajenos a este combate. "
  +
  "Y mientras esté herido o cansado, su estilo lo muestra (más desesperado, más peligroso o más cauto), sin dejar de intentar ganar. ";

const SOLO_FORMAT =
  "TRES TEXTOS EN EL JSON (en segunda persona hacia el jugador: \"tu espada\", \"te alcanza\"; nunca su nombre en tercera persona): " +
  "\"resultado\": qué pasó con el ataque pendiente y con el ataque que escribió el jugador, en pasado y neutral, sin atribuirle nada que no escribió. " +
  "\"reaccion_rival\": cómo queda el rival (con su nombre: en pie, herido, tambaleante, de rodillas, caído, inconsciente) y cómo responde (una línea suya si tiene personalidad); NUNCA vacío mientras siga en el combate. " +
  "\"intencion_rival\": el SIGUIENTE ataque del rival escrito como INTENCIÓN con su alcance, empezando por su nombre y con verbos de tentativa (\"Rocco intenta ... con la intención de ...; si llega a conectar, ...\"), creativo, encadenando combos y usando todo su repertorio para reventar a su enemigo aunque sea más fuerte. " +
  RIVAL_CRAFT +
  "NO lo resuelvas ni hagas que dañe a nadie: el jugador decidirá en su siguiente mensaje cómo lo recibe. Si el rival cayó o no puede seguir, déjalo vacío y di en \"reaccion_rival\" que no puede continuar. ";

const JSON_TAIL =
  "\"cambios\": [{\"nombre\":\"Nombre exacto\",\"vida\":0,\"aguante\":0}] con CADA combatiente y lo que PIERDE en este veredicto (enteros >= 0, 0 si nada). " +
  "\"derrotados\": [\"Nombre exacto\"] solo con quien, tras este intercambio, YA NO PUEDE SEGUIR luchando (inconsciente, muerto o incapaz); lista vacía [] si todos siguen. " +
  "Solo puedes listar a alguien cuya vida actual esté por DEBAJO de la mitad de su vida máxima, y su pérdida de vida en \"cambios\" debe ser igual a su vida actual. " +
  "Si NO lo listas, no narres que cae, muere, queda inconsciente ni que el combate termina: queda en pie, tambaleante o de rodillas. Si sí lo listas, la narración debe dejar claro que ya no puede continuar. " +
  "Responde ÚNICAMENTE con ese objeto JSON válido, sin markdown ni texto fuera de él.";

/** Concrete HP figures for the damage scale, so the model does not have to do percentages in its head. */
export function damageScale(maxHp: number): string {
  const pts = (lo: number, hi: number) => `${Math.max(1, Math.round((maxHp * lo) / 100))}-${Math.max(1, Math.round((maxHp * hi) / 100))}`;
  return `daño que puede recibir: roce ${pts(2, 6)}; golpe sólido ${pts(8, 18)}; muy fuerte ${pts(20, 35)}; devastador hasta ${Math.floor(maxHp * MAX_HP_LOSS_FRACTION)}`;
}

function conditionWord(f: number): string {
  return f > 0.85 ? "casi intacto" : f > 0.6 ? "algo herido" : f > 0.35 ? "malherido" : f > 0.15 ? "al borde de caer" : "a punto de desplomarse";
}

function actorLine(a: RefereeActor): string {
  const role = a.side === "enemy" ? "RIVAL (lo voceas tú)" : a.side === "ally" ? "ALIADO" : "JUGADOR";
  return (
    `- ${a.name} [${role}]${a.level ? `, nivel ${a.level}` : ""}: vida ${a.hp}/${a.maxHp} (${conditionWord(a.hp / Math.max(1, a.maxHp))})` +
    (a.stamina !== undefined ? `, aguante ${a.stamina}` : "") +
    (a.fatigue ? `, ${a.fatigue}` : "") +
    ` (${damageScale(a.maxHp)})` +
    (a.personality ? `. Personalidad: ${a.personality}` : "") +
    (a.sheet ? `. Ficha: ${a.sheet}` : "") +
    (a.kit ? `\n  ${a.kit.replace(/\n/g, "\n  ")}` : "")
  );
}

export function buildRefereePrompt(input: RefereeInput): PromptOut {
  const lastAction = input.actions.map((a) => a.text).join(" ");
  const plan = planLength(input.mode === "solo" ? "combat_round" : "group", lastAction);
  // Three texts must fit, so the referee never gets the tight default budget.
  const maxWords = input.mode === "duel" ? 90 : Math.max(plan.maxWords, input.mode === "joint" ? 700 : 650);

  const modeRules =
    input.mode === "duel"
      ? "MODO DUELO ENTRE JUGADORES: aquí eres un ÁRBITRO IMPARCIAL, no un narrador. Ambos jugadores actuaron a la vez y escribieron INTENCIONES; lee lo que CADA UNO escribió (cómo ataca y cómo se defiende) y decide con justicia cómo aterriza cada ataque sobre el otro: impacta, es bloqueado, esquivado, desviado o parcial, y cuánto cuesta en vida y aguante, según nivel, cansancio y capacidades reales. " +
        "REGLA DE ROL: cada jugador es responsable de sus acciones y de cómo recibe las del otro; solo resulta herido si su propio texto lo permite o si su defensa no es plausible para sus capacidades y su cansancio ACTUALES. Un bloqueo o esquiva verosímil descrito por un jugador se respeta. " +
        "Nunca escribas acciones que un jugador no escribió. NO cuentes una historia ni des voz a nadie: 2 a 4 frases neutras con cómo terminó cada ataque y cómo queda cada uno. Si alguien se queda sin vida, dilo con claridad. " +
        (input.lethal ? "Es un duelo A MUERTE: las heridas son graves. " : "Es un duelo amistoso: quien cae queda fuera de combate, vivo. ") +
        "En el JSON usa solo \"resultado\" (todo el texto) y \"cambios\"."
      : input.mode === "joint"
      ? "MODO GRUPO: varios aliados contra el mismo rival, todos escribieron intenciones a la vez. Da protagonismo a cada uno según lo que escribió y muestra la REACCIÓN del rival a cada intención. " +
        "Los aliados NPC (sin texto propio) actúan según su ficha y su papel, siempre en grado de tentativa. Si había un ataque pendiente del rival, resuélvelo contra quien corresponda según cómo cada jugador dijo recibirlo. " +
        "Quien queda con vida 0 está fuera de combate, pero no lo narres como muerto: el destino lo decide el juego después. Si el rival cae, añade al JSON \"golpe_final\" con el nombre exacto del aliado que le da el golpe decisivo. " +
        "Si algún aliado INTENTA HUIR, decide con lógica quién escapa y pon sus nombres exactos en \"huyen\" (lista, vacía si nadie); quien huye con éxito no pierde vida y quien no lo logra sigue en el combate. " +
        SOLO_FORMAT
      : "MODO COMBATE SOLO CONTRA UN RIVAL. " + SOLO_FORMAT;
  const fleeRule = input.fleeAttempt
    ? "EL JUGADOR INTENTA HUIR de este combate (lo que escribió es su intención, no un hecho). Decide con lógica si el rival lo permite o lo alcanza (velocidad, nivel, entorno, lo bien pensado que esté lo que escribió, el estado de cada uno) y añade al JSON \"huida\": true si escapa o false si lo alcanzan. Si escapa, nadie pierde vida y \"intencion_rival\" queda vacía. Si lo alcanzan, resuelve el alcance del rival como un intercambio normal (con la escala de vida) y deja su siguiente intención anunciada. "
    : "";
  const openingRule = input.openingStrike
    ? "El jugador ACABA de iniciar la agresión: el rival todavía no ha atacado, así que no hay ataque pendiente que resolver y el jugador NO pierde vida ni aguante en este veredicto; el rival reacciona y deja su respuesta anunciada como intención."
    : "";

  const system = `${CORE_RULES} ${modeRules} ${openingRule} ${fleeRule}${JSON_TAIL} ` +
    `Extensión total de los textos: sin límite práctico (hasta unas ${maxWords} palabras); NO te contengas ni recortes: el ataque del rival y el resultado deben ser tan largos, estructurados y detallados como pida la jugada, igualando la riqueza de lo que escribió el jugador; es un combate ${input.isBoss ? "importante contra un enemigo formidable" : "menor"}.` +
    (input.directives ?? "");

  const user =
    (input.stakes ? `Lo que está en juego: ${input.stakes}\n` : "") +
    (input.round ? `Intercambio número ${input.round}.\n` : "") +
    `Combatientes:\n${input.actors.map(actorLine).join("\n")}\n\n` +
    (input.mode === "duel" ? "Intenciones simultáneas:\n" : "Lo que escribió el jugador en su mensaje (son sus INTENCIONES; solo esto es suyo):\n") +
    input.actions.map((a) => `- ${a.name}: "${a.text}"${a.technique ? ` (usando ${a.technique})` : ""}`).join("\n") +
    "\n\n" +
    (input.mode !== "duel"
      ? input.pendingThreat
        ? `INTENCIÓN PENDIENTE DEL RIVAL (final del último mensaje del narrador; se resuelve ahora según lo que el jugador escribió para recibirla):\n"""${input.pendingThreat.slice(-900)}"""\n\n`
        : "No hay ataque pendiente del rival.\n\n"
      : "") +
    (input.memorySummary ? `Lo que se recuerda hasta ahora: ${input.memorySummary}\n` : "") +
    (input.fightLog && input.fightLog.length > 0
      ? `REGISTRO COMPLETO DE ESTE COMBATE, en orden (RECUÉRDALO TODO: heridas y estado del rival, técnicas y trucos ya usados por ambos, lo que cada uno ya vio, frases y promesas; sé coherente con ello y no lo contradigas):\n${input.fightLog.join("\n")}\n`
      : input.recentScene && input.recentScene.length > 0 ? `Escena reciente:\n${input.recentScene.join("\n")}\n` : "") +
    (input.actions[0] && input.mode !== "duel" ? currentActionBlock(input.actions[0].text) : "") +
    "\n\nResponde solo con el JSON.";
  return { system, user, maxTokens: Math.round(maxWords * 2.6) + 600 };
}

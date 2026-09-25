/**
 * Seven more islands (2026-09-25). Tequila Wolf is the CP-0 starting island: a quiet, level-1 World Government
 * work site in the East Blue where Cipher Pol trains its recruits (before, CP-0 characters were dropped into
 * Loguetown next to the black market and the bounty board). The rest open the Marine front (G-8 Navarone and
 * the New Marineford), Blackbeard's pirate haven (Hachinosu), the Revolutionaries' refuge (Kamabakka), a Calm
 * Belt survival island (Rusukaina) and the charred Banaro. Consumed by prisma/seed.ts exactly like its own
 * island list: same fields, same adjacency keys, same two-beat stories, same territory links.
 */
import type { EventKind, Sea } from "@prisma/client";

export interface IslandSeed {
  key: string;
  name: string;
  sea: Sea;
  danger: number;
  minLevel: number;
  factionControl: string | null;
  description: string;
  arcHook: string;
}

export const WAVE4_ISLANDS: IslandSeed[] = [
  {
    key: "tequilaWolf",
    name: "Tequila Wolf",
    sea: "EAST_BLUE",
    danger: 1,
    minLevel: 1,
    factionControl: "Gobierno Mundial (CP)",
    description:
      "Un puente interminable que el Gobierno Mundial lleva setecientos años construyendo sobre el mar del East Blue. Entre andamios, grúas y barracones grises, Cipher Pol entrena en silencio a sus reclutas: aquí se aprende a obedecer, a mirar sin ser visto y a no hacer preguntas.",
    arcHook:
      "Un instructor enmascarado ha dejado caer que alguien de la obra filtra planos del puente a los revolucionarios. Encontrarlo sería tu primera prueba de verdad.",
  },
  {
    key: "navarone",
    name: "G-8 Navarone",
    sea: "PARADISE",
    danger: 6,
    minLevel: 10,
    factionControl: "Marina",
    description:
      "Una fortaleza de la Marina encajada en un anillo de acantilados, con un solo acceso por mar y una cocina que alimenta a miles de marines. Se dice que ningún pirata ha salido de aquí por su propio pie.",
    arcHook: "El comandante Jonathan ha doblado las guardias: un barco sin bandera fue visto rondando la bahía anoche y nadie sabe de quién es.",
  },
  {
    key: "banaro",
    name: "Isla Banaro",
    sea: "PARADISE",
    danger: 7,
    minLevel: 14,
    factionControl: null,
    description:
      "Una isla desierta cuyo único pueblo quedó reducido a cenizas en el duelo entre el fuego y la oscuridad. Aún hay marcas de quemaduras en las piedras y un silencio que no parece natural.",
    arcHook: "Alguien ha vuelto a encender hogueras entre las ruinas. Los pocos que pasan por aquí dicen haber visto un caballo flaco y un jinete que tose.",
  },
  {
    key: "rusukaina",
    name: "Isla Rusukaina",
    sea: "PARADISE",
    danger: 8,
    minLevel: 18,
    factionControl: null,
    description:
      "Una isla del Calm Belt donde las estaciones cambian cada diez días y las bestias son tan fuertes que el invierno las vuelve aún más fieras. Un lugar para quien quiere entrenar hasta romperse.",
    arcHook: "Dicen que en la cima vive una bestia que nadie ha logrado derribar. Quien lo haga volverá de aquí siendo otra persona.",
  },
  {
    key: "kamabakka",
    name: "Reino Kamabakka",
    sea: "PARADISE",
    danger: 6,
    minLevel: 12,
    factionControl: "Ejército Revolucionario",
    description:
      "El reino de los okama, un paraíso rosa donde Emporio Ivankov entrena a sus soldados y esconde a revolucionarios fugitivos. Sus 'artes de combate' son tan extravagantes como letales.",
    arcHook: "Ivankov prepara algo grande para el Ejército Revolucionario y busca voluntarios. Nadie sabe qué es, pero todos quieren estar.",
  },
  {
    key: "hachinosu",
    name: "Hachinosu",
    sea: "NEW_WORLD",
    danger: 10,
    minLevel: 32,
    factionControl: "Piratas de Barbanegra",
    description:
      "La Isla Colmena: el refugio pirata donde Barbanegra ha levantado su nuevo imperio. Una calavera de piedra domina el puerto y la ley es simple: aquí manda quien no ha caído todavía.",
    arcHook: "Se rumorea que un antiguo almirante de la Marina ahora duerme en Hachinosu. Nadie sabe si vino a traicionar a Barbanegra o a servirle.",
  },
  {
    key: "nuevoMarineford",
    name: "Nuevo Marineford",
    sea: "NEW_WORLD",
    danger: 10,
    minLevel: 30,
    factionControl: "Marina",
    description:
      "El antiguo G-1, convertido en el cuartel general de la Marina tras la guerra de Marineford. Desde aquí el Almirante de Flota dirige la justicia absoluta sobre el Nuevo Mundo, a un paso de la Tierra Sagrada.",
    arcHook: "El Almirante de Flota ha convocado a SWORD a puerta cerrada. Lo que se decida esta noche marcará a más de un Emperador.",
  },
];

export const WAVE4_ADJACENCY: Record<string, string[]> = {
  tequilaWolf: ["marineG5", "loguetown", "gecko"],
  navarone: ["jaya", "skypiea"],
  banaro: ["jaya", "alabasta"],
  rusukaina: ["amazonLily", "kamabakka"],
  kamabakka: ["rusukaina", "sabaody"],
  hachinosu: ["graveyardIsland", "elbaf"],
  nuevoMarineford: ["maryGeoise", "punkHazard"],
};

export interface IslandStory {
  island: string;
  kind: EventKind;
  title: string;
  weight: number;
  min: number;
  max: number;
  flavor: string;
  crit: string;
  ok: string;
  fail: string;
  critFail: string;
  loot?: [number, number];
  xp?: [number, number];
  hurt?: [number, number];
  enemy?: { name: string; hp: number; atk: number; def: number; spd: number; personality: string };
}

const EX = "EXPLORATION" as EventKind;
const CO = "COMBAT" as EventKind;
const SO = "SOCIAL" as EventKind;
const TR = "TRAINING" as EventKind;

export const WAVE4_STORIES: IslandStory[] = [
  { island: "tequilaWolf", kind: TR, title: "La prueba del instructor", weight: 12, min: 1, max: 1, flavor: "Un instructor enmascarado te hace correr por los andamios del puente con los ojos vendados: 'Un agente que necesita ver para saber dónde pisa es un agente muerto'.", crit: "Terminas el recorrido sin tocar un solo cable y el instructor apunta algo en su libreta.", ok: "Llegas al final con los tobillos doloridos y una lección aprendida.", fail: "Te caes a una red de seguridad y tienes que empezar otra vez.", critFail: "Pisas en falso, la red cede y aterrizas sobre una pila de tablones.", xp: [8, 18], hurt: [0, 8] },
  { island: "tequilaWolf", kind: SO, title: "Susurros en los barracones", weight: 10, min: 1, max: 1, flavor: "Entre los obreros forzados del puente circula un rumor: alguien pasa planos a una célula revolucionaria.", crit: "Descubres al informante sin que nadie sepa que lo has descubierto, y el Gobierno lo anota a tu favor.", ok: "Te haces con una pista sólida y un nombre que vigilar.", fail: "Preguntas demasiado y los obreros se cierran en banda.", critFail: "Un capataz te toma por un alborotador y te castiga a cargar piedra toda la tarde.", loot: [100, 400], xp: [6, 16], hurt: [0, 4] },
  { island: "tequilaWolf", kind: CO, title: "El obrero que se escapó", weight: 9, min: 1, max: 1, flavor: "Un prisionero de la obra ha robado unas herramientas y corre hacia el mar. Los guardias te miran: es tu turno.", crit: "Lo detienes sin un rasguño y averiguas para quién trabajaba.", ok: "Lo reduces antes de que alcance la orilla.", fail: "Se te escurre entre los andamios y te deja un martillazo de recuerdo.", critFail: "Te golpea con una llave inglesa y casi se escapa.", enemy: { name: "Prisionero fugado de la obra", hp: 50, atk: 8, def: 4, spd: 8, personality: "desesperado, prefiere morir antes que volver a la obra" } },
  { island: "navarone", kind: CO, title: "La patrulla de Navarone", weight: 10, min: 6, max: 6, flavor: "Una patrulla de la G-8 te da el alto en el muelle. En Navarone nadie entra sin papeles... ni sale.", crit: "Los dejas fuera de juego antes de que suene la alarma.", ok: "Te abres paso sin que llegue la guardia de refuerzo.", fail: "La alarma suena y tienes que esconderte en la cocina de la base.", critFail: "Te encierran un rato en una bodega fría antes de que logres escurrirte.", enemy: { name: "Patrulla de la G-8", hp: 200, atk: 34, def: 24, spd: 26, personality: "disciplinados y orgullosos de su fortaleza" } },
  { island: "navarone", kind: SO, title: "La cocina de Jessica", weight: 9, min: 6, max: 6, flavor: "La cocinera jefe de la base te pilla en su despensa. Tienes un segundo para decidir si mientes o cocinas.", crit: "La convences de que eres un cocinero de refuerzo y sales con comida y un mapa de la base.", ok: "Te echa con un cucharón y una advertencia, pero sin avisar a nadie.", fail: "Te persigue por toda la cocina hasta que saltas por una ventana.", critFail: "Te tira una olla de caldo hirviendo antes de que puedas explicarte.", loot: [300, 900], xp: [10, 22], hurt: [0, 8] },
  { island: "banaro", kind: EX, title: "Las cenizas del duelo", weight: 10, min: 7, max: 7, flavor: "Recorres el pueblo quemado. Las marcas en el suelo cuentan un combate que la isla no ha olvidado.", crit: "Entre las cenizas encuentras un objeto que alguien importante perdió aquel día.", ok: "Te llevas algo de valor que la batalla dejó atrás.", fail: "El viento levanta tanto polvo que no ves nada.", critFail: "Un muro calcinado se derrumba sobre ti.", loot: [400, 1400], xp: [12, 26], hurt: [0, 12] },
  { island: "banaro", kind: CO, title: "El jinete que tose", weight: 9, min: 7, max: 7, flavor: "Un jinete enfermo sobre un caballo en los huesos te ofrece una manzana. 'Solo una de cada tres es mortal', dice sonriendo.", crit: "Rechazas la oferta y lo pones en fuga antes de que saque otra.", ok: "Lo espantas, aunque te deja un escalofrío.", fail: "Sus manzanas estallan a tu alrededor y te dejan aturdido.", critFail: "Muerdes la manzana equivocada.", enemy: { name: "Emisario de Barbanegra", hp: 260, atk: 40, def: 26, spd: 26, personality: "lúgubre y paciente; disfruta viendo a su víctima dudar" } },
  { island: "rusukaina", kind: TR, title: "Diez días de invierno", weight: 12, min: 8, max: 8, flavor: "El invierno llega de golpe y las bestias de la isla salen a cazar. Entrenar aquí es sobrevivir.", crit: "Aguantas diez días de invierno y sales con un cuerpo que ya no reconoces.", ok: "Sobrevives al frío y a dos bestias hambrientas.", fail: "Pasas más tiempo escondido que entrenando.", critFail: "Una bestia te pilla dormido y te arrastra por la nieve.", xp: [20, 44], hurt: [0, 16] },
  { island: "rusukaina", kind: CO, title: "El rey de la montaña", weight: 9, min: 8, max: 8, flavor: "Una bestia gigantesca te corta el paso en la cima. Ha matado a todo lo que ha subido hasta aquí.", crit: "La derribas con un golpe que resuena en toda la isla.", ok: "La haces retroceder y reclamas la cima un día más.", fail: "Te lanza montaña abajo de un zarpazo.", critFail: "Te aplasta contra la roca y se aleja sin mirarte.", enemy: { name: "Bestia de Rusukaina", hp: 380, atk: 50, def: 34, spd: 30, personality: "una fiera que solo respeta la fuerza" } },
  { island: "kamabakka", kind: TR, title: "Las 99 técnicas okama", weight: 12, min: 6, max: 6, flavor: "Los maestros okama te someten a su entrenamiento de 'artes del ataque': ballet, puños y maquillaje de guerra.", crit: "Dominas una técnica que ni los okama esperaban de ti, y te aplauden con lágrimas.", ok: "Sales con las piernas temblando y una patada nueva.", fail: "Te dan una lección de humildad (y de ballet).", critFail: "Un maestro te lanza por la ventana 'para que aprendas a volar'.", xp: [16, 34], hurt: [0, 10] },
  { island: "kamabakka", kind: SO, title: "Un recado para la revolución", weight: 9, min: 6, max: 6, flavor: "Un revolucionario te pide llevar un mensaje cifrado al barco que zarpa al amanecer.", crit: "Entregas el mensaje y descubres de paso qué trama el Gobierno en la zona.", ok: "El mensaje llega a tiempo y te lo agradecen en berries.", fail: "Pierdes el barco por minutos y el mensaje se queda contigo.", critFail: "Un espía del Gobierno te sigue y tienes que despistarlo a golpes.", loot: [400, 1200], xp: [12, 26], hurt: [0, 8] },
  { island: "hachinosu", kind: CO, title: "Los perros de la colmena", weight: 10, min: 10, max: 10, flavor: "Unos piratas de Barbanegra te rodean en el puerto: aquí los forasteros pagan peaje con su sangre.", crit: "Los tumbas uno a uno y el puerto entero guarda silencio.", ok: "Te abres paso a golpes hasta la taberna.", fail: "Te superan en número y te obligan a retirarte.", critFail: "Te dejan tirado en el muelle con una advertencia grabada en la piel.", enemy: { name: "Piratas de la Colmena", hp: 420, atk: 64, def: 40, spd: 38, personality: "brutales y confiados; su capitán es el hombre más temido del mar" } },
  { island: "hachinosu", kind: SO, title: "La taberna de la calavera", weight: 9, min: 10, max: 10, flavor: "En la taberna de la calavera se venden secretos como si fueran ron. Nadie te pregunta quién eres; todos quieren saber qué pagas.", crit: "Compras un secreto de Barbanegra que vale más que tu barco.", ok: "Escuchas lo suficiente para saber hacia dónde sopla el viento.", fail: "Pagas por un rumor que resulta ser mentira.", critFail: "Te sacan a patadas por mirar a la persona equivocada.", loot: [800, 3000], xp: [22, 44], hurt: [0, 14] },
  { island: "nuevoMarineford", kind: CO, title: "Los guardianes del cuartel", weight: 10, min: 10, max: 10, flavor: "Una escuadra de élite de la Marina te intercepta en el muelle del cuartel general: aquí la justicia es absoluta.", crit: "Los superas con tal precisión que un vicealmirante tiene que salir a ver quién eres.", ok: "Rompes la línea y te pierdes entre los barracones.", fail: "Te repelen con una formación perfecta.", critFail: "Un cañonazo te lanza contra el muro del puerto.", enemy: { name: "Escuadra de élite del Cuartel General", hp: 460, atk: 68, def: 44, spd: 40, personality: "justicia absoluta: ni se rinden ni negocian" } },
  { island: "nuevoMarineford", kind: SO, title: "Los archivos del cuartel", weight: 9, min: 10, max: 10, flavor: "Un funcionario de la Marina deja un expediente abierto sobre una mesa y sale a por café.", crit: "Te llevas información que la Marina daría cualquier cosa por recuperar.", ok: "Memorizas un par de nombres y rutas de patrulla.", fail: "El funcionario vuelve antes de tiempo y tienes que improvisar.", critFail: "Te pillan con el expediente en la mano.", loot: [900, 3200], xp: [22, 46], hurt: [0, 12] },
];

/** Island key -> the canon power that holds it (its conquest ends facing them in person). */
export const WAVE4_TERRITORIES: { island: string; actor: string; title: string }[] = [
  { island: "navarone", actor: "Jonathan", title: "Dominio de la Marina (G-8)" },
  { island: "hachinosu", actor: "Marshall D. Teach", title: "Dominio de Barbanegra" },
  { island: "nuevoMarineford", actor: "Sakazuki", title: "Dominio del Cuartel General de la Marina" },
];

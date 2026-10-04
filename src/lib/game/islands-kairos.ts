/**
 * Isla Kairos (2026-10-04): the one place in the world where a devil fruit can be given back (owner's request; the
 * rules live in engine/fruit-removal.ts, the ritual in game/fruit-removal.ts). Everything the rest of the world needs
 * to treat it as a real island lives here — seed definition, routes, explore stories, residents, gazetteer and
 * secrets — and is folded into the same lists as every other island (seed.ts, island-npc-data-wave2.ts,
 * island-lore-data.ts, island-secrets-data.ts), so no consumer needs to know it is special.
 */
import type { EventKind } from "@prisma/client";
import type { IslandSeed, IslandStory } from "./islands-wave4";
import type { SeedRosterEntry } from "./island-npcs";
import type { IslandLore } from "../engine/island-lore";
import type { IslandSecret } from "../engine/island-secrets";

const NAME = "Isla Kairos";

export const KAIROS_ISLAND: IslandSeed = {
  key: "kairos",
  name: NAME,
  sea: "PARADISE",
  danger: 6,
  minLevel: 10,
  factionControl: "Orden del Mar Callado",
  description:
    "Un islote de roca negra en mitad de Paradise, levantado sobre la mayor veta natural de Kairoseki del mundo. De sus grietas mana el Agua Quieta, un manantial donde el mar parece dormido y ningún poder de fruta resiste. Quien llega aquí suele venir por lo mismo: a arrancarse su Fruta del Diablo. La Orden del Mar Callado lo hace, y cobra caro.",
  arcHook:
    "La Marina quiere la veta para forjar grilletes y un capitán pirata quiere el manantial para 'apagar' a sus rivales. La Orden necesita a alguien que impida que su isla se convierta en el arsenal de cualquiera de los dos.",
};

export const KAIROS_ADJACENCY: Record<string, string[]> = { kairos: ["whiskyPeak", "littleGarden", "drum"] };

const EX = "EXPLORATION" as EventKind;
const CO = "COMBAT" as EventKind;
const SO = "SOCIAL" as EventKind;

export const KAIROS_STORIES: IslandStory[] = [
  {
    island: "kairos",
    kind: EX,
    title: "La veta que bebe el mar",
    weight: 10,
    min: 6,
    max: 6,
    flavor: "Bajas a los túneles de la mina. Las paredes brillan con un gris húmedo que roba el calor de las manos; quien lleva una fruta dentro siente que algo le aprieta el pecho a cada paso.",
    crit: "Encuentras una galería abandonada con vetas tan puras que los mineros pagarían por saber dónde está.",
    ok: "Sales con un puñado de esquirlas que alguien en el mercadillo querrá comprarte.",
    fail: "Un derrumbe de grava te corta el paso y te obliga a volver por donde viniste.",
    critFail: "Resbalas en el agua quieta del fondo de un pozo y sales temblando, sin fuerzas y con un golpe en la cabeza.",
    loot: [500, 1500],
    xp: [12, 26],
    hurt: [0, 12],
  },
  {
    island: "kairos",
    kind: SO,
    title: "Los peregrinos sin poder",
    weight: 9,
    min: 6,
    max: 6,
    flavor: "En la posada, un grupo de antiguos usuarios brinda en silencio. Todos se arrancaron su fruta aquí; ninguno cuenta lo mismo sobre por qué lo hizo.",
    crit: "Uno de ellos te confía un secreto de la Orden que no aparece en ningún folleto, y te invita a la ronda.",
    ok: "Escuchas historias que valen más que la cerveza que pagas.",
    fail: "Preguntas demasiado pronto por sus frutas y la mesa se queda en silencio.",
    critFail: "Confundes a un veterano con un cobarde en voz alta y te echan de la posada a empujones.",
    loot: [300, 900],
    xp: [10, 22],
    hurt: [0, 6],
  },
  {
    island: "kairos",
    kind: CO,
    title: "Los contrabandistas de esquirlas",
    weight: 9,
    min: 6,
    max: 6,
    flavor: "En el muelle, una banda carga esquirlas robadas de la mina en un bote sin bandera. Te ven antes de que puedas esconderte, y sus cuchillos tienen filo de Kairoseki.",
    crit: "Los desarmas uno a uno y la Orden te agradece haber recuperado la carga.",
    ok: "Los pones en fuga y el bote se queda varado con media carga.",
    fail: "Te superan en número y te obligan a soltar la presa.",
    critFail: "Un tajo con filo de seastone te deja sin aliento sobre las tablas del muelle.",
    enemy: { name: "Contrabandistas de Kairoseki", hp: 220, atk: 36, def: 24, spd: 26, personality: "codiciosos y sin escrúpulos; sus cuchillos con filo de Kairoseki no temen a ningún usuario de fruta" },
  },
];

const r = (slot: string, name: string, title: string, category: string, level: number, description: string, personality: string, weapon: string | null = null, abilities: string[] = []): SeedRosterEntry => ({
  island: NAME,
  slot: `kairos-${slot}`,
  name,
  title,
  category,
  level,
  description,
  personality,
  weapon,
  abilities,
});

export const KAIROS_RESIDENTS: SeedRosterEntry[] = [
  r(
    "abadesa",
    "Madre Oriana del Mar Callado",
    "Abadesa de la Orden del Mar Callado",
    "official",
    9,
    "Oriana guarda el manantial desde hace treinta años y es quien fija el precio del ritual: dice que lo caro no es el dinero, sino la decisión. Confía en el Hermano Tobías para sumergir a los usuarios y vigila de cerca al Teniente Duarte, que ronda el faro con demasiada curiosidad. En secreto, guarda un registro de cada fruta que ha vuelto al mar desde aquí.",
    "Habla poco, despacio y sin levantar la voz; sus silencios pesan más que sus palabras.",
    "Báculo de roca negra",
    ["Lectura de intenciones", "Calma absoluta"],
  ),
  r(
    "sumergidor",
    "Hermano Tobías el Sumergidor",
    "Maestro de las Aguas Quietas",
    "other",
    7,
    "Tobías es quien sostiene a los usuarios bajo el agua durante los tres días del ritual, recitando la cuenta de los amaneceres. Fue pescador antes de entrar en la Orden y conoce cada corriente del manantial. Trabaja codo a codo con la Doctora Wren Quedo, que cuida a los que salen, y se lleva mal con Rata Molo, al que pilló robando esquirlas de la mina.",
    "Paciente y algo brusco; bromea para calmar a los asustados y nunca miente sobre lo que duele.",
    null,
    ["Resistencia al frío", "Conocimiento del manantial"],
  ),
  r(
    "novicia",
    "Novicia Aiko",
    "Aprendiz de la Orden",
    "civilian",
    2,
    "Aiko llegó a la isla siendo una niña, en el bote de una usuaria que vino a quitarse su fruta y nunca regresó a buscarla. La Madre Oriana la crió en el claustro. Anota en un cuaderno el nombre de cada fruta que el manantial devuelve al mar y sueña con verlas renacer algún día.",
    "Curiosa, habladora y algo ingenua; pregunta a todos los peregrinos qué poder tenían.",
  ),
  r(
    "custodio",
    "Custodio Brennan",
    "Guardián del claustro de la Orden",
    "guard",
    9,
    "Brennan fue cazarrecompensas hasta que una usuaria de fruta le perdonó la vida en el mar. Desde entonces protege el manantial con un bastón rematado en Kairoseki que hace temblar a cualquier usuario. Desconfía de Ness el Garfio Salado y lo vigila cada vez que entra en la posada.",
    "Seco, leal y de pocas palabras; responde a las amenazas con una sola advertencia.",
    "Bastón con punta de Kairoseki",
    ["Golpe de seastone", "Guardia inamovible"],
  ),
  r(
    "custodia",
    "Custodia Rhea Manoquieta",
    "Guardiana del muelle de la Orden",
    "guard",
    8,
    "Rhea controla quién desembarca en el Muelle de Piedra Negra y cobra la tasa de los peregrinos. Lleva al cinto un par de grilletes de Kairoseki y dicen que nunca ha tenido que usar los dos a la vez. Sospecha que alguien en el muelle vende las esquirlas de la mina y tiene a Rata Molo en la cabeza.",
    "Firme y desconfiada; sonríe solo cuando cierra unos grilletes.",
    "Grilletes de Kairoseki",
    ["Inmovilización", "Vigilancia del puerto"],
  ),
  r(
    "teniente",
    "Teniente Duarte de la G-8",
    "Oficial de la Marina en misión de reconocimiento",
    "marine",
    10,
    "Duarte desembarcó hace un mes diciendo que venía a descansar, pero pasa las noches midiendo la veta desde el Faro Apagado. Tiene órdenes de la G-8 de estimar cuántos grilletes podrían forjarse con la mina. La Madre Oriana lo sabe y lo tolera mientras no saque nada de la isla; Ness el Garfio Salado sueña con hundir su bote.",
    "Educado, metódico y frío; nunca dice una mentira, solo calla lo que no le conviene.",
    "Sable de oficial",
    ["Tácticas de la Marina", "Disparo certero"],
  ),
  r(
    "garfio",
    "Ness el Garfio Salado",
    "Capitán pirata de paso, con una deuda pendiente",
    "pirate",
    9,
    "Ness perdió la mano contra un usuario de fruta y ahora lleva un garfio con filo de Kairoseki. Quiere el manantial para 'apagar' a sus enemigos antes de enfrentarlos y bebe en la Posada de los Peregrinos esperando su oportunidad. Brennan lo vigila, Duarte lo tiene fichado y Rata Molo le vende esquirlas a escondidas.",
    "Ruidoso, rencoroso y encantador cuando le conviene; nunca olvida una ofensa.",
    "Garfio con filo de Kairoseki",
    ["Golpe del garfio", "Pelea sucia"],
  ),
  r(
    "rata",
    "Rata Molo",
    "Contrabandista de esquirlas de Kairoseki",
    "thug",
    6,
    "Molo trabajó en la mina hasta que descubrió que una esquirla de Kairoseki vale más en el mercado negro que un mes de jornal. Ahora roba lo que puede de la Veta Madre y se lo vende a Ness y a cualquiera que pague. Tomás Veta Negra sabe lo que hace, pero le debe un favor y calla.",
    "Nervioso, adulador y rápido con el cuchillo; siempre está mirando la salida.",
    "Cuchillo de esquirla",
    ["Escabullirse", "Puñalada traicionera"],
  ),
  r(
    "teodora",
    "Teodora Brea",
    "Comerciante de sal, amuletos y esquirlas legales",
    "merchant",
    3,
    "Teodora vende sal de roca, amuletos tallados en la piedra negra y las pocas esquirlas que la Orden permite sacar con sello. Sus mejores clientes son los peregrinos que salen del ritual y quieren un recuerdo de lo que perdieron. Sabe que Rata Molo le hace la competencia con mercancía robada y no le perdona.",
    "Charlatana, regateadora y muy supersticiosa; jura que sus amuletos ahuyentan a los Reyes del Mar.",
  ),
  r(
    "brina",
    "Brina la Posadera",
    "Dueña de la Posada de los Peregrinos",
    "civilian",
    2,
    "Brina ha visto llegar a cientos de usuarios temblando y marcharse más ligeros, o rotos. Les sirve sopa caliente a la salida del ritual y escucha sin juzgar. Es amiga de Edmundo el Sin Fruta, que le paga las cuentas con historias, y echa a Ness de la posada cada vez que levanta la voz.",
    "Maternal, de risa fácil y lengua afilada con los borrachos.",
  ),
  r(
    "edmundo",
    "Edmundo el Sin Fruta",
    "Antiguo usuario de fruta y cuentacuentos de la posada",
    "other",
    6,
    "Edmundo tuvo una Logia de fuego que quemó su propia casa una noche de pesadilla; vino a Kairos a arrancársela y nunca se fue. Vuelve a nadar cada mañana en el muelle y cuenta a los recién llegados lo que se siente al tercer amanecer. Lo que no cuenta es que todavía sueña con las llamas.",
    "Melancólico y cálido; habla del pasado con humor para no tener que llorarlo.",
    null,
    ["Nadar", "Historias de la Gran Ruta"],
  ),
  r(
    "minero",
    "Tomás Veta Negra",
    "Capataz de la mina de Kairoseki",
    "civilian",
    4,
    "Tomás dirige a los pocos mineros que la Orden permite en la Veta Madre y conoce cada túnel de memoria. Tose polvo gris desde hace años y no piensa dejar la mina. Le debe un favor antiguo a Rata Molo y por eso mira hacia otro lado, aunque teme que la Marina use eso como excusa para quedarse con todo.",
    "Gruñón, honrado a su manera y terco como la roca que pica.",
    "Pico de minero",
    ["Conocimiento de la mina", "Fuerza bruta"],
  ),
  r(
    "doctora",
    "Doctora Wren Quedo",
    "Médica de la enfermería de la Orden",
    "civilian",
    5,
    "Wren cuida a los que salen del manantial: fiebre, temblores y una debilidad que dura días. Estudió en Isla Drum y discute a menudo con el Hermano Tobías sobre cuánto tiempo debe durar el ritual. Lleva la cuenta de quién no ha sobrevivido al agua y es la única que se atreve a contradecir a la Madre Oriana.",
    "Rigurosa, impaciente con la superstición y tierna con los enfermos.",
    null,
    ["Medicina", "Diagnóstico"],
  ),
];

export const KAIROS_LORE: IslandLore = {
  island: NAME,
  atmosphere:
    "Una roca negra y húmeda donde el mar suena amortiguado, como si la isla entera contuviera la respiración. El aire sabe a sal y a piedra mojada, y los usuarios de fruta sienten un peso extraño en el pecho desde que pisan el muelle. Peregrinos callados, monjes de túnica gris y mineros cubiertos de polvo comparten un lugar donde se viene a renunciar a algo.",
  history:
    "Hace siglos, un náufrago que había comido una fruta del diablo se hundió en el manantial de la isla esperando morir; salió tres días después sin su poder y capaz de nadar. Fundó la Orden del Mar Callado para custodiar el Agua Quieta y ofrecer el mismo final a quien lo pidiera. Desde entonces la Orden cobra un precio alto por el ritual, protege la mina de Kairoseki de quien quiera explotarla y se mantiene neutral entre la Marina y los piratas.",
  customs: [
    "El ritual de las Aguas Quietas solo se celebra tras pagar a la Orden el precio completo; dura tres amaneceres y nadie habla de lo que se siente.",
    "Quien sale del manantial nada desnudo en el muelle al amanecer siguiente, para demostrarse que el mar ya no lo rechaza.",
    "Ninguna esquirla sale de la isla sin el sello de la Orden; quien la saca a escondidas es expulsado para siempre.",
  ],
  places: [
    {
      name: "El Manantial de las Aguas Quietas",
      kind: "santuario",
      description:
        "Una poza natural de agua inmóvil en el corazón de la roca, rodeada de columnas de Kairoseki en bruto. Ninguna onda se forma al tocarla. Aquí se sumerge a los usuarios durante tres días hasta que su fruta se apaga.",
      regulars: ["Madre Oriana del Mar Callado", "Hermano Tobías el Sumergidor", "Novicia Aiko"],
    },
    {
      name: "El Claustro del Mar Callado",
      kind: "templo",
      description: "El monasterio de piedra gris donde vive la Orden, con un patio interior en silencio permanente y una biblioteca que guarda el registro de cada fruta devuelta al mar.",
      regulars: ["Madre Oriana del Mar Callado", "Novicia Aiko", "Custodio Brennan"],
    },
    {
      name: "La Posada de los Peregrinos",
      kind: "taberna",
      description: "Una posada de madera ennegrecida junto al camino del muelle, con sopa caliente a todas horas. Aquí esperan los que van a entrar al manantial y se recuperan los que salen.",
      regulars: ["Brina la Posadera", "Edmundo el Sin Fruta", "Ness el Garfio Salado"],
    },
    {
      name: "El Muelle de Piedra Negra",
      kind: "puerto",
      description: "Un embarcadero tallado en la misma roca de la isla, resbaladizo y frío. Los usuarios de fruta lo cruzan con cuidado: la piedra les quita las fuerzas al tocarla.",
      regulars: ["Custodia Rhea Manoquieta", "Rata Molo", "Teniente Duarte de la G-8"],
    },
    {
      name: "La Mina de la Veta Madre",
      kind: "mina",
      description: "Túneles estrechos y húmedos que siguen la mayor veta de Kairoseki conocida. La Orden solo permite picar lo justo; aun así, cada esquirla vale una fortuna fuera de la isla.",
      regulars: ["Tomás Veta Negra", "Rata Molo"],
    },
    {
      name: "El Mercadillo de la Sal",
      kind: "mercado",
      description: "Un puñado de puestos bajo toldos grises donde se venden sal de roca, amuletos tallados en piedra negra y las pocas esquirlas que salen con el sello de la Orden.",
      regulars: ["Teodora Brea", "Brina la Posadera"],
    },
    {
      name: "La Enfermería del Tercer Amanecer",
      kind: "casas importantes",
      description: "Una sala larga de camas blancas junto al claustro, donde los que salen del ritual pasan la fiebre y los temblores. Huele a hierbas y a sal.",
      regulars: ["Doctora Wren Quedo", "Hermano Tobías el Sumergidor"],
    },
    {
      name: "El Faro Apagado",
      kind: "ruinas",
      description: "Un faro de piedra en la punta norte de la isla, sin luz desde hace décadas. Desde su cima se ve toda la veta y el horizonte; últimamente alguien sube por las noches.",
      regulars: ["Teniente Duarte de la G-8", "Ness el Garfio Salado"],
    },
  ],
  rumors: [
    "Dicen que el Teniente Duarte ha mandado un informe a la G-8 con el tamaño exacto de la veta, y que un buque de la Marina viene de camino.",
    "En la posada se comenta que Ness el Garfio Salado busca a alguien dispuesto a arrastrar a un rival hasta el manantial a la fuerza.",
    "La Novicia Aiko jura que una noche vio brillar una fruta flotando en el mar, justo después de un ritual.",
  ],
};

export const KAIROS_SECRETS: IslandSecret[] = [
  {
    id: "kairos:esquirlas-sueltas",
    island: NAME,
    place: "La Mina de la Veta Madre",
    title: "Esquirlas sueltas en la galería vieja",
    discovery:
      "En una galería que los mineros dejaron de picar hace años, el agua ha ido soltando esquirlas de Kairoseki del techo. Recogidas con cuidado y entregadas con el sello de la Orden, se pagan bien en el mercadillo.",
    chance: 0.14,
    minLevel: 10,
    cooldownHours: 36,
    reward: { berries: 2500, xp: 450, items: [{ id: "vendaje", qty: 2 }] },
  },
  {
    id: "kairos:diario-del-primer-sumergido",
    island: NAME,
    place: "El Faro Apagado",
    title: "El diario del primer sumergido",
    discovery:
      "Tras una losa suelta en lo alto del faro aparece un cofre de hierro con el diario del náufrago que fundó la Orden: cuenta los tres días en el manantial y dónde escondió lo que traía del mar. La Orden pagaría por recuperarlo.",
    chance: 0.05,
    minLevel: 12,
    cooldownHours: null,
    reward: { berries: 30000, xp: 4000, items: [{ id: "reliquia", qty: 2 }, { id: "elixir", qty: 1 }] },
  },
];

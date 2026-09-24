import { FruitType, Rarity } from "@prisma/client";
import { EXTRA_FRUITS, SINGLETON_OVERRIDES } from "./devil-fruit-extra";

/**
 * Single source of truth for every devil fruit "kind" in the game — moved
 * out of prisma/seed.ts (2026-09-23) so it can be shared by the seed AND by
 * tryDropFruit's random-grant logic (src/lib/game/perform-action.ts).
 *
 * isSingleton is the whole mechanic: false (the default/common case) means
 * the fruit can be duplicated — tryDropFruit creates a FRESH DevilFruit row
 * per grant, exactly like Weapon.name/common-gear.ts already does for
 * mass-produced gear, so many characters can each awaken their own "Bomu
 * Bomu no Mi". true marks one of the "main" canon fruits: the seed's
 * upsert creates exactly ONE row for it (same as a named meito weapon),
 * tryDropFruit never selects it, and it stays permanently linked to its
 * canon WorldActor via WorldActor.devilFruitId until a future kill-mechanic
 * (not built yet — needs real combat against the actual canon character,
 * not just a subordinate stand-in) reassigns it to a player.
 */
export interface DevilFruitCatalogEntry {
  name: string;
  englishName: string;
  type: FruitType;
  rarity: Rarity;
  description: string;
  effects: object;
  isSingleton: boolean;
}

const BASE_FRUITS: DevilFruitCatalogEntry[] = [
  // ---------- Paramecia — common/uncommon utility (duplicable) ----------
  {
    name: "Bara Bara no Mi",
    englishName: "Chop-Chop Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Permite separar el cuerpo en pedazos a voluntad, inmune a cortes.",
    effects: { category: "defensive", def: 15 },
    isSingleton: true, // canon signature fruit of Buggy — see WORLD_LORE.md
  },
  {
    name: "Sube Sube no Mi",
    englishName: "Slip-Slip Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Vuelve la piel perfectamente resbaladiza; los golpes y agarres resbalan sin efecto.",
    effects: { category: "defensive", def: 8, spd: 5 },
    isSingleton: false,
  },
  {
    name: "Kilo Kilo no Mi",
    englishName: "Kilo-Kilo Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Cambia el propio peso entre 1 y 10.000 kilos a voluntad.",
    effects: { category: "utility", atk: 6 },
    isSingleton: false,
  },
  {
    name: "Bomu Bomu no Mi",
    englishName: "Bomb-Bomb Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Todo el cuerpo, incluidos mocos y aliento, puede detonar como explosivo.",
    effects: { category: "offensive", element: "explosivo", atk: 14 },
    isSingleton: false,
  },
  {
    name: "Doa Doa no Mi",
    englishName: "Door-Door Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Crea puertas en cualquier superficie, incluido el aire.",
    effects: { category: "utility", spd: 10 },
    isSingleton: false,
  },
  {
    name: "Toge Toge no Mi",
    englishName: "Spike-Spike Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "El cuerpo puede cubrirse de púas afiladas como agujas.",
    effects: { category: "offensive", atk: 10, def: 8 },
    isSingleton: false,
  },
  {
    name: "Horo Horo no Mi",
    englishName: "Ghost-Ghost Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Invoca espíritus que debilitan la voluntad de lucha del enemigo.",
    effects: { category: "utility", atk: 8, def: 6 },
    isSingleton: false,
  },
  {
    name: "Hana Hana no Mi",
    englishName: "Flower-Flower Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.RARE,
    description: "Hace florecer partes del propio cuerpo en cualquier superficie al alcance de la vista.",
    effects: { category: "utility", atk: 8, def: 8, spd: 8 },
    isSingleton: true, // canon signature fruit of Nico Robin
  },
  {
    name: "Doku Doku no Mi",
    englishName: "Venom-Venom Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.RARE,
    description: "El cuerpo genera y controla venenos capaces de corroer una isla entera.",
    effects: { category: "offensive", element: "veneno", atk: 18, awakened: { atk: 30, note: "El veneno corrompe la isla entera" } },
    isSingleton: false,
  },
  {
    name: "Bari Bari no Mi",
    englishName: "Barrier-Barrier Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.RARE,
    description: "Genera barreras irrompibles a voluntad, incluso para atacar.",
    effects: { category: "defensive", def: 22 },
    isSingleton: false,
  },
  {
    name: "Ope Ope no Mi",
    englishName: "Op-Op Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.EPIC,
    description: 'Crea una "sala" esférica donde su usuario controla el espacio como un cirujano todopoderoso.',
    effects: { category: "utility", atk: 10, def: 20, awakened: { def: 25, note: "Operación a nivel de ciudad entera" } },
    isSingleton: true, // canon signature fruit of Trafalgar D. Water Law
  },
  {
    name: "Ito Ito no Mi",
    englishName: "String-String Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.EPIC,
    description: "Genera hilos más afilados que espadas y capaces de controlar cuerpos ajenos como marionetas.",
    effects: { category: "offensive", atk: 16, def: 10, spd: 6, awakened: { atk: 20, note: "Hilos que gobiernan un reino entero" } },
    isSingleton: true, // canon signature fruit of Donquixote Doflamingo
  },
  {
    name: "Kage Kage no Mi",
    englishName: "Shadow-Shadow Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.EPIC,
    description: "Manipula sombras propias y ajenas, pudiendo robarlas para crear ejércitos de zombis.",
    effects: { category: "utility", atk: 12, def: 8 },
    isSingleton: false,
  },
  {
    name: "Zushi Zushi no Mi",
    englishName: "Gravity-Gravity Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.LEGENDARY,
    description: "Controla la gravedad a voluntad, capaz de atraer meteoritos del espacio.",
    effects: { category: "offensive", atk: 28, def: 18, awakened: { atk: 15, note: "Lluvia de meteoros a voluntad" } },
    isSingleton: true, // canon signature fruit of Fujitora
  },
  {
    name: "Mero Mero no Mi",
    englishName: "Love-Love Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.EPIC,
    description: "Convierte en piedra a quien sienta atracción y baje la guardia ante su usuario.",
    effects: { category: "utility", atk: 14, def: 16 },
    isSingleton: true, // canon signature fruit of Boa Hancock
  },
  {
    name: "Jiki Jiki no Mi",
    englishName: "Magnet-Magnet Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.EPIC,
    description: "Genera y controla campos magnéticos capaces de atraer o repeler metal a voluntad.",
    effects: { category: "offensive", atk: 17, def: 12 },
    isSingleton: true, // canon signature fruit of Eustass Kid
  },
  {
    name: "Mochi Mochi no Mi",
    englishName: "Mochi-Mochi Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.LEGENDARY,
    description: 'Un híbrido especial de Logia y Paramecia: cuerpo, creación y control absoluto del mochi, "más fuerte que la propia goma".',
    effects: { category: "offensive", atk: 26, def: 20, logiaIntangible: true },
    isSingleton: true, // canon signature fruit of Charlotte Katakuri
  },
  {
    name: "Toshi Toshi no Mi",
    englishName: "Age-Age Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.RARE,
    description: "Altera la edad propia o ajena con un toque, tanto para rejuvenecer como para envejecer de golpe.",
    effects: { category: "utility", atk: 6, def: 6, spd: 10 },
    isSingleton: true, // canon signature fruit of Jewelry Bonney
  },
  // ---------- Logia (duplicable unless noted) ----------
  {
    name: "Suna Suna no Mi",
    englishName: "Sand-Sand Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.EPIC,
    description: "Cuerpo, creación y control de arena; puede absorber la humedad de cualquier cosa.",
    effects: { category: "offensive", element: "arena", atk: 18, def: 18, logiaIntangible: true },
    isSingleton: true, // canon signature fruit of Crocodile
  },
  {
    name: "Mera Mera no Mi",
    englishName: "Flame-Flame Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description: "Cuerpo, creación y control absoluto del fuego.",
    effects: { category: "offensive", element: "fuego", atk: 30, def: 15, logiaIntangible: true, awakened: { atk: 20 } },
    isSingleton: true, // inherited by Sabo — canon signature fruit
  },
  {
    name: "Hie Hie no Mi",
    englishName: "Ice-Ice Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description: "Cuerpo, creación y control del hielo, capaz de congelar mares enteros.",
    effects: { category: "offensive", element: "hielo", atk: 25, def: 20, logiaIntangible: true },
    isSingleton: false, // its canon holder (Kuzan) isn't seeded as a WorldActor yet — stays a rare-but-duplicable drop until then
  },
  {
    name: "Pika Pika no Mi",
    englishName: "Light-Light Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description: "Cuerpo, creación y control de la luz; ataca y se mueve a velocidad lumínica.",
    effects: { category: "offensive", element: "luz", atk: 30, spd: 25, logiaIntangible: true },
    isSingleton: true, // canon signature fruit of Kizaru
  },
  {
    name: "Moku Moku no Mi",
    englishName: "Smoke-Smoke Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.RARE,
    description: "Cuerpo, creación y control del humo; puede volverse una nube cortante e impenetrable.",
    effects: { category: "defensive", element: "humo", atk: 12, def: 20, logiaIntangible: true },
    isSingleton: true, // canon signature fruit of Smoker
  },
  {
    name: "Yami Yami no Mi",
    englishName: "Dark-Dark Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.MYTHICAL_TIER,
    description:
      "Controla la oscuridad y la gravedad de la nada misma; la única Logia que, en vez de esquivar, atrae cualquier golpe hacia sí.",
    effects: { category: "offensive", element: "oscuridad", atk: 35, def: 25, logiaIntangible: false, awakened: { atk: 25, note: "Un agujero negro que engulle la luz" } },
    isSingleton: true, // canon signature fruit of Marshall D. Teach
  },
  {
    name: "Magu Magu no Mi",
    englishName: "Magma-Magma Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.MYTHICAL_TIER,
    description: "Cuerpo, creación y control del magma, considerado el elemento más fuerte al superar al fuego.",
    effects: { category: "offensive", element: "magma", atk: 38, def: 22, logiaIntangible: true, awakened: { atk: 30, note: "El elemento más fuerte de los mares" } },
    isSingleton: true, // canon signature fruit of Sakazuki
  },
  // ---------- Zoan / Ancient / Mythical (duplicable unless noted) ----------
  {
    name: "Ushi Ushi no Mi: Modelo Bisonte",
    englishName: "Ox-Ox Fruit: Bison",
    type: FruitType.ZOAN,
    rarity: Rarity.UNCOMMON,
    description: "Transformación en un poderoso bisonte de combate, o un híbrido con fuerza descomunal.",
    effects: { category: "transformation", atk: 14, def: 10 },
    isSingleton: false,
  },
  {
    name: "Neko Neko no Mi: Modelo Leopardo",
    englishName: "Cat-Cat Fruit: Leopard",
    type: FruitType.ZOAN,
    rarity: Rarity.EPIC,
    description: "Transformación en un leopardo ágil y letal, o un híbrido de reflejos felinos.",
    effects: { category: "transformation", atk: 18, spd: 22 },
    isSingleton: true, // canon signature fruit of Rob Lucci
  },
  {
    name: "Inu Inu no Mi: Modelo Okuchi no Makami",
    englishName: "Dog-Dog Fruit: Okuchi no Makami",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.EPIC,
    description: "Transformación en el lobo-deidad guardián que puede caminar sobre el hielo a voluntad.",
    effects: { category: "transformation", atk: 20, def: 18, spd: 12 },
    isSingleton: false,
  },
  {
    name: "Hito Hito no Mi",
    englishName: "Human-Human Fruit",
    type: FruitType.ZOAN,
    rarity: Rarity.RARE,
    description: "Transformación (o hibridación) en un ser humano completo — para quien no lo era, un cambio que reordena su vida entera.",
    effects: { category: "utility", atk: 6, def: 10, spd: 6 },
    isSingleton: true, // canon signature fruit of Tony Tony Chopper — distinct from "Modelo Nika"/"Modelo Daibutsu" below, same base name on purpose
  },
  {
    name: "Hito Hito no Mi: Modelo Daibutsu",
    englishName: "Human-Human Fruit: Buddha",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.LEGENDARY,
    description: "Transformación en un gigantesco Buda dorado, con ondas de choque devastadoras.",
    effects: { category: "transformation", atk: 28, def: 25 },
    isSingleton: true, // canon signature fruit of Sengoku
  },
  {
    name: "Tori Tori no Mi: Modelo Fénix",
    englishName: "Bird-Bird Fruit: Phoenix",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.LEGENDARY,
    description: "Transformación en un fénix de llamas azules capaces de regenerar heridas mortales.",
    effects: { category: "defensive", element: "fuego azul curativo", atk: 15, def: 20, awakened: { def: 30, note: "Regeneración incluso de heridas mortales" } },
    isSingleton: false, // its canon holder (Marco) isn't seeded as a WorldActor yet — stays a rare-but-duplicable drop until then
  },
  {
    name: "Mori Mori no Mi",
    englishName: "Forest-Forest Fruit",
    type: FruitType.ZOAN_ANCIENT,
    rarity: Rarity.LEGENDARY,
    description: "Convierte cualquier terreno en un bosque denso e impenetrable a voluntad, terreno y trampa a la vez.",
    effects: { category: "utility", atk: 16, def: 26 },
    isSingleton: true, // canon signature fruit of Ryokugyu
  },
  {
    name: "Yomi Yomi no Mi",
    englishName: "Revive-Revive Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.RARE,
    description: "Devuelve el alma al cuerpo tras la muerte, una sola vez — quien la come vive una segunda vida.",
    effects: { category: "utility", atk: 10, def: 10, spd: 14 },
    isSingleton: true, // canon signature fruit of Brook
  },
  {
    name: "Uo Uo no Mi: Modelo Seiryu",
    englishName: "Fish-Fish Fruit: Azure Dragon",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.MYTHICAL_TIER,
    description: "Transformación en un dragón oriental legendario capaz de controlar el clima a su alrededor.",
    effects: { category: "transformation", atk: 40, def: 30, spd: 10, awakened: { atk: 25, note: "Forma de dragón celestial completa" } },
    isSingleton: true, // Yonko-caliber Mythical Zoan — locked/reserved even without an active canon holder in this world yet
  },
  {
    name: "Hito Hito no Mi: Modelo Nika",
    englishName: "Human-Human Fruit: Nika",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.MYTHICAL_TIER,
    description:
      'La legendaria "fruta más ridícula del mundo": otorga un cuerpo de goma con libertad absoluta de movimiento, dicha en leyendas como el fruto del Guerrero de la Liberación.',
    effects: { category: "transformation", atk: 25, def: 10, spd: 15, awakened: { atk: 40, spd: 20, note: "Despertar del Guerrero de la Liberación" } },
    isSingleton: true, // canon signature fruit of Monkey D. Luffy
  },
  // ---------- Phase 2 additions (2026-09-24): duplicable utility fruits + new canon singletons ----------
  {
    name: "Goro Goro no Mi",
    englishName: "Rumble-Rumble Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description: "Cuerpo, creación y control de la electricidad: descargas, velocidad del rayo y una Observación casi infalible para quien la domina.",
    effects: { category: "offensive", element: "rayo", atk: 34, def: 14, spd: 22, logiaIntangible: true, awakened: { atk: 22, spd: 15, note: "Toda la isla se convierte en una extensión de su descarga" } },
    isSingleton: true, // canon signature fruit of Eneru (holds Skypiea)
  },
  {
    name: "Gasu Gasu no Mi",
    englishName: "Gas-Gas Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description: "Convierte al usuario en gas y le deja crear atmósferas venenosas o explosivas: letal en cerrado, temible en cualquier sitio.",
    effects: { category: "offensive", element: "gas", atk: 30, def: 16, logiaIntangible: true, awakened: { atk: 18, note: "Atmósferas enteras bajo su voluntad" } },
    isSingleton: true, // canon signature fruit of Caesar Clown (holds Punk Hazard)
  },
  {
    name: "Pamu Pamu no Mi",
    englishName: "Pop-Pop Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Permite hacer estallar cualquier cosa que el usuario toque; cuanto más grande el objeto, más inconsistente es el estallido.",
    effects: { category: "offensive", atk: 10 },
    isSingleton: false,
  },
  {
    name: "Noro Noro no Mi",
    englishName: "Slow-Slow Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Emite rayos que ralentizan todo lo que tocan durante unos segundos: una ventaja enorme para quien sepa aprovecharla.",
    effects: { category: "utility", spd: 6, atk: 5 },
    isSingleton: false,
  },
  {
    name: "Buki Buki no Mi",
    englishName: "Arms-Arms Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Convierte cualquier parte del cuerpo en armas y proyectiles; el arsenal más versátil que un cuerpo puede llevar.",
    effects: { category: "offensive", atk: 14, def: 4 },
    isSingleton: false,
  },
  {
    name: "Nagi Nagi no Mi",
    englishName: "Calm-Calm Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Crea zonas de silencio absoluto: sin sonido, ni un paso ni un grito se oye. Un sueño para infiltradores.",
    effects: { category: "utility", spd: 5, def: 6 },
    isSingleton: false,
  },
  {
    name: "Fuwa Fuwa no Mi",
    englishName: "Float-Float Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Hace flotar cualquier objeto que el usuario toque; útil para evitar golpes y para lanzar lo que el enemigo no espera.",
    effects: { category: "mobility", spd: 9 },
    isSingleton: false,
  },
  {
    name: "Mane Mane no Mi",
    englishName: "Clone-Clone Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Permite copiar el rostro y la voz de cualquier persona que el usuario haya tocado. Poder de espías y estafadores.",
    effects: { category: "utility", spd: 4, def: 4 },
    isSingleton: false,
  },
  {
    name: "Supa Supa no Mi",
    englishName: "Slice-Slice Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "Convierte cualquier parte del cuerpo en una cuchilla capaz de cortar el acero como si fuera pan.",
    effects: { category: "offensive", atk: 16, def: 6 },
    isSingleton: false,
  },
  {
    name: "Kira Kira no Mi",
    englishName: "Glitter-Glitter Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.UNCOMMON,
    description: "El cuerpo se vuelve un diamante de dureza extrema: casi indestructible, aunque pesado y lento.",
    effects: { category: "defensive", def: 20, spd: -4 },
    isSingleton: false,
  },
  {
    name: "Woshu Woshu no Mi",
    englishName: "Wash-Wash Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Lava y limpia todo lo que toca, incluida la ropa y, en manos hábiles, hasta el sudor del enemigo... y su voluntad de pelear.",
    effects: { category: "utility", def: 4 },
    isSingleton: false,
  },
  {
    name: "Guru Guru no Mi",
    englishName: "Spin-Spin Fruit",
    type: FruitType.PARAMECIA,
    rarity: Rarity.COMMON,
    description: "Permite girar cualquier parte del cuerpo a velocidades vertiginosas: hélices, taladros y trompos humanos.",
    effects: { category: "offensive", atk: 9, spd: 4 },
    isSingleton: false,
  },
  {
    name: "Kame Kame no Mi",
    englishName: "Turtle-Turtle Fruit",
    type: FruitType.ZOAN,
    rarity: Rarity.COMMON,
    description: "Transformación en tortuga: caparazón resistente, buena defensa y una presencia tranquila a la que nadie da importancia... hasta que es tarde.",
    effects: { category: "transformation", def: 16, spd: -3 },
    isSingleton: false,
  },
  {
    name: "Ryu Ryu no Mi: Modelo Pteranodon",
    englishName: "Dragon-Dragon Fruit: Pteranodon",
    type: FruitType.ZOAN_ANCIENT,
    rarity: Rarity.EPIC,
    description: "Transformación en un pterodáctilo gigante: vuelo, mordida demoledora y una envergadura que oscurece el sol.",
    effects: { category: "transformation", atk: 22, def: 12, spd: 14, awakened: { atk: 15, note: "Forma ancestral plena" } },
    isSingleton: false,
  },
  {
    name: "Sara Sara no Mi: Modelo Axolotl",
    englishName: "Sara-Sara Fruit: Axolotl",
    type: FruitType.ZOAN_MYTHICAL,
    rarity: Rarity.EPIC,
    description: "Transformación en un anfibio de regeneración casi absoluta: heridas que se cierran solas y un cuerpo que se adapta.",
    effects: { category: "transformation", def: 14, spd: 8, atk: 8 },
    isSingleton: false,
  },
];

export const DEVIL_FRUIT_CATALOG: DevilFruitCatalogEntry[] = [...BASE_FRUITS, ...EXTRA_FRUITS].map((f) => (SINGLETON_OVERRIDES.has(f.name) ? { ...f, isSingleton: true } : f));

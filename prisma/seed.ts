import { PrismaClient, FruitType, Rarity, WeaponGrade, Sea, EventKind, ActorRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Grand Line RPG world...");

  // ---------- Islands ----------
  const islandDefs = [
    {
      key: "foosha",
      name: "Pueblo Foosha",
      sea: Sea.EAST_BLUE,
      danger: 1,
      minLevel: 1,
      factionControl: null as string | null,
      description:
        "Un pueblo costero tranquilo de tejados rojos, donde los barcos pesqueros zarpan cada mañana y los niños sueñan con el mar. El punto de partida clásico de todo pirata novato.",
      arcHook:
        "Un mensajero de la Marina pasó ayer preguntando por \"cualquier joven con ambiciones de zarpar\". Nadie sabe muy bien qué anda buscando, pero todo el mundo lo comenta en susurros.",
    },
    {
      key: "marineG5",
      name: "Cuartel Marine G-5",
      sea: Sea.EAST_BLUE,
      danger: 1,
      minLevel: 1,
      factionControl: "Marina",
      description:
        "Una base de entrenamiento gris y disciplinada en el límite del East Blue, donde los reclutas aprenden que la justicia absoluta empieza por obedecer órdenes.",
      arcHook:
        "Los rumores en el cuartel hablan de una tripulación novata que ya ha empezado a dar problemas en el East Blue. Tu comandante quiere resultados, no excusas.",
    },
    {
      key: "baltigo",
      name: "Isla Baltigo",
      sea: Sea.EAST_BLUE,
      danger: 2,
      minLevel: 1,
      factionControl: "Ejército Revolucionario",
      description:
        "Oculta tras corrientes que confunden a los Log Pose corrientes, esta isla alberga un cuartel secreto donde se planifica la caída del Gobierno Mundial.",
      arcHook:
        "Una célula ha dejado de reportar. El Ejército Revolucionario necesita saber si fueron descubiertos, capturados, o algo peor — y confía en que tú lo averigües.",
    },
    {
      key: "gecko",
      name: "Isla Gecko",
      sea: Sea.EAST_BLUE,
      danger: 2,
      minLevel: 1,
      factionControl: null,
      description:
        "Un puerto polvoriento dominado por tablones de recompensas y tabernas donde los cazarrecompensas comparan cicatrices y cuentan mentiras sobre sus capturas.",
      arcHook:
        "El tablón de recompensas está más lleno que de costumbre esta semana. Alguien nuevo se está haciendo notar en los mares, y eso significa dinero fácil para quien lo encuentre primero.",
    },
    {
      key: "shimotsuki",
      name: "Villa Shimotsuki",
      sea: Sea.EAST_BLUE,
      danger: 2,
      minLevel: 1,
      factionControl: null,
      description:
        "Famosa por su dojo centenario y sus herreros que aún forjan katanas siguiendo tradiciones perdidas. El acero que sale de aquí puede cortar el destino.",
      arcHook:
        "El maestro del dojo lleva días sin abrir las puertas. Los rumores dicen que un antiguo alumno ha vuelto a la isla — y no en son de paz.",
    },
    {
      key: "baratie",
      name: "Restaurante Baratie",
      sea: Sea.EAST_BLUE,
      danger: 3,
      minLevel: 1,
      factionControl: null,
      description:
        "Un galeón reconvertido en el restaurante flotante más famoso de los mares, donde cocineros pelean tan bien como cocinan y ningún hambriento se va sin comer.",
      arcHook:
        "El dueño del restaurante ha triplicado la seguridad esta semana. Algo — o alguien — tiene a todo el personal nervioso, aunque nadie quiere decir el nombre en voz alta.",
    },
    {
      key: "conomi",
      name: "Isla Conomi",
      sea: Sea.EAST_BLUE,
      danger: 4,
      minLevel: 1,
      factionControl: "Arlong",
      description:
        "Un archipiélago de aldeas pesqueras bajo el yugo de un hombre-pez tirano que extorsiona a los humanos con impuestos imposibles de pagar.",
      arcHook:
        "Arlong ha subido de nuevo los \"impuestos\" a las aldeas humanas. Los pescadores locales ya no tienen nada más que dar, y todos saben lo que pasa cuando no pueden pagar.",
    },
    {
      key: "loguetown",
      name: "Loguetown",
      sea: Sea.EAST_BLUE,
      danger: 5,
      minLevel: 1,
      factionControl: "Marina",
      description:
        'La "Ciudad del Comienzo y el Final", donde el Rey de los Piratas fue ejecutado. La plataforma de ejecución todavía domina la plaza, y la Marina vigila cada muelle.',
      arcHook:
        "La Marina ha reforzado la vigilancia en cada muelle desde que corrió el rumor de que un pirata con recompensa alta pasó por aquí la semana pasada. Nadie entra o sale sin ser observado.",
    },
    {
      key: "reverseMountain",
      name: "Reverse Mountain",
      sea: Sea.EAST_BLUE,
      danger: 6,
      minLevel: 1,
      factionControl: null,
      description:
        "La única entrada segura al Grand Line: una montaña donde cuatro corrientes oceánicas ascienden en vez de descender. Más allá, el mundo se vuelve mucho más peligroso.",
      arcHook:
        "Las cuatro corrientes rugen más fuerte de lo habitual este año. Los marineros veteranos dicen que es un mal augurio para quien esté a punto de cruzar al Grand Line por primera vez.",
    },
    {
      key: "whiskyPeak",
      name: "Whisky Peak",
      sea: Sea.PARADISE,
      danger: 6,
      minLevel: 8,
      factionControl: "Baroque Works",
      description:
        "Un pueblo de fiesta perpetua que recibe a cada recién llegado como a un héroe... hasta que baja la guardia. Nada en el Grand Line es lo que parece.",
      arcHook: "La isla entera parece demasiado feliz de verte. En el Grand Line, esa clase de bienvenida nunca es gratuita.",
    },
    {
      key: "littleGarden",
      name: "Little Garden",
      sea: Sea.PARADISE,
      danger: 7,
      minLevel: 10,
      factionControl: null,
      description:
        "Una isla prehistórica congelada en el tiempo, hogar de bestias colosales y de dos gigantes que llevan cien años duelando por una promesa de honor.",
      arcHook:
        "El duelo centenario entre los dos gigantes de la isla sigue sin ganador — pero algo en la jungla ha empezado a cazar a ambos bandos por igual, y ninguno de los dos parece dispuesto a admitirlo.",
    },
    {
      key: "alabasta",
      name: "Alabasta",
      sea: Sea.PARADISE,
      danger: 8,
      minLevel: 12,
      factionControl: null,
      description:
        "Un reino desértico al borde de la guerra civil, donde la arena guarda secretos más viejos que el propio Gobierno Mundial.",
      arcHook: "El desierto susurra sobre una rebelión que crece más rápido de lo que la corona puede contener. Quien elija un bando aquí, lo hará para siempre.",
    },
    {
      key: "graveyardIsland",
      name: "Isla Cementerio",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 30,
      factionControl: "Marshall D. Teach",
      description:
        "Una fortaleza natural de rocas negras y niebla permanente, dominio absoluto de Barbanegra. Los rumores dicen que aquí guarda mucho más que su tripulación de criminales fugados de Impel Down.",
      arcHook:
        "No hay mapas que marquen bien esta isla, y los pocos que se acercan sin ser convocados no suelen volver a salir. Si Barbanegra guarda algo aquí, no lo comparte con nadie vivo.",
    },
    {
      key: "eniesLobby",
      name: "Enies Lobby",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 35,
      factionControl: "Gobierno Mundial (CP-0)",
      description:
        "La sede judicial del Gobierno Mundial en persona: torres de mármol blanco, un Árbol del Conocimiento marchito, y un Portal de la Justicia que ha visto entrar a más piratas de los que ha visto salir.",
      arcHook:
        "CP-0 ha sellado el archivo sobre un Poneglifo confiscado hace décadas. Nadie entra sin autorización directa del Gobierno Mundial, y nadie que lo intente sin ella ha vuelto a ser visto.",
    },
  ];

  const islands: Record<string, { id: string }> = {};
  for (const def of islandDefs) {
    const island = await prisma.island.upsert({
      where: { name: def.name },
      update: {},
      create: {
        name: def.name,
        sea: def.sea,
        dangerLevel: def.danger,
        minLevelToEnter: def.minLevel,
        factionControl: def.factionControl,
        description: def.description,
        arcHook: def.arcHook,
        connections: "[]",
      },
    });
    islands[def.key] = island;
  }

  const adjacency: Record<string, string[]> = {
    foosha: ["shimotsuki", "marineG5", "baltigo"],
    marineG5: ["foosha", "loguetown"],
    baltigo: ["foosha"],
    gecko: ["shimotsuki", "loguetown"],
    shimotsuki: ["foosha", "gecko", "baratie"],
    baratie: ["shimotsuki", "conomi"],
    conomi: ["baratie", "loguetown"],
    loguetown: ["conomi", "marineG5", "gecko", "reverseMountain"],
    reverseMountain: ["loguetown", "whiskyPeak"],
    whiskyPeak: ["reverseMountain", "littleGarden"],
    littleGarden: ["whiskyPeak", "alabasta"],
    alabasta: ["littleGarden", "graveyardIsland", "eniesLobby"],
    graveyardIsland: ["alabasta"],
    eniesLobby: ["alabasta"],
  };

  for (const [key, neighborKeys] of Object.entries(adjacency)) {
    await prisma.island.update({
      where: { id: islands[key].id },
      data: { connections: JSON.stringify(neighborKeys.map((k) => islands[k].id)) },
    });
  }

  // ---------- Devil Fruits ----------
  type FruitSeed = {
    name: string;
    englishName: string;
    type: FruitType;
    rarity: Rarity;
    description: string;
    effects: object;
  };

  const fruits: FruitSeed[] = [
    // Paramecia — common/uncommon utility
    {
      name: "Bara Bara no Mi",
      englishName: "Chop-Chop Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.COMMON,
      description: "Permite separar el cuerpo en pedazos a voluntad, inmune a cortes.",
      effects: { category: "defensive", def: 15 },
    },
    {
      name: "Sube Sube no Mi",
      englishName: "Slip-Slip Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.COMMON,
      description: "Vuelve la piel perfectamente resbaladiza; los golpes y agarres resbalan sin efecto.",
      effects: { category: "defensive", def: 8, spd: 5 },
    },
    {
      name: "Kilo Kilo no Mi",
      englishName: "Kilo-Kilo Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.COMMON,
      description: "Cambia el propio peso entre 1 y 10.000 kilos a voluntad.",
      effects: { category: "utility", atk: 6 },
    },
    {
      name: "Bomu Bomu no Mi",
      englishName: "Bomb-Bomb Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.UNCOMMON,
      description: "Todo el cuerpo, incluidos mocos y aliento, puede detonar como explosivo.",
      effects: { category: "offensive", element: "explosivo", atk: 14 },
    },
    {
      name: "Doa Doa no Mi",
      englishName: "Door-Door Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.UNCOMMON,
      description: "Crea puertas en cualquier superficie, incluido el aire.",
      effects: { category: "utility", spd: 10 },
    },
    {
      name: "Toge Toge no Mi",
      englishName: "Spike-Spike Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.UNCOMMON,
      description: "El cuerpo puede cubrirse de púas afiladas como agujas.",
      effects: { category: "offensive", atk: 10, def: 8 },
    },
    {
      name: "Horo Horo no Mi",
      englishName: "Ghost-Ghost Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.UNCOMMON,
      description: "Invoca espíritus que debilitan la voluntad de lucha del enemigo.",
      effects: { category: "utility", atk: 8, def: 6 },
    },
    {
      name: "Hana Hana no Mi",
      englishName: "Flower-Flower Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.RARE,
      description: "Hace florecer partes del propio cuerpo en cualquier superficie al alcance de la vista.",
      effects: { category: "utility", atk: 8, def: 8, spd: 8 },
    },
    {
      name: "Doku Doku no Mi",
      englishName: "Venom-Venom Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.RARE,
      description: "El cuerpo genera y controla venenos capaces de corroer una isla entera.",
      effects: { category: "offensive", element: "veneno", atk: 18, awakened: { atk: 30, note: "El veneno corrompe la isla entera" } },
    },
    {
      name: "Bari Bari no Mi",
      englishName: "Barrier-Barrier Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.RARE,
      description: "Genera barreras irrompibles a voluntad, incluso para atacar.",
      effects: { category: "defensive", def: 22 },
    },
    {
      name: "Ope Ope no Mi",
      englishName: "Op-Op Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.EPIC,
      description: 'Crea una "sala" esférica donde su usuario controla el espacio como un cirujano todopoderoso.',
      effects: { category: "utility", atk: 10, def: 20, awakened: { def: 25, note: "Operación a nivel de ciudad entera" } },
    },
    {
      name: "Ito Ito no Mi",
      englishName: "String-String Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.EPIC,
      description: "Genera hilos más afilados que espadas y capaces de controlar cuerpos ajenos como marionetas.",
      effects: { category: "offensive", atk: 16, def: 10, spd: 6, awakened: { atk: 20, note: "Hilos que gobiernan un reino entero" } },
    },
    {
      name: "Kage Kage no Mi",
      englishName: "Shadow-Shadow Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.EPIC,
      description: "Manipula sombras propias y ajenas, pudiendo robarlas para crear ejércitos de zombis.",
      effects: { category: "utility", atk: 12, def: 8 },
    },
    {
      name: "Zushi Zushi no Mi",
      englishName: "Gravity-Gravity Fruit",
      type: FruitType.PARAMECIA,
      rarity: Rarity.LEGENDARY,
      description: "Controla la gravedad a voluntad, capaz de atraer meteoritos del espacio.",
      effects: { category: "offensive", atk: 28, def: 18, awakened: { atk: 15, note: "Lluvia de meteoros a voluntad" } },
    },
    // Logia
    {
      name: "Suna Suna no Mi",
      englishName: "Sand-Sand Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.EPIC,
      description: "Cuerpo, creación y control de arena; puede absorber la humedad de cualquier cosa.",
      effects: { category: "offensive", element: "arena", atk: 18, def: 18, logiaIntangible: true },
    },
    {
      name: "Mera Mera no Mi",
      englishName: "Flame-Flame Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.LEGENDARY,
      description: "Cuerpo, creación y control absoluto del fuego.",
      effects: { category: "offensive", element: "fuego", atk: 30, def: 15, logiaIntangible: true, awakened: { atk: 20 } },
    },
    {
      name: "Hie Hie no Mi",
      englishName: "Ice-Ice Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.LEGENDARY,
      description: "Cuerpo, creación y control del hielo, capaz de congelar mares enteros.",
      effects: { category: "offensive", element: "hielo", atk: 25, def: 20, logiaIntangible: true },
    },
    {
      name: "Pika Pika no Mi",
      englishName: "Light-Light Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.LEGENDARY,
      description: "Cuerpo, creación y control de la luz; ataca y se mueve a velocidad lumínica.",
      effects: { category: "offensive", element: "luz", atk: 30, spd: 25, logiaIntangible: true },
    },
    {
      name: "Yami Yami no Mi",
      englishName: "Dark-Dark Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.MYTHICAL_TIER,
      description:
        "Controla la oscuridad y la gravedad de la nada misma; la única Logia que, en vez de esquivar, atrae cualquier golpe hacia sí.",
      effects: { category: "offensive", element: "oscuridad", atk: 35, def: 25, logiaIntangible: false, awakened: { atk: 25, note: "Un agujero negro que engulle la luz" } },
    },
    {
      name: "Magu Magu no Mi",
      englishName: "Magma-Magma Fruit",
      type: FruitType.LOGIA,
      rarity: Rarity.MYTHICAL_TIER,
      description: "Cuerpo, creación y control del magma, considerado el elemento más fuerte al superar al fuego.",
      effects: { category: "offensive", element: "magma", atk: 38, def: 22, logiaIntangible: true, awakened: { atk: 30, note: "El elemento más fuerte de los mares" } },
    },
    // Zoan / Ancient / Mythical
    {
      name: "Ushi Ushi no Mi: Modelo Bisonte",
      englishName: "Ox-Ox Fruit: Bison",
      type: FruitType.ZOAN,
      rarity: Rarity.UNCOMMON,
      description: "Transformación en un poderoso bisonte de combate, o un híbrido con fuerza descomunal.",
      effects: { category: "transformation", atk: 14, def: 10 },
    },
    {
      name: "Neko Neko no Mi: Modelo Leopardo",
      englishName: "Cat-Cat Fruit: Leopard",
      type: FruitType.ZOAN,
      rarity: Rarity.EPIC,
      description: "Transformación en un leopardo ágil y letal, o un híbrido de reflejos felinos.",
      effects: { category: "transformation", atk: 18, spd: 22 },
    },
    {
      name: "Inu Inu no Mi: Modelo Okuchi no Makami",
      englishName: "Dog-Dog Fruit: Okuchi no Makami",
      type: FruitType.ZOAN_MYTHICAL,
      rarity: Rarity.EPIC,
      description: "Transformación en el lobo-deidad guardián que puede caminar sobre el hielo a voluntad.",
      effects: { category: "transformation", atk: 20, def: 18, spd: 12 },
    },
    {
      name: "Hito Hito no Mi: Modelo Daibutsu",
      englishName: "Human-Human Fruit: Buddha",
      type: FruitType.ZOAN_MYTHICAL,
      rarity: Rarity.LEGENDARY,
      description: "Transformación en un gigantesco Buda dorado, con ondas de choque devastadoras.",
      effects: { category: "transformation", atk: 28, def: 25 },
    },
    {
      name: "Tori Tori no Mi: Modelo Fénix",
      englishName: "Bird-Bird Fruit: Phoenix",
      type: FruitType.ZOAN_MYTHICAL,
      rarity: Rarity.LEGENDARY,
      description: "Transformación en un fénix de llamas azules capaces de regenerar heridas mortales.",
      effects: { category: "defensive", element: "fuego azul curativo", atk: 15, def: 20, awakened: { def: 30, note: "Regeneración incluso de heridas mortales" } },
    },
    {
      name: "Uo Uo no Mi: Modelo Seiryu",
      englishName: "Fish-Fish Fruit: Azure Dragon",
      type: FruitType.ZOAN_MYTHICAL,
      rarity: Rarity.MYTHICAL_TIER,
      description: "Transformación en un dragón oriental legendario capaz de controlar el clima a su alrededor.",
      effects: { category: "transformation", atk: 40, def: 30, spd: 10, awakened: { atk: 25, note: "Forma de dragón celestial completa" } },
    },
    {
      name: "Hito Hito no Mi: Modelo Nika",
      englishName: "Human-Human Fruit: Nika",
      type: FruitType.ZOAN_MYTHICAL,
      rarity: Rarity.MYTHICAL_TIER,
      description:
        'La legendaria "fruta más ridícula del mundo": otorga un cuerpo de goma con libertad absoluta de movimiento, dicha en leyendas como el fruto del Guerrero de la Liberación.',
      effects: { category: "transformation", atk: 25, def: 10, spd: 15, awakened: { atk: 40, spd: 20, note: "Despertar del Guerrero de la Liberación" } },
    },
  ];

  for (const f of fruits) {
    await prisma.devilFruit.upsert({
      where: { name: f.name },
      update: {},
      create: {
        name: f.name,
        englishName: f.englishName,
        type: f.type,
        rarity: f.rarity,
        description: f.description,
        effectsJson: JSON.stringify(f.effects),
      },
    });
  }

  // ---------- Weapons ----------
  type WeaponSeed = {
    name: string;
    kind: string;
    grade: WeaponGrade;
    description: string;
    atkBonus: number;
    basePrice: number;
    special?: string;
  };

  const weapons: WeaponSeed[] = [
    // Common starter/shop gear lives in src/lib/game/common-gear.ts as a
    // plain catalog (instanced per character), not here — only truly
    // unique, 1-of-1 named blades are seeded as singleton rows.
    // Ryo Wazamono
    {
      name: "Sandai Kitetsu",
      kind: "Katana",
      grade: WeaponGrade.RYO_WAZAMONO,
      description: "La tercera generación de la maldita familia Kitetsu. Corta magníficamente... cuando no traiciona a su portador.",
      atkBonus: 20,
      basePrice: 120_000,
      special: "maldita: pequeña probabilidad de herir a su propio portador en cada combate",
    },
    {
      name: "Yubashiri",
      kind: "Katana",
      grade: WeaponGrade.RYO_WAZAMONO,
      description: "Una katana blanca de filo confiable, sin maldiciones ni sorpresas, solo acero excelente.",
      atkBonus: 16,
      basePrice: 90_000,
    },
    // Saijo O Wazamono — the twelve supreme grade blades
    {
      name: "Wado Ichimonji",
      kind: "Katana",
      grade: WeaponGrade.SAIJO_O_WAZAMONO,
      description: "Una de las doce espadas supremas. Se dice que perteneció a un samurái que la entregó como un juramento.",
      atkBonus: 25,
      basePrice: 400_000,
    },
    {
      name: "Shusui",
      kind: "Katana",
      grade: WeaponGrade.SAIJO_O_WAZAMONO,
      description: "Una hoja negra legendaria forjada en Wano, capaz de cortar el acero como si fuera papel.",
      atkBonus: 28,
      basePrice: 480_000,
    },
    {
      name: "Enma",
      kind: "Katana",
      grade: WeaponGrade.SAIJO_O_WAZAMONO,
      description: "Una hoja tan sedienta de Haki de Armadura que drena el propio poder de quien no puede dominarla.",
      atkBonus: 30,
      basePrice: 500_000,
      special: "drena Haki de Armadura del portador si su nivel es insuficiente para controlarla",
    },
    // Unique named item
    {
      name: "Kabuto",
      kind: "Rifle",
      grade: WeaponGrade.UNIQUE,
      description: "Un rifle de precisión de diseño único, capaz de disparar balas de acero comprimido a kilómetros de distancia.",
      atkBonus: 18,
      basePrice: 150_000,
    },
  ];

  for (const w of weapons) {
    const existing = await prisma.weapon.findFirst({ where: { name: w.name } });
    if (existing) continue;
    await prisma.weapon.create({
      data: {
        name: w.name,
        kind: w.kind,
        grade: w.grade,
        description: w.description,
        atkBonus: w.atkBonus,
        basePrice: w.basePrice,
        specialJson: w.special ? JSON.stringify({ note: w.special }) : null,
      },
    });
  }

  // ---------- World actors ----------
  const actors: Array<{ name: string; role: ActorRole; powerLevel: number; description: string; personality: string }> = [
    {
      name: "Shanks",
      role: ActorRole.YONKO,
      powerLevel: 99,
      description: "El pelirrojo, uno de los Cuatro Emperadores, tan temido por su espada como por su influencia política.",
      personality: "Habla con calma casi displicente incluso ante una amenaza real, pero su tono se vuelve absolutamente serio en el instante en que alguien cruza una línea que le importa.",
    },
    {
      name: "Marshall D. Teach",
      role: ActorRole.YONKO,
      powerLevel: 98,
      description: 'Apodado "Barbanegra", el único hombre conocido por poseer dos frutas del diablo. Su ambición no tiene fondo.',
      personality: 'Ríe con una carcajada grave y teatral antes de cada golpe, disfrutando abiertamente del caos que provoca; llama "amigo" a quien está a punto de destruir.',
    },
    {
      name: "Buggy",
      role: ActorRole.YONKO,
      powerLevel: 75,
      description: 'El "Payaso Estrella", ascendido a Emperador casi por accidente, ahora al frente del Cross Guild.',
      personality: "Fanfarrón y ruidoso, exagera cada amenaza hasta lo absurdo, pero entra en pánico genuino si las cosas se ponen realmente serias.",
    },
    {
      name: "Dracule Mihawk",
      role: ActorRole.WARLORD,
      powerLevel: 97,
      description: "El espadachín más fuerte del mundo, ahora aliado incómodo del Cross Guild.",
      personality: "Habla poco y con desdén aristocrático; valora la habilidad con la espada por encima de casi todo lo demás y lo dice sin rodeos.",
    },
    {
      name: "Kizaru",
      role: ActorRole.ADMIRAL,
      powerLevel: 95,
      description: "Almirante de la Marina, usuario de la Pika Pika no Mi, tan veloz como despreocupado.",
      personality: "Arrastra las palabras con pereza deliberada, como si nada le urgiera nunca — incluso en pleno combate parece estar de vacaciones.",
    },
    {
      name: "Fujitora",
      role: ActorRole.ADMIRAL,
      powerLevel: 94,
      description: "Almirante ciego que juzga con gravedad literal y figurada; su sentido de la justicia incomoda a sus superiores.",
      personality: "Habla con solemnidad pausada, casi paternal, y no oculta su incomodidad cuando la Marina le pide algo que no considera justo.",
    },
    {
      name: "Ryokugyu",
      role: ActorRole.ADMIRAL,
      powerLevel: 90,
      description: "El almirante más reciente, de métodos tan lentos como implacables.",
      personality: "Parco y metódico, deja largos silencios antes de hablar, como si cada palabra le costara un esfuerzo que prefiere ahorrarse.",
    },
    {
      name: "Sakazuki",
      role: ActorRole.ADMIRAL,
      powerLevel: 99,
      description: 'Almirante de Flota, apodado "Akainu". Encarna la Justicia Absoluta sin piedad ni excepciones.',
      personality: "Frío, tajante y sin una pizca de humor; cualquier piedad ajena le resulta personalmente ofensiva y lo dice sin levantar la voz.",
    },
    {
      name: "Sabo",
      role: ActorRole.REVOLUTIONARY_COMMANDER,
      powerLevel: 92,
      description: "Jefe de Estado Mayor del Ejército Revolucionario, hermano de juramento de sangre de dos futuros Emperadores.",
      personality: "Directo y cálido con quienes considera aliados, pero implacablemente estratégico frente al Gobierno Mundial, sin un ápice de duda.",
    },
    {
      name: "Rob Lucci",
      role: ActorRole.CIPHER_POL,
      powerLevel: 88,
      description: "Agente de CP-0, el brazo encubierto del Gobierno Mundial para los asuntos que nadie debe conocer.",
      personality: "Habla en voz baja y mide cada palabra como si calculara distancias de combate; trata la piedad ajena como una debilidad táctica, nunca como una virtud.",
    },
  ];

  const worldActors: Record<string, { id: string }> = {};
  for (const a of actors) {
    const actor = await prisma.worldActor.upsert({
      where: { name: a.name },
      update: { personality: a.personality },
      create: { name: a.name, role: a.role, powerLevel: a.powerLevel, description: a.description, personality: a.personality },
    });
    worldActors[a.name] = actor;
  }

  // ---------- World event templates (background simulation) ----------
  const worldEventTemplates = [
    {
      weight: 15,
      minHeat: 0,
      headline: "{actor} es desplegado de emergencia",
      category: "Gobierno Mundial",
      body: [
        "El Gobierno Mundial moviliza a {actor} para sofocar disturbios en una isla remota del Nuevo Mundo.",
        "Se reporta a {actor} zarpando hacia una zona de conflicto sin revelar el destino exacto.",
      ],
      busyHours: [6, 24] as [number, number],
      heatDelta: 1,
    },
    {
      weight: 10,
      minHeat: 10,
      headline: "Guerra de territorio: la fuerza de {actor} ataca una base rival",
      category: "Guerra",
      body: ["Testigos reportan explosiones y humo negro en el horizonte tras el choque liderado por {actor}."],
      busyHours: [8, 20] as [number, number],
      heatDelta: 3,
    },
    {
      weight: 8,
      minHeat: 0,
      headline: "El Gobierno Mundial anuncia una recompensa histórica",
      category: "Recompensas",
      body: ["Un pirata novato ha hecho suficiente ruido como para que su nombre aparezca en todos los periódicos de golpe."],
    },
    {
      weight: 6,
      minHeat: 15,
      headline: "Rumores de un Poneglifo perdido inquietan a {actor}",
      category: "Poneglifos",
      body: ["Fuentes cercanas a {actor} confirman movimientos inusuales cerca de ruinas ancestrales."],
      busyHours: [12, 30] as [number, number],
      heatDelta: 2,
    },
    {
      weight: 5,
      minHeat: 5,
      headline: "Motín a bordo: la tripulación de {actor} sufre una crisis interna",
      category: "Tripulaciones",
      body: ["Se dice que ni siquiera {actor} pudo evitar que la disputa llegara a las espadas."],
    },
    {
      weight: 3,
      minHeat: 40,
      headline: "El Gobierno Mundial ordena una Buster Call",
      category: "Guerra",
      body: ["Cinco Vicealmirantes convergen sobre una isla que, para cuando amanezca, puede que ya no exista."],
      heatDelta: 8,
    },
    {
      weight: 12,
      minHeat: 0,
      headline: "{actor} es visto reclutando nuevos aliados",
      category: "Tripulaciones",
      body: ["En un puerto discreto, {actor} habría cerrado una alianza que promete cambiar el mapa de poder."],
    },
    {
      weight: 7,
      minHeat: 20,
      headline: "Escaramuza en alta mar entre {actor} y una flota desconocida",
      category: "Guerra",
      body: ["Los supervivientes hablan de un combate breve, brutal, y de un vencedor que no se detuvo a dar explicaciones."],
      busyHours: [4, 10] as [number, number],
      heatDelta: 2,
    },
    {
      weight: 6,
      minHeat: 10,
      headline: "Cacería sangrienta tras un Poneglifo",
      category: "Poneglifos",
      body: [
        "Una tripulación sin nombre conocido desembarcó en busca de ruinas ancestrales. Solo la mitad regresó al barco; el resto quedó donde la Marina los encontró primero.",
        "Arqueólogos independientes financiados en secreto por un Emperador desaparecieron cerca de una isla que ni figura en los mapas oficiales. Se los da por muertos.",
        "Una emboscada en las ruinas dejó un poblado entero preguntándose qué buscaban realmente los forasteros que llegaron de madrugada.",
      ],
      heatDelta: 2,
    },
    {
      weight: 5,
      minHeat: 15,
      headline: "Emboscada en alta mar: {actor} estuvo cerca de perderlo todo",
      category: "Guerra",
      body: [
        "Una flota rival, coordinada con precisión imposible, cayó sobre {actor} en aguas que se creían seguras. Hubo bajas en ambos bandos.",
        "Nadie sabe cómo filtraron la ruta de {actor}, pero el ataque casi funciona. La desconfianza dentro de su tripulación crece.",
      ],
      busyHours: [10, 26] as [number, number],
      heatDelta: 3,
    },
    {
      weight: 2,
      minHeat: 60,
      headline: "Gran Guerra en los mares: el equilibrio del mundo se sacude",
      category: "Guerra",
      body: [
        "Lo que empezó como una operación de rescate se convirtió en la batalla más grande en años: Marina, piratas y revolucionarios chocando sobre la misma agua, con {actor} en el centro de todo. Cuando el humo se disipa, el mapa de poder ya no es el mismo.",
        "Durante días, ninguna isla cercana tuvo noticias claras: solo humo en el horizonte y rumores de que {actor} no salió ileso. El Gobierno Mundial tardó una semana en emitir un comunicado, y cuando lo hizo, omitió más de lo que contó.",
      ],
      busyHours: [48, 96] as [number, number],
      heatDelta: 15,
    },
  ];

  await prisma.worldEventTemplate.deleteMany({});
  for (const t of worldEventTemplates) {
    await prisma.worldEventTemplate.create({
      data: {
        weight: t.weight,
        minHeat: t.minHeat,
        headline: t.headline,
        category: t.category,
        bodyJson: JSON.stringify({
          variants: t.body,
          busyHours: "busyHours" in t ? t.busyHours : undefined,
          heatDelta: "heatDelta" in t ? t.heatDelta : undefined,
        }),
      },
    });
  }

  await prisma.worldClock.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, heat: 10 },
  });

  // ---------- Gameplay event templates ----------
  type EventTemplateSeed = {
    islandKey?: string;
    kind: EventKind;
    minDanger: number;
    maxDanger: number;
    weight: number;
    title: string;
    body: object;
  };

  const eventTemplates: EventTemplateSeed[] = [
    {
      kind: EventKind.EXPLORATION,
      minDanger: 1,
      maxDanger: 10,
      weight: 16,
      title: "Sendero sin marcar",
      body: {
        flavorTexts: [
          "Te adentras en un sendero cubierto de niebla, lejos de las miradas del pueblo.",
          "Sigues un rumor local hasta un claro que nadie parece recordar.",
          "Un mapa desgastado, comprado por monedas, te lleva a un rincón inexplorado de la isla.",
        ],
        onCriticalSuccess: { text: ["Encuentras un cofre oculto que nadie había tocado en años."], berries: [300, 900], xp: [15, 30] },
        onSuccess: { text: ["Encuentras un atajo útil y algo de botín menor."], berries: [80, 250], xp: [5, 15] },
        onFail: { text: ["Te pierdes un rato y vuelves con las manos vacías, pero ileso."], hpLoss: [0, 5] },
        onCriticalFail: { text: ["Caes en una trampa oxidada y te haces daño de verdad."], hpLoss: [10, 25] },
        fruitDropChance: 0.015,
      },
    },
    {
      kind: EventKind.EXPLORATION,
      minDanger: 1,
      maxDanger: 10,
      weight: 2,
      title: "El mar no perdona",
      body: {
        flavorTexts: [
          "Un tablón podrido cede bajo tus pies junto al muelle y el agua se cierra sobre ti.",
          "Una ola te arrastra mar adentro antes de que puedas reaccionar.",
          "En el forcejeo por subir al bote, alguien te empuja por la borda.",
        ],
        onCriticalSuccess: { text: ["Logras aferrarte a un cabo justo a tiempo, apenas mojado."], xp: [5, 10] },
        onSuccess: { text: ["Consigues salir del agua por tus propios medios, empapado pero ileso."], hpLoss: [0, 6] },
        onFail: { text: ["El agua se cierra sobre ti. A duras penas alguien logra sacarte a tiempo, con los pulmones ardiendo."], hpLoss: [15, 28] },
        onCriticalFail: {
          text: ["Te hundes como una piedra. Para cuando por fin te sacan del agua, apenas respiras."],
          hpLoss: [38, 50],
        },
        waterHazard: true,
      },
    },
    {
      kind: EventKind.TREASURE,
      minDanger: 1,
      maxDanger: 6,
      weight: 8,
      title: "Rumor de tesoro enterrado",
      body: {
        flavorTexts: ["Un anciano borracho jura saber dónde un pirata retirado enterró su fortuna.", "Una X tallada en una roca costera te llama la atención."],
        onCriticalSuccess: { text: ["¡El rumor era cierto! Desentierras una fortuna considerable."], berries: [800, 2000] },
        onSuccess: { text: ["Encuentras una bolsa de berries olvidada bajo las tablas del muelle."], berries: [150, 500] },
        onFail: { text: ["Cavas durante horas y solo encuentras tierra y decepción."] },
        onCriticalFail: { text: ["El rumor era una trampa de carteristas: te roban mientras excavas."], hpLoss: [0, 8] },
      },
    },
    {
      kind: EventKind.SOCIAL,
      minDanger: 1,
      maxDanger: 10,
      weight: 12,
      title: "Conversación de taberna",
      body: {
        flavorTexts: [
          "Te sientas en la taberna local, donde los marineros nunca dejan de hablar.",
          "Un vendedor ambulante insiste en contarte todo lo que sabe, por un módico precio.",
        ],
        onCriticalSuccess: { text: ["Ganas la confianza de un posible aliado para tu tripulación."], xp: [10, 20] },
        onSuccess: { text: ["Recoges información útil sobre la isla y sus peligros."], xp: [5, 12] },
        onFail: { text: ["Nadie parece tener nada interesante que decir hoy."] },
        onCriticalFail: { text: ["Ofendes sin querer a alguien peligroso; te ganas una mala mirada."] },
      },
    },
    {
      kind: EventKind.TRAINING,
      minDanger: 1,
      maxDanger: 10,
      weight: 10,
      title: "Sesión de entrenamiento",
      body: {
        flavorTexts: ["Dedicas el día a pulir tu técnica lejos de miradas curiosas.", "Buscas un rincón tranquilo para forzar los límites de tu cuerpo y tu voluntad."],
        onCriticalSuccess: { text: ["Algo hace clic dentro de ti: un avance real."], xp: [20, 40] },
        onSuccess: { text: ["Terminas exhausto pero notablemente más fuerte."], xp: [10, 20] },
        onFail: { text: ["Un día de entrenamiento mediocre, sin avances claros."] },
        onCriticalFail: { text: ["Te excedes y terminas lastimado."], hpLoss: [5, 15] },
      },
    },
    {
      kind: EventKind.RUMOR,
      minDanger: 1,
      maxDanger: 10,
      weight: 9,
      title: "Noticias que llegan con la marea",
      body: {
        flavorTexts: ["Un periódico viejo cambia de manos por el precio de una copa.", "Los pescadores comentan lo último que se dice en los muelles del Gobierno Mundial."],
        onCriticalSuccess: { text: ["La información que obtienes vale su peso en oro para tu próxima jugada."], xp: [8, 15] },
        onSuccess: { text: ["Te enteras de los rumores del día, como todos los demás."] },
        onFail: { text: ["Nada nuevo bajo el sol."] },
        onCriticalFail: { text: ["El rumor resulta ser falso y te hace perder el tiempo."] },
      },
    },
    {
      kind: EventKind.DEVIL_FRUIT,
      minDanger: 2,
      maxDanger: 10,
      weight: 1,
      title: "Un fruto extraño",
      body: {
        flavorTexts: [
          "En el mercado negro de la isla, un comerciante nervioso te ofrece un fruto de aspecto imposible.",
          "Encuentras, medio enterrado en la arena, un fruto que ninguna fruta del mundo debería parecerse.",
        ],
        onCriticalSuccess: { text: ["El vendedor, impresionado, te lo entrega casi regalado."], xp: [10, 10] },
        onSuccess: { text: ["Reúnes el valor (y el dinero) para hacerte con él."], xp: [5, 5] },
        onFail: { text: ["No consigues el dinero a tiempo; alguien más se lo lleva."] },
        onCriticalFail: { text: ["Era una trampa: casi te roban en el intento."], hpLoss: [0, 10] },
        fruitDropChance: 1,
      },
    },
    {
      kind: EventKind.COMBAT,
      minDanger: 1,
      maxDanger: 5,
      weight: 14,
      title: "Merodeadores locales",
      body: {
        flavorTexts: ["Un grupo de maleantes de poca monta te cierra el paso exigiendo tus berries.", "Bandidos oportunistas confunden tu apariencia con la de una presa fácil."],
        onCriticalSuccess: { text: ["Los intimidas antes siquiera de sacar el arma."], bounty: [0, 0] },
        onSuccess: { text: ["El enfrentamiento se decide rápido a tu favor."] },
        onFail: { text: ["Pelean con más desesperación de la esperada."] },
        onCriticalFail: { text: ["Te toman completamente desprevenido."] },
        enemy: { name: "Bandido de poca monta", hp: 25, atk: 8, def: 4, spd: 6 },
      },
    },
    {
      kind: EventKind.COMBAT,
      minDanger: 3,
      maxDanger: 8,
      weight: 9,
      title: "Cazarrecompensas rival",
      body: {
        flavorTexts: ["Otro cazador de sueños decide que tu cabeza (o tu recompensa) vale la pena el riesgo.", "Un rival de mala reputación te reconoce y decide atacar primero."],
        onCriticalSuccess: { text: ["Lo derrotas con una facilidad que corre como pólvora por los muelles."] },
        onSuccess: { text: ["Ganas tras un cruce de golpes reñido."] },
        onFail: { text: ["Es más fuerte de lo que aparentaba."] },
        onCriticalFail: { text: ["Te sorprende con un movimiento que no viste venir."] },
        enemy: { name: "Cazarrecompensas rival", hp: 45, atk: 16, def: 10, spd: 12 },
      },
    },
    {
      kind: EventKind.BOSS,
      minDanger: 4,
      maxDanger: 10,
      weight: 3,
      title: "Señor local del crimen",
      body: {
        flavorTexts: ["El verdadero poder detrás de la isla finalmente sale a tu encuentro, harto de tu interferencia."],
        onCriticalSuccess: { text: ["Lo derrotas en un enfrentamiento que la isla entera recordará."], berries: [2000, 5000], bounty: [500_000, 1_500_000] },
        onSuccess: { text: ["Tras una batalla dura, sales victorioso."], berries: [1000, 2500], bounty: [200_000, 700_000] },
        onFail: { text: ["La pelea se pone en tu contra rápidamente."] },
        onCriticalFail: { text: ["Estás gravemente superado."] },
        enemy: {
          name: "Señor local del crimen",
          hp: 90,
          atk: 26,
          def: 18,
          spd: 14,
          isBoss: true,
          personality: "calculador y vanidoso, disfruta alargar la humillación de sus rivales antes de rematarlos",
        },
      },
    },
  ];

  await prisma.eventTemplate.deleteMany({});
  for (const t of eventTemplates) {
    await prisma.eventTemplate.create({
      data: {
        islandId: t.islandKey ? islands[t.islandKey].id : null,
        kind: t.kind,
        minDanger: t.minDanger,
        maxDanger: t.maxDanger,
        weight: t.weight,
        title: t.title,
        bodyJson: JSON.stringify(t.body),
      },
    });
  }

  // Island-specific story beats
  await prisma.eventTemplate.create({
    data: {
      islandId: islands.conomi.id,
      kind: EventKind.BOSS,
      minDanger: 4,
      maxDanger: 4,
      weight: 5,
      title: "Arlong, el tirano de Conomi",
      bodyJson: JSON.stringify({
        flavorTexts: ["Arlong te recibe con una sonrisa llena de dientes afilados, seguro de su superioridad de Pez-Hombre."],
        onCriticalSuccess: { text: ["Arlong cae, y por primera vez en años, Conomi respira libre."], berries: [3000, 6000], bounty: [1_000_000, 2_500_000] },
        onSuccess: { text: ["Tras un combate feroz, Arlong es derrotado."], berries: [1500, 3500], bounty: [500_000, 1_200_000] },
        onFail: { text: ["Su fuerza de Pez-Hombre te supera en el agua cercana."] },
        onCriticalFail: { text: ["Te confías y paga caro el error."] },
        enemy: {
          name: "Arlong",
          hp: 120,
          atk: 32,
          def: 22,
          spd: 16,
          isBoss: true,
          personality: "arrogante y cruel, desprecia abiertamente a los humanos y se burla de cualquiera que se le enfrente",
        },
      }),
    },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.shimotsuki.id,
      kind: EventKind.TRAINING,
      minDanger: 1,
      maxDanger: 10,
      weight: 14,
      title: "El Dojo Shimotsuki",
      bodyJson: JSON.stringify({
        flavorTexts: ["El maestro del dojo local acepta ponerte a prueba, como hace con cualquiera que llegue buscando fuerza real."],
        onCriticalSuccess: { text: ["El maestro asiente, impresionado: hoy diste un paso que otros tardan años en dar."], xp: [25, 45] },
        onSuccess: { text: ["Sales del dojo con los músculos ardiendo y la técnica más afilada."], xp: [12, 24] },
        onFail: { text: ["El maestro niega con la cabeza: hoy no era tu día."] },
        onCriticalFail: { text: ["Un ejercicio mal ejecutado te pasa factura."], hpLoss: [5, 12] },
      }),
    },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.loguetown.id,
      kind: EventKind.SOCIAL,
      minDanger: 5,
      maxDanger: 5,
      weight: 10,
      title: "La sombra de la plataforma de ejecución",
      bodyJson: JSON.stringify({
        flavorTexts: ["Te detienes frente a la plataforma donde el Rey de los Piratas perdió la cabeza, y sientes el peso de la historia."],
        onCriticalSuccess: { text: ["Tu presencia allí no pasa desapercibida: las noticias hablan de ti al día siguiente."], xp: [15, 30] },
        onSuccess: { text: ["Te vas con una sensación extraña, como si algo te llamara mar adentro."], xp: [8, 15] },
        onFail: { text: ["La Marina te observa de cerca; decides no llamar más la atención."] },
        onCriticalFail: { text: ["Un oficial de la Marina te identifica y da la voz de alarma."], hpLoss: [0, 10] },
      }),
    },
  });

  // ---------- Poneglyphs (lore exists in the world; none are placed on a
  // discoverable island yet — finding them is meant to be a Grand
  // Line/New World-tier undertaking, not something East Blue hands out) ----------
  const poneglyphs = [
    {
      codeName: "Poneglifo de Ruta — Fragmento del Alba",
      kind: "Road",
      loreText:
        "Se dice que marca el primer paso hacia Laugh Tale, pero ni un solo erudito vivo confiesa haberlo leído completo. Los que aseguran saber su ubicación no suelen vivir para contarlo dos veces.",
      guardedBy: "Marshall D. Teach lo arrancó de un yacimiento arqueológico años atrás y lo mantiene oculto en su propio bastión, protegido por lo peor que ha reclutado de Impel Down.",
    },
    {
      codeName: "Poneglifo de Ruta — Fragmento del Ocaso",
      kind: "Road",
      loreText: "Referenciado solo de forma indirecta en registros de Ohara que sobrevivieron a la purga. Durante décadas se lo dio por mito.",
      guardedBy:
        "Confiscado hace décadas por el propio Gobierno Mundial y trasladado a la bóveda judicial de Enies Lobby, donde CP-0 lo vigila bajo sello directo. Nadie sin autorización imperial se acerca a esa bóveda dos veces.",
    },
    {
      codeName: "Poneglifo de Ruta — Fragmento del Abismo",
      kind: "Road",
      loreText: "Ligado a leyendas de una isla que se hunde y resurge con las mareas. Nadie ha confirmado si sigue existiendo.",
      guardedBy: null,
    },
    {
      codeName: "Poneglifo de Ruta — Fragmento Final",
      kind: "Road",
      loreText: "El más buscado y el menos comprendido: se cree que sin los otros tres, este no revela nada en absoluto.",
      guardedBy: "Se rumorea vigilancia directa de Cipher Pol.",
    },
  ];

  const createdPoneglyphs: Record<string, { id: string }> = {};
  for (const p of poneglyphs) {
    const created = await prisma.poneglyph.upsert({
      where: { codeName: p.codeName },
      update: {},
      create: { codeName: p.codeName, kind: p.kind, loreText: p.loreText, guardedBy: p.guardedBy },
    });
    createdPoneglyphs[p.codeName] = created;
  }

  // The Fragmento del Alba is the one Poneglyph actually placed in this
  // content slice — deliberately true end-game: Blackbeard's own stronghold,
  // level 30+, danger 10. The other three stay lore-only/unplaced.
  const albaPoneglyph = createdPoneglyphs["Poneglifo de Ruta — Fragmento del Alba"];
  await prisma.island.update({
    where: { id: islands.graveyardIsland.id },
    data: { hasPoneglyph: true, poneglyphId: albaPoneglyph.id },
  });

  // The Fragmento del Ocaso is the second placed Poneglyph — the World
  // Government's own custody, not a Yonko's. Enies Lobby, level 35+,
  // danger 10: the real CP-0 leadership is deliberately elsewhere (see the
  // event's flavor text below), so what a raider actually meets is the
  // squad left behind, not the full force. Same pattern as Blackbeard's
  // lieutenant on Isla Cementerio, generalized to a second power.
  const ocasoPoneglyph = createdPoneglyphs["Poneglifo de Ruta — Fragmento del Ocaso"];
  await prisma.island.update({
    where: { id: islands.eniesLobby.id },
    data: { hasPoneglyph: true, poneglyphId: ocasoPoneglyph.id },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.whiskyPeak.id,
      kind: EventKind.COMBAT,
      minDanger: 6,
      maxDanger: 6,
      weight: 12,
      title: "La fiesta que no era",
      bodyJson: JSON.stringify({
        flavorTexts: [
          "Los vecinos de Whisky Peak te reciben con vítores, alcohol gratis y una calidez sospechosamente perfecta. Alguien brinda un poco demasiado cerca de tu espalda.",
        ],
        onCriticalSuccess: { text: ["Detectas la encerrona antes de que empiece y les das la vuelta a los propios agentes."] },
        onSuccess: { text: ["La fiesta se convierte en emboscada, pero sales victorioso entre el confeti y los cuchillos."] },
        onFail: { text: ["Toda la isla se revela como una red de agentes encubiertos, y te superan en número."] },
        onCriticalFail: { text: ["La trampa se cierra perfectamente y no la ves venir."] },
        enemy: { name: "Agentes encubiertos de Baroque Works", hp: 55, atk: 20, def: 14, spd: 18 },
      }),
    },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.graveyardIsland.id,
      kind: EventKind.BOSS,
      minDanger: 10,
      maxDanger: 10,
      weight: 3,
      title: "La guardia personal de Barbanegra",
      bodyJson: JSON.stringify({
        flavorTexts: [
          "Te adentras en la niebla del bastión. Entre las rocas negras, una silueta se separa de las sombras: uno de los lugartenientes de Barbanegra, un antiguo preso de Impel Down que no conoce el miedo.",
        ],
        onCriticalSuccess: {
          text: ["Lo derrotas de una forma que ni el propio Barbanegra podrá ignorar. El camino a su bóveda personal queda abierto."],
          berries: [40_000, 90_000],
          bounty: [15_000_000, 30_000_000],
        },
        onSuccess: {
          text: ["Tras un combate brutal, el lugarteniente cae. La bóveda se abre ante ti."],
          berries: [20_000, 45_000],
          bounty: [8_000_000, 15_000_000],
        },
        onFail: { text: ["Su fuerza bruta, forjada en Impel Down, te supera con facilidad."] },
        onCriticalFail: { text: ["Ni siquiera lo ves venir: el golpe te deja al borde de la inconsciencia."] },
        enemy: {
          name: "Lugarteniente de Barbanegra",
          hp: 320,
          atk: 78,
          def: 55,
          spd: 42,
          isBoss: true,
          personality: "un antiguo preso de Impel Down, brutal y sin miedo, que disfruta el dolor ajeno tanto como el propio",
          worldActorId: worldActors["Marshall D. Teach"].id,
        },
        poneglyphId: albaPoneglyph.id,
      }),
    },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.eniesLobby.id,
      kind: EventKind.BOSS,
      minDanger: 10,
      maxDanger: 10,
      weight: 3,
      title: "El escuadrón de CP-0",
      bodyJson: JSON.stringify({
        flavorTexts: [
          "Cruzas el Portal de la Justicia bajo la mirada de gárgolas de piedra caliza. Un agente de CP-0 se despega de una columna sin hacer el menor ruido — el resto de la célula, con su líder al frente, está desplegado en una misión que el Gobierno Mundial aún no ha hecho pública.",
        ],
        onCriticalSuccess: {
          text: ["El agente cae sin un solo grito. Tras él, una bóveda sellada con el emblema del Gobierno Mundial queda expuesta."],
          berries: [50_000, 110_000],
          bounty: [20_000_000, 38_000_000],
        },
        onSuccess: {
          text: ["Tras un combate silencioso y brutal, el agente de CP-0 cae. La bóveda se abre ante ti."],
          berries: [25_000, 55_000],
          bounty: [10_000_000, 20_000_000],
        },
        onFail: { text: ["El Rokushiki del agente te supera con una precisión inhumana."] },
        onCriticalFail: { text: ["Ni siquiera lo ves moverse. El golpe te deja al borde de la inconsciencia."] },
        enemy: {
          name: "Agente de CP-0",
          hp: 300,
          atk: 82,
          def: 50,
          spd: 60,
          isBoss: true,
          personality: "frío, metódico y silencioso, no desperdicia palabras ni movimientos innecesarios",
          worldActorId: worldActors["Rob Lucci"].id,
        },
        poneglyphId: ocasoPoneglyph.id,
      }),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

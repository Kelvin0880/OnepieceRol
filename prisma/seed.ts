import { PrismaClient, WeaponGrade, Sea, EventKind, ActorRole, FactionType } from "@prisma/client";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";

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
  // Full catalog lives in src/lib/game/devil-fruit-catalog.ts now — shared
  // with tryDropFruit's random-grant logic (perform-action.ts) so common
  // fruits can be duplicated (fresh row per grant) while isSingleton ones
  // stay locked to the single row created here. Existing rows are always
  // refreshed on reseed (not just created-if-missing) so isSingleton and
  // other catalog fields never drift from a pre-existing row created before
  // that field existed — found live the first time this ran against an
  // already-seeded dev DB, where the old Yami Yami no Mi row silently kept
  // isSingleton's schema default (false) instead of the catalog's true.
  const fruitsByName: Record<string, { id: string }> = {};
  for (const f of DEVIL_FRUIT_CATALOG) {
    const existing = await prisma.devilFruit.findFirst({ where: { name: f.name } });
    const data = {
      englishName: f.englishName,
      type: f.type,
      rarity: f.rarity,
      description: f.description,
      effectsJson: JSON.stringify(f.effects),
      isSingleton: f.isSingleton,
    };
    const fruit = existing
      ? await prisma.devilFruit.update({ where: { id: existing.id }, data })
      : await prisma.devilFruit.create({ data: { name: f.name, ...data } });
    fruitsByName[f.name] = fruit;
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
  // Faction/rank/bounty/fruit/weapon data added 2026-09-23 alongside the
  // faction-aware news rewrite — see WORLD_LORE.md for the full roster
  // table, scope notes, and what's deliberately excluded/simplified.
  type ActorSeed = {
    name: string;
    role: ActorRole;
    powerLevel: number;
    description: string;
    personality: string;
    factionType: FactionType;
    factionName: string;
    rankLabel?: string;
    canonBounty?: bigint;
    canonWeapon?: string;
    devilFruitName?: string; // looked up in fruitsByName — must be an isSingleton catalog entry
  };

  const actors: ActorSeed[] = [
    // ---------- Yonko / near-Yonko ----------
    {
      name: "Shanks",
      role: ActorRole.YONKO,
      powerLevel: 99,
      description: "El pelirrojo, uno de los Cuatro Emperadores, tan temido por su espada como por su influencia política.",
      personality: "Habla con calma casi displicente incluso ante una amenaza real, pero su tono se vuelve absolutamente serio en el instante en que alguien cruza una línea que le importa.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Pelirrojos",
      canonBounty: BigInt(4_048_900_000),
    },
    {
      name: "Marshall D. Teach",
      role: ActorRole.YONKO,
      powerLevel: 98,
      description: 'Apodado "Barbanegra", el único hombre conocido por poseer dos frutas del diablo. Su ambición no tiene fondo.',
      personality: 'Ríe con una carcajada grave y teatral antes de cada golpe, disfrutando abiertamente del caos que provoca; llama "amigo" a quien está a punto de destruir.',
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Barbanegra",
      canonBounty: BigInt(3_996_000_000),
      devilFruitName: "Yami Yami no Mi",
    },
    {
      name: "Buggy",
      role: ActorRole.YONKO,
      powerLevel: 75,
      description: 'El "Payaso Estrella", ascendido a Emperador casi por accidente, ahora al frente del Cross Guild.',
      personality: "Fanfarrón y ruidoso, exagera cada amenaza hasta lo absurdo, pero entra en pánico genuino si las cosas se ponen realmente serias.",
      factionType: FactionType.PIRATE,
      factionName: "Cross Guild",
      canonBounty: BigInt(3_189_000_000),
      devilFruitName: "Bara Bara no Mi",
    },
    {
      name: "Monkey D. Luffy",
      role: ActorRole.YONKO,
      powerLevel: 97,
      description: "Capitán de los Piratas de Sombrero de Paja, el más nuevo de los Cuatro Emperadores tras Wano.",
      personality: "Directo hasta la ingenuidad, decide en segundos y sin cálculo político — pero se vuelve absolutamente implacable si tocan a su tripulación.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      canonBounty: BigInt(3_000_000_000),
      devilFruitName: "Hito Hito no Mi: Modelo Nika",
    },
    // ---------- Marina ----------
    {
      name: "Kizaru",
      role: ActorRole.ADMIRAL,
      powerLevel: 95,
      description: "Almirante de la Marina, usuario de la Pika Pika no Mi, tan veloz como despreocupado.",
      personality: "Arrastra las palabras con pereza deliberada, como si nada le urgiera nunca — incluso en pleno combate parece estar de vacaciones.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Almirante",
      devilFruitName: "Pika Pika no Mi",
    },
    {
      name: "Fujitora",
      role: ActorRole.ADMIRAL,
      powerLevel: 94,
      description: "Almirante ciego que juzga con gravedad literal y figurada; su sentido de la justicia incomoda a sus superiores.",
      personality: "Habla con solemnidad pausada, casi paternal, y no oculta su incomodidad cuando la Marina le pide algo que no considera justo.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Almirante",
      devilFruitName: "Zushi Zushi no Mi",
    },
    {
      name: "Ryokugyu",
      role: ActorRole.ADMIRAL,
      powerLevel: 90,
      description: "El almirante más reciente, de métodos tan lentos como implacables.",
      personality: "Parco y metódico, deja largos silencios antes de hablar, como si cada palabra le costara un esfuerzo que prefiere ahorrarse.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Almirante",
      devilFruitName: "Mori Mori no Mi",
    },
    {
      name: "Sakazuki",
      role: ActorRole.ADMIRAL,
      powerLevel: 99,
      description: 'Almirante de Flota, apodado "Akainu". Encarna la Justicia Absoluta sin piedad ni excepciones.',
      personality: "Frío, tajante y sin una pizca de humor; cualquier piedad ajena le resulta personalmente ofensiva y lo dice sin levantar la voz.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Almirante de Flota",
      devilFruitName: "Magu Magu no Mi",
    },
    {
      name: "Monkey D. Garp",
      role: ActorRole.MARINE_GENERAL,
      powerLevel: 93,
      description: 'El "Héroe de la Marina", el único que hizo retroceder al Rey de los Piratas. Rechazó tres veces el puesto de Almirante de Flota.',
      personality: "Ruidoso, directo y sentimental bajo la fachada dura; resuelve casi cualquier desacuerdo con los puños antes que con las palabras, incluida su propia familia.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Vicealmirante (Héroe de la Marina)",
    },
    {
      name: "Sengoku",
      role: ActorRole.MARINE_GENERAL,
      powerLevel: 91,
      description: "Antiguo Almirante de Flota, retirado tras Marineford pero todavía una autoridad moral dentro de la Marina.",
      personality: "Severo y formal en público, pero capaz de una ironía seca cuando la burocracia del Gobierno Mundial lo exaspera.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Almirante de Flota (retirado)",
      devilFruitName: "Hito Hito no Mi: Modelo Daibutsu",
    },
    {
      name: "Smoker",
      role: ActorRole.MARINE_GENERAL,
      powerLevel: 85,
      description: "Vicealmirante de justicia inflexible, tan desconfiado del Gobierno Mundial como de cualquier pirata.",
      personality: "Habla poco y a medio masticar un puro; su paciencia con la política interna de la Marina es prácticamente nula.",
      factionType: FactionType.MARINE,
      factionName: "Marina",
      rankLabel: "Vicealmirante",
      devilFruitName: "Moku Moku no Mi",
    },
    {
      name: "X Drake",
      role: ActorRole.MARINE_GENERAL,
      powerLevel: 82,
      description: "Antiguo pirata del Peor Generación, hoy Comodoro encubierto de una unidad especial de la Marina.",
      personality: "Calculador y hermético, mide cada palabra sabiendo que su doble vida podría desmoronarse en cualquier momento.",
      factionType: FactionType.MARINE,
      factionName: "Marina (SWORD, encubierto)",
      rankLabel: "Comodoro",
    },
    {
      name: "Kaku",
      role: ActorRole.CIPHER_POL,
      powerLevel: 84,
      description: "Agente de CP-0 experto en Rokushiki, antiguo carpintero encubierto durante el incidente de Enies Lobby.",
      personality: "Cortés hasta lo absurdo incluso en pleno combate, oculta una ambición fría tras modales impecables.",
      factionType: FactionType.CIPHER_POL,
      factionName: "CP-0",
      canonWeapon: "Kabutowari",
    },
    {
      name: "Kalifa",
      role: ActorRole.CIPHER_POL,
      powerLevel: 80,
      description: "Agente de CP-0 especializada en Rokushiki e infiltración administrativa.",
      personality: "Profesional y fría hasta la crueldad, trata cualquier muestra de debilidad ajena como una invitación a explotarla.",
      factionType: FactionType.CIPHER_POL,
      factionName: "CP-0",
    },
    // ---------- Ejército Revolucionario ----------
    {
      name: "Sabo",
      role: ActorRole.REVOLUTIONARY_COMMANDER,
      powerLevel: 92,
      description: "Jefe de Estado Mayor del Ejército Revolucionario, hermano de juramento de sangre de dos futuros Emperadores.",
      personality: "Directo y cálido con quienes considera aliados, pero implacablemente estratégico frente al Gobierno Mundial, sin un ápice de duda.",
      factionType: FactionType.REVOLUTIONARY,
      factionName: "Ejército Revolucionario",
      rankLabel: "Jefe de Estado Mayor",
      devilFruitName: "Mera Mera no Mi",
    },
    {
      name: "Monkey D. Dragon",
      role: ActorRole.REVOLUTIONARY_COMMANDER,
      powerLevel: 96,
      description: 'El "Peor Criminal del Mundo" según el Gobierno Mundial, líder absoluto del Ejército Revolucionario.',
      personality: "Habla en frases cortas y contundentes, casi nunca de más; deja que el peso de sus palabras haga el trabajo del volumen.",
      factionType: FactionType.REVOLUTIONARY,
      factionName: "Ejército Revolucionario",
      rankLabel: "Comandante en Jefe",
    },
    {
      name: "Emporio Ivankov",
      role: ActorRole.REVOLUTIONARY_COMMANDER,
      powerLevel: 88,
      description: 'Jefe de Estado Mayor y gobernante del Reino de Kamabakka, antiguo compañero de celda de Ace en Impel Down.',
      personality: "Extravagante y teatral, pero con una lucidez estratégica que sorprende a quien lo subestima por su exuberancia.",
      factionType: FactionType.REVOLUTIONARY,
      factionName: "Ejército Revolucionario",
    },
    {
      name: "Koala",
      role: ActorRole.REVOLUTIONARY_COMMANDER,
      powerLevel: 75,
      description: "Oficial revolucionaria y experta en Fishman Karate, rescatada de la esclavitud por Fisher Tiger de niña.",
      personality: "Cálida y leal hasta la médula, pero con una determinación fría en cualquier cosa relacionada con la trata de personas.",
      factionType: FactionType.REVOLUTIONARY,
      factionName: "Ejército Revolucionario",
    },
    // ---------- Warlords / Cross Guild / independientes ----------
    {
      name: "Dracule Mihawk",
      role: ActorRole.WARLORD,
      powerLevel: 97,
      description: "El espadachín más fuerte del mundo, ahora aliado incómodo del Cross Guild.",
      personality: "Habla poco y con desdén aristocrático; valora la habilidad con la espada por encima de casi todo lo demás y lo dice sin rodeos.",
      factionType: FactionType.BOUNTY_HUNTER,
      factionName: "Cross Guild",
      canonWeapon: "Kokuto Yoru",
    },
    {
      name: "Boa Hancock",
      role: ActorRole.WARLORD,
      powerLevel: 90,
      description: 'La "Emperatriz Pirata", ex-Shichibukai y capitana de las Piratas Kuja de la isla Amazon Lily.',
      personality: "Orgullosa y volátil, alterna entre desdén absoluto y una devoción inesperada — nunca a medias tintas.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Kuja",
      canonBounty: BigInt(1_658_000_000),
      devilFruitName: "Mero Mero no Mi",
    },
    {
      name: "Crocodile",
      role: ActorRole.WARLORD,
      powerLevel: 91,
      description: "Antiguo Shichibukai, hoy socio del Cross Guild tras años operando en las sombras del Gobierno Mundial.",
      personality: "Frío, calculador y sin lealtades sinceras a nadie; negocia con cualquiera si el trato le conviene.",
      factionType: FactionType.PIRATE,
      factionName: "Cross Guild",
      canonBounty: BigInt(1_965_000_000),
      devilFruitName: "Suna Suna no Mi",
    },
    {
      name: "Donquixote Doflamingo",
      role: ActorRole.WARLORD,
      powerLevel: 93,
      description: 'Ex "Rey Celestial" y antiguo Shichibukai, cabeza de la familia Donquixote — hoy tras las rejas, pero su sombra sigue larga.',
      personality: "Sonríe siempre, incluso al amenazar de muerte; disfruta abiertamente manipular a quien cree tener bajo control.",
      factionType: FactionType.PIRATE,
      factionName: "Familia Donquixote (encarcelado)",
      canonBounty: BigInt(3_000_000_000),
      devilFruitName: "Ito Ito no Mi",
    },
    // ---------- Piratas notables / Peor Generación ----------
    {
      name: "Trafalgar D. Water Law",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 92,
      description: 'El "Cirujano de la Muerte", capitán de los Piratas Heart y antiguo Shichibukai.',
      personality: "Reservado y sarcástico, calcula cada movimiento como una operación quirúrgica antes de comprometerse a nada.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Heart",
      rankLabel: "Capitán",
      canonBounty: BigInt(3_000_000_000),
      devilFruitName: "Ope Ope no Mi",
    },
    {
      name: "Eustass Kid",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 92,
      description: "Capitán de los Piratas Kid, uno de los del Peor Generación con más ambición declarada de llegar a la cima.",
      personality: "Violento y sin paciencia para la diplomacia; responde a cualquier desafío con más fuerza, nunca con menos.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Kid",
      rankLabel: "Capitán",
      canonBounty: BigInt(3_000_000_000),
      devilFruitName: "Jiki Jiki no Mi",
    },
    {
      name: "Basil Hawkins",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 84,
      description: 'El "Mago", capitán de los Piratas Hawkins, siempre calcula probabilidades de supervivencia antes de actuar.',
      personality: "Frío y fatalista, habla de la muerte propia y ajena con la misma calma con la que baraja sus cartas del tarot.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Hawkins",
      rankLabel: "Capitán",
      canonBounty: BigInt(320_000_000),
    },
    {
      name: "Killer",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 86,
      description: "Primer oficial de los Piratas Kid, casi tan temido como su propio capitán.",
      personality: "Leal hasta el extremo a Kid, mantiene un silencio letal hasta el instante en que sus guadañas entran en juego.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas Kid",
      rankLabel: "Primer oficial",
      canonBounty: BigInt(1_057_000_000),
    },
    {
      name: "Charlotte Katakuri",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 93,
      description: 'Comandante Dulce de las Piratas de Big Mom, considerado el más fuerte de sus hermanos.',
      personality: "Estoico y orgulloso de su propia disciplina, oculta una vulnerabilidad que jamás admite en voz alta.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Big Mom",
      rankLabel: "Comandante Dulce",
      canonBounty: BigInt(1_057_000_000),
      devilFruitName: "Mochi Mochi no Mi",
    },
    {
      name: "Jewelry Bonney",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 85,
      description: 'La "Pirata Tirana", capitana de su propia tripulación, capaz de alterar edades a voluntad.',
      personality: "Hosca y desconfiada por fuera, pero movida por una determinación personal que no discute con nadie.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Bonney",
      rankLabel: "Capitana",
      canonBounty: BigInt(1_390_000_000),
      devilFruitName: "Toshi Toshi no Mi",
    },
    // ---------- Straw Hat crew ----------
    {
      name: "Roronoa Zoro",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 90,
      description: "Primer oficial y espadachín de los Piratas de Sombrero de Paja, aspirante al título de mejor espadachín del mundo.",
      personality: "Directo y de pocas palabras, resuelve casi cualquier problema con determinación bruta y una lealtad inquebrantable a su capitán.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Primer oficial",
      canonBounty: BigInt(1_111_000_000),
      canonWeapon: "Santoryu (tres espadas, incluida Enma)",
    },
    {
      name: "Nami",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 70,
      description: "Navegante de los Piratas de Sombrero de Paja, capaz de leer el clima del Grand Line como nadie más.",
      personality: "Pragmática y obsesionada con el dinero en apariencia, pero fieramente protectora de su tripulación cuando de verdad importa.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Navegante",
      canonBounty: BigInt(366_000_000),
    },
    {
      name: "Usopp",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 72,
      description: 'Francotirador de los Piratas de Sombrero de Paja, apodado "Sogeking".',
      personality: "Fanfarrón y cobarde en apariencia, pero encuentra un valor genuino justo cuando su tripulación más lo necesita.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Francotirador",
      canonBounty: BigInt(500_000_000),
    },
    {
      name: "Vinsmoke Sanji",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 88,
      description: "Cocinero de los Piratas de Sombrero de Paja, heredero renegado de la familia Vinsmoke.",
      personality: "Caballeroso hasta el extremo con cualquier mujer, feroz en combate, y visceralmente protector de quien no puede defenderse.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Cocinero",
      canonBounty: BigInt(1_032_000_000),
    },
    {
      name: "Tony Tony Chopper",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 60,
      description: "Médico de los Piratas de Sombrero de Paja, un reno que comió una fruta del diablo y aprendió medicina humana.",
      personality: "Tímido e inseguro sobre sus propios elogios, pero absolutamente decidido cuando la vida de un nakama está en juego.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Médico",
      canonBounty: BigInt(1000),
      devilFruitName: "Hito Hito no Mi",
    },
    {
      name: "Nico Robin",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 82,
      description: 'Arqueóloga de los Piratas de Sombrero de Paja, apodada "La Niña Demonio" desde la infancia.',
      personality: "Reservada y de humor negro, tarda en confiar pero, una vez lo hace, es absolutamente leal.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Arqueóloga",
      canonBounty: BigInt(930_000_000),
      devilFruitName: "Hana Hana no Mi",
    },
    {
      name: "Franky",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 78,
      description: "Carpintero cyborg de los Piratas de Sombrero de Paja, constructor del Thousand Sunny.",
      personality: "Exuberante y sentimental bajo una fachada de metal, presume de cada invento propio sin ninguna modestia.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Carpintero",
      canonBounty: BigInt(394_000_000),
    },
    {
      name: "Brook",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 80,
      description: "Músico esqueleto de los Piratas de Sombrero de Paja, revivido por su propia fruta tras décadas de soledad.",
      personality: "Cortés hasta lo anticuado, oculta el peso de años de aislamiento tras chistes constantes sobre no tener carne (ni ojos que mostrar).",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Músico",
      canonBounty: BigInt(383_000_000),
      devilFruitName: "Yomi Yomi no Mi",
    },
    {
      name: "Jinbe",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 89,
      description: "Timonel de los Piratas de Sombrero de Paja, antiguo Shichibukai y ex-Primer Timonel de los Piratas de Sol.",
      personality: "Honorable hasta la médula, prioriza el bienestar del grupo por encima del propio sin dudarlo jamás.",
      factionType: FactionType.PIRATE,
      factionName: "Piratas de Sombrero de Paja",
      rankLabel: "Timonel",
      canonBounty: BigInt(1_100_000_000),
    },
    // ---------- Cipher Pol ----------
    {
      name: "Rob Lucci",
      role: ActorRole.CIPHER_POL,
      powerLevel: 88,
      description: "Agente de CP-0, el brazo encubierto del Gobierno Mundial para los asuntos que nadie debe conocer.",
      personality: "Habla en voz baja y mide cada palabra como si calculara distancias de combate; trata la piedad ajena como una debilidad táctica, nunca como una virtud.",
      factionType: FactionType.CIPHER_POL,
      factionName: "CP-0",
      devilFruitName: "Neko Neko no Mi: Modelo Leopardo",
    },
    {
      name: "Spandam",
      role: ActorRole.CIPHER_POL,
      powerLevel: 55,
      description: "Alto cargo administrativo de Cipher Pol, antiguo director de Enies Lobby.",
      personality: "Cobarde y cruel a partes iguales, se apoya siempre en el poder de otros para amenazar a quien no puede defenderse.",
      factionType: FactionType.CIPHER_POL,
      factionName: "Cipher Pol / Gobierno Mundial",
    },
    {
      name: "Stussy",
      role: ActorRole.CIPHER_POL,
      powerLevel: 87,
      description: "Agente de CP-0 con un pasado ligado a la Era del Vacío, cuya lealtad real es motivo de rumores incluso dentro del Gobierno Mundial.",
      personality: "Serena y observadora, deja que otros revelen sus cartas primero antes de mostrar cuál es realmente su bando.",
      factionType: FactionType.CIPHER_POL,
      factionName: "CP-0 (lealtad incierta)",
    },
  ];

  const worldActors: Record<string, { id: string }> = {};
  for (const a of actors) {
    const devilFruitId = a.devilFruitName ? fruitsByName[a.devilFruitName]?.id : undefined;
    const actor = await prisma.worldActor.upsert({
      where: { name: a.name },
      update: {
        personality: a.personality,
        factionType: a.factionType,
        factionName: a.factionName,
        rankLabel: a.rankLabel,
        canonBounty: a.canonBounty,
        canonWeapon: a.canonWeapon,
        devilFruitId,
      },
      create: {
        name: a.name,
        role: a.role,
        powerLevel: a.powerLevel,
        description: a.description,
        personality: a.personality,
        factionType: a.factionType,
        factionName: a.factionName,
        rankLabel: a.rankLabel,
        canonBounty: a.canonBounty,
        canonWeapon: a.canonWeapon,
        devilFruitId,
      },
    });
    worldActors[a.name] = actor;
  }

  // ---------- World event templates (background simulation) ----------
  // Rewritten 2026-09-23 to be faction-specific: each template's
  // allowedFactionTypes restricts which WorldActor can star in it (see
  // engine/world.ts's runWorldTick) — this is the direct fix for the bug
  // that started this pass ("Kizaru es visto reclutando aliados", a
  // pirate-flavored headline landing on an Admiral because the old code
  // picked from ALL available actors with no faction check at all).
  // `body` variants are now only the OFFLINE FALLBACK if the AI narration
  // call fails (world-tick.ts's narrateNews) — promptHint is what actually
  // drives the generated prose per firing.
  type WorldTemplateSeed = {
    weight: number;
    minHeat: number;
    headline: string;
    category: string;
    body: string[];
    promptHint: string;
    allowedFactionTypes?: FactionType[]; // omitted = no specific actor required
    busyHours?: [number, number];
    heatDelta?: number;
  };

  const worldEventTemplates: WorldTemplateSeed[] = [
    // ---------- MARINE-only ----------
    {
      weight: 12,
      minHeat: 0,
      headline: "{actor} despliega una patrulla contra la piratería",
      category: "Gobierno Mundial",
      body: ["{actor} lidera una redada contra una tripulación pirata de poca monta en una isla del Nuevo Mundo."],
      promptHint: "a Marine officer leads a patrol that captures or drives off a minor pirate crew",
      allowedFactionTypes: [FactionType.MARINE],
      busyHours: [6, 20],
      heatDelta: 1,
    },
    {
      weight: 6,
      minHeat: 15,
      headline: "El Gobierno Mundial ordena una Buster Call",
      category: "Guerra",
      body: ["Cinco Vicealmirantes convergen sobre una isla que, para cuando amanezca, puede que ya no exista."],
      promptHint: "the World Government authorizes a Buster Call on an island sheltering dangerous pirates",
      allowedFactionTypes: [FactionType.MARINE],
      heatDelta: 8,
    },
    {
      weight: 8,
      minHeat: 0,
      headline: "{actor} es desplegado de emergencia",
      category: "Gobierno Mundial",
      body: ["El Gobierno Mundial moviliza a {actor} para sofocar disturbios en una isla remota del Nuevo Mundo."],
      promptHint: "a Marine admiral or officer is urgently deployed to contain unrest",
      allowedFactionTypes: [FactionType.MARINE],
      busyHours: [6, 24],
      heatDelta: 1,
    },
    // ---------- PIRATE-only ----------
    {
      weight: 12,
      minHeat: 0,
      headline: "{actor} es visto reclutando nueva tripulación",
      category: "Tripulaciones",
      body: ["En un puerto discreto, {actor} habría cerrado una alianza que promete cambiar el mapa de poder."],
      promptHint: "a pirate captain recruits new crew members in a discreet port",
      allowedFactionTypes: [FactionType.PIRATE],
    },
    {
      weight: 10,
      minHeat: 10,
      headline: "Guerra de territorio: la tripulación de {actor} ataca dominios rivales",
      category: "Guerra",
      body: ["Testigos reportan explosiones y humo negro en el horizonte tras el choque liderado por {actor}."],
      promptHint: "a pirate crew attacks a rival crew's claimed territory",
      allowedFactionTypes: [FactionType.PIRATE],
      busyHours: [8, 20],
      heatDelta: 3,
    },
    {
      weight: 6,
      minHeat: 10,
      headline: "{actor} persigue rumores de un Poneglifo perdido",
      category: "Poneglifos",
      body: ["Fuentes cercanas a {actor} confirman movimientos inusuales cerca de ruinas ancestrales."],
      promptHint: "a pirate crew investigates rumors of a lost Poneglyph",
      allowedFactionTypes: [FactionType.PIRATE],
      busyHours: [12, 30],
      heatDelta: 2,
    },
    {
      weight: 5,
      minHeat: 5,
      headline: "Motín a bordo: la tripulación de {actor} sufre una crisis interna",
      category: "Tripulaciones",
      body: ["Se dice que ni siquiera {actor} pudo evitar que la disputa llegara a las espadas."],
      promptHint: "internal tension or a near-mutiny shakes a pirate crew from within",
      allowedFactionTypes: [FactionType.PIRATE],
    },
    {
      weight: 7,
      minHeat: 20,
      headline: "Escaramuza en alta mar: la flota de {actor} choca con un rival desconocido",
      category: "Guerra",
      body: ["Los supervivientes hablan de un combate breve, brutal, y de un vencedor que no se detuvo a dar explicaciones."],
      promptHint: "a pirate crew fights a brief, brutal naval skirmish against an unknown rival fleet",
      allowedFactionTypes: [FactionType.PIRATE],
      busyHours: [4, 10],
      heatDelta: 2,
    },
    {
      weight: 5,
      minHeat: 15,
      headline: "Emboscada en alta mar: {actor} estuvo cerca de perderlo todo",
      category: "Guerra",
      body: ["Una flota rival, coordinada con precisión imposible, cayó sobre {actor} en aguas que se creían seguras. Hubo bajas en ambos bandos."],
      promptHint: "a rival fleet nearly ambushes and overwhelms a pirate crew in waters thought safe",
      allowedFactionTypes: [FactionType.PIRATE],
      busyHours: [10, 26],
      heatDelta: 3,
    },
    // ---------- BOUNTY_HUNTER-only ----------
    {
      weight: 6,
      minHeat: 0,
      headline: "{actor} cobra una recompensa más",
      category: "Recompensas",
      body: ["{actor} entrega a un pirata buscado a las autoridades a cambio de una suma considerable."],
      promptHint: "a bounty hunter turns in a wanted pirate for a considerable cash reward",
      allowedFactionTypes: [FactionType.BOUNTY_HUNTER],
      busyHours: [2, 8],
    },
    // ---------- REVOLUTIONARY-only ----------
    {
      weight: 5,
      minHeat: 10,
      headline: "El Ejército Revolucionario, bajo {actor}, golpea una línea de suministro del Gobierno Mundial",
      category: "Gobierno Mundial",
      body: ["Un convoy militar nunca llega a su destino. El Gobierno Mundial evita hablar del incidente en público."],
      promptHint: "the Revolutionary Army sabotages a World Government supply line or convoy",
      allowedFactionTypes: [FactionType.REVOLUTIONARY],
      busyHours: [8, 24],
      heatDelta: 2,
    },
    {
      weight: 4,
      minHeat: 5,
      headline: "{actor} lidera la liberación de un asentamiento bajo control de la Marina",
      category: "Gobierno Mundial",
      body: ["Un pequeño asentamiento amanece sin bandera del Gobierno Mundial ondeando por primera vez en años."],
      promptHint: "the Revolutionary Army liberates a small settlement from Marine control",
      allowedFactionTypes: [FactionType.REVOLUTIONARY],
      busyHours: [12, 30],
      heatDelta: 2,
    },
    // ---------- CIPHER_POL-only ----------
    {
      weight: 5,
      minHeat: 10,
      headline: "{actor} es visto en una misión encubierta de propósito desconocido",
      category: "Gobierno Mundial",
      body: ["Testigos aseguran haber reconocido a un agente de Cipher Pol, aunque nadie sabe con certeza qué buscaba."],
      promptHint: "a Cipher Pol agent is spotted on a covert assignment whose purpose stays unclear",
      allowedFactionTypes: [FactionType.CIPHER_POL],
      busyHours: [8, 20],
      heatDelta: 1,
    },
    // ---------- No actor required ----------
    {
      weight: 8,
      minHeat: 0,
      headline: "El Gobierno Mundial anuncia una recompensa histórica",
      category: "Recompensas",
      body: ["Un pirata novato ha hecho suficiente ruido como para que su nombre aparezca en todos los periódicos de golpe."],
      promptHint: "the World Government announces a dramatic new bounty for a rising, still-unnamed rookie pirate",
    },
    {
      weight: 6,
      minHeat: 10,
      headline: "Cacería sangrienta tras un Poneglifo",
      category: "Poneglifos",
      body: [
        "Una tripulación sin nombre conocido desembarcó en busca de ruinas ancestrales. Solo la mitad regresó al barco; el resto quedó donde la Marina los encontró primero.",
      ],
      promptHint: "an unnamed crew's Poneglyph hunt ends badly for most of them",
      heatDelta: 2,
    },
    {
      weight: 2,
      minHeat: 60,
      headline: "Gran Guerra en los mares: el equilibrio del mundo se sacude",
      category: "Guerra",
      body: [
        "Lo que empezó como una operación de rescate se convirtió en la batalla más grande en años: Marina, piratas y revolucionarios chocando sobre la misma agua. Cuando el humo se disipa, el mapa de poder ya no es el mismo.",
      ],
      promptHint: "Marines, pirates, and revolutionaries collide in the same waters in the largest clash in years — the balance of power visibly shifts, but no single named actor is confirmed dead or captured",
      busyHours: [48, 96],
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
        promptHint: t.promptHint,
        allowedFactionTypes: t.allowedFactionTypes ? JSON.stringify(t.allowedFactionTypes) : null,
        bodyJson: JSON.stringify({
          variants: t.body,
          busyHours: t.busyHours,
          heatDelta: t.heatDelta,
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

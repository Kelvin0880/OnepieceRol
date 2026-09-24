import { PrismaClient, WeaponGrade, Sea, EventKind, ActorRole, FactionType } from "@prisma/client";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";

import { ACTOR_PROFILES, FRUIT_ASSIGNMENTS, profileStatsJson } from "../src/lib/game/world-actor-profiles";
import { EXTRA_ACTORS } from "../src/lib/game/world-actor-extra";

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
      key: "impelDown",
      name: "Impel Down",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 45,
      factionControl: "Gobierno Mundial (Impel Down)",
      description:
        "La gran prisión submarina del Gobierno Mundial, seis niveles de infierno bajo el mar custodiados por Magellan y un ejército de carceleros. Quien entra por la puerta grande no sale sin permiso; quien intenta sacar a alguien, menos aún.",
      arcHook:
        "Los guardias han doblado las rondas desde la última fuga. Los presos de los niveles más profundos son de esos que el Gobierno prefiere no volver a ver el sol.",
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
    // ---------- Phase 2 world expansion (2026-09-24) ----------
    {
      key: "drum",
      name: "Isla Drum",
      sea: Sea.PARADISE,
      danger: 7,
      minLevel: 11,
      factionControl: "Sin rey (Dr. Kureha)",
      description:
        "Un reino de nieve eterna sin rey desde que su tirano huyó. En lo alto de la montaña, una vieja doctora de risa temible cura lo que ningún hospital del mundo puede curar — y cobra a su manera.",
      arcHook:
        "El invierno aquí no es solo frío: es hambre, enfermedad y un pueblo que aprendió a desconfiar de los piratas por la mala fama de uno solo. Ganarse a Drum es más difícil que sobrevivirle.",
    },
    {
      key: "skypiea",
      name: "Skypiea",
      sea: Sea.PARADISE,
      danger: 8,
      minLevel: 15,
      factionControl: "Eneru",
      description:
        "Una isla entre las nubes, hecha de mar de algodón y ruinas de oro, donde un autoproclamado dios impone su ley a rayo limpio y ha convertido la fe de un pueblo en un arma.",
      arcHook:
        "Los cuatro Sacerdotes vigilan cada nube y el Dios de Skypiea todo lo oye antes de que lo digas. Quien pisa la isla sin ser invitado pasa a formar parte de su juicio.",
    },
    {
      key: "waterSeven",
      name: "Water 7",
      sea: Sea.PARADISE,
      danger: 7,
      minLevel: 14,
      factionControl: "Galley-La / CP-0 infiltrada",
      description:
        "La ciudad del agua: canales que hacen de calles, gigantescos astilleros y los mejores carpinteros del mundo. Bajo tanta prosperidad, alguien lleva años buscando unos planos que el Gobierno prefiere olvidados.",
      arcHook:
        "Todos aquí hablan bien de todos, y precisamente por eso nadie repara en quien se ha ganado la confianza del pueblo para robarles sus secretos. En Water 7, el mejor disfraz es ser querido.",
    },
    {
      key: "sabaody",
      name: "Archipiélago Sabaody",
      sea: Sea.PARADISE,
      danger: 8,
      minLevel: 18,
      factionControl: "Marina / Dragones Celestiales",
      description:
        "Setenta y nueve manglares gigantes que respiran burbujas, la última parada antes de bajar al Nuevo Mundo. Bajo la alegría de sus tiendas, una casa de subastas vende personas, y a un paso, los Dragones Celestiales pasean impunes.",
      arcHook:
        "Aquí se recubren las naves con cobre para bucear al Nuevo Mundo, se reúnen las mayores recompensas del mar y basta un mal gesto ante un noble mundial para que llegue un Almirante. Se rumorea que en un bar de burbujas vive un viejo que sabe leer Poneglifos.",
    },
    {
      key: "fishMan",
      name: "Isla Gyojin",
      sea: Sea.NEW_WORLD,
      danger: 9,
      minLevel: 22,
      factionControl: "Nuevos Piratas Gyojin (Hody Jones)",
      description:
        "Una ciudad de cristal a diez mil metros bajo el mar, gobernada por un reino de gyojin y sirenas y amenazada por un odio antiguo hacia los humanos que ahora alguien ha decidido convertir en guerra.",
      arcHook:
        "El Árbol Eve protege el reino con su sombra y una promesa de paz, pero una banda de gyojin resentidos quiere vengar siglos de esclavitud. Si triunfan, ninguna puerta volverá a abrirse entre superficie y fondo.",
    },
    {
      key: "punkHazard",
      name: "Punk Hazard",
      sea: Sea.NEW_WORLD,
      danger: 9,
      minLevel: 25,
      factionControl: "Caesar Clown",
      description:
        "Una isla partida en dos por un duelo entre dos Almirantes: una mitad arde y la otra está cubierta de hielo eterno. En el laboratorio sellado del centro, un científico sin escrúpulos produce armas y venenos para quien pague.",
      arcHook:
        "Las llamas de un lado y el hielo del otro dejaron un páramo donde los niños que no debían estar ahí lloran de noche. Nadie que no haya sido invitado al laboratorio sale con la cordura intacta.",
    },
    {
      key: "wholeCake",
      name: "Whole Cake Island",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 28,
      factionControl: "Charlotte Katakuri",
      description:
        "Un archipiélago de tartas, torres de caramelo y bosques de galleta: el reino de una de las tripulaciones más grandes del mundo, hoy mantenido por su hijo más disciplinado, un hombre que jamás pierde la calma ni cede un centímetro.",
      arcHook:
        "Todo aquí es dulce a la vista y letal al tacto. Los Ministros de la tripulación vigilan cada rincón, y el propio Katakuri sabe con un segundo de ventaja lo que vas a hacer.",
    },
    {
      key: "wano",
      name: "País de Wano",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 32,
      factionControl: "Sin gobierno (samuráis)",
      description:
        "Un país cerrado durante siglos tras montañas y cascadas, cuna de las mejores espadas del mundo. Cayó un tirano, pero los samuráis y ninjas que lo reconstruyen saben que la paz es solo el intervalo entre dos guerras.",
      arcHook:
        "Aquí el honor pesa más que el oro y un juramento se cumple aunque cueste la vida. Quien llega como aliado es recibido con sake y espadas; quien llega como conquistador no vuelve a ver la costa.",
    },
    {
      key: "abyss",
      name: "Isla Abismo",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 38,
      factionControl: "Custodios de las Mareas (Thalassa)",
      tidal: true,
      description:
        "Una isla que las mareas esconden y devuelven a su antojo: emerge unas horas y vuelve a hundirse otras tantas. Los Custodios de las Mareas llevan siglos guardando lo que hay en su corazón de coral negro, un Poneglifo que el mar no quiso llevarse.",
      arcHook:
        "Solo se puede llegar cuando baja la marea, y quien llegue tarde se queda en el fondo. Thalassa no odia a los intrusos: simplemente cree que algunas verdades es mejor que sigan bajo el agua.",
    },
    {
      key: "maryGeoise",
      name: "Mary Geoise",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 42,
      factionControl: "Gobierno Mundial (Gorosei)",
      description:
        "La Tierra Sagrada sobre la Línea Roja, donde viven los Dragones Celestiales y de donde emana la ley que rige el mundo. Palacios blancos, jardines impecables y, en el corazón del Castillo de Pangea, un salón al que ni los Almirantes tienen acceso.",
      arcHook:
        "Los Cinco Ancianos gobiernan a la sombra de alguien a quien nunca se nombra. Cualquier intruso es una amenaza para el orden entero, y el orden entero responde.",
    },
    {
      key: "orangeTown",
      name: "Orange Town",
      sea: Sea.EAST_BLUE,
      danger: 2,
      minLevel: 1,
      factionControl: "Sin gobierno (bandas locales)",
      description:
        "Un pueblo de casas naranjas que vive con miedo: una banda de piratas con circo se ha adueñado del puerto y cobra por todo. La gente aún sonríe, pero cierra las puertas antes de que caiga el sol.",
      arcHook:
        "Los vecinos están hartos de pagar tributos a una banda de payasos armados. Quien los enfrente ganará agradecimiento... y la enemistad de quien los manda.",
    },
    {
      key: "syrup",
      name: "Villa Syrup",
      sea: Sea.EAST_BLUE,
      danger: 2,
      minLevel: 1,
      factionControl: "Sin gobierno",
      description:
        "Un pueblo costero tranquilo al pie de una colina con una mansión. Los niños juegan a ser piratas y un narrador de historias cuenta aventuras tan grandes que nadie las cree del todo.",
      arcHook:
        "Cuentan que un mayordomo demasiado amable llegó a la mansión de la colina hace tres años. Desde entonces, nadie ha visto a la señorita salir de casa.",
    },
    {
      key: "ohara",
      name: "Ohara",
      sea: Sea.PARADISE,
      danger: 6,
      minLevel: 14,
      factionControl: "Sin gobierno (ruinas)",
      description:
        "Lo que queda de la isla de los arqueólogos: un árbol enorme carbonizado, una biblioteca convertida en cenizas y un silencio que pesa. Se dice que el Gobierno arrasó la isla por estudiar lo que no debía.",
      arcHook:
        "Entre las cenizas aún hay quien busca páginas salvadas del fuego. Y el Gobierno sigue enviando agentes a comprobar que nadie las encuentre.",
    },
    {
      key: "marineford",
      name: "Marineford",
      sea: Sea.PARADISE,
      danger: 9,
      minLevel: 26,
      factionControl: "Marina (Cuartel General)",
      description:
        "El cuartel general de la Marina, una fortaleza blanca con una plaza enorme donde se han decidido guerras. Hay más almirantes por metro cuadrado que en cualquier otro lugar del mundo, y ninguno tiene prisa por sonreír.",
      arcHook:
        "Cada piedra de la plaza recuerda la guerra que cambió la era. La Marina se reconstruye, y cualquier pirata que pise el puerto será visto como una amenaza inmediata.",
    },
    {
      key: "dressrosa",
      name: "Dressrosa",
      sea: Sea.NEW_WORLD,
      danger: 9,
      minLevel: 28,
      factionControl: "Reino de Dressrosa (reconstruido)",
      description:
        "La isla de la pasión: flores, plazas, un coliseo donde los gladiadores luchan por un premio imposible y, bajo el ruido de la fiesta, las cicatrices de un reinado de marionetas que aún nadie termina de olvidar.",
      arcHook:
        "El coliseo ha vuelto a abrir sus puertas, pero ya no se pelea por un premio: se pelea por reputación. Y siempre hay alguien mirando desde las gradas más altas.",
    },
    {
      key: "zou",
      name: "Zou",
      sea: Sea.NEW_WORLD,
      danger: 9,
      minLevel: 30,
      factionControl: "Mink de Zou",
      description:
        "Un elefante gigante, mayor que una isla, que camina por el mar con una ciudad-bosque sobre el lomo. Los mink lo llaman hogar, guardan un Poneglifo y aún recuerdan un juramento a una familia lejana.",
      arcHook:
        "Los mink no aceptan intrusos a la ligera: quien llegue tendrá que ganarse su confianza a base de hechos, no de palabras.",
    },
    {
      key: "egghead",
      name: "Isla Egghead",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 36,
      factionControl: "Gobierno Mundial (Laboratorio de Vegapunk)",
      description:
        "La isla del futuro: torres de cristal, robots por las calles y un laboratorio flotante donde se decide lo que la humanidad será capaz de hacer. Tiene más vigilancia que cualquier prisión, y todo el mundo quiere entrar.",
      arcHook:
        "Lo que se cocina en el laboratorio podría cambiar el equilibrio del mundo. El Gobierno lo sabe, los piratas lo saben, y por eso la isla nunca duerme tranquila.",
    },
    {
      key: "laughTale",
      name: "Laugh Tale",
      sea: Sea.NEW_WORLD,
      danger: 10,
      minLevel: 50,
      factionControl: null,
      requiresRoad: true,
      description:
        "La última isla, la que nadie encuentra si no ha leído los cuatro Poneglifos de Ruta. Un lugar que ríe con quien llega y guarda el mayor secreto de la historia: lo que fue el One Piece, y por qué el mundo lleva ochocientos años sin poder mencionarlo.",
      arcHook:
        "Llegar aquí es haberlo dejado todo atrás. Lo que se descubra en Laugh Tale cambiará el mundo entero, para bien o para mal, y quien lo sepa ya no podrá fingir que no lo sabe.",
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
        tidal: (def as { tidal?: boolean }).tidal ?? false,
        requiresRoadPoneglyphs: (def as { requiresRoad?: boolean }).requiresRoad ?? false,
      },
    });
    islands[def.key] = island;
  }

  const adjacency: Record<string, string[]> = {
    foosha: ["shimotsuki", "marineG5", "baltigo", "orangeTown"],
    orangeTown: ["foosha", "shimotsuki"],
    syrup: ["shimotsuki", "baratie"],
    ohara: ["waterSeven"],
    marineford: ["sabaody", "eniesLobby"],
    dressrosa: ["wholeCake", "zou", "egghead"],
    zou: ["dressrosa", "wano"],
    egghead: ["punkHazard", "dressrosa"],
    marineG5: ["foosha", "loguetown"],
    baltigo: ["foosha"],
    gecko: ["shimotsuki", "loguetown"],
    shimotsuki: ["foosha", "gecko", "baratie", "orangeTown", "syrup"],
    baratie: ["shimotsuki", "conomi", "syrup"],
    conomi: ["baratie", "loguetown"],
    loguetown: ["conomi", "marineG5", "gecko", "reverseMountain"],
    reverseMountain: ["loguetown", "whiskyPeak"],
    whiskyPeak: ["reverseMountain", "littleGarden"],
    littleGarden: ["whiskyPeak", "alabasta", "drum"],
    drum: ["littleGarden", "alabasta"],
    alabasta: ["littleGarden", "drum", "graveyardIsland", "eniesLobby", "skypiea", "waterSeven"],
    skypiea: ["alabasta"],
    waterSeven: ["alabasta", "eniesLobby", "sabaody", "ohara"],
    sabaody: ["waterSeven", "fishMan", "marineford"],
    fishMan: ["sabaody", "punkHazard"],
    punkHazard: ["fishMan", "wholeCake", "egghead"],
    wholeCake: ["punkHazard", "wano", "dressrosa"],
    wano: ["wholeCake", "laughTale", "zou"],
    laughTale: ["wano"],
    graveyardIsland: ["alabasta", "abyss"],
    abyss: ["graveyardIsland"],
    eniesLobby: ["alabasta", "waterSeven", "impelDown", "maryGeoise", "marineford"],
    maryGeoise: ["eniesLobby"],
    impelDown: ["eniesLobby"],
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
    {
      name: "Yoru",
      kind: "Espadón",
      grade: WeaponGrade.SAIJO_O_WAZAMONO,
      description: "El espadón negro que perteneció al mejor espadachín del mundo: tan pesado que solo un brazo excepcional lo maneja, y capaz de partir un barco de un tajo.",
      atkBonus: 34,
      basePrice: 600_000,
    },
    {
      name: "Kikoku",
      kind: "Katana",
      grade: WeaponGrade.RYO_WAZAMONO,
      description: "Una katana maldita que se alimenta del miedo de quien la mira. Corta tanto la carne como la voluntad.",
      atkBonus: 22,
      basePrice: 200_000,
      special: "maldita: aterra a los enemigos débiles, pero exige una voluntad firme a su portador",
    },
    {
      name: "Shodai Kitetsu",
      kind: "Katana",
      grade: WeaponGrade.RYO_WAZAMONO,
      description: "La primera de la familia Kitetsu: hermana mayor de una estirpe maldita, con más filo que paciencia.",
      atkBonus: 21,
      basePrice: 150_000,
      special: "maldita: pequeña probabilidad de herir a su propio portador en cada combate",
    },
    {
      name: "Murakumogiri",
      kind: "Katana",
      grade: WeaponGrade.RYO_WAZAMONO,
      description: "Una hoja sagrada de Wano que jamás pierde el filo y se dice que corta hasta las nubes.",
      atkBonus: 18,
      basePrice: 110_000,
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
      name: "Mr. 3 (Galdino)",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 45,
      description: "Agente de Baroque Works que gobierna Whisky Peak en la sombra con su Doru Doru no Mi; cobra a la isla entera su falsa hospitalidad.",
      personality: "Se cree un artista incomprendido; presume de sus esculturas de cera y teme más al desprecio que a la derrota.",
      factionType: FactionType.PIRATE,
      factionName: "Baroque Works",
      rankLabel: "Oficial de Baroque Works",
      canonBounty: BigInt(24_000_000),
    },
    {
      name: "Mr. 1 (Daz Bonez)",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 62,
      description: "El asesino más eficaz de Baroque Works, con su cuerpo convertido en acero; controla Alabasta a sangre y arena mientras la rebelión hierve.",
      personality: "Frío, metódico y de pocas palabras; considera cada muerte un trabajo bien hecho, nada más.",
      factionType: FactionType.PIRATE,
      factionName: "Baroque Works",
      rankLabel: "Oficial de Baroque Works",
      canonBounty: BigInt(80_000_000),
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
    // ---------- Phase 2 holders and guardians (2026-09-24) ----------
    {
      name: "Eneru",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 72,
      description: "El autoproclamado Dios de Skypiea: un hombre que confunde su poder con derecho divino y tiene a toda una isla aterrada por su juicio.",
      personality: "Solemne y burlón, habla de sí mismo en tercera persona y considera a cualquiera que no lo adore un insecto que aún no ha sido castigado.",
      factionType: FactionType.UNAFFILIATED,
      factionName: "Dominios de Skypiea",
      rankLabel: "Dios de Skypiea",
      canonBounty: BigInt(0),
      devilFruitName: "Goro Goro no Mi",
    },
    {
      name: "Caesar Clown",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 58,
      description: "Científico exiliado que domina Punk Hazard con su laboratorio y su fruta de gas; no distingue entre pacientes y sujetos de prueba.",
      personality: "Egocéntrico y teatral, se llama a sí mismo un genio incomprendido y ríe siempre un segundo antes de hacer algo cruel.",
      factionType: FactionType.PIRATE,
      factionName: "Laboratorio de Punk Hazard",
      rankLabel: "Científico jefe",
      canonBounty: BigInt(300_000_000),
      devilFruitName: "Gasu Gasu no Mi",
    },
    {
      name: "Hody Jones",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 55,
      description: "Capitán de los Nuevos Piratas Gyojin, resentido con los humanos hasta el punto de querer arrasar un reino entero por ellos.",
      personality: "Rencoroso y despiadado, convencido de que la historia le debe una venganza que nadie más se atreve a cobrar.",
      factionType: FactionType.PIRATE,
      factionName: "Nuevos Piratas Gyojin",
      rankLabel: "Capitán",
      canonBounty: BigInt(500_000_000),
    },
    {
      name: "Thalassa",
      role: ActorRole.NOTABLE_PIRATE,
      powerLevel: 92,
      description: "La Guardiana del Abismo: última de los Custodios de las Mareas, cree que el Poneglifo bajo su isla debe seguir siendo leído solo por quien merezca perder algo para hacerlo.",
      personality: "Serena y solemne, habla despacio como el mar; no odia a los intrusos, pero los juzga, y su juicio casi siempre es una marea.",
      factionType: FactionType.UNAFFILIATED,
      factionName: "Custodios de las Mareas",
      rankLabel: "Guardiana del Abismo",
      canonBounty: BigInt(0),
      canonWeapon: "Tridente de las Mareas",
    },
    {
      name: "Saint Jaygarcia Saturn",
      role: ActorRole.GOROSEI,
      powerLevel: 97,
      description: "Uno de los Cinco Ancianos: guardián de la guerra y de los secretos de la Tierra Sagrada, aparece rara vez y jamás se ha visto que pierda una discusión.",
      personality: "Grave y siniestro, habla de la humanidad como quien habla de una plaga necesaria y no admite réplicas.",
      factionType: FactionType.CIPHER_POL,
      factionName: "Gorosei",
      rankLabel: "Anciano — Guardián de la Guerra",
      canonBounty: BigInt(0),
    },
    {
      name: "El Rey Sin Nombre",
      role: ActorRole.HIDDEN_RULER,
      powerLevel: 100,
      description: "Quien de verdad se sienta en el Trono Vacío de Mary Geoise. Los Cinco Ancianos le sirven y ningún registro guarda su nombre: su poder es el olvido del mundo.",
      personality: "Sereno, antiguo y sin rencor: habla como quien ya ha visto caer mil veces a los que se le oponen y espera a la siguiente.",
      factionType: FactionType.UNAFFILIATED,
      factionName: "Trono Vacío",
      rankLabel: "Gobernante oculto del mundo",
      canonBounty: BigInt(0),
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

  // ---------- Codex (2026-09-24): stats, abilities, location and the rest of the canon cast ----------
  const islandIdOf = (key: string) => islands[key]?.id ?? null;
  for (const a of actors) {
    const prof = ACTOR_PROFILES[a.name];
    if (!prof) continue;
    const row = worldActors[a.name] as { id: string; currentIslandId?: string | null };
    const assigned = FRUIT_ASSIGNMENTS[a.name];
    const fruitId = assigned ? fruitsByName[assigned]?.id : undefined;
    await prisma.worldActor.update({
      where: { id: row.id },
      data: {
        statsJson: profileStatsJson(prof),
        abilitiesJson: JSON.stringify(prof.ab),
        homeIslandId: islandIdOf(prof.home),
        ...(fruitId ? { devilFruitId: fruitId } : {}),
        // Never move someone on a reseed: only place actors that have no location yet.
        ...(row.currentIslandId ? {} : { currentIslandId: islandIdOf(prof.home), locationHidden: !!prof.hidden, locationUpdatedAt: new Date() }),
      },
    });
  }
  for (const e of EXTRA_ACTORS) {
    const fruitId = e.devilFruitName ? fruitsByName[e.devilFruitName]?.id : undefined;
    const common = {
      personality: e.personality,
      description: e.description,
      powerLevel: e.powerLevel,
      factionType: e.factionType,
      factionName: e.factionName,
      rankLabel: e.rankLabel,
      canonBounty: e.canonBounty,
      canonWeapon: e.canonWeapon,
      statsJson: profileStatsJson(e.profile),
      abilitiesJson: JSON.stringify(e.profile.ab),
      homeIslandId: islandIdOf(e.profile.home),
      status: e.status ?? "ACTIVE",
      ...(fruitId ? { devilFruitId: fruitId } : {}),
    };
    const existing = await prisma.worldActor.findUnique({ where: { name: e.name } });
    const row = await prisma.worldActor.upsert({
      where: { name: e.name },
      update: { ...common, ...(existing?.currentIslandId ? {} : { currentIslandId: islandIdOf(e.profile.home), locationHidden: !!e.profile.hidden, locationUpdatedAt: new Date() }) },
      create: { name: e.name, role: e.role, ...common, currentIslandId: islandIdOf(e.profile.home), locationHidden: !!e.profile.hidden, locationUpdatedAt: new Date() },
    });
    worldActors[e.name] = row;
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
    // ---------- UNAFFILIATED-only (guardians and lone powers) ----------
    {
      weight: 5,
      minHeat: 0,
      headline: "{actor} recorre las mareas y deja su puesto",
      category: "Mares",
      body: ["{actor} habría abandonado su puesto habitual para seguir las corrientes en aguas lejanas. Su territorio queda en manos de subordinados."],
      promptHint: "a lone, powerful guardian leaves their post for a while to follow the tides or a personal matter, leaving subordinates in charge",
      allowedFactionTypes: [FactionType.UNAFFILIATED],
      busyHours: [4, 12],
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
        enemy: { name: "Bandido de poca monta", hp: 50, atk: 8, def: 4, spd: 6 },
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
        enemy: { name: "Cazarrecompensas rival", hp: 90, atk: 16, def: 10, spd: 12 },
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
          hp: 180,
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
          hp: 240,
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
      loreText: "Ligado a leyendas de una isla que se hunde y resurge con las mareas. Los pocos que lo han visto dicen que el coral negro que lo rodea canta cuando alguien lo lee.",
      guardedBy: "Thalassa, la Guardiana del Abismo, y los Custodios de las Mareas: solo se llega en marea baja y solo se sale con su permiso.",
    },
    {
      codeName: "Poneglifo de Ruta — Fragmento Final",
      kind: "Road",
      loreText: "El más buscado y el menos comprendido: se cree que sin los otros tres, este no revela nada en absoluto.",
      guardedBy: "Los Cinco Ancianos de Mary Geoise, con Cipher Pol como brazo armado: quien lo lea ha visto lo que el mundo entero ha olvidado a propósito.",
    },
  ];

  const createdPoneglyphs: Record<string, { id: string }> = {};
  for (const p of poneglyphs) {
    const created = await prisma.poneglyph.upsert({
      where: { codeName: p.codeName },
      update: { loreText: p.loreText, guardedBy: p.guardedBy },
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
        enemy: { name: "Agentes encubiertos de Baroque Works", hp: 110, atk: 20, def: 14, spd: 18 },
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
          hp: 640,
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
          hp: 600,
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

  // ---------- Phase 2: the last two Road Poneglyphs ----------
  const abismoPoneglyph = createdPoneglyphs["Poneglifo de Ruta — Fragmento del Abismo"];
  await prisma.island.update({ where: { id: islands.abyss.id }, data: { hasPoneglyph: true, poneglyphId: abismoPoneglyph.id } });
  const finalPoneglyph = createdPoneglyphs["Poneglifo de Ruta — Fragmento Final"];
  await prisma.island.update({ where: { id: islands.maryGeoise.id }, data: { hasPoneglyph: true, poneglyphId: finalPoneglyph.id } });
  await prisma.worldActor.update({ where: { id: worldActors["Thalassa"].id }, data: { homeIslandId: islands.abyss.id } });
  await prisma.worldActor.update({ where: { id: worldActors["Saint Jaygarcia Saturn"].id }, data: { homeIslandId: islands.maryGeoise.id } });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.abyss.id,
      kind: EventKind.BOSS,
      minDanger: 10,
      maxDanger: 10,
      weight: 3,
      title: "Los Custodios de las Mareas",
      bodyJson: JSON.stringify({
        flavorTexts: [
          "El coral negro se abre en abanico y del agua emergen figuras de sal y concha que sostienen tridentes: los Custodios, que llevan siglos sin dormir. Tras ellos, la marea empieza a subir demasiado rápido para ser natural.",
        ],
        onCriticalSuccess: { text: ["El último Custodio cae de rodillas y el coral se aparta: el Poneglifo queda al descubierto, cantando."], berries: [60_000, 120_000], bounty: [22_000_000, 40_000_000] },
        onSuccess: { text: ["Tras un combate de agua y sal, los Custodios ceden el paso. El Poneglifo queda a tu alcance."], berries: [30_000, 70_000], bounty: [12_000_000, 24_000_000] },
        onFail: { text: ["La marea te arrastra y los tridentes hacen el resto."] },
        onCriticalFail: { text: ["Una ola te levanta y te estrella contra el coral: tarda un rato en volver a ser real todo lo que ves."] },
        enemy: {
          name: "Custodios de las Mareas",
          hp: 760,
          atk: 92,
          def: 62,
          spd: 50,
          isBoss: true,
          personality: "silenciosos y pacientes como la marea; no atacan con odio, sino con la inevitabilidad de una ola",
          worldActorId: worldActors["Thalassa"].id,
        },
        poneglyphId: abismoPoneglyph.id,
      }),
    },
  });

  await prisma.eventTemplate.create({
    data: {
      islandId: islands.maryGeoise.id,
      kind: EventKind.BOSS,
      minDanger: 10,
      maxDanger: 10,
      weight: 3,
      title: "La guardia del Fragmento Final",
      bodyJson: JSON.stringify({
        flavorTexts: [
          "Los jardines de la Tierra Sagrada son perfectos hasta que alguien no debería estar en ellos. Entonces, de entre los setos, salen los guardias del Castillo de Pangea: una unidad de élite de CP-0 que responde directamente a los Ancianos.",
        ],
        onCriticalSuccess: { text: ["La unidad cae sin que suene una sola alarma. El pasillo hacia la sala del Fragmento Final queda libre."], berries: [70_000, 140_000], bounty: [25_000_000, 45_000_000] },
        onSuccess: { text: ["Tras un combate rápido y sucio entre los setos, el pasillo queda despejado. El Fragmento Final aguarda al fondo."], berries: [35_000, 80_000], bounty: [14_000_000, 26_000_000] },
        onFail: { text: ["La coordinación de la unidad te desborda: cada golpe llegaba antes de que lo vieras venir."] },
        onCriticalFail: { text: ["No llegas a ver ni la primera técnica: cuando recuperas la conciencia, sigues vivo por un capricho de tus captores."] },
        enemy: {
          name: "Guardia de la Tierra Sagrada",
          hp: 840,
          atk: 100,
          def: 70,
          spd: 58,
          isBoss: true,
          personality: "sin rostro ni nombre, hablan con la voz monótona de quien obedece sin pensar",
          worldActorId: worldActors["Saint Jaygarcia Saturn"].id,
        },
        poneglyphId: finalPoneglyph.id,
      }),
    },
  });

  // ---------- Phase 2: island stories (two beats per new island) ----------
  type Story = { island: string; kind: EventKind; title: string; weight: number; min: number; max: number; flavor: string; crit: string; ok: string; fail: string; critFail: string; loot?: [number, number]; xp?: [number, number]; hurt?: [number, number]; enemy?: { name: string; hp: number; atk: number; def: number; spd: number; personality: string } };
  const stories: Story[] = [
    { island: "orangeTown", kind: EventKind.COMBAT, title: "El cobro del circo", weight: 9, min: 1, max: 2, flavor: "Unos matones con narices rojas y armas de verdad te cierran el paso para cobrarte 'la entrada' al pueblo.", crit: "Los dejas sentados en el suelo con sus propias narices pegadas al pecho, y el pueblo aplaude en secreto.", ok: "Los echas del puerto sin muchas complicaciones.", fail: "Te sacuden entre risotadas y te dejan un moratón de recuerdo.", critFail: "Te lanzan un cañonazo de confeti que resulta ser pólvora de verdad.", enemy: { name: "Matones del circo", hp: 70, atk: 12, def: 6, spd: 10, personality: "escandalosos y cobardes por dentro, se creen invencibles mientras nadie les planta cara" } },
    { island: "syrup", kind: EventKind.COMBAT, title: "El mayordomo de la colina", weight: 9, min: 1, max: 2, flavor: "Un hombre de gafas y sonrisa perfecta te sale al paso en el camino de la mansión y te pide amablemente que te des la vuelta.", crit: "Descubres su verdadero rostro antes de que dé el primer paso y lo acorralas.", ok: "Lo obligas a retroceder, aunque su calma da más miedo que sus golpes.", fail: "Se mueve tan rápido que ni lo ves y te deja un arañazo de despedida.", critFail: "Tres cortes limpios, sin una sola palabra de más.", enemy: { name: "Mayordomo de la mansión", hp: 90, atk: 14, def: 8, spd: 16, personality: "educadísimo y calculador, planea cada golpe con cien pasos de antelación" } },
    { island: "ohara", kind: EventKind.COMBAT, title: "Agentes entre las cenizas", weight: 9, min: 6, max: 6, flavor: "Unos hombres de traje gris peinan las ruinas de la biblioteca y no les hace ninguna gracia verte revolver entre el polvo.", crit: "Los desarmas y dejas caer entre las cenizas lo que buscaban: una hoja salvada del fuego.", ok: "Los ahuyentas antes de que avisen a sus superiores.", fail: "Te derriban con una técnica rápida y precisa y te dan por muerto.", critFail: "Una patada de aire te atraviesa el costado sin que veas moverse a nadie.", enemy: { name: "Agentes del Gobierno", hp: 220, atk: 34, def: 20, spd: 30, personality: "fríos y burocráticos, actúan como si borrar la memoria de una isla fuera un trámite" } },
    { island: "marineford", kind: EventKind.COMBAT, title: "Patrulla de la plaza", weight: 9, min: 8, max: 9, flavor: "Una patrulla de élite de la Marina te cierra el paso en la plaza principal: aquí ningún pirata pasea sin permiso.", crit: "Los superas con una jugada que los deja sin palabras y un almirante lo ve desde lo alto.", ok: "Los detienes antes de que suene la alarma general.", fail: "Te encierran en una formación imposible de romper.", critFail: "Ni te da tiempo a levantar la guardia: una lluvia de disparos te clava contra el suelo.", enemy: { name: "Patrulla de élite de la Marina", hp: 300, atk: 46, def: 28, spd: 32, personality: "disciplinados y coordinados, no dejan un solo hueco" } },
    { island: "dressrosa", kind: EventKind.COMBAT, title: "El coliseo", weight: 9, min: 9, max: 9, flavor: "Un gladiador legendario te reta en la arena ante miles de espectadores: perder aquí es un espectáculo, ganar es una leyenda.", crit: "Lo derrotas con tal estilo que el estadio entero se pone en pie.", ok: "Ganas el combate a duras penas, con el público a tu favor.", fail: "Te tumba delante de todos y te obliga a salir con la cabeza baja.", critFail: "Un golpe seco te deja fuera de combate mientras el público se ríe.", enemy: { name: "Gladiador del coliseo", hp: 280, atk: 48, def: 30, spd: 34, personality: "showman con el orgullo por las nubes, no soporta perder delante del público" } },
    { island: "zou", kind: EventKind.COMBAT, title: "La prueba de los mink", weight: 9, min: 9, max: 9, flavor: "Un guerrero mink te espera en la entrada de la ciudad-bosque: solo quien demuestre valor cruzará.", crit: "Superas su prueba con honor y te ofrece un lugar junto al fuego.", ok: "Lo derrotas en duelo limpio y te deja pasar sin rencor.", fail: "Se mueve con una velocidad eléctrica y te lanza fuera del camino.", critFail: "Un relámpago te sacude y se te cortan hasta las palabras.", enemy: { name: "Guerrero mink", hp: 260, atk: 54, def: 30, spd: 44, personality: "orgulloso y sincero, respeta a quien pelea de frente" } },
    { island: "egghead", kind: EventKind.COMBAT, title: "Los guardianes del laboratorio", weight: 9, min: 10, max: 10, flavor: "Unas máquinas enormes se alinean en el puente de cristal: cada intruso es un dato que quiere procesar.", crit: "Encuentras su fallo lógico y las apagas una a una.", ok: "Las destrozas antes de que sellen el paso.", fail: "Te clavan a la pared con rayos que ni siquiera se ven.", critFail: "Un pulso de energía te deja de rodillas sin saber de dónde vino.", enemy: { name: "Guardianes mecánicos", hp: 340, atk: 60, def: 40, spd: 42, personality: "fríos y precisos, calculan tu siguiente movimiento antes de que lo pienses" } },

    { island: "drum", kind: EventKind.SOCIAL, title: "La doctora de la montaña", weight: 10, min: 7, max: 7, flavor: "Subes por la nieve hasta el hospital de la cima, donde una anciana de risa inquietante te mira de arriba abajo como quien ya sabe qué te duele.", crit: "La doctora te ofrece un tratamiento que casi ningún forastero recibe: te sientes más fuerte que nunca.", ok: "Te cura las heridas viejas y te cobra con un recado que resulta útil.", fail: "Te despacha con una receta amarga y una carcajada.", critFail: "Su medicina 'de prueba' te deja ardiendo de fiebre un buen rato.", xp: [12, 30], hurt: [0, 6] },
    { island: "drum", kind: EventKind.COMBAT, title: "Los lobos de nieve", weight: 9, min: 7, max: 7, flavor: "Una manada de lobos de nieve gigantes te cierra el paso: no atacan por hambre, sino porque algo más grande los empuja hacia el pueblo.", crit: "Los dispersas y descubres qué los espantaba: un rastro de caza furtiva que puedes denunciar.", ok: "Rechazas la manada y la nieve se traga sus huellas.", fail: "Los lobos te rodean y solo el frío te salva de una mordida peor.", critFail: "Uno te derriba en la ventisca y te arrastra unos metros antes de soltarte.", enemy: { name: "Manada de lobos de nieve", hp: 190, atk: 30, def: 18, spd: 32, personality: "bestias hambrientas que solo entienden la fuerza" } },
    { island: "skypiea", kind: EventKind.EXPLORATION, title: "El mar de algodón", weight: 10, min: 8, max: 8, flavor: "Caminas sobre nubes que soportan tu peso a duras penas. Abajo se ve el mar; arriba, un sol que no parece el mismo.", crit: "Encuentras una antigua ofrenda de oro que los Sacerdotes no habían reclamado.", ok: "Cruzas la nube sin incidentes y con algo de botín en el bolsillo.", fail: "Te hundes hasta la cintura y pierdes un buen rato saliendo.", critFail: "La nube cede del todo y te salva un ángel de la casualidad... no del golpe.", loot: [400, 1600], xp: [12, 28], hurt: [0, 14] },
    { island: "skypiea", kind: EventKind.COMBAT, title: "Los ojos del Dios", weight: 9, min: 8, max: 8, flavor: "Un Sacerdote te intercepta bajo un arco de nubes: Eneru todo lo oye y ya sabe qué has venido a buscar.", crit: "Lo derrotas con un ingenio que ni el Dios podría haber anticipado.", ok: "El Sacerdote cae y su rayo se disipa sobre las nubes.", fail: "Un relámpago te tira al suelo antes de que puedas responder.", critFail: "El siguiente rayo es tan rápido que ni lo ves: cuando abres los ojos ya estás herido.", enemy: { name: "Sacerdote de Eneru", hp: 260, atk: 44, def: 28, spd: 36, personality: "fanático y pomposo, convencido de que ser derrotado es un sacrilegio" } },
    { island: "waterSeven", kind: EventKind.SOCIAL, title: "Los astilleros Galley-La", weight: 10, min: 7, max: 7, flavor: "Los carpinteros te muestran su trabajo con orgullo, mientras uno de ellos, con demasiada facilidad, pregunta por 'unos planos antiguos'.", crit: "Ganas su confianza y una mejora de tu barco a precio de amigo.", ok: "Charlas con los maestros y compras material de primera con descuento.", fail: "Te toman por un curioso incómodo y te echan con cordialidad.", critFail: "Un malentendido te mete en una pelea de taberna con un carpintero corpulento.", loot: [300, 1200], xp: [10, 24], hurt: [0, 8] },
    { island: "waterSeven", kind: EventKind.COMBAT, title: "Sombras en los canales", weight: 9, min: 7, max: 7, flavor: "Una silueta te sigue por los puentes de la ciudad de agua: alguien te cree involucrado con lo que el Gobierno busca.", crit: "Lo acorralas y confiesa quién lo envía.", ok: "Lo derribas en el canal y te deja una pista sobre su jefe.", fail: "Te da esquinazo y un golpe bajo de despedida.", critFail: "Cuando te das cuenta, tienes un filo en el costado y el canal frío en la espalda.", enemy: { name: "Agente encubierto de CP", hp: 210, atk: 38, def: 24, spd: 40, personality: "callado y eficiente, actúa como si tuviera todo el tiempo del mundo" } },
    { island: "sabaody", kind: EventKind.SOCIAL, title: "El viejo de las burbujas", weight: 10, min: 8, max: 8, flavor: "En un bar del manglar 41, un anciano de mirada tranquila te ofrece un trago y una historia sobre lo que hay bajo el mar del Nuevo Mundo.", crit: "El viejo te enseña algo que nadie más sabe del Nuevo Mundo y te presenta a alguien útil.", ok: "Te cuenta una buena historia y te da un consejo que vale oro.", fail: "Te sonríe, calla y cambia de tema con elegancia.", critFail: "Sin querer, insultas a alguien de peso en el bar y sales de allí más rápido que dignamente.", loot: [500, 1800], xp: [14, 32], hurt: [0, 6] },
    { island: "sabaody", kind: EventKind.COMBAT, title: "La subasta", weight: 9, min: 8, max: 8, flavor: "Ves cómo unos matones se llevan a un joven a la casa de subastas. Nadie mira: aquí, mirar es cómplice.", crit: "Liberas al chico y desapareces antes de que llegue la Marina.", ok: "Los matones caen y el chico escapa, aunque te ha visto la cara.", fail: "Son más de lo que parecían y te ves obligado a retirarte.", critFail: "Te descubren y tienes que huir con más golpes de los que quisieras.", enemy: { name: "Matones de la casa de subastas", hp: 240, atk: 40, def: 22, spd: 30, personality: "brutales y descuidados, acostumbrados a no encontrar resistencia" } },
    { island: "fishMan", kind: EventKind.EXPLORATION, title: "El Árbol Eve", weight: 10, min: 9, max: 9, flavor: "Bajo la sombra del Árbol Eve, los gyojin te miran con cautela: eres humano, y aquí eso ya es una declaración.", crit: "Una anciana sirena te concede una audiencia y una bendición del árbol.", ok: "Recorres el reino sin incidentes, con la desconfianza a cuestas.", fail: "Un guardia te pide que te marches antes de que lo hagan otros por ti.", critFail: "Una ola te empuja contra un muro de coral y te deja magullado.", loot: [500, 2200], xp: [15, 34], hurt: [0, 10] },
    { island: "fishMan", kind: EventKind.COMBAT, title: "La banda de Hody", weight: 9, min: 9, max: 9, flavor: "Un grupo de los Nuevos Piratas Gyojin te reconoce como humano y decide que eres el primer motivo de su próxima fiesta.", crit: "Los desarmas sin que tu espada llegue a mojarse.", ok: "Repeles a la banda, que huye entre insultos.", fail: "Cada uno de ellos es más fuerte que tú en su elemento.", critFail: "Un puñetazo que ni ves venir te deja sin aire un buen rato.", enemy: { name: "Nuevos Piratas Gyojin", hp: 300, atk: 50, def: 30, spd: 34, personality: "rencorosos y confiados; ven en cada humano al culpable de su historia" } },
    { island: "punkHazard", kind: EventKind.EXPLORATION, title: "El laboratorio sellado", weight: 10, min: 9, max: 9, flavor: "Las puertas del laboratorio están abiertas de par en par, lo que en un lugar como este solo puede ser una trampa o un aviso.", crit: "Encuentras un archivo de experimentos que valdría una fortuna para el bando adecuado.", ok: "Sales con material útil y sin haber respirado el gas.", fail: "Un pasillo se sella tras de ti y pierdes un rato buscando la salida.", critFail: "Un gas dulzón te nubla los sentidos y despiertas más tarde con la cabeza a punto de estallar.", loot: [600, 2400], xp: [16, 36], hurt: [0, 16] },
    { island: "punkHazard", kind: EventKind.COMBAT, title: "Los niños del hielo", weight: 9, min: 9, max: 9, flavor: "Algo entre la ventisca se mueve con torpeza y con rabia: un experimento que ya no obedece a su creador.", crit: "Lo calmas sin luchar y te lleva hasta la puerta secreta del laboratorio.", ok: "Lo detienes y descubres qué lo ha vuelto así.", fail: "Su fuerza desbocada te lanza por los aires.", critFail: "Te encierra entre sus brazos de hielo y por un momento no sientes las manos.", enemy: { name: "Experimento fallido del laboratorio", hp: 340, atk: 55, def: 34, spd: 28, personality: "una criatura rota que ataca por miedo, no por maldad" } },
    { island: "wholeCake", kind: EventKind.EXPLORATION, title: "El bosque de galleta", weight: 10, min: 10, max: 10, flavor: "Los árboles de galleta esconden ojos de caramelo y bocas de nata que tararean una canción demasiado alegre.", crit: "Un guardián cambia de opinión sobre ti y te deja un tesoro de repostería... y un secreto.", ok: "Recorres el bosque sin que las cosas te devoren a mordiscos.", fail: "Los árboles te siguen y no te sueltan hasta que te distraen con un dulce.", critFail: "Un lazo de regaliz te atrapa y solo escapas a costa de un buen tirón.", loot: [700, 2600], xp: [18, 40], hurt: [0, 18] },
    { island: "wholeCake", kind: EventKind.COMBAT, title: "Un Ministro de la Tartas", weight: 9, min: 10, max: 10, flavor: "Un Ministro de la tripulación te sale al paso con una sonrisa tan dulce que preferirías que te gritase.", crit: "Lo derrotas con una jugada que todo el reino comentará durante semanas.", ok: "Cae tras un combate encarnizado, sin perder jamás la compostura.", fail: "Su técnica de repostería letal te supera con una elegancia insultante.", critFail: "Te sirve tu propia derrota en bandeja, y duele más de lo que parece.", enemy: { name: "Ministro de Whole Cake", hp: 420, atk: 66, def: 40, spd: 40, personality: "educado hasta la crueldad; te llama 'invitado' mientras te aplasta" } },
    { island: "wano", kind: EventKind.TRAINING, title: "El herrero de las cascadas", weight: 12, min: 10, max: 10, flavor: "Un viejo herrero acepta enseñarte cómo se templa una hoja bajo una cascada helada, con una condición: que no digas una palabra hasta el final.", crit: "Al terminar, el herrero te da una mirada de respeto que no da a casi nadie.", ok: "Sales con las manos vendadas y una idea nueva de lo que es el filo.", fail: "Hablas antes de tiempo y el herrero te echa sin mirarte.", critFail: "La hoja se quiebra en tu mano y el agua helada hace el resto.", xp: [20, 42], hurt: [0, 8] },
    { island: "wano", kind: EventKind.COMBAT, title: "El ronin sin nombre", weight: 9, min: 10, max: 10, flavor: "Un samurái sin señor te espera en un puente de madera, con la mano ya en la empuñadura: no busca dinero, busca un buen duelo.", crit: "Tu único tajo lo deja en silencio, con una reverencia respetuosa.", ok: "Tras un duelo limpio, el ronin baja la espada y asiente.", fail: "Su primera estocada te enseña más de lo que querías aprender.", critFail: "Un tajo tan rápido que no lo ves te deja una cicatriz que recordarás.", enemy: { name: "Ronin sin nombre", hp: 400, atk: 68, def: 42, spd: 52, personality: "honorable y de pocas palabras; solo habla de espadas y de deudas de honor" } },
    { island: "abyss", kind: EventKind.EXPLORATION, title: "El coral que canta", weight: 10, min: 10, max: 10, flavor: "Los arrecifes negros vibran con una nota grave que se mete en el hueso. Cada paso que das parece seguirle el compás.", crit: "Comprendes que la nota es un mapa y encuentras un pasadizo que casi nadie conoce.", ok: "Cruzas el arrecife sin extraviarte y con algo de coral valioso.", fail: "La marea sube de golpe y te obliga a retroceder.", critFail: "Una ola te levanta y te deposita, medio ahogado, más lejos de lo que empezaste.", loot: [800, 3000], xp: [20, 44], hurt: [0, 20] },
    { island: "maryGeoise", kind: EventKind.SOCIAL, title: "Los jardines de la Tierra Sagrada", weight: 10, min: 10, max: 10, flavor: "Paseas por jardines tan perfectos que resultan hostiles. Un noble mundial pasa cerca, sin mirarte, sobre la espalda de alguien.", crit: "Escuchas una conversación que ninguno de los dos debía tener en voz alta.", ok: "Pasas inadvertido y oyes lo suficiente para hacerte una idea de lo que se cuece aquí.", fail: "Un guardia te pide la documentación con una amabilidad que da miedo.", critFail: "Tu sola presencia incomoda a alguien poderoso: sales, pero con las piernas temblando.", loot: [900, 3400], xp: [22, 46], hurt: [0, 14] },
    { island: "laughTale", kind: EventKind.EXPLORATION, title: "La isla que ríe", weight: 10, min: 10, max: 10, flavor: "Al pisar la costa, el viento trae una carcajada que no pertenece a nadie. Todo el lugar parece contener la risa esperándote.", crit: "Encuentras una estancia que no aparece en ningún mapa y una inscripción que solo tú puedes leer.", ok: "Recorres la isla con la sensación de estar siendo esperado desde hace mucho.", fail: "La risa se vuelve un murmullo y por un momento no sabes si es contigo o de ti.", critFail: "Un derrumbe te obliga a retroceder, y la risa suena más fuerte, como si algo se divirtiera.", loot: [1000, 4000], xp: [24, 50], hurt: [0, 12] },
  ];
  for (const st of stories) {
    const outcome = (text: string, extra: object = {}) => ({ text: [text], ...extra });
    await prisma.eventTemplate.create({
      data: {
        islandId: islands[st.island].id,
        kind: st.kind,
        minDanger: st.min,
        maxDanger: st.max,
        weight: st.weight,
        title: st.title,
        bodyJson: JSON.stringify({
          flavorTexts: [st.flavor],
          onCriticalSuccess: outcome(st.crit, { ...(st.loot ? { berries: [st.loot[0] * 2, st.loot[1] * 2] } : {}), ...(st.xp ? { xp: [st.xp[0] * 2, st.xp[1] * 2] } : {}) }),
          onSuccess: outcome(st.ok, { ...(st.loot ? { berries: st.loot } : {}), ...(st.xp ? { xp: st.xp } : {}) }),
          onFail: outcome(st.fail, st.hurt ? { hpLoss: [0, Math.max(2, Math.floor(st.hurt[1] / 2))] } : {}),
          onCriticalFail: outcome(st.critFail, st.hurt ? { hpLoss: [st.hurt[1], st.hurt[1] * 2] } : {}),
          ...(st.enemy ? { enemy: { ...st.enemy, isBoss: false } } : {}),
        }),
      },
    });
  }

  // ---------- Conquerable territories ----------
  // Only the holder link is (re)written on a reseed — ownership, garrison and any
  // conquest in progress belong to the players and must never be reset by seeding.
  const territoryDefs: { island: string; actor: string; title: string }[] = [
    { island: islands.whiskyPeak.id, actor: "Mr. 3 (Galdino)", title: "Dominio de Baroque Works" },
    { island: islands.alabasta.id, actor: "Mr. 1 (Daz Bonez)", title: "Dominio de Baroque Works" },
    { island: islands.graveyardIsland.id, actor: "Marshall D. Teach", title: "Dominio de Barbanegra" },
    { island: islands.eniesLobby.id, actor: "Rob Lucci", title: "Dominio del Gobierno Mundial" },
    { island: islands.skypiea.id, actor: "Eneru", title: "Dominio del Dios de Skypiea" },
    { island: islands.fishMan.id, actor: "Hody Jones", title: "Dominio de los Nuevos Piratas Gyojin" },
    { island: islands.punkHazard.id, actor: "Caesar Clown", title: "Dominio del Laboratorio" },
    { island: islands.wholeCake.id, actor: "Charlotte Katakuri", title: "Dominio de Whole Cake" },
  ];
  for (const t of territoryDefs) {
    const actor = worldActors[t.actor];
    await prisma.worldActor.update({ where: { id: actor.id }, data: { homeIslandId: t.island } });
    await prisma.territory.upsert({
      where: { islandId: t.island },
      update: { homeActorId: actor.id },
      create: { islandId: t.island, homeActorId: actor.id, ownerActorId: actor.id, ownerName: t.actor, title: t.title },
    });
  }

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

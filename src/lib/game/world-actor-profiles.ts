/**
 * Codex data for the canon cast that already existed in prisma/seed.ts (2026-09-24 backfill):
 * combat stats (same raw scale as Character), Haki, fruit phase, signature abilities and where
 * each one lives. The seed upserts these onto the WorldActor rows; engine/enemy-kit.ts and the
 * codex page read them. Keys are exact WorldActor names.
 */

export type FruitPhaseKey = "initial" | "advanced" | "awakened";

export interface ActorProfile {
  /** strength, agility, durability, willpower, intellect */
  s: [number, number, number, number, number];
  /** armament, observation, conqueror */
  h: [number, number, boolean];
  phase?: FruitPhaseKey;
  ab: string[];
  /** Island key from prisma/seed.ts (home + initial location). */
  home: string;
  /** Moves in secret by default. */
  hidden?: boolean;
}

export const ACTOR_PROFILES: Record<string, ActorProfile> = {
  Shanks: { s: [94, 90, 92, 99, 90], h: [98, 96, true], ab: ["Gryphon", "Haoshoku Haki que detiene batallas", "Esgrima de un solo tajo decisivo"], home: "foosha" },
  "Marshall D. Teach": { s: [93, 78, 99, 96, 88], h: [90, 82, false], phase: "awakened", ab: ["POSEE DOS FRUTAS DEL DIABLO a la vez (único en el mundo)", "Fruta 1, Yami Yami no Mi: Kurouzu atrae todo hacia su vacío, anula las frutas ajenas al tocarlas, Liberación de oscuridad", "Fruta 2, Gura Gura no Mi: terremotos que agrietan el suelo y el aire, ondas de choque con cada golpe", "Combina vacío y terremoto: atrae al rival y lo revienta con una onda sísmica"], home: "graveyardIsland" },
  Buggy: { s: [55, 60, 55, 70, 78], h: [30, 25, false], phase: "initial", ab: ["Bara Bara Festival", "Buggy Ball: cañón de payaso", "Faroleo y astucia política", "Cuerpo separable inmune a cortes"], home: "loguetown" },
  "Monkey D. Luffy": { s: [96, 92, 94, 99, 60], h: [95, 90, true], phase: "awakened", ab: ["Gear 5 — Sun God Nika", "Gomu Gomu no Bajrang Gun", "Haoshoku recubierto", "Cuerpo de goma sin límites"], home: "wano" },
  Kizaru: { s: [90, 99, 88, 80, 85], h: [92, 96, false], phase: "awakened", ab: ["Yasakani no Magatama: ráfaga de luz", "Ame no Habakiri: espada de luz", "Patada a velocidad lumínica", "Rayos de Amaterasu"], home: "eniesLobby" },
  Fujitora: { s: [88, 82, 90, 85, 92], h: [90, 94, false], phase: "awakened", ab: ["Gravedad: Gravitación y meteoritos", "Espada oculta Shikomizue", "Haki de Observación afinado (ciego)", "Ley moral, no ley ciega"], home: "marineG5" },
  Ryokugyu: { s: [90, 80, 92, 82, 84], h: [93, 90, false], phase: "awakened", ab: ["Drenaje de vida con raíces", "Bosque de la Grand Line", "Forma de bosque devorador", "Tala silenciosa"], home: "marineG5" },
  Sakazuki: { s: [95, 84, 96, 99, 78], h: [95, 88, false], phase: "awakened", ab: ["Meigo: puño de magma", "Dai Funka: erupciones", "Justicia Absoluta", "Meteoritos de lava"], home: "eniesLobby" },
  "Monkey D. Garp": { s: [96, 78, 97, 96, 70], h: [96, 92, true], ab: ["Puño del Amor", "Galaxy Impact", "Hakis que quiebran barcos", "Veterano legendario de la Marina"], home: "marineG5" },
  Sengoku: { s: [86, 76, 88, 90, 96], h: [88, 84, false], phase: "advanced", ab: ["Forma de Buda dorado", "Onda de choque de Daibutsu", "Estrategia de flota", "Liderazgo de Almirante de Flota"], home: "marineG5" },
  Smoker: { s: [82, 84, 80, 88, 74], h: [78, 70, false], phase: "advanced", ab: ["Cuerpo de humo", "White Blow/White Snake", "Jitte con Kairoseki", "Persecución implacable"], home: "loguetown" },
  "X Drake": { s: [82, 76, 84, 80, 78], h: [70, 72, false], phase: "advanced", ab: ["Forma híbrida de Allosaurus", "Agente doble", "Poder de choque de dinosaurio", "Escamas y garras"], home: "marineG5" },
  Kaku: { s: [82, 92, 80, 78, 80], h: [60, 70, false], phase: "advanced", ab: ["Rokushiki", "Tempest Kick", "Forma híbrida de jirafa", "Rankyaku"], home: "eniesLobby" },
  Kalifa: { s: [58, 84, 60, 74, 92], h: [30, 55, false], phase: "initial", ab: ["Burbujas de jabón", "Rokushiki de espionaje", "Infiltración en oficinas", "Abogada implacable"], home: "eniesLobby" },
  Sabo: { s: [90, 92, 86, 92, 88], h: [90, 86, false], phase: "advanced", ab: ["Fuego Dragón: llamas de Mera Mera", "Ryuu no Kagizume", "Estilo de combate de tuberías", "Segundo al mando revolucionario"], home: "baltigo" },
  "Monkey D. Dragon": { s: [94, 88, 92, 99, 96], h: [96, 94, true], ab: ["Tormentas invocadas", "Dominio del clima", "Haoshoku de líder", "El hombre más buscado del mundo"], home: "baltigo", hidden: true },
  "Emporio Ivankov": { s: [76, 82, 78, 88, 82], h: [55, 60, false], phase: "advanced", ab: ["Hormonas de curación", "Hormonas de velocidad", "Emporio Face", "Reina del Reino Kamabakka"], home: "baltigo" },
  Koala: { s: [72, 84, 70, 86, 82], h: [56, 50, false], ab: ["Karate hombre-pez", "Kōsen de agua", "Infiltración revolucionaria"], home: "baltigo" },
  "Dracule Mihawk": { s: [95, 90, 88, 92, 86], h: [94, 96, false], ab: ["Yoru: el mejor espadachín", "Corte volador que parte islas", "Duelos sin rival"], home: "reverseMountain" },
  "Boa Hancock": { s: [86, 92, 82, 88, 84], h: [86, 80, true], phase: "advanced", ab: ["Mero Mero: petrificación", "Haoshoku de Emperatriz", "Patadas de serpiente", "Reina de las Kuja"], home: "reverseMountain" },
  Crocodile: { s: [86, 82, 86, 88, 94], h: [82, 78, false], phase: "awakened", ab: ["Cuerpo de arena", "Desert Spada", "Sables: gancho de veneno", "Absorción de agua"], home: "alabasta" },
  "Mr. 3 (Galdino)": { s: [46, 50, 52, 60, 78], h: [20, 20, false], phase: "initial", ab: ["Cera endurecible", "Candle Service", "Trampas y esculturas"], home: "whiskyPeak" },
  "Mr. 1 (Daz Bonez)": { s: [76, 70, 90, 82, 64], h: [55, 40, false], phase: "advanced", ab: ["Cuerpo de acero", "Cortes con cuchillas", "Frases de honor"], home: "alabasta" },
  "Donquixote Doflamingo": { s: [92, 92, 88, 94, 94], h: [92, 90, true], phase: "awakened", ab: ["Hilos de Ito Ito", "Parasite: marionetas de personas", "Birdcage", "Hilos de Haki"], home: "sabaody", hidden: true },
  "Trafalgar D. Water Law": { s: [80, 88, 76, 92, 96], h: [82, 78, false], phase: "awakened", ab: ["Room y Shambles", "Injection Shot", "Gamma Knife", "Cirugía letal"], home: "punkHazard" },
  "Eustass Kid": { s: [90, 76, 88, 90, 74], h: [86, 74, false], phase: "advanced", ab: ["Magnetismo: Punk Rotten", "Repel", "Damned Punk", "Brazo de metal"], home: "sabaody" },
  "Basil Hawkins": { s: [78, 80, 82, 80, 90], h: [74, 84, false], phase: "advanced", ab: ["Muñeco de paja", "Adivinación por cartas", "Ritual de paja", "Daño transferido"], home: "sabaody" },
  Killer: { s: [82, 88, 76, 84, 72], h: [72, 70, false], ab: ["Cuchillas de brazo", "Fast Gleam", "Máscara asesina"], home: "sabaody" },
  "Charlotte Katakuri": { s: [92, 92, 90, 92, 88], h: [94, 99, false], phase: "awakened", ab: ["Mochi de acero", "Futuro visto con Observación", "Donut y lanza de mochi", "Ministro de la Tartas"], home: "wholeCake" },
  "Jewelry Bonney": { s: [66, 78, 64, 80, 76], h: [50, 44, false], phase: "advanced", ab: ["Toshi Toshi: cambiar la edad", "Rejuvenecer y envejecer", "Astucia de glotona"], home: "sabaody" },
  Eneru: { s: [86, 92, 82, 96, 90], h: [30, 99, false], phase: "awakened", ab: ["Cuerpo de rayo", "El Amaru", "Mantra: escucha todo", "Rayo de Dios: Raigo"], home: "skypiea" },
  "Caesar Clown": { s: [56, 60, 62, 70, 96], h: [20, 20, false], phase: "advanced", ab: ["Gas venenoso", "Bombas Gastanet", "Armas químicas", "Científico sin escrúpulos"], home: "punkHazard" },
  "Hody Jones": { s: [88, 78, 90, 76, 62], h: [45, 30, false], ab: ["Karate hombre-pez extremo", "Esteroides de Energy Steroid", "Ira de los Nuevos Piratas"], home: "fishMan" },
  Thalassa: { s: [88, 82, 92, 96, 94], h: [90, 92, true], ab: ["Guardiana del Abismo", "Voz de las profundidades", "Memoria de la Era del Vacío"], home: "abyss", hidden: true },
  "Saint Jaygarcia Saturn": { s: [92, 84, 94, 92, 98], h: [92, 94, false], ab: ["Anciano de las Cinco Estrellas", "Formas no humanas", "Sentencia sin apelación"], home: "maryGeoise", hidden: true },
  "El Rey Sin Nombre": { s: [98, 90, 98, 99, 99], h: [99, 99, true], ab: ["Gobernante oculto del mundo", "Voluntad de la Era del Vacío", "Poder que no se nombra"], home: "maryGeoise", hidden: true },
  "Roronoa Zoro": { s: [94, 88, 92, 96, 66], h: [92, 90, true], ab: ["Santoryu: Asura", "Enma: Haki de Armadura extremo", "Rey del Infierno", "Nothing Cut"], home: "wano" },
  Nami: { s: [56, 88, 58, 80, 96], h: [30, 62, false], ab: ["Clima-Tact: Thunderbolt Tempo", "Zeus: rayo hecho compañero", "Navegación imposible", "Ladrona maestra"], home: "wano" },
  Usopp: { s: [58, 82, 62, 92, 90], h: [40, 90, false], ab: ["Francotirador Rey", "Kabuto: bolas explosivas", "Haki de Observación de vanguardia", "Mentiras que se hacen realidad"], home: "wano" },
  "Vinsmoke Sanji": { s: [88, 94, 86, 92, 80], h: [88, 90, false], ab: ["Diable Jambe", "Ifrit Jambe", "Genes Germa: Raid Suit", "Patadas en llamas"], home: "wano" },
  "Tony Tony Chopper": { s: [70, 82, 76, 90, 88], h: [30, 40, false], phase: "advanced", ab: ["Monster Point", "Rumble Ball", "Médico de la tripulación", "Cambios de forma"], home: "wano" },
  "Nico Robin": { s: [64, 84, 66, 92, 98], h: [58, 70, false], phase: "advanced", ab: ["Hana Hana: brazos por todo el cuerpo", "Demonio Fleur", "Gigantesco", "Lee poneglifos"], home: "wano" },
  Franky: { s: [92, 70, 96, 88, 90], h: [60, 40, false], ab: ["Cyborg: Radical Beam", "Franky Shogun", "Constructor de barcos", "Strong Right"], home: "wano" },
  Brook: { s: [70, 92, 68, 86, 84], h: [50, 66, false], phase: "advanced", ab: ["Yomi Yomi: alma de vuelta", "Soul Solid", "Esgrima de hielo", "Música que duerme"], home: "wano" },
  Jinbe: { s: [90, 80, 92, 94, 88], h: [84, 78, false], ab: ["Karate hombre-pez", "Corriente de Mar", "Yoshi 5000 tejas", "Timonel honorable"], home: "wano" },
  "Rob Lucci": { s: [90, 96, 88, 90, 86], h: [88, 92, true], phase: "awakened", ab: ["Leopardo híbrido", "Rokuogan", "Rokushiki maestro", "Cazador del Gobierno"], home: "eniesLobby" },
  Spandam: { s: [40, 42, 40, 54, 66], h: [0, 0, false], ab: ["Latigazos con Kairoseki", "Órdenes de ejecución", "Intrigante cobarde"], home: "eniesLobby" },
  Stussy: { s: [78, 90, 74, 84, 92], h: [78, 82, false], ab: ["Rokushiki", "Doble juego de espionaje", "Lealtad incierta"], home: "eniesLobby", hidden: true },
};

/** Canon fruits that belong to actors seeded before the codex existed (all are 1-of-1 rows in the fruit catalog). */
export const FRUIT_ASSIGNMENTS: Record<string, string> = {
  "Mr. 3 (Galdino)": "Doru Doru no Mi",
  "Mr. 1 (Daz Bonez)": "Supa Supa no Mi",
  "Emporio Ivankov": "Horu Horu no Mi",
  "Basil Hawkins": "Wara Wara no Mi",
  "X Drake": "Ryu Ryu no Mi: Modelo Allosaurus",
  Kaku: "Ushi Ushi no Mi: Modelo Jirafa",
  Kalifa: "Awa Awa no Mi",
};

/** What the WorldActor.statsJson column holds (read by game/enemy-kit.ts and the codex). */
export function profileStatsJson(p: ActorProfile): string {
  const [strength, agility, durability, willpower, intellect] = p.s;
  return JSON.stringify({ strength, agility, durability, willpower, intellect, armamentHaki: p.h[0], observationHaki: p.h[1], conquerorsHaki: p.h[2], fruitPhase: p.phase ?? null });
}

import data from "./game-data.json";

export const GAME = data;
export const COUNTS = data.counts;

export const CREATOR = "Kelvin Piña";

export const MARQUEE_TOP = [
  "Sin dados",
  "Una IA arbitra cada golpe",
  "Muerte permanente",
  "Mundo vivo 24/7",
  `${COUNTS.islands} islas`,
  `${COUNTS.fruits} frutas del diablo`,
  "Guerras mundiales",
  "Duelos a muerte",
];

export const MARQUEE_BOTTOM = [
  "Tripulaciones",
  "Escenas compartidas",
  "Coliseo",
  "Den Den Mushi",
  "Impel Down",
  "Haki y Despertar",
  "Puestos de mando",
  `${COUNTS.roadPoneglyphs} Poneglifos de Ruta`,
];

export type DemoRole = "player" | "narrator" | "referee";

export interface DemoStep {
  role: DemoRole;
  text: string;
  /** The player's bars after this beat; only a player's life and stamina are ever shown, never the rival's. */
  bars?: { life: number; stamina: number };
}

/** Loguetown and its people are real: Rafael el Templado, Dorian «Sombrero» and Barthus el Cicatriz live there in the game. */
export const DEMO: { place: string; who: string; steps: DemoStep[] } = {
  place: "Loguetown",
  who: "Nivel 7 · Pirata",
  steps: [
    { role: "player", text: "Entro en La Última Botella, dejo caer una moneda de oro sobre la barra y pregunto por el hombre de la cicatriz." },
    {
      role: "narrator",
      text: "La moneda gira sobre la madera hasta que Rafael el Templado la atrapa sin mirarla. «Barthus hace la ronda de noche», murmura, señalando la puerta del fondo. Allí, Dorian «Sombrero» deja su jarra y se levanta despacio, haciendo girar un garrote que pesa demasiado para ser solo madera.",
    },
    { role: "player", text: "Desenvaino y me lanzo contra Dorian: amago alto y barrido a las piernas antes de que levante el garrote." },
    {
      role: "referee",
      text: "El amago funciona a medias: Dorian se cubre la cara y el barrido le arranca un gruñido cuando la rodilla le cede. Se rehace más rápido de lo que esperabas, escupe al suelo y alza el garrote de plomo: va a descargarlo en diagonal sobre tu hombro izquierdo.",
      bars: { life: 100, stamina: 84 },
    },
    { role: "player", text: "Ruedo hacia su lado ciego y le clavo la empuñadura en las costillas." },
    {
      role: "referee",
      text: "Ruedas, pero tarde: el garrote te roza el hombro y el brazo entero te zumba. Aun así la empuñadura encuentra sus costillas y el aire se le escapa en un silbido. Dorian retrocede un paso, pálido, buscando la puerta con la mirada.",
      bars: { life: 91, stamina: 71 },
    },
  ],
};

export const FACTION_COPY: Record<string, { name: string; tagline: string; play: string; color: string }> = {
  PIRATE: { name: "Pirata", tagline: "Libertad a cambio de tu cabeza.", play: "Tu recompensa sube con cada golpe al orden mundial. Tripulación, territorios y, algún día, el trono de Emperador.", color: "#d0553a" },
  MARINE: { name: "Marina", tagline: "Justicia absoluta, rango a rango.", play: "Méritos y ascensos. Captura piratas, manda a los peores a Impel Down y aspira a un asiento de Almirante.", color: "#5a9fd4" },
  REVOLUTIONARY: { name: "Revolucionario", tagline: "El Gobierno Mundial caerá.", play: "Sabotajes, liberaciones y guerras contra el Gobierno. Tu influencia puede llevarte al mando del Ejército.", color: "#5fc7a0" },
  BOUNTY_HUNTER: { name: "Cazarrecompensas", tagline: "Cada cartel es un sueldo.", play: "Trabajas solo, sin tripulación. Cazas por dinero y tu fama de gremio abre puertas... y enemistades.", color: "#e0b04a" },
  CP0: { name: "CP-0", tagline: "Nadie te ve llegar.", play: "Operaciones encubiertas para el Gobierno Mundial. Los mejores acaban siendo Caballeros Divinos.", color: "#a887e0" },
};

export const REVERSE_POINTS = [
  "Cada isla pide un nivel mínimo para dejarte atracar.",
  "Navegar cansa: aguante, tiempo de travesía y rutas reales entre islas.",
  "Desde nivel 20, grandes travesías a cualquier isla. Con emboscadas en alta mar.",
  "Hay islas que solo aparecen cuando baja la marea.",
];

export const PARADISE_POINTS = [
  { title: `${COUNTS.residents} habitantes`, text: "Taberneros, guardias, matones, contrabandistas... con nombre, oficio y memoria. Nadie sale de la nada." },
  { title: "Nada se deshace", text: "Si matas a alguien, no vuelve. Otro ocupará su sitio, y la isla lo recordará." },
  { title: "Misiones y contratos", text: "Cada isla tiene sus encargos, y tu bando te manda los suyos." },
  { title: "Nakamas", text: "A quien convenzas, te sigue: hasta tres compañeros que suben de nivel contigo." },
];

export const NEW_WORLD_POINTS = [
  { title: "Emperadores de verdad", text: `${data.canon.yonko.join(", ").replace(/, ([^,]*)$/, " y $1")}. Desafíalos y el trono puede ser tuyo.` },
  { title: "Asientos de mando", text: "Almirante, Almirante de Flota, Gorosei o la cúpula revolucionaria: se ganan venciendo a quien se sienta en ellos." },
  { title: "Guerras mundiales", text: "Las facciones canon se declaran la guerra solas. Cada 12 horas se libra un frente, y puedes estar en él." },
  { title: "Impel Down", text: "Seis niveles bajo el mar, sin fianza. Si te encierran ahí, tus nakamas tendrán que ir a por ti." },
];

export const SYSTEMS = [
  { key: "referee", title: "Un árbitro, no un dado", text: "Cada intercambio lo juzga una IA que conoce tu nivel, tu Haki, tu fruta, tu arma y tu cansancio. Lo que escribes cuenta." },
  { key: "death", title: "Muerte permanente", text: "Si caes y nadie te salva, se acabó. De verdad." },
  { key: "world", title: "Un mundo que no te espera", text: `${COUNTS.canon} personajes canon viajan entre islas, estallan guerras y las noticias se escriben solas, estés conectado o no.` },
  { key: "crew", title: "Tripulación de verdad", text: "Escenas compartidas por turnos, chat de tripulación, bandera propia y nakamas que crecen contigo." },
  { key: "duel", title: "Duelos entre jugadores", text: "Amistosos o a muerte. Si ganas, decides: perdonar, capturar o rematar." },
  { key: "power", title: "Poder que evoluciona", text: "Frutas por fases hasta el Despertar, técnicas que mejoran con el uso y el Haki del Rey esperando su momento." },
  { key: "denden", title: "Den Den Mushi", text: "Un canal para tu bando y otro para tu tripulación." },
  { key: "arena", title: "Coliseo y eventos", text: "Torneos cada 48 horas y pruebas para novatos con frutas únicas de premio." },
  { key: "ooc", title: "Fuera de rol", text: "Un panel para rebobinar una escena, pedir ayuda o pactar con el narrador cómo quieres jugar." },
] as const;

export const FRUIT_TYPE_LABEL: Record<string, string> = {
  PARAMECIA: "Paramecia",
  ZOAN: "Zoan",
  ZOAN_ANCIENT: "Zoan Ancestral",
  ZOAN_MYTHICAL: "Zoan Mítica",
  LOGIA: "Logia",
};

export const RARITY_LABEL: Record<string, string> = {
  COMMON: "Común",
  UNCOMMON: "Poco común",
  RARE: "Rara",
  EPIC: "Épica",
  LEGENDARY: "Legendaria",
  MYTHICAL_TIER: "Mítica",
};

export const FRUIT_COLORS: Record<string, [string, string]> = {
  PARAMECIA: ["#8e4fd0", "#3d1d68"],
  ZOAN: ["#e8862f", "#7a3a10"],
  LOGIA: ["#2f8fe0", "#0f3a6e"],
};

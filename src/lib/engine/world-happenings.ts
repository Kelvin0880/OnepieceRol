/**
 * World happenings ("Sucesos del mundo"): one new, self-contained event every 24 h, invented by the AI from the state of
 * the world (festivals, storms, discoveries, crimes, oddities...). They are colour with a real place; they never kill or
 * capture a canon character and never hand out items (the death/capture arcs in world-arcs.ts stay the only way for
 * that, with the owner's verdict). Pure: no DB, no AI.
 */
import type { Rng } from "./rng";

export const HAPPENING_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const HAPPENING_CATEGORY = "Sucesos del mundo";
export const HAPPENING_MEMORY = 10;

export interface HappeningSeed {
  kind: string;
  brief: string;
}

/** Inspiration and offline fallback: the AI is told to invent its own and only borrow the kind when it has no better idea. */
export const HAPPENING_SEEDS: HappeningSeed[] = [
  { kind: "festival", brief: "un festival local con música, comida y competiciones amistosas que llena el puerto de forasteros" },
  { kind: "tormenta", brief: "una tormenta fuera de temporada que obliga a los barcos a refugiarse y deja daños en el muelle" },
  { kind: "descubrimiento", brief: "unos pescadores sacan del fondo un objeto antiguo cubierto de inscripciones que nadie sabe leer" },
  { kind: "criatura marina", brief: "un rey marino aparece cerca de la costa y los pescadores se niegan a salir" },
  { kind: "feria", brief: "llega una feria ambulante de mercaderes con mercancías raras y precios que cambian cada hora" },
  { kind: "crimen", brief: "una banda organizada roba el cargamento de un comerciante y la ciudad pide justicia" },
  { kind: "desastre natural", brief: "un temblor agrieta calles y casas; los vecinos se organizan para reconstruir" },
  { kind: "leyenda", brief: "circula la leyenda de un tesoro escondido y medio pueblo empieza a cavar donde no debe" },
  { kind: "misterio", brief: "desaparecen faroles y campanas del puerto cada noche y nadie ve al culpable" },
  { kind: "competición", brief: "se anuncia una carrera de barcos pequeños con premio en berries abierta a cualquiera" },
  { kind: "epidemia", brief: "una fiebre extraña se extiende entre los marineros y el médico del pueblo pide hierbas raras" },
  { kind: "fenómeno", brief: "el mar brilla de noche con un resplandor azul que atrae a curiosos y a bestias" },
  { kind: "forastero", brief: "llega un viajero misterioso que dice conocer el destino de quien le invite a una copa" },
  { kind: "naufragio", brief: "un barco mercante naufraga cerca de la costa y sus restos aparecen en la playa" },
  { kind: "política", brief: "el alcalde anuncia impuestos nuevos y los ciudadanos se dividen entre protestar y callar" },
  { kind: "religión", brief: "un predicador anuncia que el mar reclamará una ofrenda y reúne a una multitud" },
  { kind: "invención", brief: "un inventor presenta una máquina asombrosa que promete cambiar la vida del puerto, si no explota antes" },
  { kind: "hambruna", brief: "la cosecha se echa a perder y los precios de la comida se disparan" },
  { kind: "huelga", brief: "los estibadores paran de trabajar hasta que se paguen los salarios atrasados" },
  { kind: "fantasma", brief: "los vecinos aseguran ver un barco fantasma que atraca de madrugada y desaparece" },
  { kind: "eclipse", brief: "un eclipse oscurece el día y los supersticiosos cierran las puertas mientras otros hacen negocio" },
  { kind: "migración", brief: "una manada enorme de bestias marinas migra cerca de la costa y altera las rutas de navegación" },
  { kind: "erupción", brief: "el volcán de la isla escupe ceniza y humo; algunos huyen y otros van a buscar minerales raros" },
  { kind: "boda", brief: "se celebra la boda de dos familias rivales y todo el mundo espera que nadie la estropee" },
  { kind: "subasta", brief: "una casa de subastas anuncia una pieza secreta y atrae a coleccionistas de todo el mar" },
  { kind: "teatro", brief: "una compañía de teatro estrena una obra sobre piratas famosos y provoca más de una discusión" },
  { kind: "pesca", brief: "un pescador captura un ejemplar gigantesco y el pueblo organiza un banquete" },
  { kind: "plaga", brief: "una plaga de ratas o de insectos invade los almacenes y se ofrecen recompensas por acabar con ella" },
  { kind: "contrabando", brief: "la Marina intensifica los controles por un rumor de contrabando y el mercado negro se esconde" },
  { kind: "recompensa local", brief: "el pueblo ofrece una recompensa por acabar con un bandido que aterroriza los caminos" },
  { kind: "mareas", brief: "las mareas se vuelven caprichosas y algunas rutas tardan el doble o el triple en recorrerse" },
  { kind: "estrella fugaz", brief: "cae una estrella fugaz en el mar y los buceadores compiten por encontrar los restos" },
  { kind: "torneo", brief: "se organiza un pequeño torneo de lucha en la plaza con premios para los mejores" },
  { kind: "duelo", brief: "dos espadachines locales anuncian un duelo por el honor de sus escuelas y el pueblo apuesta" },
  { kind: "incendio", brief: "un incendio arrasa unos almacenes y se busca al responsable entre rumores de sabotaje" },
  { kind: "huérfanos", brief: "un grupo de niños del puerto encuentra un mapa viejo y se lanza a una pequeña aventura" },
  { kind: "espías", brief: "se rumorea que espías de varias facciones se hospedan en la misma posada, cada uno vigilando a los demás" },
  { kind: "monstruo", brief: "una bestia terrestre baja de la montaña y arrasa los cultivos; se pide ayuda a los aventureros" },
  { kind: "carnaval", brief: "un carnaval de máscaras oculta identidades y provoca confusiones, romances y algún robo" },
  { kind: "reliquia", brief: "el museo local exhibe una reliquia de la era antigua y varios grupos la miran con demasiado interés" },
];

/** True when no happening has been published for a full interval (or none ever). */
export function happeningDue(lastAt: Date | null, now: Date): boolean {
  return !lastAt || now.getTime() - lastAt.getTime() >= HAPPENING_INTERVAL_MS;
}

/** Up to n seed ideas, skipping the kinds used most recently so consecutive days never feel the same. */
export function pickSeeds(rng: Rng, recentKinds: string[], n = 3): HappeningSeed[] {
  const recent = new Set(recentKinds.map((k) => k.toLowerCase()));
  const pool = HAPPENING_SEEDS.filter((s) => !recent.has(s.kind.toLowerCase()));
  const source = pool.length >= n ? pool : HAPPENING_SEEDS;
  const chosen: HappeningSeed[] = [];
  const left = [...source];
  while (chosen.length < n && left.length > 0) chosen.push(left.splice(Math.floor(rng() * left.length), 1)[0]);
  return chosen;
}

export interface Happening {
  headline: string;
  body: string;
  kind: string;
  islandName: string | null;
}

/** Reads the AI's JSON. Null when it is unusable (missing text) so the caller falls back to a seed. */
export function parseHappening(raw: string, islandNames: string[]): Happening | null {
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  const o = p as Record<string, unknown>;
  const headline = typeof o?.headline === "string" ? o.headline.trim() : "";
  const body = typeof o?.body === "string" ? o.body.trim() : "";
  if (headline.length < 8 || body.length < 60) return null;
  const wanted = typeof o.island === "string" ? o.island.trim().toLowerCase() : "";
  const islandName = islandNames.find((n) => n.toLowerCase() === wanted) ?? null;
  const kind = typeof o.kind === "string" && o.kind.trim() ? o.kind.trim().toLowerCase().slice(0, 40) : "suceso";
  return { headline: headline.slice(0, 140), body: body.slice(0, 1600), kind, islandName };
}

/** The offline version of a happening, built from a seed and an island. */
export function fallbackHappening(seed: HappeningSeed, islandName: string): Happening {
  const brief = seed.brief.charAt(0).toUpperCase() + seed.brief.slice(1);
  return {
    headline: `${islandName}: ${seed.kind}`,
    body: `${brief}. En ${islandName} no se habla de otra cosa, y los recién llegados harían bien en mantener los ojos abiertos.`,
    kind: seed.kind,
    islandName,
  };
}

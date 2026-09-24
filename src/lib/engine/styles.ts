import type { Rng } from "./rng";

/**
 * Combat styles: learnable martial arts and swordsmanship with their own mastery ladder (like Haki),
 * their own techniques, and rules about what you hold in your hands. Pure: the game layer stores
 * (styleId, mastery) per character and feeds it in here.
 */
export type StyleCategory = "Esgrima" | "Artes marciales" | "Regional" | "Gobierno" | "Marina" | "Revolucionario";
export type StyleFaction = "PIRATE" | "MARINE" | "REVOLUTIONARY" | "BOUNTY_HUNTER" | "CP0";
export type StyleAttr = "strength" | "agility" | "durability" | "willpower" | "intellect";

export interface StyleTechnique {
  name: string;
  minMastery: number;
  cost: number;
  atk: number;
  def: number;
  spd: number;
  note: string;
}

export interface StyleDef {
  id: string;
  name: string;
  category: StyleCategory;
  description: string;
  /** Bonuses at mastery 100; only half applies passively, the rest comes from using its techniques. */
  mods: { atk: number; def: number; spd: number; pierce: number };
  /** How many weapons must be wielded for the style to work (0/0 = bare hands, 0/3 = anything). */
  weapons: { min: number; max: number };
  learn?: {
    islands: string[];
    /** null = any faction. */
    factions: StyleFaction[] | null;
    minLevel: number;
    price: number;
    needs?: { attrs?: Partial<Record<StyleAttr, number>>; style?: { id: string; mastery: number } };
  };
  techniques: StyleTechnique[];
}

const T = (name: string, minMastery: number, cost: number, atk: number, def: number, spd: number, note: string): StyleTechnique => ({ name, minMastery, cost, atk, def, spd, note });

export const STYLES: StyleDef[] = [
  {
    id: "ittoryu", name: "Ittoryu (una espada)", category: "Esgrima",
    description: "Cortes concentrados, desenvaine rápido y estocadas directas con una sola hoja.",
    mods: { atk: 8, def: 2, spd: 3, pierce: 0 }, weapons: { min: 1, max: 1 },
    learn: { islands: ["Villa Shimotsuki", "Loguetown"], factions: null, minLevel: 1, price: 2_000 },
    techniques: [T("Iai Giri (desenvaine)", 0, 8, 4, 0, 2, "un corte relámpago desde la vaina"), T("Onda cortante", 40, 12, 8, 0, 0, "un tajo que viaja por el aire"), T("Corte trascendental", 80, 18, 14, 0, 2, "un solo golpe perfecto")],
  },
  {
    id: "nitoryu", name: "Nitoryu (dos espadas)", category: "Esgrima",
    description: "Dos hojas a la vez: cruces ofensivos y defensivos, con la coordinación de ambos brazos.",
    mods: { atk: 12, def: 3, spd: 3, pierce: 0 }, weapons: { min: 2, max: 2 },
    learn: { islands: ["Villa Shimotsuki", "Isla Kuraigana"], factions: null, minLevel: 6, price: 20_000, needs: { style: { id: "ittoryu", mastery: 30 } } },
    techniques: [T("Tora Gari", 0, 10, 6, 0, 0, "un doble tajo cruzado"), T("Nigiri", 40, 14, 10, 2, 0, "cortes cruzados que defienden y atacan"), T("Ryu Tsume", 75, 20, 16, 0, 2, "una tenaza de dos hojas")],
  },
  {
    id: "santoryu", name: "Santoryu (tres espadas)", category: "Esgrima",
    description: "El estilo de las tres espadas: dos en las manos y una entre los dientes, con giros que multiplican cada corte.",
    mods: { atk: 16, def: 3, spd: 4, pierce: 0 }, weapons: { min: 3, max: 3 },
    learn: { islands: ["País de Wano", "Isla Kuraigana"], factions: null, minLevel: 14, price: 80_000, needs: { style: { id: "nitoryu", mastery: 50 }, attrs: { agility: 18 } } },
    techniques: [T("Oni Giri", 0, 12, 8, 0, 0, "tres cortes cruzados en un mismo movimiento"), T("Tatsumaki", 35, 16, 12, 0, 2, "un torbellino de filo"), T("Sanzen Sekai", 65, 22, 18, 0, 0, "un tajo capaz de partir un edificio"), T("Ashura", 90, 30, 26, 0, 4, "tres brazos de sombra con tres espadas")],
  },
  {
    id: "black_leg", name: "Estilo Pierna Negra", category: "Artes marciales",
    description: "Combate solo con patadas para proteger las manos: acrobacias, velocidad y calor por fricción.",
    mods: { atk: 12, def: 2, spd: 8, pierce: 0 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Restaurante Baratie"], factions: null, minLevel: 5, price: 8_000, needs: { attrs: { agility: 12 } } },
    techniques: [T("Collier Shoot", 0, 8, 6, 0, 2, "una patada de cuello con toda la cadera"), T("Diable Jambe", 40, 14, 12, 0, 2, "la pierna en llamas por fricción"), T("Ifrit Jambe", 80, 22, 20, 0, 4, "la patada al rojo blanco")],
  },
  {
    id: "rokushiki", name: "Rokushiki (Seis Estilos)", category: "Gobierno",
    description: "La técnica de los agentes del Gobierno: Geppo, Soru, Tekkai, Rankyaku, Shigan y Kami-e; la maestra, Rokuogan.",
    mods: { atk: 8, def: 8, spd: 10, pierce: 0.05 }, weapons: { min: 0, max: 3 },
    learn: { islands: ["Enies Lobby", "Mary Geoise", "Marineford"], factions: ["CP0", "MARINE"], minLevel: 12, price: 50_000 },
    techniques: [T("Soru (afeitado)", 0, 8, 0, 0, 6, "desplazarse a velocidad invisible"), T("Geppo (paseo lunar)", 10, 8, 0, 2, 5, "patear el aire para saltar"), T("Tekkai (cuerpo de hierro)", 25, 10, 0, 10, 0, "endurecer el cuerpo como acero"), T("Rankyaku (pierna torbellino)", 40, 12, 10, 0, 0, "una patada que lanza filos de aire"), T("Shigan (pistola digital)", 60, 14, 12, 0, 2, "una estocada de dedo que perfora"), T("Rokuogan (pistola de los seis reyes)", 90, 28, 26, 0, 0, "una onda de choque interna")],
  },
  {
    id: "marine_fencing", name: "Esgrima Marina", category: "Marina",
    description: "La esgrima reglamentaria: cortes precisos y brutales con espadas de ordenanza.",
    mods: { atk: 8, def: 4, spd: 3, pierce: 0 }, weapons: { min: 1, max: 1 },
    learn: { islands: ["Cuartel Marine G-5", "Marineford"], factions: ["MARINE"], minLevel: 3, price: 5_000 },
    techniques: [T("Corte de ordenanza", 0, 8, 4, 2, 0, "un tajo limpio de manual"), T("Estocada naval", 40, 12, 9, 0, 2, "una estocada de abordaje"), T("Formación de asalto", 75, 16, 12, 6, 0, "cortes coordinados de escuadra")],
  },
  {
    id: "battleship_fist", name: "Puño del Acorazado", category: "Marina",
    description: "Golpear casco de barco hasta que las manos desnudas rompan casi cualquier cosa. Sin armas.",
    mods: { atk: 12, def: 8, spd: 0, pierce: 0.05 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Cuartel Marine G-5", "Marineford"], factions: ["MARINE"], minLevel: 8, price: 15_000, needs: { attrs: { strength: 16 } } },
    techniques: [T("Puño del amor", 0, 10, 8, 0, 0, "un puñetazo que hunde cascos"), T("Puño de meteorito", 45, 16, 14, 0, 0, "una lluvia de puños"), T("Impacto acorazado", 80, 24, 22, 4, 0, "el golpe que hunde un barco")],
  },
  {
    id: "ryusoken", name: "Ryusoken (garra de dragón)", category: "Revolucionario",
    description: "Puño en forma de garra que destroza el núcleo de armaduras, rocas y armas.",
    mods: { atk: 10, def: 4, spd: 4, pierce: 0.2 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Isla Baltigo"], factions: ["REVOLUTIONARY"], minLevel: 14, price: 40_000, needs: { attrs: { strength: 20 } } },
    techniques: [T("Garra de dragón", 0, 10, 8, 0, 0, "tres dedos que se cierran sobre el punto débil"), T("Ryusoken: Ruptura", 45, 16, 14, 0, 0, "destrozar una armadura de un agarre"), T("Ryusoken: Núcleo", 80, 24, 22, 0, 2, "romper el corazón de la defensa rival")],
  },
  {
    id: "newkama_kenpo", name: "Newkama Kenpo", category: "Revolucionario",
    description: "El arte del Reino Kamabakka: golpes de palma, presión de aire y gracia sorprendente.",
    mods: { atk: 8, def: 3, spd: 8, pierce: 0.05 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Isla Baltigo"], factions: ["REVOLUTIONARY"], minLevel: 8, price: 18_000 },
    techniques: [T("Hell Wink", 0, 8, 6, 0, 2, "un guiño que dispara presión de aire"), T("Golpe de palma", 40, 12, 10, 0, 2, "una palma que resuena por dentro"), T("Baile del reino", 75, 18, 14, 4, 6, "una coreografía de golpes")],
  },
  {
    id: "gyojin_karate", name: "Karate Hombre-Pez", category: "Regional",
    description: "Controla el agua del ambiente y del cuerpo rival: la onda viaja por el vapor y golpea por dentro.",
    mods: { atk: 10, def: 6, spd: 2, pierce: 0.15 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Isla Gyojin"], factions: null, minLevel: 15, price: 40_000, needs: { attrs: { willpower: 10 } } },
    techniques: [T("Uchimizu", 0, 10, 8, 0, 0, "una onda que atraviesa el aire húmedo"), T("Karakusagawara Seiken", 45, 16, 14, 0, 0, "un golpe que estalla en el agua interior"), T("Murasame", 80, 22, 20, 2, 0, "una lluvia de golpes de agua")],
  },
  {
    id: "hasshoken", name: "Hasshoken (ocho impactos)", category: "Regional",
    description: "Ondas de vibración que atraviesan escudos y armaduras y destrozan el interior del objetivo.",
    mods: { atk: 12, def: 2, spd: 2, pierce: 0.25 }, weapons: { min: 0, max: 0 },
    learn: { islands: ["Isla Gyojin"], factions: null, minLevel: 20, price: 60_000, needs: { attrs: { strength: 25 } } },
    techniques: [T("Impacto vibrante", 0, 12, 10, 0, 0, "una onda que ignora el blindaje"), T("Ocho impactos", 50, 18, 16, 0, 0, "ocho golpes que sacuden el interior"), T("Rebote de ondas", 85, 26, 24, 0, 0, "una onda que rebota dentro del cuerpo")],
  },
  {
    id: "electro", name: "Electro (tribu Mink)", category: "Regional",
    description: "Descargas eléctricas por el pelaje, las garras o el arma. Con luna llena, la forma Sulong.",
    mods: { atk: 8, def: 2, spd: 8, pierce: 0 }, weapons: { min: 0, max: 3 },
    learn: { islands: ["Zou"], factions: null, minLevel: 12, price: 30_000, needs: { attrs: { willpower: 12 } } },
    techniques: [T("Electro", 0, 10, 8, 0, 2, "una descarga en el golpe"), T("Descarga en cadena", 40, 14, 12, 0, 2, "un arco eléctrico entre varios"), T("Sulong", 70, 26, 20, 4, 8, "la transformación de la luna llena")],
  },
  {
    id: "kitsunebi_ryu", name: "Kitsunebi-ryu (fuego de zorro)", category: "Regional",
    description: "Esgrima de Wano que corta y prende: llamas en la hoja y disipación de fuego rival.",
    mods: { atk: 10, def: 4, spd: 2, pierce: 0 }, weapons: { min: 1, max: 1 },
    learn: { islands: ["País de Wano"], factions: null, minLevel: 18, price: 70_000, needs: { style: { id: "ittoryu", mastery: 40 } } },
    techniques: [T("Corte de zorro", 0, 10, 8, 0, 0, "un tajo con llama en el filo"), T("Zorro de fuego", 45, 16, 12, 6, 0, "cortar y disipar el fuego rival"), T("Cien llamas", 80, 24, 20, 2, 2, "una tormenta de tajos ardientes")],
  },
  {
    id: "dial_combat", name: "Combate con Dials", category: "Regional",
    description: "Conchas de Skypiea integradas en guantes, patines y escudos: impacto, rechazo, fuego y filo.",
    mods: { atk: 6, def: 6, spd: 4, pierce: 0.05 }, weapons: { min: 0, max: 3 },
    learn: { islands: ["Skypiea"], factions: null, minLevel: 10, price: 25_000 },
    techniques: [T("Impact Dial", 0, 10, 8, 0, 0, "acumular un golpe en la concha"), T("Reject Dial", 40, 14, 6, 10, 0, "devolver un golpe recibido"), T("Flame y Axe Dial", 70, 20, 16, 0, 2, "fuego y filo combinados")],
  },
  {
    id: "rapier", name: "Esgrima de estocada", category: "Esgrima",
    description: "Esgrima elegante y rápida a la europea: estocadas veloces y saltos de mucha altura.",
    mods: { atk: 8, def: 2, spd: 8, pierce: 0.05 }, weapons: { min: 1, max: 1 },
    learn: { islands: ["Dressrosa"], factions: null, minLevel: 10, price: 30_000, needs: { attrs: { agility: 14 } } },
    techniques: [T("Kenbishi", 0, 8, 6, 0, 2, "una estocada en cadena"), T("Hakuba", 45, 14, 10, 0, 4, "una carga de caballo blanco"), T("Danza de la espada", 80, 22, 18, 2, 6, "un ballet de estocadas")],
  },

  // ---------- Solo personajes (no se aprenden) ----------
  { id: "hachi_ryu", name: "Hachi-ryu (ocho espadas)", category: "Esgrima", description: "Ocho espadas con ocho tentáculos.", mods: { atk: 16, def: 4, spd: 4, pierce: 0 }, weapons: { min: 0, max: 3 }, techniques: [T("Ocho espadas", 0, 12, 12, 2, 2, "ocho cortes a la vez")] },
  { id: "jyu_ryu", name: "Jyu-ryu (diez espadas)", category: "Esgrima", description: "Diez o más espadas manejadas con brazos y cabello.", mods: { atk: 14, def: 4, spd: 4, pierce: 0 }, weapons: { min: 0, max: 3 }, techniques: [T("Lluvia de hojas", 0, 12, 12, 2, 2, "una tormenta de filos")] },
  { id: "oden_nitoryu", name: "Oden Nitoryu", category: "Regional", description: "Dos espadas pesadas que canalizan Haki de Armamento avanzado.", mods: { atk: 18, def: 4, spd: 2, pierce: 0.1 }, weapons: { min: 0, max: 3 }, techniques: [T("Enma y Ame no Habakiri", 0, 20, 16, 2, 0, "dos hojas y todo el Haki")] },
  { id: "zatoichi", name: "Esgrima ciega (Zatoichi)", category: "Esgrima", description: "Espada envainada y bastón: desenvainar a la inversa e inducir gravedad.", mods: { atk: 12, def: 6, spd: 4, pierce: 0.05 }, weapons: { min: 0, max: 3 }, techniques: [T("Corte inverso", 0, 12, 10, 4, 0, "envainar mientras cae el golpe")] },
  { id: "tekkai_kenpo", name: "Tekkai Kenpo", category: "Gobierno", description: "El Tekkai en movimiento, combinado con boxeo y kung fu.", mods: { atk: 10, def: 12, spd: 4, pierce: 0 }, weapons: { min: 0, max: 0 }, techniques: [T("Tekkai en movimiento", 0, 12, 8, 10, 0, "golpear con el cuerpo de acero")] },
  { id: "jao_kun_do", name: "Jao Kun Do", category: "Regional", description: "Boxeo explosivo con hombros modificados y brazos largos: golpes que estallan como un cañón.", mods: { atk: 14, def: 2, spd: 4, pierce: 0.05 }, weapons: { min: 0, max: 0 }, techniques: [T("Impacto neumático", 0, 12, 10, 0, 2, "un golpe con articulación doble")] },
];

const BY_ID = new Map(STYLES.map((s) => [s.id, s]));
export function getStyle(id: string): StyleDef | undefined {
  return BY_ID.get(id);
}
export function learnableStyles(): StyleDef[] {
  return STYLES.filter((s) => s.learn);
}

export const TIER_NAMES = ["Iniciado", "Practicante", "Adepto", "Maestro", "Gran Maestro"] as const;
export function styleTier(mastery: number): { index: number; name: (typeof TIER_NAMES)[number]; next: number | null } {
  const cuts = [0, 20, 45, 70, 90];
  let index = 0;
  for (let i = 0; i < cuts.length; i++) if (mastery >= cuts[i]) index = i;
  return { index, name: TIER_NAMES[index], next: cuts[index + 1] ?? null };
}

export interface KnownStyle {
  id: string;
  mastery: number;
}

export type LearnCheck = { ok: true } | { ok: false; reason: string };

export function canLearnStyle(
  def: StyleDef,
  who: { faction: string; level: number; berries: number; islandName: string; attrs: Record<StyleAttr, number>; known: KnownStyle[] }
): LearnCheck {
  if (!def.learn) return { ok: false, reason: "Este estilo no se enseña: solo lo dominan ciertos personajes." };
  const l = def.learn;
  if (who.known.some((k) => k.id === def.id)) return { ok: false, reason: "Ya conoces este estilo." };
  if (!l.islands.includes(who.islandName)) return { ok: false, reason: `Aquí nadie lo enseña. Se aprende en: ${l.islands.join(", ")}.` };
  if (l.factions && !l.factions.includes(who.faction as StyleFaction)) return { ok: false, reason: "Tu facción no tiene acceso a esta escuela." };
  if (who.level < l.minLevel) return { ok: false, reason: `Necesitas nivel ${l.minLevel}.` };
  for (const [k, min] of Object.entries(l.needs?.attrs ?? {})) {
    if (who.attrs[k as StyleAttr] < (min as number)) return { ok: false, reason: `Necesitas ${ATTR_LABEL[k as StyleAttr]} ${min}.` };
  }
  const req = l.needs?.style;
  if (req) {
    const have = who.known.find((k) => k.id === req.id);
    if (!have || have.mastery < req.mastery) return { ok: false, reason: `Antes debes dominar ${getStyle(req.id)?.name ?? req.id} al menos al ${req.mastery}%.` };
  }
  if (who.berries < l.price) return { ok: false, reason: `La matrícula cuesta ฿ ${l.price.toLocaleString("es-ES")}.` };
  return { ok: true };
}

const ATTR_LABEL: Record<StyleAttr, string> = { strength: "Fuerza", agility: "Agilidad", durability: "Resistencia", willpower: "Voluntad", intellect: "Intelecto" };

export const STARTING_MASTERY = 5;

/** Does the style work with this many weapons in hand? */
export function styleApplies(def: StyleDef, wielded: number): boolean {
  return wielded >= def.weapons.min && wielded <= def.weapons.max;
}

/** The style shaping passive bonuses right now: the chosen one if it applies, otherwise the strongest that does. */
export function activeStyle(known: KnownStyle[], wielded: number, focusId?: string | null): { def: StyleDef; mastery: number } | null {
  const usable = known.flatMap((k) => {
    const def = getStyle(k.id);
    return def && styleApplies(def, wielded) ? [{ def, mastery: k.mastery }] : [];
  });
  if (usable.length === 0) return null;
  const chosen = focusId ? usable.find((u) => u.def.id === focusId) : undefined;
  if (chosen) return chosen;
  return usable.sort((a, b) => b.mastery * (b.def.mods.atk + 1) - a.mastery * (a.def.mods.atk + 1))[0];
}

export interface StyleMods {
  atk: number;
  def: number;
  spd: number;
  pierce: number;
}

/** The always-on half of a style, scaled by how well it is mastered. */
export function passiveMods(def: StyleDef, mastery: number): StyleMods {
  const k = (Math.max(0, Math.min(100, mastery)) / 100) * 0.5;
  return { atk: Math.round(def.mods.atk * k), def: Math.round(def.mods.def * k), spd: Math.round(def.mods.spd * k), pierce: Math.round(def.mods.pierce * k * 100) / 100 };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export interface StyleUse {
  styleId: string;
  styleName: string;
  technique: string;
  atk: number;
  def: number;
  spd: number;
  cost: number;
  /** Set when the player named a technique they have not unlocked: they fall back to the best they can do. */
  fallbackNote?: string;
}

/**
 * The technique the player's text calls for. A named technique that is unlocked is used; a named one that is not
 * gets the best unlocked one instead (with a note for the narrator); no name means the strongest unlocked one.
 */
export function chooseTechnique(def: StyleDef, mastery: number, text: string): StyleUse {
  const unlocked = def.techniques.filter((t) => t.minMastery <= mastery);
  const best = unlocked[unlocked.length - 1] ?? def.techniques[0];
  const lower = norm(text);
  const named = def.techniques.find((t) => {
    const key = norm(t.name).replace(/\(.*\)/, "").trim();
    return key.length > 2 && lower.includes(key);
  });
  let chosen = best;
  let fallbackNote: string | undefined;
  if (named) {
    if (named.minMastery <= mastery) chosen = named;
    else fallbackNote = `todavía no domina ${named.name}: lo intenta con lo que sí sabe`;
  }
  return { styleId: def.id, styleName: def.name, technique: chosen.name, atk: chosen.atk, def: chosen.def, spd: chosen.spd, cost: chosen.cost, fallbackNote };
}

/** Which known style the text is about (a technique or style name), else the active one. */
export function styleForText(known: KnownStyle[], text: string, wielded: number, focusId?: string | null): { def: StyleDef; mastery: number } | null {
  const lower = norm(text);
  for (const k of known) {
    const def = getStyle(k.id);
    if (!def || !styleApplies(def, wielded)) continue;
    const short = norm(def.name).replace(/\(.*\)/, "").trim();
    if ((short.length > 3 && lower.includes(short)) || def.techniques.some((t) => lower.includes(norm(t.name).replace(/\(.*\)/, "").trim()))) return { def, mastery: k.mastery };
  }
  return activeStyle(known, wielded, focusId);
}

/** Weapons in the off hands: without the matching style the extra blades are clumsy; with it they approach full value. */
export function wieldedAttackBonus(bonuses: number[], slotsSkilled: number, mastery: number): number {
  const sorted = [...bonuses].sort((a, b) => b - a).slice(0, 3);
  let total = 0;
  sorted.forEach((b, i) => {
    if (i === 0) total += b;
    else if (i < slotsSkilled) total += Math.round(b * (0.5 + 0.5 * (Math.max(0, Math.min(100, mastery)) / 100)));
    else total += Math.round(b * 0.25);
  });
  return total;
}

export function trainStyleMastery(rng: Rng, mastery: number, willpower: number, level: number): number {
  if (mastery >= 100) return 0;
  const base = 3 + willpower * 0.08 + level * 0.1;
  const gain = Math.max(1, Math.round(base * (1 - mastery / 125)) + (rng() < 0.3 ? 1 : 0));
  return Math.min(gain, 100 - mastery);
}

export function styleGrowthFromUse(rng: Rng, mastery: number): number {
  if (mastery >= 100) return 0;
  return rng() < 0.3 * (1 - mastery / 130) ? 1 : 0;
}

/** One block of text for the narrator: what styles the character really knows, at what level, with which techniques. */
export function describeStyles(known: KnownStyle[], wielded: number, wieldedNames: string[]): string {
  const weapons = wieldedNames.length ? `empuña ${wieldedNames.join(" + ")}` : "no empuña ninguna arma";
  if (known.length === 0) return `${weapons}; sin estilo de combate aprendido (pelea de forma básica: no inventes técnicas de estilo)`;
  const parts = known.flatMap((k) => {
    const def = getStyle(k.id);
    if (!def) return [];
    const unlocked = def.techniques.filter((t) => t.minMastery <= k.mastery).map((t) => t.name);
    const ok = styleApplies(def, wielded) ? "" : " [NO aplicable con lo que empuña ahora]";
    return [`${def.name} — ${styleTier(k.mastery).name} (${k.mastery}/100)${ok}, técnicas: ${unlocked.join(", ")}`];
  });
  return `${weapons}; estilos: ${parts.join(" | ")}`;
}

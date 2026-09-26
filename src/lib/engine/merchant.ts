import { specialtyIdsFor } from "./inventory";

/**
 * Every island's merchant sells what makes sense THERE: a fishing village has bandages and rations, a shipwright city has
 * cannons, only the ports at the entrance of the Grand Line sell a Log Pose, and the shady corners sell forged papers.
 * Communication snails are not for sale in shops at all (the black market keeps the rare ones). Pure data + rules.
 */
export interface MerchantStock {
  items: string[];
  weapons: string[];
  title: string;
}

const ESSENTIALS = ["vendaje", "racion"];

/** Places big enough (or wild enough) to have a tavern's worth of drink. */
const TAVERN_ISLANDS = new Set([
  "Pueblo Foosha", "Cuartel Marine G-5", "Villa Shimotsuki", "Restaurante Baratie", "Loguetown", "Orange Town", "Villa Syrup", "Whisky Peak", "Jaya",
  "Water 7", "Alabasta", "Archipiélago Sabaody", "Dressrosa", "Whole Cake Island", "Marineford", "Nuevo Marineford", "País de Wano", "Long Ring Long Land", "Thriller Bark",
]);
/** Where a serious medic or a barracks sells field kits. */
const MEDIC_ISLANDS = new Set(["Cuartel Marine G-5", "Loguetown", "G-8 Navarone", "Marineford", "Nuevo Marineford", "Water 7", "Alabasta", "Isla Drum", "Dressrosa", "Archipiélago Sabaody", "Isla Baltigo", "Reino Kamabakka", "Enies Lobby", "Isla Egghead"]);
/** The Log Pose is sold where the Grand Line begins or where sailors resupply. */
const LOGPOSE_ISLANDS = new Set(["Loguetown", "Reverse Mountain", "Jaya", "Water 7", "Archipiélago Sabaody", "Dressrosa"]);
/** Shady corners: forged papers and treasure maps. */
const SHADY_ISLANDS = new Set(["Jaya", "Archipiélago Sabaody", "Long Ring Long Land", "Whisky Peak", "Orange Town", "Villa Syrup", "Isla Gecko"]);
const MAP_ISLANDS = new Set(["Loguetown", "Jaya", "Whisky Peak", "Water 7", "Little Garden", "Archipiélago Sabaody"]);
const RELIC_ISLANDS = new Set(["Ohara", "Alabasta", "Skypiea", "Zou", "Elbaf"]);
/** Islands where nobody runs a shop at all: the wild, the government's prison, the world's end. */
const NO_MERCHANT = new Set(["Impel Down", "Laugh Tale", "Isla Abismo", "Mary Geoise", "Reverse Mountain", "Little Garden", "Isla Kuraigana"]);

/** Ordinary weapons by what the place makes or needs. */
const WEAPONS_BY_ISLAND: Record<string, string[]> = {
  "Pueblo Foosha": ["Bo de combate", "Hacha de leñador", "Espada de acero"],
  "Cuartel Marine G-5": ["Espada de acero", "Pistola de chispa", "Sable de abordaje"],
  "Isla Baltigo": ["Nudillos de hierro", "Bo de combate", "Arco largo"],
  "Isla Gecko": ["Pistola de chispa", "Arco largo", "Nudillos de hierro"],
  "Villa Shimotsuki": ["Espada de acero", "Bo de combate"],
  "Restaurante Baratie": ["Sable de abordaje", "Hacha de leñador"],
  "Loguetown": ["Espada de acero", "Pistola de chispa", "Sable de abordaje", "Cañón de mano"],
  "Orange Town": ["Pistola de chispa", "Sable de abordaje"],
  "Villa Syrup": ["Bo de combate", "Espada de acero"],
  "Tequila Wolf": ["Pistola de chispa", "Nudillos de hierro"],
  "Whisky Peak": ["Espada de acero", "Pistola de chispa"],
  "Jaya": ["Pistola de chispa", "Sable de abordaje", "Nudillos de hierro"],
  "G-8 Navarone": ["Cañón de mano", "Espada de acero", "Pistola de chispa"],
  "Isla Drum": ["Hacha de leñador", "Bo de combate"],
  "Long Ring Long Land": ["Nudillos de hierro", "Bo de combate"],
  "Alabasta": ["Sable de abordaje", "Espada de acero", "Arco largo"],
  "Reino Kamabakka": ["Nudillos de hierro", "Bo de combate"],
  "Water 7": ["Cañón de mano", "Pistola de chispa", "Hacha de leñador", "Espada de acero"],
  "Skypiea": ["Arco largo", "Bo de combate"],
  "Archipiélago Sabaody": ["Tridente gyojin", "Pistola de chispa", "Sable de abordaje"],
  "Isla Gyojin": ["Tridente gyojin"],
  "Zou": ["Arco largo", "Hacha de leñador"],
  "Dressrosa": ["Espada de acero", "Sable de abordaje", "Pistola de chispa"],
  "Punk Hazard": ["Cañón de mano"],
  "Marineford": ["Espada de acero", "Cañón de mano", "Pistola de chispa"],
  "Nuevo Marineford": ["Espada de acero", "Cañón de mano", "Pistola de chispa"],
  "País de Wano": ["Espada de acero", "Arco largo", "Bo de combate"],
  "Elbaf": ["Hacha de leñador"],
  "Whole Cake Island": ["Espada de acero", "Pistola de chispa"],
};

export function merchantStock(islandName: string, dangerLevel: number): MerchantStock {
  if (NO_MERCHANT.has(islandName)) return { items: [], weapons: [], title: "Sin mercader: nadie comercia aquí" };
  const items = [...ESSENTIALS];
  if (TAVERN_ISLANDS.has(islandName)) items.push("sake");
  if (MEDIC_ISLANDS.has(islandName)) items.push("botiquin");
  if (LOGPOSE_ISLANDS.has(islandName)) items.push("logpose");
  if (MAP_ISLANDS.has(islandName)) items.push("mapa");
  if (SHADY_ISLANDS.has(islandName)) items.push("papeles");
  if (RELIC_ISLANDS.has(islandName)) items.push("reliquia");
  if (islandName === "Isla Drum") items.push("elixir");
  for (const id of specialtyIdsFor(islandName)) if (!items.includes(id)) items.push(id);
  const weapons = WEAPONS_BY_ISLAND[islandName] ?? (dangerLevel >= 6 ? ["Espada de acero", "Pistola de chispa"] : ["Espada de acero", "Bo de combate"]);
  const title = SHADY_ISLANDS.has(islandName) ? "Puesto del mercado (con trastienda)" : MEDIC_ISLANDS.has(islandName) && /Marine|Navarone|Marineford/.test(islandName) ? "Intendencia del cuartel" : dangerLevel >= 7 ? "Buhonero de ruta peligrosa" : "Mercader del puerto";
  return { items, weapons, title };
}

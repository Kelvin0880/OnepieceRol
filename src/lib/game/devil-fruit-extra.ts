import { FruitType, Rarity } from "@prisma/client";
import type { DevilFruitCatalogEntry } from "./devil-fruit-catalog";

/** Canon signature fruits added with the character codex (2026-09-24). Every one is a 1-of-1, tied to its canon holder when that holder exists in the world. */
export const EXTRA_FRUITS: DevilFruitCatalogEntry[] = [
  { name: "Gura Gura no Mi", englishName: "Tremor-Tremor Fruit", type: FruitType.PARAMECIA, rarity: Rarity.MYTHICAL_TIER, description: "Genera terremotos con cada golpe: puede resquebrajar el aire, el mar y el propio mundo.", effects: { category: "offensive", atk: 55, spd: 5, awakened: { atk: 20, note: "El temblor se propaga a todo lo que toca" } }, isSingleton: true },
  { name: "Nikyu Nikyu no Mi", englishName: "Paw-Paw Fruit", type: FruitType.PARAMECIA, rarity: Rarity.LEGENDARY, description: "Repele cualquier cosa que toquen sus palmas, incluso el dolor o la distancia misma.", effects: { category: "utility", atk: 20, def: 20, spd: 20 }, isSingleton: true },
  { name: "Ori Ori no Mi", englishName: "Cage-Cage Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Encierra al rival en grilletes y jaulas de hierro que se cierran alrededor de su cuerpo.", effects: { category: "control", atk: 8, def: 12 }, isSingleton: true },
  { name: "Soru Soru no Mi", englishName: "Soul-Soul Fruit", type: FruitType.PARAMECIA, rarity: Rarity.MYTHICAL_TIER, description: "Arranca y manipula almas: da vida a objetos y a homies, y roba años de vida.", effects: { category: "control", atk: 28, def: 16, awakened: { atk: 12, note: "Sus homies dominan el entorno" } }, isSingleton: true },
  { name: "Pero Pero no Mi", englishName: "Candy-Candy Fruit", type: FruitType.PARAMECIA, rarity: Rarity.EPIC, description: "Convierte su saliva en caramelo duro y adhesivo con el que inmoviliza y forja armas.", effects: { category: "control", atk: 14, def: 10 }, isSingleton: true },
  { name: "Bisu Bisu no Mi", englishName: "Biscuit-Biscuit Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Crea y moldea galleta dura como el acero, con la que fabrica armas y ejércitos.", effects: { category: "offensive", atk: 14, def: 10 }, isSingleton: true },
  { name: "Shibo Shibo no Mi", englishName: "Wring-Wring Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Exprime cualquier cuerpo hasta secarlo, arrancándole sus fluidos y su fuerza.", effects: { category: "offensive", atk: 16, def: 8 }, isSingleton: true },
  { name: "Ryu Ryu no Mi: Modelo Brachiosaurus", englishName: "Dragon-Dragon Fruit: Brachiosaurus", type: FruitType.ZOAN_ANCIENT, rarity: Rarity.EPIC, description: "Forma híbrida de un saurópodo colosal: un cuello que golpea como una maza y un cuerpo casi indestructible.", effects: { category: "transformation", atk: 24, def: 22, spd: -4, awakened: { atk: 16, note: "Tamaño y peso descomunales" } }, isSingleton: true },
  { name: "Zou Zou no Mi: Modelo Mamut", englishName: "Elephant-Elephant Fruit: Mammoth", type: FruitType.ZOAN_ANCIENT, rarity: Rarity.EPIC, description: "Un mamut colosal, tan pesado como imparable, que aplasta lo que cae bajo sus patas.", effects: { category: "transformation", atk: 26, def: 20, spd: -2, awakened: { atk: 14, note: "Forma ancestral completa" } }, isSingleton: true },
  { name: "Ryu Ryu no Mi: Modelo Pachycephalosaurus", englishName: "Dragon-Dragon Fruit: Pachycephalosaurus", type: FruitType.ZOAN_ANCIENT, rarity: Rarity.RARE, description: "Cráneo de piedra y una embestida de cabeza capaz de quebrar muros.", effects: { category: "transformation", atk: 18, def: 16, spd: 4 }, isSingleton: true },
  { name: "Ryu Ryu no Mi: Modelo Allosaurus", englishName: "Dragon-Dragon Fruit: Allosaurus", type: FruitType.ZOAN_ANCIENT, rarity: Rarity.RARE, description: "Un depredador ancestral de mandíbulas enormes: velocidad y mordida devastadoras.", effects: { category: "transformation", atk: 20, def: 10, spd: 12 }, isSingleton: true },
  { name: "Ushi Ushi no Mi: Modelo Jirafa", englishName: "Cow-Cow Fruit: Giraffe", type: FruitType.ZOAN, rarity: Rarity.UNCOMMON, description: "Alcance y patadas de jirafa: un cuello largo y golpes desde donde nadie espera.", effects: { category: "transformation", atk: 12, def: 6, spd: 10 }, isSingleton: true },
  { name: "Dia Dia no Mi", englishName: "Diamond Fruit", type: FruitType.PARAMECIA, rarity: Rarity.EPIC, description: "Convierte el cuerpo en diamante, casi indestructible, a costa de algo de velocidad.", effects: { category: "defensive", atk: 14, def: 26, spd: -6 }, isSingleton: true },
  { name: "Baku Baku no Mi", englishName: "Munch-Munch Fruit", type: FruitType.PARAMECIA, rarity: Rarity.UNCOMMON, description: "Devora cualquier cosa y fusiona lo comido con su propio cuerpo.", effects: { category: "utility", atk: 10, def: 8 }, isSingleton: true },
  { name: "Bane Bane no Mi", englishName: "Spring-Spring Fruit", type: FruitType.PARAMECIA, rarity: Rarity.UNCOMMON, description: "Convierte sus piernas y brazos en muelles: saltos, rebotes y golpes en cadena.", effects: { category: "offensive", atk: 10, spd: 8 }, isSingleton: true },
  { name: "Shiro Shiro no Mi", englishName: "Castle-Castle Fruit", type: FruitType.PARAMECIA, rarity: Rarity.EPIC, description: "Un castillo viviente dentro de su cuerpo, con armas, ejército y refugio propio.", effects: { category: "defensive", atk: 12, def: 20 }, isSingleton: true },
  { name: "Oto Oto no Mi", englishName: "Sound-Sound Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Ondas de sonido que lo transforman en un arma: golpes de vibración y notas que desorientan.", effects: { category: "control", atk: 12, spd: 6 }, isSingleton: true },
  { name: "Doru Doru no Mi", englishName: "Wax-Wax Fruit", type: FruitType.PARAMECIA, rarity: Rarity.UNCOMMON, description: "Cera endurecible con la que fabrica armas, muros y trampas.", effects: { category: "utility", atk: 8, def: 8 }, isSingleton: true },
  { name: "Horu Horu no Mi", englishName: "Hormone-Hormone Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Hormonas a voluntad: cura, transforma y altera cuerpos.", effects: { category: "utility", atk: 8, def: 10, spd: 6 }, isSingleton: true },
  { name: "Wara Wara no Mi", englishName: "Straw-Straw Fruit", type: FruitType.PARAMECIA, rarity: Rarity.RARE, description: "Su cuerpo de paja transfiere el daño recibido a un muñeco y a quien lo golpea.", effects: { category: "defensive", atk: 10, def: 20 }, isSingleton: true },
  { name: "Awa Awa no Mi", englishName: "Bubble-Bubble Fruit", type: FruitType.PARAMECIA, rarity: Rarity.UNCOMMON, description: "Burbujas de jabón que dejan todo resbaladizo, limpio... y sin fuerzas.", effects: { category: "control", atk: 6, def: 8 }, isSingleton: true },
  { name: "Inu Inu no Mi: Modelo Lobo", englishName: "Dog-Dog Fruit: Wolf", type: FruitType.ZOAN, rarity: Rarity.UNCOMMON, description: "Transformación en lobo: olfato, velocidad y una mordida certera.", effects: { category: "transformation", atk: 12, spd: 12 }, isSingleton: true },
  { name: "Yuki Yuki no Mi", englishName: "Snow-Snow Fruit", type: FruitType.LOGIA, rarity: Rarity.LEGENDARY, description: "Cuerpo y control de la nieve y la ventisca; congela con un aliento.", effects: { category: "offensive", element: "nieve", atk: 20, def: 8, logiaIntangible: true }, isSingleton: true },
];

/** Older catalog entries that turned out to be a canon character's signature fruit: locked to that holder from now on. */
export const SINGLETON_OVERRIDES = new Set([
  "Hie Hie no Mi",
  "Doku Doku no Mi",
  "Tori Tori no Mi: Modelo Fénix",
  "Bari Bari no Mi",
  "Supa Supa no Mi",
  "Woshu Woshu no Mi",
  "Mane Mane no Mi",
  "Sube Sube no Mi",
  "Kage Kage no Mi",
  "Uo Uo no Mi: Modelo Seiryu",
  "Ryu Ryu no Mi: Modelo Pteranodon",
  "Inu Inu no Mi: Modelo Okuchi no Makami",
  "Nagi Nagi no Mi",
  "Doa Doa no Mi",
]);

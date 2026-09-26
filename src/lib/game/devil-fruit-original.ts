import { FruitType, Rarity } from "@prisma/client";
import type { DevilFruitCatalogEntry } from "./devil-fruit-catalog";

/** Original 1-of-1 fruits made by the owner's request (never dropped, never in shops or enemy kits): handed out by hand. */
export const ORIGINAL_FRUITS: DevilFruitCatalogEntry[] = [
  {
    name: "Tsuki Tsuki no Mi",
    englishName: "Moon-Moon Fruit",
    type: FruitType.LOGIA,
    rarity: Rarity.LEGENDARY,
    description:
      "Fruta Logia lunar: su cuerpo se vuelve luz de luna y polvo plateado. Puede disparar haces lunares cortantes, teñir de plata todo lo que toca y cargar de peso lunar o aligerar (gravedad lunar) a quien está cerca; sus mareas tiran del agua y de los cuerpos. Su poder crece de noche y bajo luna llena; en un día nublado o de luna nueva es mucho más débil. Al ser Logia, los golpes normales lo atraviesan: solo el Haki de Armadura lo hiere. El agua de mar y el Kairoseki lo anulan como a toda fruta.",
    effects: {
      category: "offensive",
      element: "luz lunar",
      atk: 24,
      def: 10,
      spd: 10,
      logiaIntangible: true,
      awakened: { atk: 12, note: "Su luna cubre toda la isla: la gravedad y las mareas obedecen a su voluntad" },
    },
    isSingleton: true,
  },
];

import { FruitType } from "@prisma/client";
import { fruitMaker } from "./devil-fruit-builder";

const logia = fruitMaker(FruitType.LOGIA);

/**
 * Original Logia fruits. Every one is a 1-of-1 (the body IS the element, so only Armament Haki hurts it, see LOGIA_RULE),
 * never dropped, never in shops: they are found through events or handed out by the owner.
 */
export const INVENTED_LOGIA = [
  logia("Kaze Kaze no Mi", "Wind-Wind Fruit", "LEGENDARY", "Su cuerpo es viento: vuela, corta con hojas de aire y desvía proyectiles con un vendaval. El Haki de Armadura lo alcanza, y en el vacío o en una cámara cerrada no tiene aire con el que jugar.", "mobility", 18, 8, 18, { singleton: true, element: "viento", awakened: "El viento de todo el cielo responde a su voluntad" }),
  logia("Mizu Mizu no Mi", "Water-Water Fruit", "LEGENDARY", "Su cuerpo es agua: fluye entre los golpes, ahoga, cura con su corriente y levanta olas. Como toda fruta le impide nadar, y el Kairoseki lo deja como un charco inerte.", "control", 16, 12, 12, { singleton: true, element: "agua", awakened: "Cada charco, río y mar cercano es una extensión de su cuerpo" }),
  logia("Tsuchi Tsuchi no Mi", "Earth-Earth Fruit", "LEGENDARY", "Su cuerpo es tierra: levanta muros, se hunde y sale del suelo, aplasta con rocas y se regenera del terreno. Sin suelo (a bordo de un barco de madera lejos de la costa) pierde mucha fuerza.", "defensive", 18, 20, 4, { singleton: true, element: "tierra", awakened: "El terreno de toda la isla se levanta a su orden" }),
  logia("Kiri Kiri no Mi", "Mist-Mist Fruit", "LEGENDARY", "Su cuerpo es niebla espesa: esconde al que quiere, se cuela por rendijas y borra el sonido. Un viento fuerte la dispersa.", "control", 12, 10, 14, { singleton: true, element: "niebla" }),
  logia("Numa Numa no Mi", "Swamp-Swamp Fruit", "LEGENDARY", "Su cuerpo es un pantano: traga a los que pisan su lodo, lo vuelve hirviente o pegajoso y se esconde bajo cualquier charco. El fuego seca su cuerpo.", "control", 16, 12, 4, { singleton: true, element: "pantano" }),
  logia("Ishi Ishi no Mi", "Stone-Stone Fruit", "LEGENDARY", "Su cuerpo es piedra: puños de roca, estatuas que defienden, avalanchas. Muy fuerte y muy pesado; el agua y el hielo lo desgastan.", "defensive", 20, 22, 2, { singleton: true, element: "piedra" }),
  logia("Kinzoku Kinzoku no Mi", "Metal-Metal Fruit", "LEGENDARY", "Su cuerpo es metal fundido o frío: espadas que le nacen de los brazos, escudos, magnetismo. El óxido del mar lo estropea y la lava lo derrite.", "offensive", 20, 20, 2, { singleton: true, element: "metal" }),
  logia("Doro Doro no Mi", "Mud-Mud Fruit", "LEGENDARY", "Su cuerpo es barro: atrapa, sepulta, resbala y se moldea en lo que quiera. Se seca al sol y se endurece, pero no lo destruye.", "control", 14, 12, 6, { singleton: true, element: "barro" }),
  logia("Ame Ame no Mi", "Rain-Rain Fruit", "LEGENDARY", "Su cuerpo es lluvia: llama a la tormenta, disuelve el fuego y esconde su rastro. Bajo cielo despejado sigue siendo Logia, pero mucho menos fuerte.", "control", 14, 12, 12, { singleton: true, element: "lluvia" }),
  logia("Hai Hai no Mi", "Ash-Ash Fruit", "LEGENDARY", "Su cuerpo es ceniza: se deshace, sofoca, ciega y apaga fuegos. La lluvia lo convierte en barro y lo hace pesado.", "control", 14, 10, 12, { singleton: true, element: "ceniza" }),
  logia("Yoake Yoake no Mi", "Dawn-Dawn Fruit", "LEGENDARY", "Su cuerpo es la luz del amanecer: cura a los aliados, ciega a los que mira con odio y sube en poder con cada hora hasta el mediodía. La noche lo apaga a medias.", "offensive", 18, 10, 14, { singleton: true, element: "amanecer" }),
  logia("Yūyake Yūyake no Mi", "Dusk-Dusk Fruit", "LEGENDARY", "Su cuerpo es el fuego del atardecer: rojo, denso y cálido. Fuerte al caer el sol, débil al mediodía; sus llamas no queman sino que hacen tan pesado el ánimo que el rival duda.", "control", 16, 12, 10, { singleton: true, element: "atardecer" }),
  logia("Kokuyō Kokuyō no Mi", "Obsidian-Obsidian Fruit", "LEGENDARY", "Su cuerpo es obsidiana negra y cortante: hojas de cristal volcánico que rebanan el acero. Frágil ante golpes de Haki muy fuertes, que lo rompen como un vidrio.", "offensive", 22, 14, 6, { singleton: true, element: "obsidiana" }),
  logia("Shōkō Shōkō no Mi", "Aurora-Aurora Fruit", "MYTHICAL_TIER", "Su cuerpo es aurora: colores que hipnotizan, velos de luz que curan o abrasan, un manto sobre el cielo entero. Solo en mares del norte o en noches limpias llega a su fuerza total.", "offensive", 24, 14, 14, { singleton: true, element: "aurora", awakened: "Su aurora cubre el cielo de todo el mar" }),
];

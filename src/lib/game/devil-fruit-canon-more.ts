import { FruitType } from "@prisma/client";
import { fruitMaker } from "./devil-fruit-builder";

const para = fruitMaker(FruitType.PARAMECIA);
const zoan = fruitMaker(FruitType.ZOAN);
const anc = fruitMaker(FruitType.ZOAN_ANCIENT);

/**
 * Canon fruits that the catalog was still missing (2026-09-26). Personal signature fruits are 1-of-1 (singleton, hand-given
 * or won); the plain animal models are common and can drop like any other duplicable fruit.
 */
export const CANON_MORE_FRUITS = [
  para("Hobi Hobi no Mi", "Toy-Toy Fruit", "EPIC", "Convierte a quien toca en juguete y borra su recuerdo de todos: quien fue juguete deja de existir en la memoria del mundo. El hechizo se rompe si su dueña cae o pierde la concentración.", "control", 10, 8, 4, { singleton: true }),
  para("Memo Memo no Mi", "Memo-Memo Fruit", "EPIC", "Lee, extrae, corta y reescribe recuerdos: borra un miedo, injerta un falso recuerdo o pone a alguien contra los suyos. Cada intervención exige contacto visual y deja a su usuario agotado.", "control", 8, 10, 4, { singleton: true }),
  para("Mira Mira no Mi", "Mirror-Mirror Fruit", "RARE", "Crea espejos donde quiera que haya superficie, entra y sale por ellos, copia el aspecto de quien se refleje en ellos y lanza reflejos como armas de luz.", "utility", 10, 12, 6, { singleton: true }),
  para("Netsu Netsu no Mi", "Heat-Heat Fruit", "EPIC", "Su cuerpo irradia un calor extremo: derrite el acero al tocarlo, cuece el aire a su alrededor y convierte sus puños en hierros al rojo vivo.", "offensive", 18, 8, 4, { singleton: true }),
  para("Beri Beri no Mi", "Berry-Berry Fruit", "UNCOMMON", "Su cuerpo se separa en decenas de bolas del tamaño de una baya que se mueven solas, se reagrupan y golpean por todas partes; es casi imposible cortarlo de un tajo.", "defensive", 8, 14, 4, { singleton: true }),
  para("Beta Beta no Mi", "Sticky-Sticky Fruit", "RARE", "Segrega un lodo viscoso y pegajoso que inmoviliza, engancha armas y recubre el suelo; puede endurecerlo en muros o en armas.", "control", 12, 10, 2, { singleton: true }),
  para("Mini Mini no Mi", "Mini-Mini Fruit", "UNCOMMON", "Encoge el cuerpo hasta el tamaño de una mano y lo vuelve a agrandar a voluntad: infiltración, evasión, y golpes de gigante al volver a su tamaño.", "mobility", 8, 6, 12, { singleton: true }),
  zoan("Hebi Hebi no Mi: Modelo Anaconda", "Snake-Snake Fruit: Anaconda", "UNCOMMON", "Un cuerpo de serpiente anaconda: constricción aplastante, movimiento silencioso y una mirada que hace dudar. Fuerte en la selva, torpe en el frío.", "transformation", 12, 10, 6),
  zoan("Hebi Hebi no Mi: Modelo Cobra Real", "Snake-Snake Fruit: King Cobra", "RARE", "La cobra real: veneno paralizante, capucha intimidante y velocidad de mordida. Su veneno no mata a la primera; adormece y debilita.", "offensive", 14, 6, 10),
  zoan("Mushi Mushi no Mi: Modelo Escarabajo Rinoceronte", "Bug-Bug Fruit: Rhino Beetle", "UNCOMMON", "Coraza de escarabajo y un cuerno enorme: embestidas brutales, vuelo torpe pero fuerte y una resistencia excelente a los golpes.", "transformation", 14, 14, 2),
  zoan("Mushi Mushi no Mi: Modelo Avispa", "Bug-Bug Fruit: Hornet", "RARE", "Alas rápidas y un aguijón envenenado: ataques en picado, vuelo veloz y enjambres cuando el usuario es hábil.", "mobility", 12, 4, 14),
  zoan("Tori Tori no Mi: Modelo Albatros", "Bird-Bird Fruit: Albatross", "UNCOMMON", "El albatros: vuelo de larga distancia sin descanso, planeo casi infinito y buena vista sobre el mar. Poco dañino en combate directo.", "mobility", 8, 6, 12),
  zoan("Neko Neko no Mi: Modelo Puma", "Cat-Cat Fruit: Puma", "UNCOMMON", "Un puma ágil: saltos gigantescos, zarpazos y emboscadas silenciosas en terreno accidentado.", "transformation", 12, 8, 12),
  zoan("Inu Inu no Mi: Modelo Chacal", "Dog-Dog Fruit: Jackal", "COMMON", "Olfato de chacal y la mordida del carroñero: rastrea a cualquiera herido y resiste el calor del desierto sin agua.", "transformation", 10, 8, 10),
  zoan("Inu Inu no Mi: Modelo Teckel", "Dog-Dog Fruit: Dachshund", "COMMON", "Cuerpo largo y bajo de perro salchicha: se cuela por rendijas, muerde tobillos y es tan terco como inofensivo parece.", "transformation", 6, 8, 8),
  zoan("Uma Uma no Mi: Modelo Caballo", "Horse-Horse Fruit: Horse", "COMMON", "Un caballo de guerra: galope veloz, coces demoledoras y capacidad para cargar a un aliado a la espalda.", "mobility", 10, 8, 14),
  zoan("Mogu Mogu no Mi: Modelo Topo", "Mole-Mole Fruit: Mole", "COMMON", "Un topo: cava túneles con rapidez, ataca desde el subsuelo y ve muy bien en la oscuridad, aunque a la luz del día es casi ciego.", "mobility", 8, 6, 8),
  anc("Ryu Ryu no Mi: Modelo Espinosaurio", "Dragon-Dragon Fruit: Spinosaurus", "EPIC", "Un depredador anfibio ancestral: vela dorsal, mandíbulas de cocodrilo y una fuerza devastadora dentro y fuera del agua.", "transformation", 20, 14, 6),
  anc("Ryu Ryu no Mi: Modelo Triceratops", "Dragon-Dragon Fruit: Triceratops", "EPIC", "Tres cuernos y un escudo óseo: embestidas de tanque que aplastan muros y un cráneo casi impenetrable.", "transformation", 18, 20, 2),
  anc("Neko Neko no Mi: Modelo Dientes de Sable", "Cat-Cat Fruit: Sabertooth", "RARE", "Colmillos como dagas y una fuerza muscular monstruosa: mordida perforadora y zarpazos capaces de abrir una coraza.", "transformation", 20, 10, 10),
  anc("Kumo Kumo no Mi: Modelo Rosamygale Grauvogeli", "Spider-Spider Fruit: Rosamygale", "RARE", "Una araña gigante prehistórica: hilos de seda resistentes como el acero, telarañas trampa, patas afiladas y veneno paralizante.", "control", 14, 10, 10),
];

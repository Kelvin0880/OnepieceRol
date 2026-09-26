import { FruitType } from "@prisma/client";
import { fruitMaker } from "./devil-fruit-builder";

const para = fruitMaker(FruitType.PARAMECIA);

/**
 * Original Paramecia (2026-09-26). Most are common/duplicable (they can drop and be found in shops); a few of the strongest are
 * 1-of-1 (singleton) and are only handed out by events or by the owner.
 */
export const INVENTED_PARAMECIA = [
  para("Kagi Kagi no Mi", "Key-Key Fruit", "UNCOMMON", "Convierte en llave o en cerradura lo que toca: abre cualquier puerta o cofre y sella cerraduras que ni un herrero abre. Cerrar un cuerpo con su cerradura solo funciona con quien no la resiste con Haki.", "control", 6, 8, 2),
  para("Tokei Tokei no Mi", "Clock-Clock Fruit", "EPIC", "Acelera o ralentiza el tiempo en una zona del tamaño de una habitación: sus enemigos se mueven como en melaza. Cada segundo de tiempo torcido se lo cobra en aguante.", "control", 10, 8, 8, { singleton: true, awakened: "Su zona de tiempo cubre todo el campo de batalla" }),
  para("Fude Fude no Mi", "Brush-Brush Fruit", "RARE", "Todo lo que dibuja con su pincel cobra vida un rato: muros, fieras de tinta, cuerdas. Lo dibujado se emborrona con agua y se deshace en pocos minutos.", "utility", 8, 8, 4),
  para("Kusari Kusari no Mi", "Chain-Chain Fruit", "UNCOMMON", "Cadenas que brotan de su cuerpo y del suelo: atan, arrastran y levantan. Un rival fuerte las rompe, pero pierde un instante en hacerlo.", "control", 10, 8, 4),
  para("Hon Hon no Mi", "Book-Book Fruit", "RARE", "Sus libros guardan hechizos, mapas y criaturas de tinta que sale de sus páginas; cada libro solo puede usarse una vez por combate.", "utility", 8, 6, 4),
  para("Nawa Nawa no Mi", "Rope-Rope Fruit", "COMMON", "Cuerdas vivas que se anudan solas, trepan, azotan y cuelgan a los rivales boca abajo.", "control", 8, 4, 6),
  para("Tane Tane no Mi", "Seed-Seed Fruit", "UNCOMMON", "Produce semillas de cualquier planta que ha tocado: espinas, lianas, frutos curativos o esporas. Necesita tierra o agua cerca para que crezcan rápido.", "utility", 8, 8, 4),
  para("Saka Saka no Mi", "Reverse-Reverse Fruit", "EPIC", "Invierte una sola cosa a la vez: el sentido de un golpe, la gravedad sobre un objeto, la dirección de un empujón. Un rival muy sereno le adivina el truco.", "control", 10, 10, 6, { singleton: true }),
  para("Ura Ura no Mi", "Flip-Flip Fruit", "RARE", "Da la vuelta a lo que toca como un guante: cierra una puerta en una pared, invierte el suelo bajo los pies del rival o lo deja de cabeza.", "control", 8, 8, 6),
  para("Uso Uso no Mi", "Lie-Lie Fruit", "EPIC", "Sus mentiras cobran cuerpo unos segundos: un espejismo convincente, un aliado falso, un muro que no está. Quien conoce la verdad de la escena casi no se deja engañar.", "control", 8, 10, 6, { singleton: true }),
  para("Yubi Yubi no Mi", "Finger-Finger Fruit", "UNCOMMON", "Sus dedos se estiran, se separan y vuelan como proyectiles perforantes; puede tejer redes de dedos como si fueran hilos.", "offensive", 12, 4, 6),
  para("Kuchi Kuchi no Mi", "Mouth-Mouth Fruit", "COMMON", "Abre bocas en cualquier parte de su cuerpo y del terreno: muerde, grita o traga proyectiles pequeños.", "offensive", 10, 4, 4),
  para("Mimi Mimi no Mi", "Ear-Ear Fruit", "COMMON", "Un oído absoluto: oye a kilómetros, distingue a cada persona por su pulso y detecta engaños por el latido. No es un arma directa.", "utility", 4, 6, 6),
  para("Me Me no Mi", "Eye-Eye Fruit", "RARE", "Sus ojos ven a través de cuerpos, muros finos y mentiras; puede compartir su vista con un aliado. La luz cegadora lo deja indefenso.", "utility", 6, 6, 8),
  para("Hone Hone no Mi", "Bone-Bone Fruit", "UNCOMMON", "Saca y moldea huesos como armas, lanzas y escudos, y puede levantar esqueletos pequeños para distraer.", "offensive", 12, 8, 4),
  para("Chi Chi no Mi", "Blood-Blood Fruit", "RARE", "Controla la sangre: la suya, que endurece en armas, y la de quien acaba de herir. Sin sangre a la vista es solo una fruta modesta.", "control", 12, 8, 4),
  para("Tama Tama no Mi", "Orb-Orb Fruit", "COMMON", "Esferas de energía o de piedra que orbitan a su alrededor: golpean, bloquean y estallan al chocar.", "offensive", 10, 8, 4),
  para("Ha Ha no Mi", "Tooth-Tooth Fruit", "COMMON", "Sus dientes crecen como espadas y se disparan como balas; le crecen de nuevo en segundos.", "offensive", 10, 4, 4),
  para("Kasa Kasa no Mi", "Umbrella-Umbrella Fruit", "UNCOMMON", "Un paraguas vivo que desvía balas, abre planeos y se vuelve lanza; su tela no resiste el fuego intenso.", "defensive", 6, 12, 6),
  para("Ami Ami no Mi", "Net-Net Fruit", "UNCOMMON", "Lanza redes de hilo, cadena o luz que atrapan multitudes o barcos pequeños. No aguanta a alguien muy fuerte que las tire con Haki.", "control", 8, 8, 4),
  para("Kabe Kabe no Mi", "Wall-Wall Fruit", "EPIC", "Levanta muros de piedra, hielo o luz sólida en un instante para cortar el paso o proteger a los suyos. Cuanto más grande el muro, más aguante gasta.", "defensive", 8, 22, 2),
  para("Tobi Tobi no Mi", "Hop-Hop Fruit", "RARE", "Salta de un punto a otro que ve, a unos pocos metros, sin cruzar el espacio intermedio. No sirve a ciegas ni más allá de su vista.", "mobility", 8, 6, 16),
  para("Kaori Kaori no Mi", "Scent-Scent Fruit", "COMMON", "Aromas a voluntad: seduce, aturde, tranquiliza o marca a un rival para rastrearlo. Inútil con el viento en contra.", "utility", 4, 6, 6),
  para("Iro Iro no Mi", "Color-Color Fruit", "UNCOMMON", "Pinta cuerpos y cosas de colores que causan efectos: el rojo enfurece, el azul calma, el negro ciega un momento.", "control", 6, 6, 6),
  para("Tsuno Tsuno no Mi", "Horn-Horn Fruit", "COMMON", "Cuernos que crecen de su cabeza y sus hombros: embestidas y cornadas que perforan madera y cuero.", "offensive", 12, 8, 2),
  para("Tsume Tsume no Mi", "Claw-Claw Fruit", "COMMON", "Garras largas y afiladas en manos y pies: cortes rápidos y agarre en muros y árboles.", "offensive", 12, 4, 6),
  para("Hane Hane no Mi", "Feather-Feather Fruit", "COMMON", "Lluvia de plumas afiladas y un planeo corto; sus plumas se ven en todo el aire y desorientan.", "mobility", 8, 4, 10),
  para("Uroko Uroko no Mi", "Scale-Scale Fruit", "UNCOMMON", "Cubre su piel de escamas duras como acero que además le permiten respirar bajo el agua.", "defensive", 6, 14, 4),
  para("Kabi Kabi no Mi", "Mold-Mold Fruit", "UNCOMMON", "Moho y esporas que pudren madera, cuero y comida, y debilitan a quien las respira; el fuego lo limpia todo.", "control", 8, 6, 4),
  para("Gomi Gomi no Mi", "Trash-Trash Fruit", "COMMON", "Convierte cualquier desecho en armas y escudos y no se ensucia ni se contagia de nada; huele fatal.", "utility", 8, 8, 4),
  para("Mizu Mizu Bin no Mi", "Flask-Flask Fruit", "COMMON", "Guarda líquidos, gases y hasta pequeños objetos dentro de su cuerpo como en un frasco, y los libera a voluntad.", "utility", 6, 6, 4),
  para("Denki Denki no Mi", "Spark-Spark Fruit", "UNCOMMON", "Almacena estática en su cuerpo y la libera en descargas cortas; no es Logia: un golpe sólido lo alcanza.", "offensive", 12, 4, 8),
  para("Rei Rei no Mi", "Spirit-Spirit Fruit", "EPIC", "Ve, habla con y convoca fantasmas de los que murieron cerca: le dan pistas, se cuelan por muros y asustan; no puede convocar a nadie sin lugar donde haya muerto alguien.", "utility", 8, 10, 6, { singleton: true }),
  para("Doku Doku Nuru no Mi", "Slime-Slime Fruit", "UNCOMMON", "Un limo elástico que amortigua golpes, se desliza por rendijas y adhiere lo que toca; la sal lo reseca.", "defensive", 6, 12, 4),
  para("Kakera Kakera no Mi", "Shard-Shard Fruit", "RARE", "Se rompe en cristales afilados y se recompone, y cada fragmento puede lanzarse como cuchilla y hacer de ojos.", "offensive", 14, 10, 8),
  para("Niji Niji no Mi", "Rainbow-Rainbow Fruit", "RARE", "Puentes de luz de colores sobre los que corre sin caerse, y siete rayos de color con efectos distintos; solo funciona con luz.", "mobility", 10, 8, 12),
  para("Kōri Kōri no Mi", "Ice-Pop Fruit", "COMMON", "Piruletas de hielo que enfrían lo que tocan, pegajosas y resbaladizas; no es Logia y no hiela nada grande.", "control", 6, 6, 4),
  para("Pazuru Pazuru no Mi", "Puzzle-Puzzle Fruit", "COMMON", "Reordena un objeto o un lugar pequeño como un rompecabezas: abre una pared, cambia la posición de un techo o desarma un arma rival.", "utility", 6, 8, 4),
  para("Gyaku Gyaku no Mi", "Recoil-Recoil Fruit", "RARE", "Devuelve una parte del daño que recibe al que lo causó; no funciona contra ataques que no ve o que lo toman por sorpresa.", "defensive", 8, 16, 4),
  para("Tsuki Kage no Mi", "Umbra-Umbra Fruit", "EPIC", "Sus sombras hacen de armas, esconden a sus aliados y le dan un paso por cualquier sombra cercana. De día pleno queda casi sin poder.", "mobility", 12, 8, 12, { singleton: true }),
  para("Jishin Jishin no Mi", "Quake-Quake Fruit", "RARE", "Golpes con temblor local: el suelo en un radio pequeño cede, se agrieta y ondula. A diferencia de la Gura Gura, no llega a quebrar el aire ni el mar.", "offensive", 16, 6, 4),
  para("Hiru Hiru no Mi", "Day-Day Fruit", "EPIC", "Enciende o apaga la luz del día sobre una zona: ciega a quien mira, esconde el rastro y hace sonar como si fuera medianoche o mediodía. Su trampa se apaga si se mira sin miedo.", "control", 8, 8, 6),
];

/** The answer to "what is the One Piece" in this world, shown once to whoever first sets foot on Laugh Tale. */
export const ONE_PIECE_TRUTH_TITLE = "La Crónica del Mar";

export const ONE_PIECE_TRUTH = [
  "Laugh Tale no guarda oro. Guarda una sala circular tallada en piedra viva, y en sus muros, escrita en la lengua de los Poneglifos, está la Crónica del Mar: el archivo completo del Siglo Vacío y de la Voz del Mar, todo lo que el mundo fue obligado a olvidar.",
  "Ese es el One Piece. No es un tesoro que se gaste: es la memoria de todos los reinos borrados, de las islas que se hundieron por decreto y de los nombres que nadie pronuncia. Quien la hereda deja de ser un pirata más y se convierte en aquel que puede devolverle el pasado al mundo.",
  "Y entonces lo entiendes. El Rey Sin Nombre, el que se sienta sobre el Trono Vacío de Mary Geoise, no gobierna con ejércitos: gobierna con el olvido. Su poder existe solo mientras nadie recuerda. La Crónica es lo único que puede quebrarlo, pero solo si alguien llega a su trono y lo enfrenta antes de que se cierre otra vez la sala.",
  "Eso no lo hace nadie solo. Reúne a quienes han sabido llegar hasta aquí, suma a los aliados que confían en ti y marchad sobre Mary Geoise.",
].join("\n\n");

export const KING_TITLE = "Rey de los Piratas";
export const HERO_TITLE = "Héroe de Mary Geoise";
export const NEW_ERA = "Nueva Era";

export function truthNewsBody(name: string): string {
  return `${name} ha puesto pie en Laugh Tale. Dicen que salió de la sala en silencio y con la mirada cambiada. Lo que ha leído en sus muros puede cambiar el mundo, y hay quien ya se prepara para impedirlo.`;
}

export function newEraNewsBody(kingName: string): string {
  return `El Trono Vacío de Mary Geoise ha caído. El Rey Sin Nombre ya no gobierna el olvido y la Crónica del Mar ha sido leída en voz alta ante el mundo. ${kingName} ha sido coronado Rey de los Piratas. Empieza la Nueva Era.`;
}

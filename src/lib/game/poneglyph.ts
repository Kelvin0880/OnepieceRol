import { prisma } from "../db";
import { heatAfterReadingPoneglyph } from "../engine/pursuit";
import { postNews } from "./death-resolution";

export interface PoneglyphReader {
  id: string;
  name: string;
  poneglyphsRead: string;
  poneglyphHeat: number;
  currentIsland: { name: string };
}

/**
 * The one place a Poneglyph actually gets read: appends it to the character's
 * ledger, spikes pursuit heat, posts the major news. Shared by every path that
 * can yield one (mercy choice after a guardian falls, joint fights, stealth).
 * Returns the code name when newly read, undefined when already known.
 */
export async function grantPoneglyphRead(
  reader: PoneglyphReader,
  poneglyphId: string,
  log: string[],
  newsLog: string[],
  opts: { heat?: number; quiet?: boolean } = {}
): Promise<string | undefined> {
  const known = JSON.parse(reader.poneglyphsRead) as string[];
  if (known.includes(poneglyphId)) return undefined;
  const poneglyph = await prisma.poneglyph.findUnique({ where: { id: poneglyphId } });
  if (!poneglyph) return undefined;
  await prisma.character.update({
    where: { id: reader.id },
    data: { poneglyphsRead: JSON.stringify([...known, poneglyph.id]), poneglyphHeat: heatAfterReadingPoneglyph(reader.poneglyphHeat, opts.heat) },
  });
  log.push(`Descifras el ${poneglyph.codeName}. Su mensaje quedará grabado en tu memoria para siempre.`);
  log.push(
    opts.quiet
      ? "Nadie sabe que estuviste aquí; aun así, lo que sabes deja un rastro tenue para quien sepa buscar."
      : "Pero ese conocimiento tiene un precio: ahora eres alguien a quien hay que silenciar."
  );
  if (opts.quiet) return poneglyph.codeName;
  const headline = `${reader.name} descifra un Poneglifo de Ruta`;
  await postNews(
    headline,
    `Pocos en el mundo pueden leer los símbolos antiguos — ${reader.name} acaba de hacerlo en ${reader.currentIsland.name}. No tardarán en venir a silenciar a quien sabe demasiado.`,
    "Poneglifos",
    reader.id,
    "major"
  );
  newsLog.push(headline);
  return poneglyph.codeName;
}

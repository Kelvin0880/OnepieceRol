import { prisma } from "../db";
import { CharacterStatus } from "@prisma/client";
import { heatAfterReadingPoneglyph } from "../engine/pursuit";
import {
  canReadKind,
  chapterFor,
  HISTORY_CHAPTERS,
  HISTORY_READ_HEAT,
  routeSteps,
  RUBBING_KIND,
  rubbingName,
  scriptAfterStudy,
  scriptLabel,
  scriptNeeded,
  STUDY_STAMINA,
  studyBlockReason,
} from "../engine/poneglyph-lore";
import { currentStamina } from "./combat-prep";
import { postNews } from "./death-resolution";

export class PoneglyphError extends Error {}

export interface PoneglyphReader {
  id: string;
  name: string;
  poneglyphsRead: string;
  poneglyphHeat: number;
  ancientScript: number;
  currentIsland: { name: string };
}

const readList = (json: string) => JSON.parse(json || "[]") as string[];

async function holdsRubbing(characterId: string, poneglyphId: string): Promise<boolean> {
  const rows = await prisma.inventoryItem.findMany({ where: { characterId, kind: RUBBING_KIND } });
  return rows.some((r) => (JSON.parse(r.effectJson ?? "{}") as { poneglyphId?: string }).poneglyphId === poneglyphId);
}

async function giveRubbing(characterId: string, poneglyph: { id: string; codeName: string }): Promise<boolean> {
  if (await holdsRubbing(characterId, poneglyph.id)) return false;
  await prisma.inventoryItem.create({ data: { characterId, name: rubbingName(poneglyph.codeName), kind: RUBBING_KIND, quantity: 1, effectJson: JSON.stringify({ poneglyphId: poneglyph.id }) } });
  return true;
}

/** Appends the stone to the reader's ledger, spikes pursuit heat and posts the news. The only place a Poneglyph is actually read. */
async function commitRead(reader: PoneglyphReader, poneglyph: { id: string; codeName: string; kind: string }, log: string[], newsLog: string[], opts: { heat?: number; quiet?: boolean; placeName?: string }) {
  const known = readList(reader.poneglyphsRead);
  await prisma.character.update({
    where: { id: reader.id },
    data: { poneglyphsRead: JSON.stringify([...known, poneglyph.id]), poneglyphHeat: heatAfterReadingPoneglyph(reader.poneglyphHeat, opts.heat) },
  });
  const chapter = poneglyph.kind === "Historia" ? chapterFor(poneglyph.codeName) : null;
  log.push(`Descifras el ${poneglyph.codeName}. Su mensaje quedará grabado en tu memoria para siempre.`);
  if (chapter) log.push(`«${chapter.title}»: ${chapter.text}`);
  log.push(opts.quiet ? "Nadie sabe que lo has leído; aun así, lo que sabes deja un rastro tenue para quien sepa buscar." : "Pero ese conocimiento tiene un precio: ahora eres alguien a quien hay que silenciar.");
  if (opts.quiet) return;
  const headline = poneglyph.kind === "Historia" ? `${reader.name} lee un Poneglifo de Historia` : `${reader.name} descifra un Poneglifo de Ruta`;
  await postNews(
    headline,
    poneglyph.kind === "Historia"
      ? `En ${opts.placeName ?? reader.currentIsland.name}, ${reader.name} ha leído en voz alta una piedra que habla del siglo que el mundo olvidó. El Gobierno Mundial toma nota.`
      : `Pocos en el mundo pueden leer los símbolos antiguos — ${reader.name} acaba de hacerlo en ${opts.placeName ?? reader.currentIsland.name}. No tardarán en venir a silenciar a quien sabe demasiado.`,
    "Poneglifos",
    reader.id,
    "major"
  );
  newsLog.push(headline);
}

/**
 * Reaching a Poneglyph (beating its guardian, sneaking in): someone who knows the old script reads it on the spot; anyone
 * else takes a rubbing to decipher later. Returns the code name when newly read, undefined otherwise.
 */
export async function grantPoneglyphRead(reader: PoneglyphReader, poneglyphId: string, log: string[], newsLog: string[], opts: { heat?: number; quiet?: boolean } = {}): Promise<string | undefined> {
  if (readList(reader.poneglyphsRead).includes(poneglyphId)) return undefined;
  const poneglyph = await prisma.poneglyph.findUnique({ where: { id: poneglyphId } });
  if (!poneglyph) return undefined;
  if (!canReadKind(poneglyph.kind, reader.ancientScript ?? 0)) {
    const fresh = await giveRubbing(reader.id, poneglyph);
    await prisma.character.update({ where: { id: reader.id }, data: { poneglyphHeat: heatAfterReadingPoneglyph(reader.poneglyphHeat, Math.round((opts.heat ?? 50) / 2)) } });
    log.push(
      fresh
        ? `Estás frente al ${poneglyph.codeName}, pero no sabes leer la lengua antigua. Te llevas un calco de la piedra: descífralo cuando la domines (se estudia en Ohara) o dáselo a un compañero que sepa leerla.`
        : `Ya tienes un calco del ${poneglyph.codeName}: aprende la lengua antigua en Ohara para descifrarlo.`
    );
    if (fresh && !opts.quiet) {
      await postNews(`${reader.name} se lleva un calco de un Poneglifo`, `Testigos en ${reader.currentIsland.name} aseguran que ${reader.name} copió los símbolos de un Poneglifo antes de huir. Nadie sabe si podrá leerlos.`, "Poneglifos", reader.id, "normal");
    }
    return undefined;
  }
  await commitRead(reader, poneglyph, log, newsLog, opts);
  return poneglyph.codeName;
}

async function loadReader(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c || c.userId !== userId) throw new PoneglyphError("Personaje no encontrado.");
  if (c.status !== CharacterStatus.ALIVE) throw new PoneglyphError("No estás en condiciones de hacerlo.");
  return c;
}

/** A session among the ruins of Ohara. */
export async function studyScript(characterId: string, userId: string) {
  const c = await loadReader(characterId, userId);
  const stamina = currentStamina(c);
  const block = studyBlockReason({ islandName: c.currentIsland.name, script: c.ancientScript, lastStudyAt: c.lastStudyAt, stamina, now: new Date() });
  if (block) throw new PoneglyphError(block);
  const script = scriptAfterStudy(c.ancientScript);
  const saved = await prisma.character.updateMany({ where: { id: c.id, ancientScript: c.ancientScript }, data: { ancientScript: script, lastStudyAt: new Date(), stamina: stamina - STUDY_STAMINA, staminaUpdatedAt: new Date() } });
  if (saved.count === 0) throw new PoneglyphError("Ya estabas estudiando: inténtalo de nuevo.");
  const unlocked = scriptNeeded("Historia") > c.ancientScript && script >= scriptNeeded("Historia") ? " Ya puedes leer los Poneglifos de Historia." : scriptNeeded("Road") > c.ancientScript && script >= scriptNeeded("Road") ? " Ya puedes leer los Poneglifos de Ruta." : "";
  return { log: [`Pasas horas entre los libros quemados y las piedras de Ohara, reconstruyendo símbolos. Lengua antigua: ${script}/100 — ${scriptLabel(script)}.${unlocked}`] };
}

/** Reads the rubbings this character can now understand. */
export async function decipherRubbings(characterId: string, userId: string) {
  const c = await loadReader(characterId, userId);
  const rubbings = await prisma.inventoryItem.findMany({ where: { characterId: c.id, kind: RUBBING_KIND } });
  if (!rubbings.length) throw new PoneglyphError("No llevas ningún calco.");
  const log: string[] = [];
  const newsLog: string[] = [];
  let reader = c;
  for (const r of rubbings) {
    const pid = (JSON.parse(r.effectJson ?? "{}") as { poneglyphId?: string }).poneglyphId;
    const stone = pid ? await prisma.poneglyph.findUnique({ where: { id: pid } }) : null;
    if (!stone) continue;
    if (!canReadKind(stone.kind, reader.ancientScript)) {
      log.push(`El ${stone.codeName} sigue siendo un misterio: necesitas ${scriptNeeded(stone.kind)} de lengua antigua (tienes ${reader.ancientScript}).`);
      continue;
    }
    if (!readList(reader.poneglyphsRead).includes(stone.id)) await commitRead(reader, stone, log, newsLog, { heat: 20 });
    await prisma.inventoryItem.delete({ where: { id: r.id } });
    reader = (await prisma.character.findUnique({ where: { id: c.id }, include: { currentIsland: true } }))!;
  }
  if (!log.length) log.push("No hay nada nuevo que descifrar.");
  return { log };
}

/** A rubbing is paper: it can be handed to a crewmate on the same island who knows the script. */
export async function handRubbing(characterId: string, userId: string, rubbingId: string, toCharacterId: string) {
  const c = await loadReader(characterId, userId);
  const r = await prisma.inventoryItem.findUnique({ where: { id: rubbingId } });
  if (!r || r.characterId !== c.id || r.kind !== RUBBING_KIND) throw new PoneglyphError("Ese calco no es tuyo.");
  const to = await prisma.character.findUnique({ where: { id: toCharacterId } });
  if (!to || to.status !== CharacterStatus.ALIVE) throw new PoneglyphError("Esa persona no puede recibirlo.");
  if (!c.crewId || to.crewId !== c.crewId) throw new PoneglyphError("Solo puedes confiarle un calco a alguien de tu tripulación.");
  if (to.currentIslandId !== c.currentIslandId) throw new PoneglyphError("Tiene que estar en tu misma isla.");
  const pid = (JSON.parse(r.effectJson ?? "{}") as { poneglyphId?: string }).poneglyphId ?? "";
  if (await holdsRubbing(to.id, pid)) throw new PoneglyphError(`${to.name} ya tiene ese calco.`);
  await prisma.inventoryItem.update({ where: { id: r.id }, data: { characterId: to.id } });
  return { log: [`Entregas el ${r.name} a ${to.name}.`] };
}

/** A Historia Poneglyph needs no fight: it stands in the open for whoever can read it. */
export async function readHistoryStone(characterId: string, userId: string) {
  const c = await loadReader(characterId, userId);
  const stone = await prisma.poneglyph.findFirst({ where: { kind: "Historia", locationIslandId: c.currentIslandId } });
  if (!stone) throw new PoneglyphError("En esta isla no hay ningún Poneglifo de Historia a la vista.");
  if (readList(c.poneglyphsRead).includes(stone.id)) throw new PoneglyphError("Ya leíste esta piedra.");
  const log: string[] = [];
  const newsLog: string[] = [];
  if (!canReadKind(stone.kind, c.ancientScript)) {
    const fresh = await giveRubbing(c.id, stone);
    return { log: [fresh ? `No sabes leer la lengua antigua: copias los símbolos del ${stone.codeName} en un calco. Estudia en Ohara para descifrarlo.` : "Ya tienes un calco de esta piedra. Aprende la lengua antigua en Ohara."] };
  }
  await commitRead(c, stone, log, newsLog, { heat: HISTORY_READ_HEAT, placeName: c.currentIsland.name });
  return { log };
}

/** Everything the "Ruta a Laugh Tale" panel shows. */
export async function getRouteState(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true, crew: { include: { members: { select: { id: true, name: true, currentIslandId: true, ancientScript: true, status: true } } } } } });
  if (!c || c.userId !== userId) throw new PoneglyphError("Personaje no encontrado.");
  const read = readList(c.poneglyphsRead);
  const stones = await prisma.poneglyph.findMany({ include: { island: { select: { name: true } } } });
  const islands = new Map((await prisma.island.findMany({ select: { id: true, name: true } })).map((i) => [i.id, i.name]));
  const road = stones.filter((s) => s.kind === "Road");
  const history = stones.filter((s) => s.kind === "Historia");
  const rubbings = await prisma.inventoryItem.findMany({ where: { characterId: c.id, kind: RUBBING_KIND } });
  const hereHistory = history.find((h) => h.locationIslandId === c.currentIslandId) ?? null;
  const chapters = HISTORY_CHAPTERS.map((ch) => {
    const stone = history.find((h) => h.codeName === ch.codeName);
    const known = !!stone && read.includes(stone.id);
    return { key: ch.key, title: ch.title, islandName: ch.islandName, known, text: known ? ch.text : null };
  });
  return {
    script: c.ancientScript,
    scriptLabel: scriptLabel(c.ancientScript),
    canStudyHere: c.currentIsland.name === "Ohara",
    studyBlock: studyBlockReason({ islandName: c.currentIsland.name, script: c.ancientScript, lastStudyAt: c.lastStudyAt, stamina: currentStamina(c), now: new Date() }),
    road: road.map((r) => ({ id: r.id, codeName: r.codeName, read: read.includes(r.id), where: r.island?.name ?? "Paradero desconocido", guardedBy: r.guardedBy, lore: read.includes(r.id) ? r.loreText : null })),
    chapters,
    hereHistory: hereHistory ? { codeName: hereHistory.codeName, read: read.includes(hereHistory.id), needs: scriptNeeded("Historia") } : null,
    rubbings: rubbings.map((r) => ({ id: r.id, name: r.name })),
    crewReaders: (c.crew?.members ?? []).filter((m) => m.id !== c.id && m.status === "ALIVE" && m.currentIslandId === c.currentIslandId).map((m) => ({ id: m.id, name: m.name, script: m.ancientScript })),
    knowsTruth: c.knowsTruth,
    steps: routeSteps({ script: c.ancientScript, historyRead: chapters.filter((x) => x.known).length, roadRead: road.filter((r) => read.includes(r.id)).length, roadTotal: road.length, rubbings: rubbings.length, knowsTruth: c.knowsTruth }),
    historyIslands: history.map((h) => islands.get(h.locationIslandId ?? "") ?? "?"),
  };
}

/** One line for the narrator: what this character really knows of the stones. */
export async function poneglyphLineForNarrator(c: { poneglyphsRead: string; ancientScript: number; knowsTruth: boolean }): Promise<string> {
  const read = readList(c.poneglyphsRead);
  if (!read.length && c.ancientScript <= 0) return "";
  const stones = await prisma.poneglyph.findMany({ where: { id: { in: read } }, select: { codeName: true, kind: true } });
  const chapters = stones.filter((s) => s.kind === "Historia").map((s) => chapterFor(s.codeName)?.title).filter(Boolean);
  const roads = stones.filter((s) => s.kind === "Road").length;
  return `Poneglifos: ${scriptLabel(c.ancientScript)}; ${roads}/4 de Ruta leídos${chapters.length ? `; capítulos de Historia conocidos: ${chapters.join(", ")}` : ""}${c.knowsTruth ? "; conoce la Crónica del Mar (Laugh Tale)" : ""}. Solo sabe lo que ha leído: no inventes revelaciones nuevas.`;
}

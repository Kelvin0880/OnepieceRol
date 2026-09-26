/**
 * Reading the ancient script. A Poneglyph is stone: anyone can stand in front of it, but only someone who has learned
 * the old language can read it. The script is studied among the ruins of Ohara; without it, all a character can do is
 * take a rubbing (calco) and decipher it later, or hand it to a crewmate who can. The Historia Poneglyphs tell, chapter
 * by chapter, what the world was made to forget; the Road Poneglyphs point the way to Laugh Tale.
 */

export const SCRIPT_MAX = 100;
export const SCRIPT_FOR_HISTORY = 25;
export const SCRIPT_FOR_ROAD = 50;
export const STUDY_GAIN = 25;
export const STUDY_COOLDOWN_MS = 3 * 3600_000;
export const STUDY_STAMINA = 20;
export const STUDY_ISLAND = "Ohara";
export const RUBBING_KIND = "Calco";
export const HISTORY_READ_HEAT = 12;

export type PoneglyphKind = "Road" | "Historia";

export function scriptNeeded(kind: string): number {
  return kind === "Historia" ? SCRIPT_FOR_HISTORY : SCRIPT_FOR_ROAD;
}

export function canReadKind(kind: string, script: number): boolean {
  return script >= scriptNeeded(kind);
}

export function scriptLabel(script: number): string {
  if (script <= 0) return "No sabes leer la lengua antigua";
  if (script < SCRIPT_FOR_HISTORY) return "Rudimentos de la lengua antigua";
  if (script < SCRIPT_FOR_ROAD) return "Lees los Poneglifos de Historia";
  if (script < SCRIPT_MAX) return "Lees también los Poneglifos de Ruta";
  return "Erudito de Ohara";
}

export function studyBlockReason(p: { islandName: string; script: number; lastStudyAt: Date | null; stamina: number; now: Date }): string | null {
  if (p.islandName !== STUDY_ISLAND) return `La lengua antigua solo se estudia entre las ruinas de ${STUDY_ISLAND}.`;
  if (p.script >= SCRIPT_MAX) return "Ya dominas la lengua antigua: no queda nada que aprender en estas ruinas.";
  if (p.lastStudyAt && p.now.getTime() - p.lastStudyAt.getTime() < STUDY_COOLDOWN_MS) {
    const min = Math.ceil((STUDY_COOLDOWN_MS - (p.now.getTime() - p.lastStudyAt.getTime())) / 60_000);
    return `Tu cabeza necesita descanso: vuelve a estudiar en ${min} min.`;
  }
  if (p.stamina < STUDY_STAMINA) return "Estás demasiado agotado para concentrarte. Descansa primero.";
  return null;
}

export function scriptAfterStudy(script: number): number {
  return Math.min(SCRIPT_MAX, script + STUDY_GAIN);
}

export function rubbingName(codeName: string): string {
  return `${RUBBING_KIND}: ${codeName}`;
}

export interface HistoryChapter {
  key: string;
  codeName: string;
  islandName: string;
  title: string;
  text: string;
}

/** The chapters of the forgotten century, one per Historia Poneglyph. Together they are the road to the Crónica del Mar. */
export const HISTORY_CHAPTERS: HistoryChapter[] = [
  {
    key: "alabasta",
    codeName: "Poneglifo de Historia — El Reino Sin Nombre",
    islandName: "Alabasta",
    title: "I. El Reino Sin Nombre",
    text: "Hubo un reino que no necesitaba murallas porque su fuerza era la memoria: cada isla guardaba una parte de su historia y todas juntas la contaban entera. Sus enemigos no lo vencieron en batalla; lo vencieron prohibiendo pronunciar su nombre.",
  },
  {
    key: "skypiea",
    codeName: "Poneglifo de Historia — La Campana de las Nubes",
    islandName: "Skypiea",
    title: "II. La Campana de las Nubes",
    text: "Cuando la guerra llegó, el reino subió sus archivos al cielo y colgó una campana en lo alto: mientras sonara, alguien recordaría. La campana calló el día en que las nubes cayeron, y con ella calló la primera mitad de la historia.",
  },
  {
    key: "gyojin",
    codeName: "Poneglifo de Historia — La Promesa del Mar",
    islandName: "Isla Gyojin",
    title: "III. La Promesa del Mar",
    text: "Un hombre que reía como nadie prometió al pueblo del mar que volvería para sacarlo a la luz del sol. No pudo cumplirlo. Grabó su disculpa en esta piedra y dejó dicho que otro, algún día, heredaría la promesa junto con su risa.",
  },
  {
    key: "zou",
    codeName: "Poneglifo de Historia — La Voz de Todas las Cosas",
    islandName: "Zou",
    title: "IV. La Voz de Todas las Cosas",
    text: "Algunos pueden oír lo que no habla: el mar, las piedras, las bestias antiguas. El reino llamaba a ese don la Voz del Mar y confió a quienes la oían el camino hasta la última isla. Por eso quien la oye sigue siendo perseguido.",
  },
  {
    key: "wano",
    codeName: "Poneglifo de Historia — Las Puertas Cerradas",
    islandName: "País de Wano",
    title: "V. Las Puertas Cerradas",
    text: "Los canteros que tallaron las piedras eternas se encerraron tras montañas y mareas para que nadie les obligara a borrar lo escrito. Su tierra cerró sus puertas al mundo esperando el día en que alguien viniera a abrirlas con la historia completa.",
  },
  {
    key: "elbaf",
    codeName: "Poneglifo de Historia — Los Gigantes que Recordaban",
    islandName: "Elbaf",
    title: "VI. Los Gigantes que Recordaban",
    text: "Los gigantes viven tanto que su memoria es más larga que cualquier decreto. Ellos vieron levantarse el Trono Vacío sobre la Tierra Sagrada y a su dueño gobernar sin rostro, alimentándose del olvido de los demás. Dicen que su poder se quiebra el día en que el mundo recuerde.",
  },
];

export const HISTORY_TOTAL = HISTORY_CHAPTERS.length;

export function chapterFor(codeName: string): HistoryChapter | null {
  return HISTORY_CHAPTERS.find((c) => c.codeName === codeName) ?? null;
}

/** The final raid knows its enemy better the more of the true history the coalition has read: the ruler's hold weakens. */
export function raidHistoryFactor(distinctChaptersKnown: number): number {
  return 1 - 0.03 * Math.max(0, Math.min(HISTORY_TOTAL, distinctChaptersKnown));
}

export interface RouteStep {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

/** The road to Laugh Tale as a checklist anybody can follow. */
export function routeSteps(p: { script: number; historyRead: number; roadRead: number; roadTotal: number; rubbings: number; knowsTruth: boolean }): RouteStep[] {
  return [
    { id: "script", label: "Aprende la lengua antigua", done: p.script >= SCRIPT_FOR_ROAD, detail: `${scriptLabel(p.script)} (${p.script}/${SCRIPT_FOR_ROAD} para los de Ruta). Se estudia en ${STUDY_ISLAND}.` },
    { id: "history", label: "Lee los Poneglifos de Historia", done: p.historyRead >= HISTORY_TOTAL, detail: `${p.historyRead}/${HISTORY_TOTAL} capítulos del siglo olvidado. Cada uno debilita al Rey Sin Nombre en el asalto final.` },
    { id: "road", label: "Descifra los cuatro Poneglifos de Ruta", done: p.roadRead >= p.roadTotal, detail: `${p.roadRead}/${p.roadTotal} leídos${p.rubbings ? ` · ${p.rubbings} calco(s) por descifrar` : ""}. Cada uno está custodiado por un gran poder.` },
    { id: "laughtale", label: "Zarpa hacia Laugh Tale", done: p.knowsTruth, detail: p.knowsTruth ? "Has leído la Crónica del Mar." : "Con los cuatro de Ruta, el rumbo aparece en tus mapas." },
    { id: "raid", label: "Marcha sobre Mary Geoise", done: false, detail: "Reúne una coalición y derriba el Trono Vacío." },
  ];
}

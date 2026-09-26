export interface RealPlayer {
  name: string;
  /** "tripulante" | "en esta isla" | "en otra isla" */
  relation: string;
}

const SPEECH =
  "dij|dice(?![a-z])|grit|susurr|murmur|respond|pregunt|exclam|a[ñn]adi|coment|gru[ñn]|escupi|sonri|asinti|neg[óo]|advirti|explic|repiti|cont[óo]|llam[óo]|lleg|apareci|sali(?:o|a)|se acerc|se detuvo|se gir|dio media vuelta|cruz[óo]|mir[óo]|se dirig|se alej|se inclin|se levant|se sent";

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Directive appended to every narrator prompt: other people's characters belong to other people. */
export function realPlayersBlock(players: RealPlayer[]): string {
  if (players.length === 0) return "";
  const list = players.map((p) => `${p.name} (${p.relation})`).join(", ");
  return (
    `PERSONAJES DE OTROS JUGADORES REALES (personas de verdad, no PNJ): ${list}. ` +
    "Son controlados por su jugador: NUNCA les des diálogo, acciones nuevas, decisiones, pensamientos ni emociones, y no los hagas aparecer, llegar, irse, mirar, asentir ni reaccionar. " +
    "Puedes MENCIONARLOS como algo que el personaje sabe o recuerda (que existen, que son aliados o rivales, algo que YA ocurrió según la memoria) sin ponerlos en escena. " +
    "Si el jugador se dirige a uno de ellos, su mensaje le llega a esa persona: tú no contestas por ella, describe solo el entorno y los PNJ. " +
    "Los PNJ que inventes nunca pueden llevar el nombre de un personaje real."
  );
}

/**
 * True when the text makes a real player's character talk or act (name followed closely by a speech/movement verb,
 * a quote right after the name, or "dijo <name>"). A plain mention ("Barbosa tenía razón") is allowed.
 */
export function voicesRealPlayer(text: string, names: string[]): string | null {
  const t = fold(text);
  for (const name of names) {
    const n = escapeRe(fold(name));
    if (!n) continue;
    const before = new RegExp(`\\b(?:${SPEECH})\\w*\\s+${n}\\b`);
    const after = new RegExp(`\\b${n}\\b[^.!?\\n"“«:]{0,40}?\\b(?:${SPEECH})`);
    const quoted = new RegExp(`\\b${n}\\b[^.!?\\n]{0,14}[:"“«—]`);
    const label = new RegExp(`(?:^|\\n)\\s*${n}\\s*:`);
    const hit = after.test(t) || quoted.test(t) || label.test(t) || before.test(t);
    if (hit) return name;
  }
  return null;
}

/** The narrator announcing what only the system can decide: missions done, payouts, reputation, level-ups. */
export function inventsSystemResult(text: string): boolean {
  return /misi[oó]n[^.\n]{0,60}(completad|cumplid|superad)|recompensa asignada|reputaci[oó]n[^.\n]{0,25}adquirid|has subido a nivel|subes a nivel|nivel \d+ alcanzado/i.test(text);
}

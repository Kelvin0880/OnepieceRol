/**
 * Combat without dice: the AI referee judges every exchange from what each fighter can really do and what
 * was described, and answers with a narration plus how much HP and stamina each side loses. The code never
 * rolls; it only keeps the verdict inside sane bounds and applies it. Pure: no DB, no network.
 */

/** Nobody loses more than half of their maximum life in a single exchange, so a fight always has room to breathe. */
export const MAX_HP_LOSS_FRACTION = 0.5;
export const MAX_STAMINA_LOSS = 45;

export interface RefereeChange {
  name: string;
  /** Points lost (never gains). */
  hp: number;
  stamina: number;
}

export interface RefereeVerdict {
  /** The whole message, already assembled: result, the rival's reaction and the rival's next attempt. */
  narration: string;
  /** The rival's next attack written as an INTENTION (never as a landed hit). Empty when the rival is out of the fight or in duels. */
  rivalIntent?: string;
  changes: RefereeChange[];
  /** Group fights only: the ally who lands the decisive blow when the rival falls. */
  finalBlow?: string;
  /** Fighters who cannot go on after this exchange (unconscious, dead, unable). Only accepted from half life or less. */
  defeated?: string[];
  /** Solo flight attempts: the rival let them go (true) or caught them (false). */
  escaped?: boolean;
  /** Group fights: allies whose flight attempt succeeded. */
  fled?: string[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function firstJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

/** Long multi-paragraph answers often carry raw line breaks inside the strings, which strict JSON rejects: escape them and try again. */
function parseLenient(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    let out = "";
    let inString = false;
    let escaped = false;
    const NL = String.fromCharCode(10);
    const CR = String.fromCharCode(13);
    const TAB = String.fromCharCode(9);
    const BACKSLASH = String.fromCharCode(92);
    for (const ch of json) {
      if (inString && !escaped && ch === NL) out += BACKSLASH + "n";
      else if (inString && !escaped && ch === CR) out += "";
      else if (inString && !escaped && ch === TAB) out += BACKSLASH + "t";
      else out += ch;
      if (inString && escaped) escaped = false;
      else if (inString && ch === BACKSLASH) escaped = true;
      else if (ch === '"') inString = !inString;
    }
    return JSON.parse(out) as Record<string, unknown>;
  }
}

/** A model sometimes answers a text field as an object or list (one entry per fighter): read it as the text it is. */
function textOf(v: unknown): string {
  const join = (parts: string[]) => parts.filter(Boolean).join(String.fromCharCode(10, 10));
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return join(v.map(textOf));
  if (v && typeof v === "object") return join(Object.values(v as Record<string, unknown>).map(textOf));
  return "";
}

/** Models wrap JSON in fences or chatter: take the first balanced object and validate it. Anything malformed is null. */
export function parseRefereeVerdict(raw: string): RefereeVerdict | null {
  const json = firstJsonObject(raw);
  if (!json) return null;
  try {
    const obj = parseLenient(json);
    const str = textOf;
    const result = str(obj.resultado) || str(obj.narracion) || str(obj.narration);
    const reaction = str(obj.reaccion_rival);
    const intent = str(obj.intencion_rival);
    const narration = [result, reaction, intent].filter(Boolean).join("\n\n");
    if (result.length < 30) return null;
    const list = Array.isArray(obj.cambios) ? obj.cambios : Array.isArray(obj.changes) ? obj.changes : [];
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
    const changes: RefereeChange[] = [];
    for (const c of list) {
      if (!c || typeof c !== "object") continue;
      const rec = c as Record<string, unknown>;
      const name = typeof rec.nombre === "string" ? rec.nombre : typeof rec.name === "string" ? rec.name : "";
      if (!name.trim()) continue;
      changes.push({ name: name.trim(), hp: num(rec.vida ?? rec.hp), stamina: num(rec.aguante ?? rec.stamina) });
    }
    const fb = typeof obj.golpe_final === "string" && obj.golpe_final.trim() ? obj.golpe_final.trim() : undefined;
    const defeated = Array.isArray(obj.derrotados) ? obj.derrotados.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
    const fled = Array.isArray(obj.huyen) ? obj.huyen.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];
    const escaped = typeof obj.huida === "boolean" ? obj.huida : undefined;
    return { narration, ...(intent ? { rivalIntent: intent } : {}), changes, ...(fb ? { finalBlow: fb } : {}), ...(defeated.length ? { defeated } : {}), ...(escaped !== undefined ? { escaped } : {}), ...(fled.length ? { fled } : {}) };
  } catch {
    return null;
  }
}

/**
 * The rival of the list stands for its whole side: when the story shows henchmen and the model books their wounds under
 * their own invented names, the loss would silently vanish. Any change whose name matches nobody in the fight goes to the rival.
 */
export function foldUnknownChanges(verdict: RefereeVerdict, knownNames: string[], rivalName: string): RefereeVerdict {
  const known = new Set(knownNames.map(norm));
  if (!known.has(norm(rivalName))) return verdict;
  const changes = verdict.changes.map((c) => (known.has(norm(c.name)) ? c : { ...c, name: rivalName }));
  // A fallen henchman is not the whole side falling: only real combatants can be declared defeated.
  const defeated = verdict.defeated?.filter((n) => known.has(norm(n)));
  return { ...verdict, changes, ...(defeated ? { defeated } : {}) };
}

export interface RefereeBound {
  name: string;
  hp: number;
  maxHp: number;
  stamina?: number;
  /** Nothing has been thrown at this fighter yet (e.g. they started the fight): the verdict cannot hurt them. */
  protectedThisExchange?: boolean;
  /** Attack of whoever is hitting this fighter and this fighter's own defence: a much weaker attacker cannot take a big bite out of a much tougher target. */
  incomingAtk?: number;
  defense?: number;
}

/** Largest share of max life one exchange can take, by how the attacker's attack compares with the target's defence (never above the flat cap). */
export function powerCapFraction(incomingAtk: number, defense: number): number {
  const ratio = incomingAtk / Math.max(1, defense);
  return Math.max(0.06, Math.min(MAX_HP_LOSS_FRACTION, 0.06 + 0.18 * ratio));
}

export interface AppliedChange {
  name: string;
  hpLoss: number;
  staminaLoss: number;
  hpAfter: number;
  staminaAfter: number | null;
}

/** Keeps the verdict inside the rules of the game: bounded per exchange, never below zero, never hurting a protected fighter. */
export function applyVerdict(verdict: RefereeVerdict, bounds: RefereeBound[]): AppliedChange[] {
  return bounds.map((b) => {
    const mine = verdict.changes.filter((c) => norm(c.name) === norm(b.name));
    const asked = mine.reduce((acc, c) => ({ hp: acc.hp + c.hp, stamina: acc.stamina + c.stamina }), { hp: 0, stamina: 0 });
    const hpCap = Math.max(1, Math.floor(b.maxHp * MAX_HP_LOSS_FRACTION));
    const powerCap = b.incomingAtk !== undefined && b.defense !== undefined ? Math.max(1, Math.floor(b.maxHp * powerCapFraction(b.incomingAtk, b.defense))) : hpCap;
    // "Defeated" is explicit and final: a fighter already at half life or less who is declared unable to go on drops to zero.
    const declaredDown = (verdict.defeated ?? []).some((n) => norm(n) === norm(b.name)) && b.hp <= hpCap;
    const hpLoss = b.protectedThisExchange ? 0 : declaredDown ? Math.max(0, b.hp) : Math.min(asked.hp, hpCap, powerCap, Math.max(0, b.hp));
    const staminaLoss = b.protectedThisExchange ? 0 : Math.min(asked.stamina, MAX_STAMINA_LOSS, Math.max(0, b.stamina ?? MAX_STAMINA_LOSS));
    return {
      name: b.name,
      hpLoss,
      staminaLoss,
      hpAfter: Math.max(0, b.hp - hpLoss),
      staminaAfter: b.stamina === undefined ? null : Math.max(0, b.stamina - staminaLoss),
    };
  });
}

/** When the AI is unreachable nothing happens: no invented damage, and the round does not count. */
export const NO_VERDICT_TEXT = "(El árbitro no pudo juzgar este intercambio a tiempo. No se ha perdido vida ni aguante: describe tu movimiento de nuevo.)";

export interface StubActor {
  name: string;
  side: "player" | "ally" | "enemy";
  maxHp: number;
  sheet?: string;
}

const sheetPower = (sheet?: string): number => {
  const m = /ataque (\d+), defensa (\d+)/.exec(sheet ?? "");
  return m ? Number(m[1]) + Number(m[2]) : 20;
};

/**
 * A deterministic stand-in for the AI referee, used only by the scripted checks (REFEREE_STUB=1): the side with
 * more combined attack + defence wins the exchange by a margin. Never used in the running game.
 */
export function stubVerdict(actors: StubActor[], fleeAttempt = false): RefereeVerdict {
  const enemies = actors.filter((a) => a.side === "enemy");
  const friends = actors.filter((a) => a.side !== "enemy");
  const [g1, g2] = enemies.length > 0 ? [friends, enemies] : [actors.slice(0, 1), actors.slice(1, 2)];
  const p1 = g1.reduce((n, a) => n + sheetPower(a.sheet), 0);
  const p2 = g2.reduce((n, a) => n + sheetPower(a.sheet), 0);
  const share = p1 / Math.max(1, p1 + p2);
  if (fleeAttempt) {
    // A flight succeeds when the fugitive is at least as fast as the pursuer.
    const speed = (a?: StubActor) => Number(/velocidad (\d+)/.exec(a?.sheet ?? "")?.[1] ?? 0);
    const escaped = speed(g1[0]) >= speed(g2[0]);
    return {
      narration: escaped ? "El árbitro de pruebas deja escapar al fugitivo por ser más rápido que su perseguidor." : "El árbitro de pruebas alcanza al fugitivo: su perseguidor es más rápido.",
      escaped,
      changes: escaped ? [] : [{ name: g1[0]?.name ?? "", hp: Math.max(1, Math.round((g1[0]?.maxHp ?? 10) * 0.1)), stamina: 5 }],
    };
  }
  const lose = (a: StubActor, winShare: number) => Math.max(1, Math.round(a.maxHp * (0.05 + 0.45 * winShare)));
  return {
    narration: "El árbitro de pruebas resuelve este intercambio según la fuerza relativa de cada bando.",
    changes: [...g1.map((a) => ({ name: a.name, hp: lose(a, 1 - share), stamina: 5 })), ...g2.map((a) => ({ name: a.name, hp: lose(a, share), stamina: 5 }))],
    finalBlow: g1[0]?.name,
  };
}

// ---------------------------------------------------------------------------------------------
// Mano Negra guard (Reglasrol.txt): the referee may decide RESULTS, but never writes acts the player
// did not write, and the rival's next attack is only ever an intention the player answers.
// ---------------------------------------------------------------------------------------------

/** A hit written as already landed on the player ("te golpea", "el puño conecta", "sientes el golpe"). */
const LANDED_ON_PLAYER = /\b(te\s+(golpea|golpeó|alcanza|alcanzó|da|dio|hiere|hirió|impacta|impactó|roza|derriba|atraviesa|corta|cortó|lanza|lanzó)|conecta|conectó|impacta|impactó|sientes|sentiste|acierta|acertó)(?=[\s.,;:!?…"”»]|$)/i;

/** "si conecta", "si llega a impactar", "en caso de que acierte": a hit that is only a possibility is exactly what an intention should say. */
const CONDITIONAL_HIT = /\b(si|cuando|de|en\s+caso\s+de\s+que|por\s+si)\s+(el\s+(golpe|impacto|ataque|puñetazo|corte)\s+)?(llega(ra)?\s+a\s+)?(conect|impact|acert|alcanz|dar|golpe)\w*/gi;

/** Second-person DEFENCES the player may not have written: dodges, blocks, moves out of the way. */
const UNWRITTEN_DEFENCE = /\b(logras|consigues|lograste|conseguiste)\s+(esquivar|bloquear|desviar|evitar|parar|detener|apartarte|agacharte)|\b(esquivas|esquivaste|bloqueas|bloqueaste|desv[ií]as|desviaste|detienes|detuviste|paras|paraste|evitas|evitaste|retrocedes|retrocediste|saltas|saltaste|te\s+agachas|te\s+agachaste|te\s+apartas|te\s+apart[oó]|te\s+echas|te\s+hechas)\b/i;

/** Second-person ATTACKS or advances the player may not have written. */
const UNWRITTEN_OFFENCE = /\b(logras|consigues|lograste|conseguiste)\s+(contraatacar|responder|golpear|cortar|herir|alcanzar)|\b(contraatacas|contraatacaste|golpeas|golpeaste|cortas|cortaste|atacas|atacaste|te\s+lanzas|te\s+abalanzas|avanzas|avanzaste|embistes|respondes|respondiste)\b/i;

/** First-person defence the player really wrote (a bare "activo mi Haki de observación" is not one). */
const WROTE_DEFENCE = /esquiv|bloque|desv[ií]|detend|detien|evit|agach|apart|retroced|\bsalt(o|ar|aría|aria)\b|\bpar(o|ar|aría|aria)\b|contraat|agarr|me\s+ech|me\s+cubr|cubrir[ií]a|cubro|proteg|me\s+defiend|defenderm/i;

/** First-person attack the player really wrote ("intenta atacarme" addressed to the rival is not one). */
const WROTE_OFFENCE = /\b(ataco|atacar[ií]a|golpeo|golpear[ií]a|corto|cortar[ií]a|lanzo|lanzar[ií]a|doy|dar[ií]a|intento|embisto|embestir[ií]a|corro|correr[ií]a|avanzo|avanzar[ií]a|patead|puñetaz|tajo|contraat|me\s+lanz|me\s+abalanz|dispar|desenv[ai]in|desenfund|sacar[ií]a|\bsaco\b|ir[ií]a|\bvoy\b|\biré\b|impuls|cubrir[ií]a|hac[ií]a|hacia\s+(mi|el|su)|apunt|arremet|carg(o|ar[ií]a)|\bsalto\b|saltar[ií]a)/i;

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…»”"])\s+/).filter((s) => s.trim().length > 0);
}

export interface SanitizeReport {
  removed: string[];
}

/**
 * Drops, sentence by sentence, whatever breaks the roleplay rules:
 *  - in the rival's intention: anything that reads as a hit already landed on the player;
 *  - anywhere: a dodge, block, counter or move attributed to a player who did not write one.
 * `playerText` is everything the players wrote this turn (their intentions are the only acts they own).
 */
export function sanitizeVerdict(verdict: RefereeVerdict, playerText: string, rivalName: string, playerName?: string): { verdict: RefereeVerdict; report: SanitizeReport } {
  const removed: string[] = [];
  const wroteDefence = WROTE_DEFENCE.test(playerText);
  const wroteOffence = WROTE_OFFENCE.test(playerText);
  const thirdPerson = playerName ? new RegExp("^[\"'«“—\\-\\s]*" + playerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i") : null;
  const defeatAllowed = (verdict.defeated ?? []).length > 0;
  const keepSentence = (sentence: string, isIntent: boolean): boolean => {
    // An announced fall that the numbers do not back up would leave the fight open on a finished-sounding scene.
    if (!defeatAllowed && DEFEAT_PHRASES.test(sentence)) {
      removed.push(sentence);
      return false;
    }
    // The player is always "tú": a sentence that opens with their name is the narrator acting for them.
    if (thirdPerson && thirdPerson.test(sentence)) {
      removed.push(sentence);
      return false;
    }
    if (isIntent && LANDED_ON_PLAYER.test(sentence.replace(CONDITIONAL_HIT, " "))) {
      removed.push(sentence);
      return false;
    }
    // "Si esquivas, girará..." is the rival planning for both answers, not the player acting.
    const hypothetical = isIntent && /\b(si|en\s+caso\s+de\s+que|por\s+si|en\s+cuanto)\b/i.test(sentence);
    if (!hypothetical && ((!wroteDefence && UNWRITTEN_DEFENCE.test(sentence)) || (!wroteOffence && UNWRITTEN_OFFENCE.test(sentence)))) {
      removed.push(sentence);
      return false;
    }
    return true;
  };
  const intent = verdict.rivalIntent ? splitSentences(verdict.rivalIntent).filter((s) => keepSentence(s, true)).join(" ") : "";
  const intentFinal = verdict.rivalIntent && !intent ? `${rivalName} se prepara para atacar de nuevo: describe cómo te dispones a recibirlo.` : intent;
  // Everything before the intention: the resolution and the reaction.
  const head = verdict.rivalIntent && verdict.narration.endsWith(verdict.rivalIntent) ? verdict.narration.slice(0, verdict.narration.length - verdict.rivalIntent.length).trimEnd() : verdict.narration;
  const headClean = head
    .split(/\n{2,}/)
    .map((par) => splitSentences(par).filter((s) => keepSentence(s, false)).join(" "))
    .filter((par) => par.length > 0)
    .join("\n\n");
  const narration = [headClean, intentFinal].filter(Boolean).join("\n\n");
  return { verdict: { ...verdict, narration: narration.length >= 12 ? narration : verdict.narration, ...(verdict.rivalIntent ? { rivalIntent: intentFinal } : {}) }, report: { removed } };
}

// ---------------------------------------------------------------------------------------------
// Coherence: what the text says must match what the numbers do. A scene that announces a fallen rival
// while the fight stays open (reported 2026-09-25) is the failure this guards against.
// ---------------------------------------------------------------------------------------------

/** Sentences that say someone can no longer fight. */
export const DEFEAT_PHRASES = /\b(cae\s+(inerte|muert[oa]|inconsciente|desplomad[oa]|de\s+espaldas|sin\s+vida)|queda(n)?\s+(inconsciente|fuera\s+de\s+combate|inerte|sin\s+vida)|(ha\s+)?muert[oa]\b|\bmuere\b|sin\s+vida|no\s+puede\s+(continuar|seguir)|sin\s+poder\s+(continuar|seguir)|ha\s+llegado\s+a\s+su\s+fin|cuerpo\s+cae|pierde\s+el\s+conocimiento|queda\s+derrotad[oa]|victoria\s+es\s+tuya)/i;

const MIN_INTENT_CHARS = 350;

export function checkConsistency(verdict: RefereeVerdict, bounds: RefereeBound[]): string[] {
  const issues: string[] = [];
  const declared = (verdict.defeated ?? []).map(norm);
  for (const name of verdict.defeated ?? []) {
    const b = bounds.find((x) => norm(x.name) === norm(name));
    if (b && b.hp > Math.floor(b.maxHp * MAX_HP_LOSS_FRACTION)) {
      issues.push(`Declaras derrotado a ${b.name}, pero le queda ${b.hp}/${b.maxHp} de vida (más de la mitad): en este intercambio no puede caer. Déjalo herido, tambaleante o de rodillas, pero en pie o consciente.`);
    }
  }
  if (declared.length === 0 && DEFEAT_PHRASES.test(verdict.narration)) {
    issues.push('Narras que alguien cae, muere, queda inconsciente o no puede seguir, pero no lo pusiste en "derrotados". O lo listas en "derrotados" (solo si su vida está por debajo de la mitad) o reescribes sin darlo por caído.');
  }
  if (verdict.rivalIntent && declared.length === 0 && verdict.rivalIntent.trim().length < MIN_INTENT_CHARS) {
    issues.push("La \"intencion_rival\" es demasiado corta: debe ser una SECUENCIA larga y estructurada (5 a 10 frases) con una finta o preparación, el golpe principal con su técnica nombrada y un seguimiento por si el jugador esquiva o bloquea (todo en grado de tentativa).");
  }
  return issues;
}

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

/** Models wrap JSON in fences or chatter: take the first balanced object and validate it. Anything malformed is null. */
export function parseRefereeVerdict(raw: string): RefereeVerdict | null {
  const json = firstJsonObject(raw);
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
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
    return { narration, ...(intent ? { rivalIntent: intent } : {}), changes, ...(fb ? { finalBlow: fb } : {}) };
  } catch {
    return null;
  }
}

export interface RefereeBound {
  name: string;
  hp: number;
  maxHp: number;
  stamina?: number;
  /** Nothing has been thrown at this fighter yet (e.g. they started the fight): the verdict cannot hurt them. */
  protectedThisExchange?: boolean;
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
    const hpLoss = b.protectedThisExchange ? 0 : Math.min(asked.hp, hpCap, Math.max(0, b.hp));
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
export function stubVerdict(actors: StubActor[]): RefereeVerdict {
  const enemies = actors.filter((a) => a.side === "enemy");
  const friends = actors.filter((a) => a.side !== "enemy");
  const [g1, g2] = enemies.length > 0 ? [friends, enemies] : [actors.slice(0, 1), actors.slice(1, 2)];
  const p1 = g1.reduce((n, a) => n + sheetPower(a.sheet), 0);
  const p2 = g2.reduce((n, a) => n + sheetPower(a.sheet), 0);
  const share = p1 / Math.max(1, p1 + p2);
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
const LANDED_ON_PLAYER = /\b(te\s+(golpea|golpe[oó]|alcanza|alcanz[oó]|da|dio|hiere|hiri[oó]|impacta|impact[oó]|roza|derriba|atraviesa|corta|cort[oó]|lanza|lanz[oó])|conecta|conect[oó]|impacta|impact[oó]|sientes|sentiste|acierta|acert[oó])\b/i;

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
  const keepSentence = (sentence: string, isIntent: boolean): boolean => {
    // The player is always "tú": a sentence that opens with their name is the narrator acting for them.
    if (thirdPerson && thirdPerson.test(sentence)) {
      removed.push(sentence);
      return false;
    }
    if (isIntent && LANDED_ON_PLAYER.test(sentence.replace(CONDITIONAL_HIT, " "))) {
      removed.push(sentence);
      return false;
    }
    if ((!wroteDefence && UNWRITTEN_DEFENCE.test(sentence)) || (!wroteOffence && UNWRITTEN_OFFENCE.test(sentence))) {
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
  return { verdict: { ...verdict, narration: narration.length >= 30 ? narration : verdict.narration, ...(verdict.rivalIntent ? { rivalIntent: intentFinal } : {}) }, report: { removed } };
}

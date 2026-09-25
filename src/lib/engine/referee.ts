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
  narration: string;
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
    const narration = typeof obj.narracion === "string" ? obj.narracion : typeof obj.narration === "string" ? obj.narration : "";
    if (narration.trim().length < 30) return null;
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
    return { narration: narration.trim(), changes, ...(fb ? { finalBlow: fb } : {}) };
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

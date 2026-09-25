import type { Rng } from "./rng";

export type ItemKind = "Consumible" | "Herramienta" | "Tesoro";

export interface ItemEffect {
  hp?: number;
  stamina?: number;
  /** Reduces the Poneglyph pursuit heat. */
  heat?: number;
  berries?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  /** Buying price; selling gives SELL_FRACTION of it. */
  price: number;
  effect?: ItemEffect;
  maxStack: number;
  /** Lowest island danger where it turns up as loot (99 = never dropped). */
  minDanger: number;
  /** Island specialty: sold only by the merchant of these islands. */
  soldAt?: string[];
}

export const ITEM_CATALOG: ItemDef[] = [
  { id: "vendaje", name: "Vendaje", kind: "Consumible", description: "Cierra heridas superficiales. Recupera 25 de vida.", price: 300, effect: { hp: 25 }, maxStack: 9, minDanger: 1 },
  { id: "racion", name: "Ración de viaje", kind: "Consumible", description: "Carne seca y galleta. Recupera 30 de aguante.", price: 200, effect: { stamina: 30 }, maxStack: 9, minDanger: 1 },
  { id: "sake", name: "Botella de sake", kind: "Consumible", description: "Calienta el cuerpo. Recupera 20 de aguante y 8 de vida.", price: 500, effect: { stamina: 20, hp: 8 }, maxStack: 6, minDanger: 2 },
  { id: "botiquin", name: "Botiquín de campaña", kind: "Consumible", description: "Suturas y ungüentos. Recupera 60 de vida.", price: 1500, effect: { hp: 60 }, maxStack: 5, minDanger: 4 },
  { id: "elixir", name: "Elixir de la doctora", kind: "Consumible", description: "Receta de Drum. Recupera 40 de vida y 40 de aguante.", price: 4000, effect: { hp: 40, stamina: 40 }, maxStack: 3, minDanger: 6 },
  { id: "papeles", name: "Papeles falsos", kind: "Consumible", description: "Una identidad prestada: baja 30 de persecución por Poneglifos.", price: 6000, effect: { heat: 30 }, maxStack: 3, minDanger: 5 },
  { id: "logpose", name: "Log Pose", kind: "Herramienta", description: "Una brújula que apunta a la siguiente isla. Sin él, la Grand Line se traga a los marineros.", price: 5000, maxStack: 1, minDanger: 3 },
  { id: "denden", name: "Den Den Mushi portátil", kind: "Herramienta", description: "Un caracol de comunicaciones. Útil para recibir rumores.", price: 3500, maxStack: 1, minDanger: 3 },
  { id: "mapa", name: "Mapa del tesoro", kind: "Tesoro", description: "Un mapa viejo con una X. Al usarlo, encuentras un pequeño botín.", price: 2000, effect: { berries: 1500 }, maxStack: 3, minDanger: 2 },
  { id: "reliquia", name: "Reliquia antigua", kind: "Tesoro", description: "Cerámica de una era olvidada. Los coleccionistas pagan bien.", price: 8000, maxStack: 5, minDanger: 4 },
  { id: "oasis", name: "Agua de oasis", kind: "Consumible", description: "Agua fría de los manantiales de Alabasta. Recupera 60 de aguante.", price: 900, effect: { stamina: 60 }, maxStack: 6, minDanger: 99, soldAt: ["Alabasta"] },
  { id: "banquete", name: "Banquete del Baratie", kind: "Consumible", description: "Un plato de los cocineros del Baratie. Recupera 50 de vida y 50 de aguante.", price: 2500, effect: { hp: 50, stamina: 50 }, maxStack: 4, minDanger: 99, soldAt: ["Restaurante Baratie"] },
  { id: "unguento", name: "Ungüento Kuja", kind: "Consumible", description: "Hierbas de Amazon Lily. Recupera 80 de vida.", price: 3000, effect: { hp: 80 }, maxStack: 4, minDanger: 99, soldAt: ["Amazon Lily"] },
  { id: "infusion", name: "Infusión mink", kind: "Consumible", description: "Un brebaje de la selva de Zou. Recupera 70 de aguante y 20 de vida.", price: 2200, effect: { stamina: 70, hp: 20 }, maxStack: 4, minDanger: 99, soldAt: ["Zou"] },
  { id: "sakewano", name: "Sake de Wano", kind: "Consumible", description: "Sake de arroz de la tierra de los samuráis. Recupera 45 de aguante y 30 de vida.", price: 1800, effect: { stamina: 45, hp: 30 }, maxStack: 4, minDanger: 99, soldAt: ["País de Wano"] },
  { id: "perlasirena", name: "Perla de sirena", kind: "Tesoro", description: "Una perla de la Isla Gyojin, tan pura que las sirenas la regalan a quien protege su hogar.", price: 12000, maxStack: 5, minDanger: 99, soldAt: ["Isla Gyojin"] },
  { id: "estrella", name: "Estrella del Toro Negro", kind: "Consumible", description: "Una ración de guerra de los Black Bulls. Recupera 100 de vida y 60 de aguante.", price: 9000, effect: { hp: 100, stamina: 60 }, maxStack: 2, minDanger: 99, soldAt: ["Isla del Toro Negro"] },
  { id: "perla", name: "Perla del mar profundo", kind: "Tesoro", description: "Una perla enorme, de las que se pagan a precio de barco.", price: 20000, maxStack: 5, minDanger: 7 },
];

const BY_ID = new Map(ITEM_CATALOG.map((i) => [i.id, i]));
export function getItemDef(id: string): ItemDef | undefined {
  return BY_ID.get(id);
}

/** What this island's merchant sells on top of the common stock. */
export function specialtyIdsFor(islandName: string): string[] {
  return ITEM_CATALOG.filter((i) => i.soldAt?.includes(islandName)).map((i) => i.id);
}

export const SELL_FRACTION = 0.4;
export const INVENTORY_SLOTS = 24;

export function sellValue(def: ItemDef): number {
  return Math.max(1, Math.floor(def.price * SELL_FRACTION));
}

export interface Stack {
  id: string;
  quantity: number;
}

export type AddResult = { ok: true; stacks: Stack[]; added: number } | { ok: false; reason: string };

/** Merges into an existing stack up to maxStack, then opens a new slot; refuses when there is no room, never dropping things silently. */
export function addToInventory(stacks: Stack[], itemId: string, quantity: number): AddResult {
  const def = getItemDef(itemId);
  if (!def) return { ok: false, reason: "Objeto desconocido." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Cantidad inválida." };
  const next = stacks.map((s) => ({ ...s }));
  let left = quantity;
  for (const s of next) {
    if (left === 0) break;
    if (s.id !== itemId) continue;
    const room = def.maxStack - s.quantity;
    const put = Math.min(room, left);
    s.quantity += put;
    left -= put;
  }
  while (left > 0) {
    if (next.length >= INVENTORY_SLOTS) return { ok: false, reason: "La mochila está llena." };
    const put = Math.min(def.maxStack, left);
    next.push({ id: itemId, quantity: put });
    left -= put;
  }
  return { ok: true, stacks: next, added: quantity };
}

export interface BodyState {
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  heat: number;
  berries: number;
}

export type UseResult = { ok: true; state: BodyState; consumed: boolean; message: string } | { ok: false; reason: string };

export function useItem(def: ItemDef, s: BodyState): UseResult {
  if (!def.effect) return { ok: false, reason: `${def.name} no se puede usar así: es ${def.kind === "Herramienta" ? "una herramienta que llevas contigo" : "algo para vender"}.` };
  const e = def.effect;
  const next = { ...s };
  const parts: string[] = [];
  if (e.hp) {
    if (s.hp >= s.maxHp && !e.stamina && !e.heat && !e.berries) return { ok: false, reason: "Ya estás con toda la vida." };
    next.hp = Math.min(s.maxHp, s.hp + e.hp);
    if (next.hp > s.hp) parts.push(`+${next.hp - s.hp} de vida`);
  }
  if (e.stamina) {
    next.stamina = Math.min(s.maxStamina, s.stamina + e.stamina);
    if (next.stamina > s.stamina) parts.push(`+${next.stamina - s.stamina} de aguante`);
  }
  if (e.heat) {
    if (s.heat <= 0 && !e.hp && !e.stamina) return { ok: false, reason: "Nadie te persigue por Poneglifos: no hace falta." };
    next.heat = Math.max(0, s.heat - e.heat);
    if (next.heat < s.heat) parts.push(`-${s.heat - next.heat} de persecución`);
  }
  if (e.berries) {
    next.berries = s.berries + e.berries;
    parts.push(`+${e.berries} berries`);
  }
  if (parts.length === 0) return { ok: false, reason: "Ahora mismo no te haría ningún efecto." };
  return { ok: true, state: next, consumed: true, message: `Usas ${def.name}: ${parts.join(", ")}.` };
}

export function removeOne(stacks: Stack[], itemId: string): Stack[] | null {
  const idx = stacks.findIndex((s) => s.id === itemId);
  if (idx < 0) return null;
  const next = stacks.map((s) => ({ ...s }));
  next[idx].quantity -= 1;
  return next.filter((s) => s.quantity > 0);
}

/** What a successful action might leave behind: a small chance, more often on dangerous islands, never a jackpot from small fry. */
export function rollLoot(rng: Rng, danger: number, outcome: "success" | "critical_success"): Stack | null {
  const chance = outcome === "critical_success" ? 0.4 : 0.15;
  if (rng() >= chance) return null;
  const pool = ITEM_CATALOG.filter((i) => i.minDanger <= danger);
  if (pool.length === 0) return null;
  // Cheap items are far more common than pricey ones.
  const weights = pool.map((i) => 1 / Math.sqrt(i.price));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return { id: pool[i].id, quantity: 1 };
  }
  return { id: pool[pool.length - 1].id, quantity: 1 };
}

/** What an NPC of this kind plausibly carries: shown on crewmate cards and the codex, and told to the narrator so nobody pulls out what they do not own. */
export function belongingsFor(kind: string): string[] {
  const k = kind.toLowerCase();
  if (/(medic|doctor|médico)/.test(k)) return ["Botiquín de campaña", "Vendajes", "Instrumental de cirugía"];
  if (/(naveg|navig|cart)/.test(k)) return ["Log Pose", "Cartas náuticas", "Brújula"];
  if (/(cook|cocin)/.test(k)) return ["Raciones de viaje", "Cuchillos de cocina", "Sake"];
  if (/(carpint|shipwright|tecn)/.test(k)) return ["Herramientas", "Planos", "Clavos y madera"];
  if (/(sniper|tirador|arque)/.test(k)) return ["Munición variada", "Catalejo", "Raciones de viaje"];
  if (/(music|músic)/.test(k)) return ["Instrumento", "Partituras"];
  if (/(swordsman|espad|fighter|luchador|guerrero|bruiser)/.test(k)) return ["Piedra de afilar", "Vendajes", "Sake"];
  if (/(marine|marina|soldado)/.test(k)) return ["Uniforme reglamentario", "Grilletes", "Den Den Mushi portátil"];
  if (/(revolucion)/.test(k)) return ["Papeles falsos", "Den Den Mushi portátil"];
  if (/(pirat|capit)/.test(k)) return ["Mapa del tesoro", "Sake", "Bandera pirata"];
  return ["Raciones de viaje", "Vendajes"];
}

export function describeInventory(stacks: Stack[]): string {
  const parts = stacks.map((s) => {
    const d = getItemDef(s.id);
    return d ? `${d.name}${s.quantity > 1 ? ` x${s.quantity}` : ""}` : null;
  });
  const list = parts.filter(Boolean);
  return list.length ? `lleva en la mochila: ${list.join(", ")}` : "lleva la mochila vacía";
}

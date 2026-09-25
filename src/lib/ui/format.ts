// Pure presentation helpers shared by every screen (kept out of components so they can be unit tested).

export function percent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("es-ES");
}

export function formatBerries(n: number): string {
  return `฿ ${formatNumber(n)}`;
}

// "1,2 mil millones" style short form for big canon bounties on small screens.
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const fmt = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: v < 10 ? 1 : 0 });
  if (abs >= 1e9) return `${fmt(n / 1e9)} mil M`;
  if (abs >= 1e6) return `${fmt(n / 1e6)} M`;
  if (abs >= 1e4) return `${fmt(n / 1e3)} mil`;
  return formatNumber(n);
}

export function formatMinutes(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface VitalsSnapshot {
  level: number;
  hp: number;
  berries: number;
  bounty: number;
  notoriety: number;
  rankTitle: string;
  attributePoints: number;
}

export interface DeltaToast {
  kind: "level" | "rank" | "berries" | "bounty" | "merit" | "damage" | "heal" | "points";
  text: string;
  tone: "gold" | "blood" | "jade";
}

// What changed between two polls that deserves a floating notice. Never invents anything: it only compares
// numbers the server already sent.
export function diffVitals(prev: VitalsSnapshot | null, next: VitalsSnapshot): DeltaToast[] {
  if (!prev) return [];
  const out: DeltaToast[] = [];
  if (next.level > prev.level) out.push({ kind: "level", text: `¡Nivel ${next.level}!`, tone: "gold" });
  if (next.rankTitle !== prev.rankTitle && next.rankTitle) out.push({ kind: "rank", text: `Nuevo rango: ${next.rankTitle}`, tone: "gold" });
  if (next.attributePoints > prev.attributePoints) {
    const d = next.attributePoints - prev.attributePoints;
    out.push({ kind: "points", text: `+${d} punto${d === 1 ? "" : "s"} de atributo`, tone: "jade" });
  }
  if (next.bounty > prev.bounty) out.push({ kind: "bounty", text: `Recompensa +${formatBerries(next.bounty - prev.bounty)}`, tone: "gold" });
  if (next.notoriety > prev.notoriety) out.push({ kind: "merit", text: `Mérito +${formatNumber(next.notoriety - prev.notoriety)}`, tone: "gold" });
  if (next.berries !== prev.berries) {
    const d = next.berries - prev.berries;
    out.push({ kind: "berries", text: `${d > 0 ? "+" : "−"}${formatBerries(Math.abs(d))}`, tone: d > 0 ? "jade" : "blood" });
  }
  if (next.hp < prev.hp) out.push({ kind: "damage", text: `−${formatNumber(prev.hp - next.hp)} vida`, tone: "blood" });
  else if (next.hp > prev.hp) out.push({ kind: "heal", text: `+${formatNumber(next.hp - prev.hp)} vida`, tone: "jade" });
  return out;
}

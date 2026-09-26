import { CELL_LABELS } from "./impel-down";

const CANON_CELLS = [100_000_000, 300_000_000, 600_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000];

/** Impel Down level (1-6) for a captured canon actor: by canon bounty when known, otherwise by raw power. */
export function actorPrisonCell(canonBounty: number | null, powerLevel: number): number {
  if (canonBounty && canonBounty > 0) {
    let cell = 1;
    CANON_CELLS.forEach((t, i) => {
      if (canonBounty >= t) cell = i + 1;
    });
    return Math.min(6, cell);
  }
  return Math.max(1, Math.min(6, Math.floor((powerLevel - 40) / 10)));
}

export function prisonLabel(cell: number | null | undefined): string {
  return cell ? `Impel Down, ${CELL_LABELS[cell] ?? `nivel ${cell}`}` : "Impel Down";
}

export interface WorldState {
  yonko: string[];
  prisoners: { name: string; cell: number | null }[];
  defeated: string[];
  fallen: string[];
  events: string[];
}

/** The facts of the world that every narrator must treat as true, whatever the scene. Empty parts are omitted. */
export function describeWorldState(s: WorldState): string {
  const parts: string[] = [];
  if (s.yonko.length) parts.push(`Yonko vigentes: ${s.yonko.join(", ")} (nadie más ostenta ese título)`);
  if (s.prisoners.length) parts.push(`PRESOS (capturados, siguen encerrados: nunca aparecen libres ni actuando): ${s.prisoners.map((p) => `${p.name} en ${prisonLabel(p.cell)}`).join("; ")}`);
  if (s.defeated.length) parts.push(`Derrotados, sin poder ni título actual: ${s.defeated.join(", ")}`);
  if (s.fallen.length) parts.push(`Fallecidos: ${s.fallen.join(", ")}`);
  if (s.events.length) parts.push(`Eventos en curso: ${s.events.join("; ")}`);
  if (!parts.length) return "";
  return `ESTADO DEL MUNDO (verdad absoluta, no lo contradigas nunca): ${parts.join(". ")}.`;
}

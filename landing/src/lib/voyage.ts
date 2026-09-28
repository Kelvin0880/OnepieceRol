export const SEA_STOPS = [
  { id: "east-blue", name: "East Blue", section: "viaje" },
  { id: "reverse-mountain", name: "Reverse Mountain", section: "reverse-mountain" },
  { id: "paradise", name: "Paradise", section: "paradise" },
  { id: "nuevo-mundo", name: "Nuevo Mundo", section: "nuevo-mundo" },
  { id: "laugh-tale", name: "Laugh Tale", section: "zarpa" },
] as const;

export const MAX_SEA = SEA_STOPS.length - 1;

export interface Anchor {
  y: number;
  sea: number;
}

const clampSea = (v: number) => Math.min(MAX_SEA, Math.max(0, v));

export function buildAnchors(raw: Anchor[]): Anchor[] {
  return raw
    .filter((a) => Number.isFinite(a.y) && Number.isFinite(a.sea))
    .map((a) => ({ y: a.y, sea: clampSea(a.sea) }))
    .sort((a, b) => a.y - b.y);
}

/** Voyage position for a viewport-centre y: piecewise-linear between the centres of the sections (anchors must be sorted). */
export function seaAt(anchors: Anchor[], y: number): number {
  if (anchors.length === 0) return 0;
  if (y <= anchors[0].y) return anchors[0].sea;
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (y <= b.y) {
      const f = b.y === a.y ? 1 : (y - a.y) / (b.y - a.y);
      return a.sea + (b.sea - a.sea) * f;
    }
  }
  return anchors[anchors.length - 1].sea;
}

export function stopIndexAt(sea: number): number {
  return Math.round(clampSea(sea));
}

/** 0..1 visibility of something that lives around one voyage point; it fades in before and out after. */
export function presence(v: number, center: number, before = 0.6, after = 0.6, soft = 0.25): number {
  const rise = smoothstep(center - before - soft, center - before + soft, v);
  const fall = 1 - smoothstep(center + after - soft, center + after + soft, v);
  return Math.min(rise, fall);
}

export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * The fixed gazetteer of an island: its named places, history, customs, rumours and who can usually be found where.
 * The narrator gets it on every scene so it can describe the island richly without inventing places or people.
 */

export interface IslandPlace {
  name: string;
  kind: string;
  description: string;
  /** Resident names usually found here. */
  regulars: string[];
}

export interface IslandLore {
  island: string;
  atmosphere: string;
  history: string;
  customs: string[];
  places: IslandPlace[];
  rumors: string[];
}

export interface LoreMission {
  title: string;
  brief: string;
  progress: number;
  target: number;
  giver?: string | null;
  targetName?: string | null;
}

const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function placeNames(lore: IslandLore | null | undefined): string[] {
  return lore ? lore.places.map((p) => p.name) : [];
}

/** The island block for narrator prompts: what the island is, its places and people, and every active mission in full. */
export function islandLoreBlock(p: {
  name: string;
  description: string;
  arcHook: string | null;
  danger: number;
  control: string | null;
  lore: IslandLore | null;
  missions: LoreMission[];
}): string {
  const lines: string[] = [`GUÍA DE ${p.name.toUpperCase()} (datos fijos del mundo: úsalos para describir y ambientar; es lo que ES esta isla)`];
  lines.push(`- Qué es: ${clip(p.description, 700)}`);
  if (p.arcHook) lines.push(`- Conflicto actual de la isla: ${clip(p.arcHook, 500)}`);
  lines.push(`- Peligro ${p.danger}/10${p.control ? `; la controla ${p.control}` : ""}.`);
  if (p.lore) {
    if (p.lore.atmosphere) lines.push(`- Ambiente: ${clip(p.lore.atmosphere, 400)}`);
    if (p.lore.history) lines.push(`- Historia: ${clip(p.lore.history, 500)}`);
    if (p.lore.customs.length) lines.push(`- Costumbres: ${p.lore.customs.slice(0, 5).map((c) => clip(c, 160)).join(" | ")}`);
    if (p.lore.places.length) {
      lines.push("- LUGARES (los únicos sitios con nombre de la isla; puedes describir rincones sin nombre propio):");
      for (const pl of p.lore.places.slice(0, 12)) {
        lines.push(`  · ${pl.name} (${pl.kind}): ${clip(pl.description, 260)}${pl.regulars.length ? ` Suele estar: ${pl.regulars.join(", ")}.` : ""}`);
      }
    }
    if (p.lore.rumors.length) lines.push(`- Rumores que corren (ganchos que puedes sembrar, sin darlos por ciertos): ${p.lore.rumors.slice(0, 5).map((r) => clip(r, 200)).join(" | ")}`);
  }
  if (p.missions.length) {
    lines.push("- MISIONES ACTIVAS del personaje aquí (llévalas en la historia: haz que sus pistas, lugares y personas aparezcan cuando el jugador las persiga; solo el sistema marca progreso y paga, NUNCA anuncies una misión completada, recompensas ni subidas de nivel):");
    for (const m of p.missions) {
      const who = [m.giver ? `la encarga ${m.giver}` : "", m.targetName ? `objetivo: ${m.targetName}` : ""].filter(Boolean).join("; ");
      lines.push(`  · «${m.title}» ${m.progress}/${m.target}: ${clip(m.brief, 360)}${who ? ` (${who})` : ""}`);
    }
  }
  return lines.join("\n");
}

/** Validates and normalises an AI-written gazetteer; null when it is too thin to be useful. */
export function parseIslandLore(raw: string, island: string, residentNames: string[]): IslandLore | null {
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const v = JSON.parse(m[0]) as Record<string, unknown>;
    const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
    const arr = (x: unknown) => (Array.isArray(x) ? x : []);
    const known = new Set(residentNames);
    const seen = new Set<string>();
    const places: IslandPlace[] = [];
    for (const raw of arr(v.places)) {
      const r = raw as Record<string, unknown>;
      const name = str(r.name, 80);
      const description = str(r.description, 400);
      if (!name || !description || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      places.push({ name, kind: str(r.kind, 40) || "lugar", description, regulars: arr(r.regulars).map((x) => str(x, 60)).filter((x) => known.has(x)) });
    }
    const lore: IslandLore = {
      island,
      atmosphere: str(v.atmosphere, 500),
      history: str(v.history, 700),
      customs: arr(v.customs).map((x) => str(x, 200)).filter(Boolean).slice(0, 6),
      places: places.slice(0, 12),
      rumors: arr(v.rumors).map((x) => str(x, 240)).filter(Boolean).slice(0, 6),
    };
    return lore.places.length >= 4 && lore.history ? lore : null;
  } catch {
    return null;
  }
}

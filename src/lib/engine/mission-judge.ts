import type { MissionKind } from "./missions";

export interface JudgedMission {
  id: string;
  advance: boolean;
  hint?: string;
}

/** Only goals about what happened in the story are judged; training and travel are counted exactly by the engine. */
export function judgeableKinds(includeExplore: boolean): MissionKind[] {
  return includeExplore ? ["win_fights", "spare", "explore"] : ["win_fights", "spare"];
}

const truthy = (v: unknown) => v === true || (typeof v === "string" && /^(s[ií]|true|avanza|cumplida?)$/i.test(v.trim())) || v === 1;

/** {"misiones":[{"id","avanza","pista"}]}; unknown ids are dropped, at most one entry per mission, tolerant of prose around the JSON. */
export function parseMissionVerdict(raw: string, ids: string[]): JudgedMission[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = o.misiones ?? o.missions;
  if (!Array.isArray(list)) return null;
  const seen = new Set<string>();
  const out: JudgedMission[] = [];
  for (const it of list) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const id = String(r.id ?? "");
    if (!ids.includes(id) || seen.has(id)) continue;
    seen.add(id);
    const hint = typeof (r.pista ?? r.hint) === "string" ? String(r.pista ?? r.hint).trim().slice(0, 160) : "";
    out.push({ id, advance: truthy(r.avanza ?? r.advance), hint: hint || undefined });
  }
  return out;
}

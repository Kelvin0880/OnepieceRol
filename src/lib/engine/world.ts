import { Rng, rollInt, weightedPick } from "./rng";

export interface WorldActorState {
  id: string;
  name: string;
  role: string;
  factionType: string;
  factionName: string;
  rankLabel: string | null;
  canonBounty: string | null; // BigInt serialized to string at the boundary — this file stays framework-free
  personality: string | null;
  busyUntil: Date | null;
}

export interface WorldEventTemplateSpec {
  id: string;
  weight: number;
  minHeat: number;
  headline: string; // may contain "{actor}"
  category: string;
  bodyVariants: string[];
  /** Hours the involved actor becomes unavailable after this event, if any. */
  busyHours?: [number, number];
  heatDelta?: number;
  /** null = no specific actor needed (a bare Gobierno Mundial announcement); otherwise the actor's factionType must be one of these. */
  allowedFactionTypes?: string[] | null;
  promptHint?: string;
}

export interface WorldTickResult {
  headline: string;
  body: string;
  category: string;
  promptHint: string;
  involvedActorId: string | null;
  newBusyUntil: Date | null;
  newHeat: number;
}

/**
 * One tick of the background world simulation: picks a template (gated by
 * the current "heat" so escalating, saga-ending-tier events don't fire in
 * a calm early game), optionally an available actor to star in it, and
 * returns the news item plus any resulting actor busy-window / heat change.
 * Actors currently busy are skipped so "Kizaru is deployed elsewhere" holds.
 *
 * Faction-aware actor selection (2026-09-23 fix): a template with
 * `allowedFactionTypes` set (e.g. MARINE-only) may ONLY star an actor whose
 * factionType matches — this is the direct fix for the bug that started
 * this pass (an Admiral being picked for a "recluta nuevos aliados"
 * pirate-flavored headline, because the old code picked from ALL available
 * actors with zero regard for the template's category). If no eligible
 * actor of the required faction is currently available, this tick is
 * skipped entirely (returns null) rather than either faking a wrong-faction
 * actor or firing a headline with no one to name — a quiet tick is a much
 * smaller problem than a faction-nonsensical one. Templates with
 * `allowedFactionTypes` unset/null keep the original unrestricted behavior,
 * including falling back to a generic "El Gobierno Mundial" actor-less
 * headline when nobody at all is available.
 */
export function runWorldTick(
  rng: Rng,
  now: Date,
  currentHeat: number,
  templates: WorldEventTemplateSpec[],
  actors: WorldActorState[]
): WorldTickResult | null {
  const eligible = templates.filter((t) => t.minHeat <= currentHeat);
  if (eligible.length === 0) return null;

  const template = weightedPick(
    rng,
    eligible.map((t) => ({ item: t, weight: t.weight }))
  );

  const availableActors = actors.filter((a) => !a.busyUntil || a.busyUntil <= now);
  const requiresFaction = !!template.allowedFactionTypes && template.allowedFactionTypes.length > 0;
  const eligibleActors = requiresFaction
    ? availableActors.filter((a) => template.allowedFactionTypes!.includes(a.factionType))
    : availableActors;

  if (requiresFaction && eligibleActors.length === 0) return null;

  const actor = eligibleActors.length > 0 ? eligibleActors[Math.floor(rng() * eligibleActors.length)] : null;

  const headline = actor ? template.headline.replace("{actor}", actor.name) : template.headline.replace("{actor}", "El Gobierno Mundial");
  const body = template.bodyVariants[Math.floor(rng() * template.bodyVariants.length)].replace(
    "{actor}",
    actor?.name ?? "una fuerza desconocida"
  );

  let newBusyUntil: Date | null = null;
  if (actor && template.busyHours) {
    const hours = rollInt(rng, template.busyHours[0], template.busyHours[1]);
    newBusyUntil = new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  const newHeat = Math.max(0, Math.min(100, currentHeat + (template.heatDelta ?? 0)));

  return {
    headline,
    body,
    category: template.category,
    promptHint: template.promptHint ?? "",
    involvedActorId: actor?.id ?? null,
    newBusyUntil,
    newHeat,
  };
}

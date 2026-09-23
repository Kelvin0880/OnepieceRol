import { Rng, rollInt, weightedPick } from "./rng";

export interface WorldActorState {
  id: string;
  name: string;
  role: string;
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
}

export interface WorldTickResult {
  headline: string;
  body: string;
  category: string;
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
  const actor = availableActors.length > 0 ? availableActors[Math.floor(rng() * availableActors.length)] : null;

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
    involvedActorId: actor?.id ?? null,
    newBusyUntil,
    newHeat,
  };
}

/**
 * Resting and serious training need a moment of calm: you cannot catch your
 * breath mid-fight, with a hunter closing in, or while the island is under
 * a Buster Call. Pure: the game layer reports what is going on, this says no.
 */
export interface DangerContext {
  hasPendingEncounter: boolean;
  activeDuel: boolean;
  /** A hunt or lethal challenge aimed at this character that they have not answered yet. */
  hostileChallengePending: boolean;
  inJointFight: boolean;
  busterCallOnIsland: boolean;
}

export function dangerBlockReason(ctx: DangerContext, what: "descansar" | "entrenar" | "usar objetos"): string | null {
  if (ctx.hasPendingEncounter) return `No puedes ${what} con un enfrentamiento sin resolver: primero sal de esa situación.`;
  if (ctx.activeDuel) return `No puedes ${what} en mitad de un duelo.`;
  if (ctx.inJointFight) return `No puedes ${what} en plena pelea con tus aliados.`;
  if (ctx.hostileChallengePending) return `Te están cazando: no es momento de ${what}. Responde a la caza (huir o aceptar) antes.`;
  if (ctx.busterCallOnIsland) return `La isla está bajo un Buster Call: no hay calma para ${what}. Defiéndela o huye.`;
  return null;
}

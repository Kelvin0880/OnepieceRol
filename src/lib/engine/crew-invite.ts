/** Pure rules for crew invitations (game/crew.ts does the DB work). */

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PENDING_INVITES_PER_CREW = 10;
export const MAX_CREW_MEMBERS = 12;

export function inviteExpired(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() > INVITE_TTL_MS;
}

export interface InviteCheck {
  inviterHasCrew: boolean;
  targetAlive: boolean;
  targetHasCrew: boolean;
  sameFaction: boolean;
  isSelf: boolean;
  alreadyPending: boolean;
  pendingInCrew: number;
  crewSize: number;
}

/** Returns why an invitation cannot be sent, or null when it can. */
export function inviteBlockReason(c: InviteCheck): string | null {
  if (!c.inviterHasCrew) return "Necesitas una tripulación para invitar a alguien.";
  if (c.isSelf) return "No puedes invitarte a ti mismo.";
  if (!c.targetAlive) return "Ese personaje ya no puede unirse a nadie.";
  if (c.targetHasCrew) return "Ese personaje ya pertenece a otra tripulación.";
  if (!c.sameFaction) return "Solo se puede invitar a personajes de la misma facción.";
  if (c.alreadyPending) return "Ya tiene una invitación tuya pendiente.";
  if (c.crewSize >= MAX_CREW_MEMBERS) return `La tripulación ya está completa (${MAX_CREW_MEMBERS} miembros).`;
  if (c.pendingInCrew >= MAX_PENDING_INVITES_PER_CREW) return "Tienes demasiadas invitaciones pendientes: espera respuestas o cancela alguna.";
  return null;
}

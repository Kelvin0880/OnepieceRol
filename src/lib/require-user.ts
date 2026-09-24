import { getSession } from "./session";

export class UnauthorizedError extends Error {}

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session.userId) throw new UnauthorizedError("No has iniciado sesión.");
  return session.userId;
}

export class ForbiddenError extends Error {}

/** Owner-only routes: the session user must be listed in ADMIN_USERNAMES (src/lib/admin.ts). */
export async function requireAdminUserId(): Promise<{ userId: string; username: string }> {
  const userId = await requireUserId();
  const { prisma } = await import("./db");
  const { isAdminUsername } = await import("./admin");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (!user || !isAdminUsername(user.username)) throw new ForbiddenError("Solo el dueño del juego puede hacer esto.");
  return { userId, username: user.username };
}

/** True when the current session belongs to the owner; never throws (used to show the admin link). */
export async function sessionIsAdmin(): Promise<boolean> {
  try {
    await requireAdminUserId();
    return true;
  } catch {
    return false;
  }
}

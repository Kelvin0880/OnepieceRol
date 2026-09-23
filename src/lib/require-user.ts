import { getSession } from "./session";

export class UnauthorizedError extends Error {}

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session.userId) throw new UnauthorizedError("No has iniciado sesión.");
  return session.userId;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ user: null, characters: [] });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ user: null, characters: [] });

  const characters = await prisma.character.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { currentIsland: true },
  });

  return NextResponse.json({ user: { id: user.id, username: user.username }, characters });
}

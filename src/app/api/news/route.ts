import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tickWorldIfDue } from "@/lib/game/world-tick";

export async function GET() {
  await tickWorldIfDue();
  const news = await prisma.newsItem.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
  return NextResponse.json({ news });
}

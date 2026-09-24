import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tickWorldIfDue, tickBountyDigestIfDue } from "@/lib/game/world-tick";
import { logError } from "@/lib/log-error";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  // In the background: the ticks may call the AI (many seconds) and the reader must never wait for them.
  void tickWorldIfDue().catch((e) => logError("news/tick", e));
  void tickBountyDigestIfDue().catch((e) => logError("news/digest", e));

  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");

  const news = await prisma.newsItem.findMany({
    where: category ? { category } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = news.length > limit;
  const page = hasMore ? news.slice(0, limit) : news;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({ news: page, nextCursor });
}

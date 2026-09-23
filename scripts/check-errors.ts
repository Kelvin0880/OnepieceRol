// Usage: npx tsx scripts/check-errors.ts [count]
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const take = parseInt(process.argv[2] ?? "15", 10);
  const total = await prisma.errorLog.count();
  console.log("total error logs:", total);
  const logs = await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take });
  for (const l of logs) {
    console.log(l.createdAt.toISOString(), "|", l.context);
    console.log(l.message);
    if (l.metaJson) console.log("meta:", l.metaJson);
  }
}
main().finally(() => prisma.$disconnect());

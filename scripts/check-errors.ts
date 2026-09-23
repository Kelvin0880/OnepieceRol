import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const total = await prisma.errorLog.count();
  console.log("total error logs:", total);
  const logs = await prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 });
  for (const l of logs) {
    console.log(l.createdAt.toISOString(), "|", l.context, "|", l.message.slice(0, 250));
  }
}
main().finally(() => prisma.$disconnect());

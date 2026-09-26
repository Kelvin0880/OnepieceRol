// Test helper for residents-ui-check.mjs: marks one living guard resident as dead.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const n = await prisma.islandNpc.findFirstOrThrow({ where: { status: "ALIVE", category: "guard" } });
  await prisma.islandNpc.update({ where: { id: n.id }, data: { status: "DEAD", diedAt: new Date(), diedNote: "muerto a manos de Prueba" } });
  console.log("killed", n.name);
}
main().finally(() => prisma.$disconnect());

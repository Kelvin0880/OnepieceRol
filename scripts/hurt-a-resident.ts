// Test helper: leaves one resident hurt (20 min) and another arrested (1 h) and prints their names as JSON.
import "dotenv/config";
import { prisma } from "../src/lib/db";
(async () => {
  const rows = await prisma.islandNpc.findMany({ where: { status: "ALIVE", recoversAt: null }, orderBy: { name: "asc" }, take: 2, select: { id: true, name: true } });
  await prisma.islandNpc.update({ where: { id: rows[0].id }, data: { recoversAt: new Date(Date.now() + 20 * 60_000), stateNote: "herido por la paliza de Prueba" } });
  await prisma.islandNpc.update({ where: { id: rows[1].id }, data: { status: "CAPTURED", recoversAt: new Date(Date.now() + 60 * 60_000), stateNote: "detenido por Prueba" } });
  console.log(JSON.stringify({ hurt: rows[0].name, jailed: rows[1].name }));
})().finally(() => prisma.$disconnect());

import { prisma } from "../src/lib/db";

async function main() {
  const teach = await prisma.worldActor.findUnique({ where: { name: "Marshall D. Teach" } });
  console.log("Teach personality:", teach?.personality);
  const lucci = await prisma.worldActor.findUnique({ where: { name: "Rob Lucci" } });
  console.log("Lucci personality:", lucci?.personality);

  const et1 = await prisma.eventTemplate.findFirst({ where: { title: "La guardia personal de Barbanegra" } });
  const body1 = JSON.parse(et1!.bodyJson);
  console.log("Lieutenant worldActorId matches Teach id:", body1.enemy.worldActorId === teach?.id);

  const et2 = await prisma.eventTemplate.findFirst({ where: { title: "El escuadrón de CP-0" } });
  const body2 = JSON.parse(et2!.bodyJson);
  console.log("CP-0 agent worldActorId matches Lucci id:", body2.enemy.worldActorId === lucci?.id);
}

main().finally(() => prisma.$disconnect());

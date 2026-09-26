// One-off owner test: an admiral "sails" to Foosha (a protected starter island) and turns back after N minutes. Usage: npx tsx scripts/foosha-dispatch-test.ts [minutes=5] [admiral=Kizaru]
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { postNews } from "../src/lib/game/death-resolution";
import { invalidateWorldState } from "../src/lib/game/world-state";
import { notifyIsland } from "../src/lib/game/notify";

async function main() {
  const minutes = Number(process.argv[2] ?? 5);
  const name = process.argv[3] ?? "Kizaru";
  const island = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const admiral = await prisma.worldActor.findFirstOrThrow({ where: { name: { contains: name }, role: "ADMIRAL" } });
  const here = await prisma.character.findMany({ where: { currentIslandId: island.id, status: "ALIVE" }, select: { name: true, faction: true, level: true } });
  console.log(`Foosha: ${island.name}; almirante ${admiral.name}; personajes vivos allí:`, here);
  const travelMs = 30 * 60_000;
  const d = await prisma.admiralDispatch.create({
    data: { admiralActorId: admiral.id, admiralName: admiral.name, originIslandId: admiral.currentIslandId ?? admiral.homeIslandId ?? null, targetIslandId: island.id, targetIslandName: island.name, travelMs, arrivesAt: new Date(Date.now() + travelMs) },
  });
  await postNews(
    `El almirante ${admiral.name} zarpa hacia ${island.name}`,
    `El Gobierno Mundial ha ordenado a ${admiral.name} erradicar a los piratas de ${island.name}. Llegará en unos ${minutes} minutos. Quien no quiera enfrentarse a él, que abandone la isla antes de que desembarque: después no habrá escapatoria.`,
    "Gobierno Mundial", undefined, "major", { locationName: `En el mar, rumbo a ${island.name}`, islandId: island.id }
  );
  invalidateWorldState();
  await notifyIsland(island.id, "admiral-dispatch");
  console.log(`Alerta lanzada; se cancela en ${minutes} min...`);
  await new Promise((r) => setTimeout(r, minutes * 60_000));
  await prisma.admiralDispatch.update({ where: { id: d.id }, data: { status: "ENDED", endedAt: new Date() } });
  await postNews(
    `${admiral.name} da media vuelta y no desembarca en ${island.name}`,
    `El almirante ${admiral.name} decidió que ${island.name} no valía la pena: los piratas que la habitan no justifican una campaña del Gobierno. Su barco vuelve a su puesto y la isla respira tranquila... por ahora.`,
    "Gobierno Mundial", undefined, "normal", { locationName: `En el mar, de vuelta de ${island.name}`, islandId: island.id }
  );
  invalidateWorldState();
  await notifyIsland(island.id, "admiral-dispatch");
  console.log("Evento cancelado y noticia publicada.");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

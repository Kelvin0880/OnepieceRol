// Owner tool: closes a stuck group fight as a victory and pays a bonus (berries, xp, one devil fruit each; the captain a bit more).
// Usage: DATABASE_URL=<prod> npx tsx scripts/owner-close-joint.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getOpenJointFightFor, ownerSettleJointFight } from "../src/lib/game/joint-fight";
import { grantCatalogFruit } from "../src/lib/game/inventory";
import { grantXp } from "../src/lib/game/xp";

const GIFTS = [
  { name: "Sebastian", fruit: "Noro Noro no Mi", berries: 8000, xp: 80 },
  { name: "Barbosa", fruit: "Buki Buki no Mi", berries: 6000, xp: 60 },
];

async function main() {
  const anyone = await prisma.character.findFirst({ where: { name: { contains: "Barbosa" } } });
  const fight = anyone ? await getOpenJointFightFor(anyone.id) : null;
  if (fight) {
    await prisma.jointFight.update({ where: { id: fight.id }, data: { enemyHp: 0 } });
    const cap = await prisma.character.findFirst({ where: { name: { contains: "Sebastian" } } });
    const ctx = JSON.parse((await prisma.jointFight.findUniqueOrThrow({ where: { id: fight.id } })).contextJson) as Record<string, unknown>;
    await prisma.jointFight.update({ where: { id: fight.id }, data: { contextJson: JSON.stringify({ ...ctx, finalBlowCharacterId: cap?.id }) } });
    await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: null, authorName: "Narrador", text: "El callejón queda en silencio: los tres matones están fuera de combate y Leo ha hablado. Por las molestias del camino, el dueño del mar recompensa a la pareja con un botín extra y una Akuma no Mi a cada uno, escogida según su estilo." } });
    await ownerSettleJointFight(fight.id, "victory");
  } else {
    console.log("(no open fight: already closed, only paying the bonus)");
  }

  for (const g of GIFTS) {
    const c = await prisma.character.findFirst({ where: { name: { contains: g.name } } });
    if (!c) continue;
    const lvl = await grantXp(c.experience, c.level, g.xp);
    await prisma.character.update({ where: { id: c.id }, data: { experience: lvl.xp, level: lvl.level, berries: { increment: g.berries } } });
    const got = await grantCatalogFruit(c.id, g.fruit);
    await prisma.gameLogEntry.create({ data: { characterId: c.id, kind: "reward", text: `Recompensa del dueño por el problema en la pelea: ฿ ${g.berries.toLocaleString("es-ES")}, ${g.xp} XP${got ? ` y la ${got} (está en tu inventario, no la comas hasta estar seguro: el mar te rechazará para siempre)` : " (la fruta no pudo entrar: mochila llena)"}.` } });
    const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, include: { inventory: true } });
    console.log(c.name, `nivel ${after.level}`, `berries ${after.berries}`, `hp ${after.hp}/${after.maxHp}`, "fruta:", got, "bolsa:", after.inventory.map((i) => i.name).join(", "));
  }
}
main().finally(() => prisma.$disconnect());

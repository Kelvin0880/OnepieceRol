// Test helper for scripts/features-ui-check.mjs.
//   npx tsx scripts/features-setup.ts prep "<character>"   -> level 12, on Dressrosa, money, a fruit and a weapon in the bag, a fruit tournament announced
//   npx tsx scripts/features-setup.ts start                  -> closes registration now
//   npx tsx scripts/features-setup.ts round                  -> resolves the current round now
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { announceTournament, startTournament, resolveRound } from "../src/lib/game/coliseum";
import { grantCatalogFruit, grantWeapon, grantItem } from "../src/lib/game/inventory";
import { DEVIL_FRUIT_CATALOG } from "../src/lib/game/devil-fruit-catalog";

async function main() {
  const [mode, name] = [process.argv[2], process.argv[3]];
  if (mode === "prep") {
    const c = await prisma.character.findFirstOrThrow({ where: { name } });
    const dress = await prisma.island.findFirstOrThrow({ where: { name: "Dressrosa" } });
    await prisma.character.update({ where: { id: c.id }, data: { level: 12, currentIslandId: dress.id, berries: 500_000, hp: 60 } });
    const fruit = DEVIL_FRUIT_CATALOG.filter((f) => !f.isSingleton)[0].name;
    console.log("fruit:", await grantCatalogFruit(c.id, fruit));
    await grantWeapon(c.id, { name: "Espada de premio", kind: "Espada", atkBonus: 9, description: "Un premio de prueba." });
    await grantItem(c.id, "vendaje", 2);
    await prisma.tournamentEntry.deleteMany({});
    await prisma.tournament.deleteMany({});
    const t = await announceTournament(Date.now(), { kind: "fruit" });
    console.log("announced:", t?.id, t?.prizeJson);
  } else if (mode === "start" || mode === "round") {
    const t = await prisma.tournament.findFirstOrThrow({ where: { status: { in: ["ANNOUNCED", "RUNNING"] } } });
    if (mode === "start") await startTournament(t.id);
    else await resolveRound(t.id);
    console.log("status:", (await prisma.tournament.findUniqueOrThrow({ where: { id: t.id } })).status);
  }
}
main().finally(() => prisma.$disconnect());

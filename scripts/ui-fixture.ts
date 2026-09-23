// Puts a character into an interesting state so the browser checks don't depend on RNG (2026-09-24).
// Usage: npx tsx scripts/ui-fixture.ts <territory|claim-vote|buster|jail|stealth|owner|raid|raid-unaware> <characterId>
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { captureCharacter } from "../src/lib/game/prison";
import { startBusterCall } from "../src/lib/game/buster-call";

async function main() {
  const [mode, id] = process.argv.slice(2);
  const c = await prisma.character.findUniqueOrThrow({ where: { id } });
  const isl = (name: string) => prisma.island.findUniqueOrThrow({ where: { name } });
  if (mode === "territory" || mode === "claim-vote" || mode === "owner") {
    const whisky = await isl("Whisky Peak");
    await prisma.character.update({ where: { id }, data: { currentIslandId: whisky.id, level: 12, berries: 500000 } });
    const t = await prisma.territory.findUniqueOrThrow({ where: { islandId: whisky.id } });
    if (mode === "claim-vote") {
      await prisma.territory.update({
        where: { id: t.id },
        data: { status: "CLAIM_VOTE", ownerActorId: null, contributionsJson: JSON.stringify({ [id]: 6, rival: 4 }), voteDeadline: new Date(Date.now() + 3600_000), votesJson: "{}" },
      });
    } else if (mode === "owner") {
      await prisma.territory.update({
        where: { id: t.id },
        data: { status: "HELD", ownerActorId: null, ownerCharacterId: id, ownerName: c.name, title: "Señor de Whisky Peak", garrison: 60, lastIncomeAt: new Date(Date.now() - 4 * 3600_000), lastPressureAt: new Date() },
      });
      await prisma.character.update({ where: { id }, data: { title: "Señor de Whisky Peak" } });
    } else {
      await prisma.territory.update({
        where: { id: t.id },
        data: { status: "HELD", ownerActorId: t.homeActorId, ownerCharacterId: null, ownerName: "Mr. 3 (Galdino)", contributionsJson: "{}", musterJson: "[]", votesJson: "{}" },
      });
    }
  } else if (mode === "buster") {
    const impel = await isl("Impel Down");
    await prisma.busterCall.updateMany({ where: { status: "ACTIVE" }, data: { status: "REPELLED" } });
    await prisma.character.update({ where: { id }, data: { currentIslandId: impel.id, level: 50 } });
    await startBusterCall(impel.id, "Fixture de prueba: una fuga desde el nivel más profundo.");
  } else if (mode === "jail") {
    await prisma.character.update({ where: { id }, data: { bounty: 1_200_000_000, level: 20 } });
    const fresh = await prisma.character.findUniqueOrThrow({ where: { id }, include: { currentIsland: true, companions: true } });
    await captureCharacter(fresh, 120, "Capturado por la Marina (fixture).", []);
  } else if (mode === "raid" || mode === "raid-unaware") {
    const mary = await isl("Mary Geoise");
    await prisma.raid.deleteMany({});
    await prisma.character.update({ where: { id }, data: { currentIslandId: mary.id, level: 50, knowsTruth: mode === "raid" } });
  } else if (mode === "stealth") {
    const c2 = await isl("Isla Cementerio");
    await prisma.character.update({ where: { id }, data: { currentIslandId: c2.id, level: 30 } });
  } else throw new Error("unknown mode " + mode);
  console.log("fixture ok:", mode);
  await prisma.$disconnect();
}
main();

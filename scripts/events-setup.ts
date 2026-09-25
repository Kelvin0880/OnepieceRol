// Test helper for events-ui-check.mjs. Usage:
//   npx tsx scripts/events-setup.ts event            -> announces a beginner event on Pueblo Foosha (real AI unless EVENT_STUB=1)
//   npx tsx scripts/events-setup.ts backdate         -> ends the registration window of every open event
//   npx tsx scripts/events-setup.ts report          -> adds a player report for the admin panel
//   npx tsx scripts/events-setup.ts item <characterId> -> drops a new item in the character's bag
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createPlayerEvent } from "../src/lib/game/player-events";

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "event") {
    const ev = await createPlayerEvent({ withFruit: true, islandName: "Pueblo Foosha", maxLevel: 10, createdBy: "check" });
    console.log(`event ${ev.id} "${ev.title}" fruit=${ev.rewardFruitName}`);
  } else if (cmd === "backdate") {
    const n = await prisma.playerEvent.updateMany({ where: { status: "OPEN" }, data: { createdAt: new Date(Date.now() - 7 * 3600_000) } });
    console.log(`backdated ${n.count}`);
  } else if (cmd === "report") {
    await prisma.oocReport.create({ data: { characterId: "gone", kind: "report", text: "Reporte de prueba: el narrador olvidó mi inventario." } });
    console.log("report added");
  } else if (cmd === "item" && arg) {
    await prisma.inventoryItem.create({ data: { characterId: arg, name: "Mapa desgastado", kind: "Mapa", quantity: 1 } });
    console.log("item added");
  } else {
    throw new Error("unknown command");
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

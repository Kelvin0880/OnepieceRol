// Test helper for scripts/voyage-ui-check.mjs: `arrive "<character>"` makes the current crossing end now; `ambush "<character>"` also plants an ambush.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const [mode, name] = [process.argv[2], process.argv[3]];
  const c = await prisma.character.findFirstOrThrow({ where: { name } });
  await prisma.character.update({
    where: { id: c.id },
    data: {
      voyageArrivesAt: new Date(Date.now() - 1000),
      ...(mode === "ambush" ? { voyageAmbushJson: JSON.stringify({ name: "Rey del Mar", blurb: "Algo enorme sube desde las profundidades.", power: 1.1 }) } : {}),
    },
  });
  console.log("ready");
}
main().finally(() => prisma.$disconnect());

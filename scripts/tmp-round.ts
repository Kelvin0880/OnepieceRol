import "dotenv/config";
import fs from "fs";
import { prisma } from "../src/lib/db";
import { resolveFreeTextAction } from "../src/lib/game/perform-action";
(async () => {
  const c = await prisma.character.findFirstOrThrow({ where: { name: "Kaito" } });
  const text = fs.readFileSync(process.argv[2], "utf8").trim();
  const t0 = Date.now();
  const r = await resolveFreeTextAction(c.id, c.userId, text);
  const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id }, select: { hp: true, maxHp: true, stamina: true } });
  const pe = await prisma.pendingEncounter.findUnique({ where: { characterId: c.id } });
  console.log(`\n### JUGADOR:\n${text}\n\n### RESPUESTA (${Math.round((Date.now() - t0) / 1000)}s):\n${r.log.join("\n\n")}\n\n### ESTADO: Kaito ${after.hp}/${after.maxHp} vida, aguante ${after.stamina} | Smoker(interno) ${pe?.enemyHp ?? "-"}/1360 fase ${pe?.phase ?? "fin"} ronda ${pe?.roundNumber ?? "-"} | hpDelta ${r.hpDelta}`);
})().catch((e) => console.error("ERROR", e.message)).finally(() => prisma.$disconnect());

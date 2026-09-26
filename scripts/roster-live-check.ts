// Live (real AI): the narrator and the referee only use residents/canon/players, never invented names. Usage: npx tsx scripts/roster-live-check.ts [island]
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { resolveFreeTextAction } from "../src/lib/game/perform-action";
import { allowedNamesFor } from "../src/lib/game/island-npcs";
import { inventedNames } from "../src/lib/engine/island-npc";

const TEXTS = [
  "Entro en la taberna del pueblo, me siento en la barra, pido algo de beber y hablo con el tabernero sobre los rumores de la isla.",
  "Salgo a la calle y busco a alguien de la guardia local para preguntarle si hay problemas en el puerto.",
  "Le doy un puñetazo al primer guardia que veo, con toda mi fuerza, buscando derribarlo de un golpe.",
  "Sigo peleando: le lanzo una patada baja para tirarlo al suelo y después intento sujetarlo.",
];

async function main() {
  const islandName = process.argv[2] ?? "Pueblo Foosha";
  const island = await prisma.island.findUniqueOrThrow({ where: { name: islandName } });
  const stamp = Date.now() % 100000;
  const u = await prisma.user.create({ data: { username: `live${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Prueba${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: island.id, level: 6 } });
  const roster = await prisma.islandNpc.findMany({ where: { islandId: island.id }, select: { name: true, title: true, status: true, category: true } });
  console.log(`Residentes de ${islandName}:\n${roster.map((r) => `- ${r.name} (${r.title}, ${r.category})`).join("\n")}\n`);
  let bad = 0;
  for (const t of TEXTS) {
    console.log(`\n>>> ${t}`);
    try {
      const res = await resolveFreeTextAction(c.id, u.id, t);
      const text = res.log.join("\n");
      const allowed = await allowedNamesFor(c.id, island.id);
      const invented = inventedNames(text, allowed);
      console.log(text.slice(0, 1400));
      console.log(invented.length ? `!!! NOMBRES INVENTADOS: ${invented.join(", ")}` : "--- sin nombres inventados");
      if (invented.length) bad++;
    } catch (e) {
      console.log(`(error: ${(e as Error).message})`);
    }
  }
  console.log(bad === 0 ? "\nOK: ningún nombre inventado" : `\n${bad} respuestas con nombres inventados`);
}
main().finally(() => prisma.$disconnect());

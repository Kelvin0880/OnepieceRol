process.env.JUDGE_STUB = "1";
// Real-AI check (needs OPENROUTER_API_KEY): the narrator must not voice another player's character nor charge more than the purse.
// Usage: npx tsx scripts/real-players-live-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { narrateScene } from "../src/lib/ai/narrate";
import { voicesRealPlayer } from "../src/lib/engine/real-players";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (!ok) failures++;
};

async function main() {
  const stamp = Date.now() % 100000;
  const uA = await prisma.user.create({ data: { username: `rpa${stamp}`, passwordHash: "x" } });
  const uB = await prisma.user.create({ data: { username: `rpb${stamp}`, passwordHash: "x" } });
  const seb = await createCharacter(uA.id, `Sebas${stamp}`, "PIRATE", "swordsman");
  const barb = await createCharacter(uB.id, `Barbosa${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: barb.id }, data: { currentIslandId: seb.currentIslandId } });
  await prisma.character.update({ where: { id: seb.id }, data: { berries: 13005 } });
  const isle = await prisma.island.findUniqueOrThrow({ where: { id: seb.currentIslandId } });
  const base = { characterName: seb.name, faction: "PIRATE", level: 3, islandName: isle.name, islandDescription: isle.description };
  const barbName = `Barbosa${stamp}`;

  for (let i = 1; i <= 3; i++) {
    const text = await narrateScene(
      {
        ...base,
        playerText: `—Sebas entra a la herrería de Golton, le pide una katana mejor, el nódachi de 75.000 berries y luego dos dagas. Barbosa lo espera fuera en la taberna—`,
        recentScene: [`[Jugador]: Barbosa, espérame en la taberna, voy con el herrero.`],
        memorySummary: `Sebas y ${barbName} pelearon juntos contra una banda y son compañeros.`,
      },
      { characterId: seb.id },
    );
    console.log(`\n--- intento ${i}\n${text}\n`);
    check(`#${i} no voice or action for the other player's character`, voicesRealPlayer(text, [barbName, "Barbosa"]) === null);
    check(`#${i} nothing is narrated as already paid`, !/(pagas|pag[oó] los|recoge (los|tu) (dinero|berries)|cuent[ao] los berries|guarda los .* berries bajo)/i.test(text));
  }

  await prisma.character.deleteMany({ where: { id: { in: [seb.id, barb.id] } } }).catch(() => {});
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();

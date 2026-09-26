// Poneglyphs and the road to Laugh Tale: reading vs. taking a rubbing, studying the old script at Ohara, deciphering
// rubbings, handing one to a crewmate, reading a Historia stone in place, and the "Mi ruta" panel's shape.
// Usage (fresh dev DB, seeded): npx tsx scripts/poneglyph-route-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { grantPoneglyphRead, studyScript, decipherRubbings, handRubbing, readHistoryStone, getRouteState } from "../src/lib/game/poneglyph";
import { scriptNeeded } from "../src/lib/engine/poneglyph-lore";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

const stamp = Date.now() % 1_000_000;
async function mk(name: string, island?: string) {
  const u = await prisma.user.create({ data: { username: `${name}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${name}${stamp}`, "PIRATE", "swordsman");
  if (island) {
    const isl = await prisma.island.findUniqueOrThrow({ where: { name: island } });
    await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: isl.id } });
  }
  return { u, c: await prisma.character.findUniqueOrThrow({ where: { id: c.id } }) };
}

async function main() {
  const roadStone = await prisma.poneglyph.findFirstOrThrow({ where: { kind: "Road" } });

  // --- Someone who cannot yet read the old script gets a rubbing instead, at half heat ---
  const illiterate = await mk("Illit");
  const log1: string[] = [];
  const news1: string[] = [];
  const grant1 = await grantPoneglyphRead({ ...illiterate.c, currentIsland: { name: "Pueblo Foosha" } }, roadStone.id, log1, news1, { heat: 50 });
  assert(grant1 === undefined, "an illiterate reader does not get the stone's code name back — no read happened");
  assert(log1.some((l) => l.includes("calco")), "they take a rubbing instead");
  const afterGrant1 = await prisma.character.findUniqueOrThrow({ where: { id: illiterate.c.id } });
  assert(JSON.parse(afterGrant1.poneglyphsRead).length === 0, "the stone is not in their ledger — only a rubbing exists");
  assert(afterGrant1.poneglyphHeat === 25, `a rubbing still spikes heat, but only half as much as a real read (got ${afterGrant1.poneglyphHeat})`);
  const rubbing1 = await prisma.inventoryItem.findFirstOrThrow({ where: { characterId: illiterate.c.id, kind: "Calco" } });
  assert(JSON.parse(rubbing1.effectJson ?? "{}").poneglyphId === roadStone.id, "the rubbing is tied to the exact stone");

  // A second attempt on the same stone gives no duplicate rubbing.
  const log1b: string[] = [];
  await grantPoneglyphRead({ ...(await prisma.character.findUniqueOrThrow({ where: { id: illiterate.c.id } })), currentIsland: { name: "Pueblo Foosha" } }, roadStone.id, log1b, [], { heat: 50 });
  assert((await prisma.inventoryItem.count({ where: { characterId: illiterate.c.id, kind: "Calco" } })) === 1, "no duplicate rubbing of the same stone");

  // --- Studying at Ohara raises the old script; it's blocked elsewhere ---
  const student = await mk("Stud", "Pueblo Foosha");
  let blockedElsewhere = "";
  try {
    await studyScript(student.c.id, student.u.id);
  } catch (e) {
    blockedElsewhere = (e as Error).message;
  }
  assert(blockedElsewhere.length > 0, `studying is blocked outside Ohara (${blockedElsewhere})`);
  await prisma.character.update({ where: { id: student.c.id }, data: { currentIslandId: (await prisma.island.findUniqueOrThrow({ where: { name: "Ohara" } })).id } });
  const study1 = await studyScript(student.c.id, student.u.id);
  assert(study1.log[0].includes("Lengua antigua"), "a session at Ohara raises the old script");
  const afterStudy1 = await prisma.character.findUniqueOrThrow({ where: { id: student.c.id } });
  assert(afterStudy1.ancientScript === 25, `the first session teaches exactly STUDY_GAIN (got ${afterStudy1.ancientScript})`);
  let cooldown = "";
  try {
    await studyScript(student.c.id, student.u.id);
  } catch (e) {
    cooldown = (e as Error).message;
  }
  assert(cooldown.length > 0, `a second session right away is blocked by the cooldown (${cooldown})`);

  // Push the student to full Historia literacy directly (deterministic, skips the real-time cooldown) and grant a real read.
  await prisma.character.update({ where: { id: student.c.id }, data: { ancientScript: scriptNeeded("Historia"), lastStudyAt: null } });
  const historyStone = await prisma.poneglyph.findFirstOrThrow({ where: { kind: "Historia" } });
  const log2: string[] = [];
  const news2: string[] = [];
  const literate = await prisma.character.findUniqueOrThrow({ where: { id: student.c.id }, include: { currentIsland: true } });
  const code = await grantPoneglyphRead(literate, historyStone.id, log2, news2, { heat: 50 });
  assert(code === historyStone.codeName, "a literate reader reads the stone for real and gets its code name back");
  assert(news2.length === 1, "a real read posts real news");
  const afterRead = await prisma.character.findUniqueOrThrow({ where: { id: student.c.id } });
  assert(JSON.parse(afterRead.poneglyphsRead).includes(historyStone.id), "the stone is now in the reader's ledger");

  // --- Deciphering a rubbing once literate ---
  await prisma.character.update({ where: { id: student.c.id }, data: { ancientScript: scriptNeeded("Road") } });
  await prisma.inventoryItem.create({ data: { characterId: student.c.id, name: "Calco", kind: "Calco", quantity: 1, effectJson: JSON.stringify({ poneglyphId: roadStone.id }) } });
  const deciphered = await decipherRubbings(student.c.id, student.u.id);
  assert(deciphered.log.some((l) => l.includes(roadStone.codeName) || l.includes("Descifras")), `deciphering reads the stone for real (${deciphered.log.join(" | ")})`);
  assert((await prisma.inventoryItem.count({ where: { characterId: student.c.id, kind: "Calco" } })) === 0, "the rubbing is consumed once deciphered");
  const afterDecipher = await prisma.character.findUniqueOrThrow({ where: { id: student.c.id } });
  assert(JSON.parse(afterDecipher.poneglyphsRead).includes(roadStone.id), "the Road stone joins the ledger too");

  // --- Handing a rubbing to a crewmate on the same island ---
  const captain = await mk("Handc", "Pueblo Foosha");
  const mate = await mk("Handm", "Pueblo Foosha");
  const crew = await createCrew(captain.c.id, captain.u.id, `Handoff ${stamp}`, "x");
  await joinCrew(mate.c.id, mate.u.id, crew.inviteCode);
  const otherStone = await prisma.poneglyph.findFirstOrThrow({ where: { kind: "Historia", id: { not: historyStone.id } } });
  const rub = await prisma.inventoryItem.create({ data: { characterId: captain.c.id, name: "Calco", kind: "Calco", quantity: 1, effectJson: JSON.stringify({ poneglyphId: otherStone.id }) } });
  const stranger = await mk("Handx", "Pueblo Foosha");
  let notCrew = "";
  try {
    await handRubbing(captain.c.id, captain.u.id, rub.id, stranger.c.id);
  } catch (e) {
    notCrew = (e as Error).message;
  }
  assert(notCrew.includes("tripulación"), `handing a rubbing to someone outside the crew is refused (${notCrew})`);
  const handed = await handRubbing(captain.c.id, captain.u.id, rub.id, mate.c.id);
  assert(handed.log[0].includes(mate.c.name), "handing to a crewmate on the same island works");
  assert((await prisma.inventoryItem.findUniqueOrThrow({ where: { id: rub.id } })).characterId === mate.c.id, "ownership actually transferred");

  // --- Reading a Historia stone standing on its own island ---
  const hereStone = await prisma.poneglyph.findFirstOrThrow({ where: { kind: "Historia", id: { notIn: [historyStone.id, otherStone.id] } } });
  const island = await prisma.island.findUniqueOrThrow({ where: { id: hereStone.locationIslandId! } });
  const traveler = await mk("Trav", island.name);
  const notLiterate = await readHistoryStone(traveler.c.id, traveler.u.id);
  assert(notLiterate.log[0].includes("calco"), "standing on the stone without knowing the script gets a rubbing, not the text");
  await prisma.character.update({ where: { id: traveler.c.id }, data: { ancientScript: scriptNeeded("Historia") } });
  const readHere = await readHistoryStone(traveler.c.id, traveler.u.id);
  assert(readHere.log.some((l) => l.includes(hereStone.codeName)), "once literate, standing on the stone reads it for real");
  let twice = "";
  try {
    await readHistoryStone(traveler.c.id, traveler.u.id);
  } catch (e) {
    twice = (e as Error).message;
  }
  assert(twice.includes("Ya leíste"), "reading the same stone twice is refused");

  // --- The route panel's shape ---
  const route = await getRouteState(student.c.id, student.u.id);
  assert(route.road.filter((r) => r.read).length >= 1, "the route state counts real Road reads");
  assert(route.chapters.some((c) => c.known), "the route state marks known Historia chapters");
  assert(route.steps.length > 0, "the route panel always has at least one next step");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

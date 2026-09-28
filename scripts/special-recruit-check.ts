process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Recruiting end to end on the dev DB: a special recruit refuses until its hand-written condition is met, then joins with
// its own profile (paying its price); a filler resident is recruitable and their job is refilled by a successor that does
// NOT inherit the special story; the crew never exceeds three nakamas. Usage: npx tsx scripts/special-recruit-check.ts (freshly seeded DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { recruitCompanion, CompanionError } from "../src/lib/game/companions";
import { getIslandCast, seedIslandRoster, tickIslandNpcs } from "../src/lib/game/island-npcs";
import { REPLACEMENT_DELAY_MS } from "../src/lib/engine/island-npc";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  const specialName = `Maren Testvoss${stamp}`;
  await seedIslandRoster([
    {
      island: "Pueblo Foosha",
      slot: `sp-test-${stamp}`,
      name: specialName,
      title: "Cirujana de barco",
      category: "civilian",
      level: 6,
      description: "Una cirujana que ya no navega desde que su barco se hundió.",
      personality: "Seca y precisa",
      recruit: {
        role: "Médico",
        epithet: "La de las manos quietas",
        abilities: ["Sutura de emergencia", "Diagnóstico rápido", "Tajo quirúrgico"],
        attrs: { strength: 15, agility: 25, durability: 20, willpower: 35, intellect: 45 },
        lore: "Fue cirujana en un barco que se hundió con toda su tripulación menos ella; no vuelve a subir a cubierta con nadie que no haya demostrado ser capaz de cuidar de los suyos y de pagar un pasaje digno.",
        hint: "Solo sigue a quien ya lleva camino recorrido y sabe pagar un buen pasaje.",
        condition: { minLevel: 8, berries: 20_000 },
      },
    },
  ]);

  const u = await prisma.user.create({ data: { username: `sr${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Recluta${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: foosha.id, level: 1, berries: 5_000, willpower: 90, intellect: 90 } });

  const cast = await getIslandCast(foosha.id, c.id);
  const entry = cast.find((e) => e.name === specialName);
  assert(!!entry?.recruit && entry.recruit.special && /pasaje/.test(entry.recruit.hint), "the island cast shows the special recruit with its hint (no exact numbers)");
  assert(cast.some((e) => !e.recruit && e.usable), "ordinary residents are listed without a special mark");

  let refused = "";
  try {
    await recruitCompanion(c.id, u.id, { target: specialName, intentText: "Únete a mi tripulación." });
  } catch (e) {
    refused = e instanceof CompanionError ? e.message : "";
  }
  assert(/experiencia/.test(refused) && refused.includes("La de las manos quietas"), "a special recruit refuses while the condition is unmet, saying what is missing");
  assert((await prisma.nPCCompanion.count({ where: { characterId: c.id } })) === 0, "nothing was created on a refusal");

  await prisma.character.update({ where: { id: c.id }, data: { level: 10, berries: 5_000 } });
  let poor = "";
  try {
    await recruitCompanion(c.id, u.id, { target: specialName });
  } catch (e) {
    poor = e instanceof CompanionError ? e.message : "";
  }
  assert(/฿/.test(poor) || /precio/i.test(poor), "the price is checked too");

  await prisma.character.update({ where: { id: c.id }, data: { berries: 30_000 } });
  const done = await recruitCompanion(c.id, u.id, { target: specialName });
  assert(done.accepted && done.companionName === specialName, "with the condition met the special recruit joins");
  const nak = await prisma.nPCCompanion.findFirstOrThrow({ where: { characterId: c.id, name: specialName } });
  const prof = JSON.parse(nak.profileJson ?? "{}");
  assert(nak.role === "Médico" && prof.epithet === "La de las manos quietas" && prof.abilities.length === 3, "the nakama keeps its own role, epithet and abilities");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries === 10_000, "the signing price was paid");
  const row = await prisma.islandNpc.findUniqueOrThrow({ where: { name: specialName } });
  assert(row.status === "RECRUITED", "the resident left the island");

  // The job is refilled after a while and the successor is an ordinary resident.
  await prisma.islandNpc.update({ where: { id: row.id }, data: { diedAt: new Date(Date.now() - REPLACEMENT_DELAY_MS - 60_000) } });
  await tickIslandNpcs();
  const after = await prisma.islandNpc.findUniqueOrThrow({ where: { id: row.id } });
  assert(!!after.successorId, "a successor was scheduled for the recruited resident's job");
  const successor = await prisma.islandNpc.findUniqueOrThrow({ where: { id: after.successorId! } });
  assert(successor.slot === row.slot && successor.recruitJson === null && successor.status === "ALIVE", "the successor holds the same job but not the special story");

  // An ordinary resident can be recruited too; the role comes from their title.
  const free = { islandId: foosha.id, status: "ALIVE", recoversAt: null, recruitJson: null } as const;
  const filler = await prisma.islandNpc.findFirstOrThrow({ where: { ...free, NOT: { id: successor.id } } });
  const ok = await recruitCompanion(c.id, u.id, { target: filler.name, intentText: "Necesito gente como tú a bordo, con un buen trato." });
  assert(ok.accepted, "an ordinary resident can be recruited (judge decides)");
  const fnak = await prisma.nPCCompanion.findFirstOrThrow({ where: { characterId: c.id, name: filler.name } });
  assert(fnak.role.length > 0 && fnak.profileJson === null, "an ordinary nakama has no special profile");

  // Max three.
  const third = await prisma.islandNpc.findFirstOrThrow({ where: { ...free, NOT: { id: { in: [filler.id, successor.id] } } } });
  await recruitCompanion(c.id, u.id, { target: third.name, intentText: "Únete, te pagaré bien." });
  const fourth = await prisma.islandNpc.findFirstOrThrow({ where: { ...free, NOT: { id: { in: [filler.id, third.id] } } } });
  let full = "";
  try {
    await recruitCompanion(c.id, u.id, { target: fourth.name });
  } catch (e) {
    full = e instanceof CompanionError ? e.message : "";
  }
  assert(/completa/.test(full), "a fourth nakama is refused: the crew holds three");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

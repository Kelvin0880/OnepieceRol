// Regression for a real live bug (2026-09-27): when a MECHANICAL action (explore/attack) is what closes the lap,
// its own echo used to land as a SECOND "Narrador" bubble right after the lap's wrap-up narration — reading like
// the narrator answered the two party members separately instead of once, together. Real AI narrator.
// Usage: npx tsx scripts/party-round-merge-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { syncPartyForCharacter } from "../src/lib/game/party";
import { resolveFreeTextAction } from "../src/lib/game/perform-action";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 1_000_000;
  const mk = async (n: string) => {
    const u = await prisma.user.create({ data: { username: `${n}${stamp}`, passwordHash: "x" } });
    return { u, c: await createCharacter(u.id, `${n}${stamp}`, "PIRATE", "swordsman") };
  };
  const a = await mk("Mergea");
  const b = await mk("Mergeb");
  const crew = await createCrew(a.c.id, a.u.id, `Merge ${stamp}`, "Una brújula rota.");
  await joinCrew(b.c.id, b.u.id, crew.inviteCode);
  await syncPartyForCharacter(a.c.id);
  const partyId = (await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } })).partyId!;

  const narratorRows = () => prisma.partySceneMessage.count({ where: { partyId, authorCharacterId: null, authorName: "Narrador" } });
  const before = await narratorRows();

  await resolveFreeTextAction(a.c.id, a.u.id, "Comento en voz alta lo tranquilo que está el pueblo esta mañana.");
  assert((await narratorRows()) === before, "a's plain narrate line does not close the lap yet");

  // b closes the lap with a MECHANICAL action (a decisive commitment -> classified as "explore").
  const r2 = await resolveFreeTextAction(b.c.id, b.u.id, "Me interno decidido por el pueblo a buscar problemas, cueste lo que cueste.");
  assert(r2.log.length > 0, "b's mechanical action resolved for real");

  const after = await narratorRows();
  assert(after === before + 1, `exactly ONE narrator message closes the lap, not two (before=${before}, after=${after})`);

  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });
  assert(party.roundActionsJson === "{}" && !party.awaitingNarrator, "the lap is cleared after the merged answer");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

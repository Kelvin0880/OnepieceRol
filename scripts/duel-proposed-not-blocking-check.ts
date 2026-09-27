// Regression for a real live bug (2026-09-27): a party member with a merely PROPOSED (unanswered, not yet accepted)
// duel invite from an unrelated player got silently excluded from being pulled into her own crew's joint fight —
// "no arrastro a shiroyasha" from real gameplay. An unaccepted challenge costs nothing to ignore and must not lock
// anyone out of party/joint combat; only an ACTUALLY ACTIVE duel should. Usage: npx tsx scripts/duel-proposed-not-blocking-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { syncPartyForCharacter } from "../src/lib/game/party";
import { freePartyMemberIds } from "../src/lib/game/joint-fight";
import { challengeDuel, respondToDuel } from "../src/lib/game/duel";

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
  const a = await mk("Duela");
  const b = await mk("Duelb");
  const outsider = await mk("Dueloutsider");
  const crew = await createCrew(a.c.id, a.u.id, `Duel ${stamp}`, "Una brújula rota.");
  await joinCrew(b.c.id, b.u.id, crew.inviteCode);
  await syncPartyForCharacter(a.c.id);

  const before = await freePartyMemberIds(a.c.id);
  assert(before.length === 2 && before.includes(b.c.id), "before any duel, both crewmates are free to join a fight");

  // An unrelated player challenges b to a duel — b never answers it.
  const duel = await challengeDuel(outsider.c.id, outsider.u.id, b.c.id, false);
  const withProposed = await freePartyMemberIds(a.c.id);
  assert(withProposed.length === 2 && withProposed.includes(b.c.id), "an unanswered PROPOSED duel invite does not block b from a party joint fight");

  // b actually accepts it — now they're really mid-duel and must stay out.
  await respondToDuel(b.c.id, b.u.id, duel.duelId, true);
  const withActive = await freePartyMemberIds(a.c.id);
  assert(withActive.length === 1 && !withActive.includes(b.c.id), "an ACTIVE duel correctly excludes b from a party joint fight");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

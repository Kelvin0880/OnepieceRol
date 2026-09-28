process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Island secrets end to end on the dev DB: a discovery pays exactly once (double calls pay nothing), one-time secrets never
// return, cooldown ones return only after their cooldown, and a low-level character cannot find a secret above their band.
// Usage: npx tsx scripts/island-secrets-check.ts (freshly seeded DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { tryIslandSecret } from "../src/lib/game/island-secrets";
import { ISLAND_SECRETS } from "../src/lib/game/island-secrets-data";
import { eligibleSecrets, HOUR_MS, pickSecret } from "../src/lib/engine/island-secrets";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function main() {
  const stamp = Date.now() % 100000;
  const island = "Pueblo Foosha";
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: island } });
  const u = await prisma.user.create({ data: { username: `is${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `Buscador${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: foosha.id, level: 30, berries: 0 } });

  const secrets = ISLAND_SECRETS.filter((s) => s.island === island);
  assert(secrets.length >= 2, "the island has at least two hand-written secrets");

  // find an hour in which some secret is open for this character
  let t = new Date("2026-10-01T00:00:00Z");
  let hit = null as ReturnType<typeof pickSecret>;
  for (let h = 0; h < 2000 && !hit; h++) {
    t = new Date(Date.UTC(2026, 9, 1) + h * HOUR_MS);
    hit = pickSecret(eligibleSecrets(ISLAND_SECRETS, island, 30, new Map(), t), c.id, t);
  }
  assert(!!hit, "some hour opens a secret for this character (deterministic)");

  const before = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  const log = await tryIslandSecret(c.id, 30, island, t);
  assert(log.length > 1 && log[0].includes(hit!.title), "the discovery text and its reward lines are returned");
  const after = await prisma.character.findUniqueOrThrow({ where: { id: c.id } });
  const r = hit!.reward;
  assert((r.berries ? after.berries > before.berries : true) && (r.xp ? after.experience > before.experience || after.level > before.level : true), "berries and experience were paid");
  assert((await prisma.islandSecretFound.count({ where: { characterId: c.id, secretId: hit!.id } })) === 1, "the find was recorded");

  const again = await tryIslandSecret(c.id, 30, island, t);
  assert(!again.some((l) => l.includes(hit!.title)), "the same secret does not pay twice in the same moment");

  // one-time secrets never come back; cooldown ones only after their cooldown
  const later = new Date(t.getTime() + 500 * 24 * HOUR_MS);
  const stillEligible = eligibleSecrets(ISLAND_SECRETS, island, 30, new Map([[hit!.id, t]]), later).some((s) => s.id === hit!.id);
  assert(stillEligible === (hit!.cooldownHours !== null), "a one-time secret is gone for good; a cooldown one is available again much later");

  // level band
  const low = new Date(Date.UTC(2026, 9, 1));
  const lowSecrets = eligibleSecrets(ISLAND_SECRETS, island, 1, new Map(), low);
  assert(lowSecrets.every((s) => s.minLevel <= 1), "a level-1 character only sees secrets of their band");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

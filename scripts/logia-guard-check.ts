process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Logia backstop end to end on the dev DB: a Logia fighter loses no life to a rival that certainly cannot hurt it
// (no Haki, no fruit, no seastone) while a non-Logia teammate in the same round does; a rival with Armament Haki
// (derived from level) does hurt the Logia. Usage: npx tsx scripts/logia-guard-check.ts (freshly seeded DB)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startJointFight, forceResolveJointRound } from "../src/lib/game/joint-fight";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function mk(stamp: number, tag: string, logia: boolean) {
  const u = await prisma.user.create({ data: { username: `lg${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, "PIRATE", "swordsman");
  const fruit = logia
    ? await prisma.devilFruit.create({ data: { name: "Fruta de prueba", englishName: "Test fruit", type: "LOGIA", rarity: "RARE", description: "test", effectsJson: "{}" } })
    : null;
  await prisma.character.update({ where: { id: c.id }, data: { strength: 1, agility: 1, durability: 1, level: 1, maxHp: 100, hp: 100, devilFruitId: fruit?.id ?? null } });
  return c;
}

async function oneRound(stamp: number, enemyAtk: number, enemyDef: number, label: string) {
  const logia = await mk(stamp, `Logia${label}`, true);
  const plain = await mk(stamp, `Plano${label}`, false);
  const island = logia.currentIslandId;
  await prisma.character.update({ where: { id: plain.id }, data: { currentIslandId: island } });
  const started = await startJointFight({
    kind: "party",
    characterIds: [logia.id, plain.id],
    enemy: { name: `Rival ${label}${stamp}`, hp: 400, atk: enemyAtk, def: enemyDef, spd: 10, isBoss: false },
    rewards: { berries: 0, xp: 0, bounty: 0, islandDanger: 1 },
  });
  await prisma.jointFightParticipant.updateMany({ where: { fightId: started.fightId, isNpc: false }, data: { action: "Ataco con todo lo que tengo." } });
  await forceResolveJointRound(started.fightId);
  const parts = await prisma.jointFightParticipant.findMany({ where: { fightId: started.fightId, isNpc: false } });
  return { logia: parts.find((p) => p.characterId === logia.id)!, plain: parts.find((p) => p.characterId === plain.id)! };
}

async function main() {
  const stamp = Date.now() % 100000;

  const weak = await oneRound(stamp, 12, 12, "Debil");
  console.log(`  weak rival: Logia hp ${weak.logia.hp}/${weak.logia.maxHp}, plain hp ${weak.plain.hp}/${weak.plain.maxHp}`);
  assert(weak.plain.hp < weak.plain.maxHp, "the control fighter is hurt by the Haki-less rival (the stub does book damage)");
  assert(weak.logia.hp === weak.logia.maxHp, "the Logia fighter loses no life to a rival with no Haki, fruit or seastone");

  const strong = await oneRound(stamp, 70, 60, "Fuerte");
  console.log(`  strong rival: Logia hp ${strong.logia.hp}/${strong.logia.maxHp}, plain hp ${strong.plain.hp}/${strong.plain.maxHp}`);
  assert(strong.logia.hp < strong.logia.maxHp, "a rival whose level brings Armament Haki does hurt the Logia");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

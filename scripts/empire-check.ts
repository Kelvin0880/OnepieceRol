process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Domains as an army and nakama errands against the dev DB (needs a seeded DB: npm run db:reset).
// Usage: npx tsx scripts/empire-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getEmpire, sendOnErrand, settleErrands, EmpireError } from "../src/lib/game/empire";
import { readErrand, writeErrand } from "../src/lib/engine/empire";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}
async function rejects(fn: () => Promise<unknown>, part?: string) {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof EmpireError && (!part || e.message.includes(part));
  }
}

async function main() {
  const toro = await prisma.island.findFirstOrThrow({ where: { name: "Isla del Toro Negro" } });
  const u = await prisma.user.create({ data: { username: `em${Math.floor(Math.random() * 1e9)}`, passwordHash: "x" } });
  const c = await prisma.character.create({ data: { name: `Imperio${Date.now() % 10000}`, faction: "PIRATE", userId: u.id, currentIslandId: toro.id, level: 35, hp: 200, maxHp: 200, berries: 1000 } });
  const old = await prisma.territory.findUnique({ where: { islandId: toro.id } });
  await prisma.territory.upsert({
    where: { islandId: toro.id },
    update: { ownerCharacterId: c.id, ownerName: c.name, status: "HELD", garrison: 40, lastPressureAt: new Date() },
    create: { islandId: toro.id, ownerCharacterId: c.id, ownerName: c.name, status: "HELD", garrison: 40 },
  });
  const yami = await prisma.nPCCompanion.create({ data: { characterId: c.id, name: "Yami", role: "Espadachín", hp: 150, maxHp: 150, loyalty: 90, profileJson: JSON.stringify({ epithet: "Corta-Tormentas", attrs: { strength: 140, agility: 100, durability: 100, willpower: 50, intellect: 30 } }) } });
  const hurt = await prisma.nPCCompanion.create({ data: { characterId: c.id, name: "Herido", role: "Cocinero", hp: 10, maxHp: 90, loyalty: 50 } });

  try {
    // ---- the overview
    const e0 = (await getEmpire(c.id))!;
    assert(e0.domains.length === 1 && e0.domains[0].islandName === "Isla del Toro Negro", "the empire lists the island I hold");
    assert(e0.domains[0].garrison === 40 && e0.domains[0].garrisonLabel === "Debilitada" && e0.domains[0].troops > 0, "it shows garrison, its label and a troop count");
    assert(e0.domains[0].msUntilFall > 0 && e0.domains[0].isOwner, "it shows when the garrison would fall");
    assert(e0.commanders.length === 2 && e0.commanders[0].epithet === "Corta-Tormentas", "commanders keep their epithet");

    // ---- refusals
    assert(await rejects(() => sendOnErrand(c.id, "someone-else", yami.id, "scout"), "no encontrado"), "only the owner can send errands");
    assert(await rejects(() => sendOnErrand(c.id, u.id, hurt.id, "scout"), "herido"), "a badly hurt nakama cannot go");
    assert(await rejects(() => sendOnErrand(c.id, u.id, yami.id, "patrol"), "dominio"), "a patrol needs a chosen domain");
    const other = await prisma.island.findFirstOrThrow({ where: { name: "Loguetown" } });
    assert(await rejects(() => sendOnErrand(c.id, u.id, yami.id, "patrol", other.id), "sostienes"), "you cannot patrol a domain you do not hold");

    // ---- a patrol, the busy state and the double-send guard
    await sendOnErrand(c.id, u.id, yami.id, "patrol", toro.id);
    const after = await prisma.nPCCompanion.findUniqueOrThrow({ where: { id: yami.id } });
    assert(!!readErrand(after.profileJson) && JSON.parse(after.profileJson!).epithet === "Corta-Tormentas", "the errand is stored without losing the commander's profile");
    assert(await rejects(() => sendOnErrand(c.id, u.id, yami.id, "scout"), "ya está"), "a busy nakama cannot take a second errand");
    assert((await getEmpire(c.id))!.commanders[0].errand?.kind === "patrol", "the panel shows who is away");
    assert((await settleErrands(c.id)).length === 0, "nothing settles before it is due");

    // ---- settle: the patrol lands, pays once
    let wins = 0;
    for (let i = 0; i < 12 && wins === 0; i++) {
      await prisma.nPCCompanion.update({ where: { id: yami.id }, data: { hp: 150, profileJson: writeErrand((await prisma.nPCCompanion.findUniqueOrThrow({ where: { id: yami.id } })).profileJson, { kind: "patrol", startedAt: Date.now() - 5000, endsAt: Date.now() - 1000, islandId: toro.id }) } });
      const before = (await prisma.territory.findUniqueOrThrow({ where: { islandId: toro.id } })).garrison;
      const lines = await settleErrands(c.id);
      assert(lines.length === 1, "a finished errand reports exactly once");
      assert((await settleErrands(c.id)).length === 0, "a second settle pays nothing (no double payout)");
      const now = (await prisma.territory.findUniqueOrThrow({ where: { islandId: toro.id } })).garrison;
      if (now > before) wins++;
    }
    assert(wins === 1, "a strong commander eventually raises the garrison on patrol");
    assert(!readErrand((await prisma.nPCCompanion.findUniqueOrThrow({ where: { id: yami.id } })).profileJson), "he is free again afterwards");

    // ---- tribute pays berries, scout pays XP; failure hurts but never kills
    const money = (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries;
    let paid = false;
    for (let i = 0; i < 12 && !paid; i++) {
      await prisma.nPCCompanion.update({ where: { id: yami.id }, data: { hp: 150, profileJson: writeErrand(null, { kind: "tribute", startedAt: 0, endsAt: 1 }) } });
      await settleErrands(c.id);
      paid = (await prisma.character.findUniqueOrThrow({ where: { id: c.id } })).berries > money;
    }
    assert(paid, "a tribute errand brings berries home");
    const weak = await prisma.nPCCompanion.create({ data: { characterId: c.id, name: "Debil", role: "Músico", hp: 60, maxHp: 60, loyalty: 10 } });
    const dangerous = await prisma.character.update({ where: { id: c.id }, data: { level: 1 } });
    void dangerous;
    let failed = false;
    for (let i = 0; i < 40 && !failed; i++) {
      await prisma.nPCCompanion.update({ where: { id: weak.id }, data: { hp: 60, profileJson: writeErrand(null, { kind: "tribute", startedAt: 0, endsAt: 1, islandId: toro.id }) } });
      await settleErrands(c.id);
      const w = await prisma.nPCCompanion.findUniqueOrThrow({ where: { id: weak.id } });
      failed = w.hp < 60;
      assert(w.status === "ALIVE", "a failed errand never kills");
    }
    assert(failed, "a weak nakama sent somewhere dangerous can come back wounded");
    const reports = (await getEmpire(c.id))!.reports;
    assert(reports.length > 0, "settled errands leave reports");
  } finally {
    await prisma.gameLogEntry.deleteMany({ where: { characterId: c.id } });
    await prisma.nPCCompanion.deleteMany({ where: { characterId: c.id } });
    if (old) await prisma.territory.update({ where: { islandId: toro.id }, data: { ownerCharacterId: old.ownerCharacterId, ownerName: old.ownerName, garrison: old.garrison } });
    else await prisma.territory.delete({ where: { islandId: toro.id } });
    await prisma.character.delete({ where: { id: c.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

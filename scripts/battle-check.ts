process.env.REFEREE_STUB = "1"; // the AI referee is replaced by the deterministic stand-in
// Crew battles (2v2) are now real duels: propose -> accept -> one duel per matchup -> the battle settles when all end.
// Usage: npx tsx scripts/battle-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { proposeBattle, respondToBattle, BattleError } from "../src/lib/game/group-battle";
import { yieldDuel, decideVerdict } from "../src/lib/game/duel-resolution";
import { getOpenDuelFor } from "../src/lib/game/duel";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

const stamp = Date.now() % 100000;

async function main() {
  const foosha = await prisma.island.findFirstOrThrow({ where: { name: { contains: "Foosha" } } });
  const made: { u: string; c: string }[] = [];
  const mk = async (tag: string) => {
    const u = await prisma.user.create({ data: { username: `bt${tag}${stamp}${Math.floor(Math.random() * 1e6)}`, passwordHash: "x" } });
    const c = await prisma.character.create({ data: { name: `${tag}${stamp}`, faction: "PIRATE", userId: u.id, currentIslandId: foosha.id, level: 10, hp: 150, maxHp: 150, strength: 30, durability: 30 } });
    made.push({ u: u.id, c: c.id });
    return { u, c };
  };
  const crewIds: string[] = [];
  try {
    const a1 = await mk("Alfa1");
    const a2 = await mk("Alfa2");
    const b1 = await mk("Beta1");
    const b2 = await mk("Beta2");
    const ca = await createCrew(a1.c.id, a1.u.id, `Alfa${stamp}`, "x");
    const cb = await createCrew(b1.c.id, b1.u.id, `Beta${stamp}`, "x");
    crewIds.push(ca.id, cb.id);
    await joinCrew(a2.c.id, a2.u.id, ca.inviteCode);
    await joinCrew(b2.c.id, b2.u.id, cb.inviteCode);

    for (const lethal of [false, true]) {
      const battle = await proposeBattle(a1.c.id, a1.u.id, cb.id, [
        { myCharacterId: a1.c.id, opponentCharacterId: b1.c.id },
        { myCharacterId: a2.c.id, opponentCharacterId: b2.c.id },
      ], lethal);
      assert(battle.lethal === lethal, `a ${lethal ? "lethal" : "friendly"} 2v2 is proposed`);
      const r = await respondToBattle(b1.c.id, b1.u.id, battle.id, true);
      assert(r.status === "ACTIVE" && r.duels === 2, "accepting opens one real duel per matchup");
      const duels = await prisma.duel.findMany({ where: { groupBattleId: battle.id } });
      assert(duels.length === 2 && duels.every((d) => d.status === "ACTIVE" && d.lethal === lethal), "both duels are running with the chosen stakes");
      assert(!!(await getOpenDuelFor(a1.c.id)) && !!(await getOpenDuelFor(b2.c.id)), "every fighter has their own duel");
      let bs = await prisma.groupBattle.findUniqueOrThrow({ where: { id: battle.id } });
      assert(bs.status === "ACTIVE", "the battle is in progress");

      // Crew A's fighters both give up.
      await yieldDuel(a1.c.id, a1.u.id, duels.find((d) => d.challengerId === a1.c.id)!.id);
      bs = await prisma.groupBattle.findUniqueOrThrow({ where: { id: battle.id } });
      assert(bs.status === "ACTIVE", "one finished duel does not settle the battle");
      if (lethal) {
        await decideVerdict(b1.c.id, b1.u.id, duels.find((d) => d.challengerId === a1.c.id)!.id, "spare");
        bs = await prisma.groupBattle.findUniqueOrThrow({ where: { id: battle.id } });
        assert(bs.status === "ACTIVE", "in a lethal battle the verdict comes first");
      }
      const second = duels.find((d) => d.challengerId === a2.c.id)!;
      await yieldDuel(a2.c.id, a2.u.id, second.id);
      if (lethal) await decideVerdict(b2.c.id, b2.u.id, second.id, "spare");

      const done = await prisma.groupBattle.findUniqueOrThrow({ where: { id: battle.id }, include: { participants: true } });
      assert(done.status === "RESOLVED" && !!done.resultJson, "when the last duel ends the battle settles");
      const res = JSON.parse(done.resultJson!) as { victor: string; duels: { winner: string }[] };
      assert(res.victor === "b" && res.duels.every((d) => d.winner === "b"), "crew B wins both matchups");
      assert(done.participants.filter((p) => p.side === "B").every((p) => p.outcome === "victory") && done.participants.filter((p) => p.side === "A").every((p) => p.outcome === "defeat"), "outcomes are recorded per fighter");
      const news = await prisma.newsItem.findFirst({ where: { headline: { contains: `Beta${stamp}` }, category: "Guerra" }, orderBy: { createdAt: "desc" } });
      assert(!!news && news.severity === "major" && !!news.locationName, "the clash is major news with its place");
      const winner = await prisma.character.findUniqueOrThrow({ where: { id: b1.c.id } });
      assert(winner.berries > 0, "the winners collect their spoils");
    }

    // A fighter who is not free cannot be dragged into a second fight.
    const c1 = await mk("Solo1");
    const busy = await proposeBattle(a1.c.id, a1.u.id, cb.id, [{ myCharacterId: a1.c.id, opponentCharacterId: b1.c.id }], false);
    await prisma.character.update({ where: { id: b1.c.id }, data: { currentIslandId: (await prisma.island.findFirstOrThrow({ where: { name: { contains: "Baratie" } } })).id } });
    let refused = false;
    try {
      await respondToBattle(b1.c.id, b1.u.id, busy.id, true);
    } catch (e) {
      refused = e instanceof BattleError;
    }
    assert(refused, "a fighter who left the island cannot be forced into the battle");
    void c1;
  } finally {
    for (const x of made) {
      await prisma.groupBattleParticipant.deleteMany({ where: { characterId: x.c } });
      await prisma.duel.deleteMany({ where: { OR: [{ challengerId: x.c }, { opponentId: x.c }] } });
    }
    await prisma.groupBattle.deleteMany({ where: { OR: [{ crewAId: { in: crewIds } }, { crewBId: { in: crewIds } }] } });
    for (const x of made) await prisma.character.update({ where: { id: x.c }, data: { crewId: null } }).catch(() => undefined);
    await prisma.crew.deleteMany({ where: { id: { in: crewIds } } });
    for (const x of made) {
      await prisma.character.delete({ where: { id: x.c } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: x.u } }).catch(() => undefined);
    }
  }
  console.log("ALL PASS");
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

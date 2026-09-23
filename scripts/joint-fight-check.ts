// Real N-vs-1 joint fight (2026-09-24): three players plus a companion against
// one boss, then a hopeless one. Direct function calls against the dev DB; each
// move is classified by the real AI (needs OPENROUTER_API_KEY).
// Usage: npx tsx scripts/joint-fight-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startJointFight, submitJointAction, getOpenJointFightFor, getJointFightStateForCharacter, freePartyMemberIds, JointFightError } from "../src/lib/game/joint-fight";
import { attackCharacter } from "../src/lib/game/perform-action";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(stamp: number, tag: string, faction: "PIRATE" | "MARINE", boost: number) {
  const u = await prisma.user.create({ data: { username: `jf${tag}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${tag}${stamp}`, faction, "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { strength: boost, agility: boost, durability: boost, level: 5, maxHp: 60 + boost, hp: 60 + boost } });
  return { user: u, char: c };
}

async function playRounds(fightId: string, who: { id: string; userId: string }[], maxRounds: number) {
  for (let i = 0; i < maxRounds; i++) {
    const f = await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } });
    if (f.status !== "ACTIVE") return f.status;
    for (const w of who) {
      const part = await prisma.jointFightParticipant.findFirst({ where: { fightId, characterId: w.id } });
      if (part?.status === "FIGHTING" && !part.action) {
        try {
          await submitJointAction(w.id, w.userId, "Ataco al enemigo con todo lo que tengo, coordinándome con mis nakamas.");
        } catch (e) {
          if (!(e instanceof JointFightError)) throw e;
        }
      }
    }
  }
  return (await prisma.jointFight.findUniqueOrThrow({ where: { id: fightId } })).status;
}

async function main() {
  const stamp = Date.now() % 100000;
  const a = await mk(stamp, "Alfa", "PIRATE", 70);
  const b = await mk(stamp, "Beta", "PIRATE", 70);
  const c = await mk(stamp, "Gama", "PIRATE", 70);
  const island = a.char.currentIslandId;
  await prisma.character.updateMany({ where: { id: { in: [b.char.id, c.char.id] } }, data: { currentIslandId: island } });
  await prisma.nPCCompanion.create({ data: { characterId: a.char.id, name: `Cocinero${stamp}`, role: "Cocinero", hp: 40, maxHp: 40, loyalty: 80 } });

  // 1) Group vs. boss: enemy scales, the round waits for everyone, then resolves once.
  const enemy = { name: "Capitán Rival", hp: 120, atk: 40, def: 25, spd: 10, isBoss: true };
  const started = await startJointFight({
    kind: "party",
    characterIds: [a.char.id, b.char.id, c.char.id],
    enemy,
    rewards: { berries: 500, xp: 60, bounty: 100_000, islandDanger: 3 },
    stakes: "un duelo de pasillo",
    opening: { characterId: a.char.id, text: "Cargo contra el capitán.", tactic: 5, technique: "none" },
  });
  const fight = await prisma.jointFight.findUniqueOrThrow({ where: { id: started.fightId }, include: { participants: true } });
  assert(fight.participants.length === 4, "3 players + 1 companion are participants");
  assert(fight.enemyMaxHp > enemy.hp * 2.5, `boss HP scaled for the group (${fight.enemyMaxHp} > ${enemy.hp * 2.5})`);
  assert(started.waiting && fight.round === 1, "round 1 waits for the other players after one opening move");
  assert(!!(await getOpenJointFightFor(b.char.id)), "every player sees the open fight");

  let blocked = false;
  try {
    await startJointFight({ kind: "party", characterIds: [b.char.id], enemy, rewards: { berries: 0, xp: 0, bounty: 0, islandDanger: 1 } });
  } catch (e) {
    blocked = e instanceof JointFightError;
  }
  assert(blocked, "a player already in a fight cannot start another");

  const res = await playRounds(fight.id, [a, b, c].map((x) => ({ id: x.char.id, userId: x.user.id })), 12);
  const msgs = await prisma.jointFightMessage.count({ where: { fightId: fight.id } });
  assert(msgs > 4, `shared transcript recorded (${msgs} messages)`);
  assert(res === "WON" || res === "LOST", `fight concluded (${res})`);
  const state = await getJointFightStateForCharacter(b.char.id);
  assert(!!state && state.participants.length === 4, "state payload lists all participants for any member");
  if (res === "WON") {
    const after = await prisma.character.findUniqueOrThrow({ where: { id: b.char.id } });
    assert(after.berries > 3000, "a victory pays every participant");
    assert(!(await getOpenJointFightFor(b.char.id)), "the fight closes after victory");
  }

  // 2) Party attack routes into a joint fight for the whole party.
  const crewId = `crew${stamp}`;
  const party = await prisma.party.create({ data: { crewId, turnOrder: JSON.stringify([a.char.id, b.char.id]) } });
  await prisma.character.updateMany({ where: { id: { in: [a.char.id, b.char.id] } }, data: { partyId: party.id, hp: 130, maxHp: 130 } });
  const free = await freePartyMemberIds(a.char.id);
  assert(free.length === 2, "freePartyMemberIds returns both party members");
  const atk = await attackCharacter(a.char.id, a.user.id, "Golpeo al fanfarrón del bar.", { target: "el fanfarrón", tier: "average", tacticModifier: 0 });
  assert(atk.jointFight === true, "attacking in a party opens a joint fight");
  const open = await getOpenJointFightFor(b.char.id);
  assert(!!open, "the crewmate is pulled into the same fight");
  await prisma.jointFight.update({ where: { id: open!.id }, data: { status: "CANCELLED" } });

  // 3) A hopeless fight: downed players face the real death roll.
  await prisma.character.update({ where: { id: a.char.id }, data: { partyId: null } });
  await prisma.character.update({ where: { id: b.char.id }, data: { partyId: null } });
  const weak = await mk(stamp, "Debil", "PIRATE", 3);
  await prisma.character.update({ where: { id: weak.char.id }, data: { currentIslandId: island, hp: 15, maxHp: 15 } });
  const doom = await startJointFight({
    kind: "party",
    characterIds: [weak.char.id],
    enemy: { name: "Monstruo", hp: 900, atk: 200, def: 120, spd: 60, isBoss: true },
    rewards: { berries: 0, xp: 0, bounty: 0, islandDanger: 5 },
    opening: { characterId: weak.char.id, text: "Ataco.", tactic: 0, technique: "none" },
  });
  const doomStatus = await prisma.jointFight.findUniqueOrThrow({ where: { id: doom.fightId } });
  assert(doomStatus.status === "LOST", "a hopeless fight is lost");
  const wc = await prisma.character.findUniqueOrThrow({ where: { id: weak.char.id } });
  assert(wc.status === "DEAD" || wc.hp > 0, `downed player went through the death roll (status ${wc.status}, hp ${wc.hp})`);

  console.log("ALL PASS");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

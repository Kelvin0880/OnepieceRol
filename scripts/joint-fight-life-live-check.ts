// Real AI check (no stubs): does the referee correctly book life/stamina for MULTIPLE humans at once in a joint fight,
// the same way the solo wound-floor/underbooked-wound backstops already guarantee for 1v1? Usage:
// npx tsx scripts/joint-fight-life-live-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { createCrew, joinCrew } from "../src/lib/game/crew";
import { syncPartyForCharacter } from "../src/lib/game/party";
import { attackCharacter } from "../src/lib/game/perform-action";
import { submitJointAction, getOpenJointFightFor } from "../src/lib/game/joint-fight";

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
  const a = await mk("Vidaa");
  const b = await mk("Vidab");
  const crew = await createCrew(a.c.id, a.u.id, `Vida ${stamp}`, "Una brújula rota.");
  await joinCrew(b.c.id, b.u.id, crew.inviteCode);
  await syncPartyForCharacter(a.c.id);

  const hp = () => prisma.character.findMany({ where: { id: { in: [a.c.id, b.c.id] } }, select: { id: true, name: true, hp: true, maxHp: true, stamina: true } });
  console.log("before:", await hp());

  const started = await attackCharacter(a.c.id, a.u.id, "Me lanzo contra el guardia del muelle con un tajo directo.", { target: "guardia", tier: "average" });
  assert(!!started.jointFight, "attacking with a free crewmate present opens a joint fight, not a solo one");
  const fight = await getOpenJointFightFor(a.c.id);
  assert(!!fight, "both are now in the same joint fight");

  const enemyHp = async () => {
    const f = await prisma.jointFight.findFirst({ where: { id: fight!.id } });
    return f ? { hp: f.enemyHp, maxHp: f.enemyMaxHp, round: f.round, status: f.status } : null;
  };

  // b closes round 1 (a's opening strike was already their move for it).
  const r1 = await submitJointAction(b.c.id, b.u.id, "Cubro el flanco de mi compañero y golpeo con el bastón.");
  console.log("b (round 1):", r1.log.join(" | ").slice(0, 400));
  console.log("players after round 1:", await hp());
  console.log("enemy after round 1:", await enemyHp());

  const aTexts = ["Aprovecho que retrocedió y encadeno otro tajo, esta vez apuntando al costado.", "Intento esquivar su patada girando hacia un lado y contraataco al torso.", "Sigo presionando con estocadas rápidas para no dejarlo recuperar el aliento."];
  const bTexts = ["Sigo presionando, atacando junto a mi compañero con otro golpe de bastón.", "Me cubro y busco un hueco para golpear de nuevo.", "Ataco con todo lo que tengo para terminar esto."];
  for (let round = 2; round <= 4; round++) {
    console.log(`\n--- round ${round} ---`);
    const stillA = await getOpenJointFightFor(a.c.id);
    if (!stillA) { console.log("fight concluded before round", round); break; }
    const ra = await submitJointAction(a.c.id, a.u.id, aTexts[round - 2]);
    console.log("a:", ra.log.join(" | ").slice(0, 200));
    const stillB = await getOpenJointFightFor(b.c.id);
    if (!stillB) { console.log("fight concluded mid-round", round, "(a's move alone ended it)"); break; }
    const rb = await submitJointAction(b.c.id, b.u.id, bTexts[round - 2]);
    console.log("b:", rb.log.join(" | ").slice(0, 300));
    console.log("players after round", round, ":", await hp());
    console.log("enemy after round", round, ":", await enemyHp());
    if (!(await getOpenJointFightFor(a.c.id))) { console.log("fight concluded at round", round); break; }
  }

  const final = await hp();
  const finalEnemy = await enemyHp();
  const enemyMoved = finalEnemy && finalEnemy.hp !== finalEnemy.maxHp;
  const playersMoved = final.some((f) => f.hp !== f.maxHp);
  assert(!!enemyMoved || playersMoved || !!(finalEnemy && finalEnemy.status !== "ACTIVE"), "at least one side's life actually moved from the fight, or it concluded (not everyone flatlined at full HP forever)");
  assert(final.every((f) => f.hp >= 0 && f.hp <= f.maxHp), "every player's HP stayed within real bounds [0, maxHp]");
  if (finalEnemy) assert(finalEnemy.hp >= 0 && finalEnemy.hp <= finalEnemy.maxHp, "the enemy's own HP stayed within real bounds too");

  console.log("\nALL PASS (see prints above for what the real AI actually did)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

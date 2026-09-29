// Reported 2026-09-28 (Zarpe vs Crag el Rompehuesos): the player could never find "Reintentar ronda" even though a
// round had genuinely stalled. Root cause: the "stalled" flag was computed from roundStartedAt, the same timestamp
// each failed background retry resets — so the flag (and the button) flickered true for a fraction of one poll every
// ~150s, never long enough for a human to see or click it. Fix: derive it from the no-verdict notice instead, which
// stays put across attempts. Direct function calls against the dev DB, no AI involved.
// Usage: npx tsx scripts/joint-fight-stalled-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getJointFightStateForCharacter } from "../src/lib/game/joint-fight";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

const NOTICE = "(El árbitro no pudo juzgar esta ronda a tiempo. Nada cambió: se reintenta sola en unos minutos, o pulsa Reintentar ronda.)";

async function main() {
  const characterId = `stalledcheck-${Date.now()}`;
  const fight = await prisma.jointFight.create({
    data: {
      islandId: "stalledcheck-island",
      kind: "canon_vanguard",
      status: "ACTIVE",
      round: 3,
      enemyJson: JSON.stringify({ name: "Crag el Rompehuesos", hp: 515, atk: 102, def: 36, spd: 55, isBoss: false, level: 45 }),
      enemyHp: 515,
      enemyMaxHp: 515,
      rewardsJson: JSON.stringify({ berries: 1000, xp: 10, bounty: 0, islandDanger: 5 }),
      roundStartedAt: new Date(), // fresh, exactly what a failed background retry leaves behind
    },
  });
  await prisma.jointFightParticipant.create({
    data: { fightId: fight.id, characterId, name: "Zarpe", isNpc: false, hp: 400, maxHp: 400, status: "FIGHTING", action: "un movimiento largo y detallado" },
  });

  // 1) Everyone answered, but no notice was ever posted (a genuinely fresh round, or the first attempt still running):
  //    not player-visibly stalled yet, whatever roundStartedAt says.
  let state = await getJointFightStateForCharacter(characterId);
  assert(state?.stalled === false, "not stalled before any failure is on record");

  // 2) A failed attempt posts the notice. roundStartedAt gets reset to right now by that same attempt (the real bug
  //    trigger) — the old logic would read this as "not stalled" again immediately.
  await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: null, authorName: "Narrador", text: NOTICE } });
  await prisma.jointFight.update({ where: { id: fight.id }, data: { roundStartedAt: new Date() } });
  state = await getJointFightStateForCharacter(characterId);
  assert(state?.stalled === true, "stalled right after a failure, even with roundStartedAt freshly reset");

  // 3) Simulate more real time passing with no further attempt (the player finally opens the screen minutes later):
  //    still stalled, still showing the retry option.
  await prisma.jointFight.update({ where: { id: fight.id }, data: { roundStartedAt: new Date(Date.now() - 5 * 60_000) } });
  state = await getJointFightStateForCharacter(characterId);
  assert(state?.stalled === true, "still stalled several minutes later, not just in the instant after the failure");

  // 4) The round actually resolves: a real narrator message replaces the notice as the newest, and (as
  //    resolveJointRoundFor really does on success) the participant's `action` is cleared for the next round.
  await prisma.jointFightMessage.create({ data: { fightId: fight.id, authorCharacterId: null, authorName: "Narrador", text: "Zarpe esquiva el golpe y responde con un tajo certero." } });
  await prisma.jointFightParticipant.updateMany({ where: { fightId: fight.id }, data: { action: null } });
  state = await getJointFightStateForCharacter(characterId);
  assert(state?.stalled === false, "not stalled once a real resolution message is the newest one");

  await prisma.jointFightMessage.deleteMany({ where: { fightId: fight.id } });
  await prisma.jointFightParticipant.deleteMany({ where: { fightId: fight.id } });
  await prisma.jointFight.delete({ where: { id: fight.id } });
  console.log("Cleaned up.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

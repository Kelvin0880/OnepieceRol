process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Seats of command (Admiral / Fleet Admiral, revolutionary command, Gorosei): challenges against canon holders and players,
// forfeits, the world's own challenges, canon-vs-canon duels and the wars a seat can declare.
// Usage (fresh dev DB, seeded): npx tsx scripts/seats-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { challengeSeat, getSeatState, refreshSeatChallenges, respondSeatChallenge, resolveCanonDuelNow, startCanonSeatEventNow } from "../src/lib/game/faction-seats";
import { closeJointFight, getOpenJointFightFor } from "../src/lib/game/joint-fight";
import { yieldDuel } from "../src/lib/game/duel-resolution";
import { declareWar, getSovereigntyState, warAssault } from "../src/lib/game/sovereignty";
import { invalidateWorldState, worldStateBlock } from "../src/lib/game/world-state";
import { SEATS, type SeatId } from "../src/lib/engine/faction-seats";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function expectError(fn: () => Promise<unknown>, part: string, label: string) {
  let msg = "";
  try {
    await fn();
  } catch (e) {
    msg = (e as Error).message;
  }
  assert(msg.includes(part), `${label} (${msg || "no error"})`);
}

const stamp = Date.now() % 1_000_000;
async function mk(name: string, faction: "MARINE" | "REVOLUTIONARY" | "PIRATE" | "CP0", island: string, extra: Record<string, unknown> = {}) {
  const u = await prisma.user.create({ data: { username: `${name}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${name}${stamp}`, faction, "swordsman");
  const isl = await prisma.island.findUniqueOrThrow({ where: { name: island } });
  await prisma.character.update({ where: { id: c.id }, data: { currentIslandId: isl.id, level: 55, hp: 900, maxHp: 900, stamina: 400, maxStamina: 400, notoriety: 13_000, ...extra } });
  return { u, c: await prisma.character.findUniqueOrThrow({ where: { id: c.id } }) };
}

async function win(id: string, userId: string) {
  const f = await getOpenJointFightFor(id);
  if (!f) throw new Error("no open fight");
  await prisma.jointFight.update({ where: { id: f.id }, data: { enemyHp: 10 } });
  return closeJointFight(id, userId);
}

async function lose(id: string, userId: string) {
  const f = await getOpenJointFightFor(id);
  if (!f) throw new Error("no open fight");
  await prisma.jointFightParticipant.updateMany({ where: { fightId: f.id, characterId: id }, data: { hp: 20 } });
  return closeJointFight(id, userId);
}

const seatOf = async (id: string) => (await prisma.character.findUniqueOrThrow({ where: { id } })).seat;
const actor = (name: string) => prisma.worldActor.findUniqueOrThrow({ where: { name } });
const cool = (id: string) => prisma.character.update({ where: { id }, data: { lastSeatChallengeAt: null } });

async function capacityHolds(label: string) {
  for (const s of Object.values(SEATS)) {
    const n = (await prisma.worldActor.count({ where: { seat: s.id, status: "ACTIVE" } })) + (await prisma.character.count({ where: { seat: s.id, status: { not: "DEAD" } } }));
    if (n > s.seats) throw new Error(`FAIL: ${s.title} has ${n}/${s.seats} (${label})`);
  }
  console.log(`PASS: no seat over capacity (${label})`);
}

async function main() {
  await capacityHolds("seeded world");
  assert((await actor("Sakazuki")).seat === "FLEET_ADMIRAL", "Sakazuki is the one Fleet Admiral");
  assert((await actor("Don Krieg")).rankLabel?.includes("pirata") ?? false, "Don Krieg is a pirate captain, not a Marine fleet admiral");

  const a = await mk("Almira", "MARINE", "Nuevo Marineford", { notoriety: 8_000 });
  const pirate = await mk("Pirata", "PIRATE", "Nuevo Marineford");
  await expectError(() => challengeSeat(pirate.c.id, pirate.u.id, "ADMIRAL", "canon", "x"), "no existe", "unknown rival refused");
  await expectError(async () => challengeSeat(pirate.c.id, pirate.u.id, "ADMIRAL", "canon", (await actor("Kizaru")).id), "requisitos", "a pirate cannot challenge an admiral");
  await expectError(async () => challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "canon", (await actor("Sakazuki")).id), "requisitos", "fleet admiral needs being an admiral first");

  const st0 = await getSeatState(a.c.id, a.u.id);
  assert(st0.tiers.map((t) => t.id).join() === "ADMIRAL,FLEET_ADMIRAL" && st0.tiers[0].taken === 3, "the marine sees the two seats and the three canon admirals");
  const kizaru = await actor("Kizaru");
  assert(kizaru.currentIslandId !== a.c.currentIslandId, "Kizaru is elsewhere (the challenge is presented at headquarters)");

  // 1. Beat an admiral: you are admiral, he drops to vice admiral.
  await challengeSeat(a.c.id, a.u.id, "ADMIRAL", "canon", kizaru.id);
  const k1 = await actor("Kizaru");
  assert(k1.currentIslandId === a.c.currentIslandId, "the holder answers the challenge at headquarters");
  const open1 = await prisma.seatChallenge.findFirstOrThrow({ where: { challengerId: a.c.id } });
  assert(open1.status === "FIGHTING" && !!open1.fightId, "a one-on-one fight is running");
  const fight1 = await prisma.jointFight.findUniqueOrThrow({ where: { id: open1.fightId! }, include: { participants: true } });
  assert(fight1.kind === "seat" && fight1.participants.filter((p) => !p.isNpc).length === 1, "it is a solo seat fight");
  await win(a.c.id, a.u.id);
  assert((await seatOf(a.c.id)) === "ADMIRAL", "the challenger is now Admiral");
  const k2 = await actor("Kizaru");
  assert(k2.seat === null && k2.role === "MARINE_GENERAL" && (k2.rankLabel ?? "").startsWith("Vicealmirante"), "Kizaru drops to Vice Admiral");
  assert(!!(await prisma.newsItem.findFirst({ where: { category: "Rangos y mandos", headline: { contains: "nuevo Almirante" } } })), "the promotion is in the news");
  await capacityHolds("after the first promotion");

  // 2. Losing to the fleet admiral: nothing changes and nobody dies.
  await expectError(async () => challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "canon", (await actor("Sakazuki")).id), "requisitos", "an Admiral still needs 12.000 merit for the top");
  await prisma.character.update({ where: { id: a.c.id }, data: { notoriety: 13_000 } });
  await cool(a.c.id);
  await challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "canon", (await actor("Sakazuki")).id);
  await lose(a.c.id, a.u.id);
  const afterLoss = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
  assert(afterLoss.status === "ALIVE" && afterLoss.seat === "ADMIRAL", "a lost seat duel leaves you alive and still Admiral");
  const ch2 = await prisma.seatChallenge.findFirstOrThrow({ where: { challengerId: a.c.id }, orderBy: { createdAt: "desc" } });
  assert(ch2.status === "DONE" || ch2.status === "CANCELLED", "the challenge is closed");

  // 3. Beating the fleet admiral swaps the two posts.
  await prisma.worldActor.update({ where: { name: "Sakazuki" }, data: { busyUntil: null } });
  await cool(a.c.id);
  await challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "canon", (await actor("Sakazuki")).id);
  await expectError(() => challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "canon", "x"), "", "no second challenge while one runs");
  await win(a.c.id, a.u.id);
  assert((await seatOf(a.c.id)) === "FLEET_ADMIRAL", "the player is the new Fleet Admiral");
  const s3 = await actor("Sakazuki");
  assert(s3.seat === "ADMIRAL" && s3.role === "ADMIRAL", "Sakazuki takes the player's admiral seat");
  await capacityHolds("after the swap at the top");
  invalidateWorldState();
  assert((await worldStateBlock()).includes(`Almirante de Flota: ${a.c.name}`), "the narrator's world facts name the new Fleet Admiral");

  // 4. Player vs player: refusing the duel costs the seat; accepting and yielding decides it too.
  const b = await mk("Bravo", "MARINE", "Nuevo Marineford");
  await challengeSeat(b.c.id, b.u.id, "ADMIRAL", "canon", (await actor("Ryokugyu")).id);
  await win(b.c.id, b.u.id);
  assert((await seatOf(b.c.id)) === "ADMIRAL", "a second marine becomes Admiral");
  await cool(b.c.id);
  await challengeSeat(b.c.id, b.u.id, "FLEET_ADMIRAL", "player", a.c.id);
  const incoming = await getSeatState(a.c.id, a.u.id);
  assert(incoming.incoming.length === 1 && incoming.incoming[0].challengerName === b.c.name, "the defender sees the challenge");
  await respondSeatChallenge(a.c.id, a.u.id, incoming.incoming[0].id, false);
  assert((await seatOf(b.c.id)) === "FLEET_ADMIRAL" && (await seatOf(a.c.id)) === "ADMIRAL", "refusing hands over the seat: they swap");

  await cool(a.c.id);
  await challengeSeat(a.c.id, a.u.id, "FLEET_ADMIRAL", "player", b.c.id);
  const inc2 = (await getSeatState(b.c.id, b.u.id)).incoming[0];
  await respondSeatChallenge(b.c.id, b.u.id, inc2.id, true);
  const duelCh = await prisma.seatChallenge.findUniqueOrThrow({ where: { id: inc2.id } });
  assert(duelCh.status === "FIGHTING" && !!duelCh.duelId, "accepting opens a duel");
  const duel = await prisma.duel.findUniqueOrThrow({ where: { id: duelCh.duelId! } });
  assert(duel.status === "ACTIVE" && !duel.lethal, "a friendly duel, never to the death");
  await yieldDuel(b.c.id, b.u.id, duel.id);
  assert((await seatOf(a.c.id)) === "FLEET_ADMIRAL" && (await seatOf(b.c.id)) === "ADMIRAL", "the one who yields loses the seat");
  await capacityHolds("after the player duels");

  // 5. The world challenges a player: an unanswered challenge expires and costs the seat.
  await prisma.character.updateMany({ where: { id: { in: [a.c.id, b.c.id] } }, data: { seatSince: new Date(Date.now() - 48 * 3600_000), lastSeatDefenseAt: null } });
  await prisma.seatChallenge.updateMany({ where: { challengerKind: "canon" }, data: { createdAt: new Date(0) } });
  await startCanonSeatEventNow();
  const canonCh = await prisma.seatChallenge.findFirstOrThrow({ where: { challengerKind: "canon", defenderKind: "player", status: "PENDING" } });
  assert([a.c.id, b.c.id].includes(canonCh.defenderId), `a canon character (${canonCh.challengerName}) comes for a player's seat (${canonCh.seat})`);
  assert(!!(await prisma.newsItem.findFirst({ where: { headline: { contains: canonCh.challengerName }, category: "Rangos y mandos" } })), "the world's challenge is announced in the news");
  const defenderSeatBefore = (await seatOf(canonCh.defenderId)) as SeatId;
  await prisma.seatChallenge.update({ where: { id: canonCh.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await refreshSeatChallenges();
  const challengerAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: canonCh.challengerId } });
  assert(challengerAfter.seat === defenderSeatBefore, `ignoring it for 24 h: ${canonCh.challengerName} takes the seat`);
  assert((await seatOf(canonCh.defenderId)) !== defenderSeatBefore, "and the player loses it");
  await capacityHolds("after a forfeit");

  // 6. Two canon characters settle it among themselves.
  await prisma.character.updateMany({ where: { seat: { not: null } }, data: { lastSeatDefenseAt: new Date() } });
  await startCanonSeatEventNow();
  const cc = await prisma.seatChallenge.findFirstOrThrow({ where: { challengerKind: "canon", defenderKind: "canon", status: "ANNOUNCED" } });
  assert(!!cc.resolveAt, `canon duel announced: ${cc.challengerName} vs ${cc.defenderName} (${cc.seat})`);
  await resolveCanonDuelNow(cc.id);
  const ccDone = await prisma.seatChallenge.findUniqueOrThrow({ where: { id: cc.id } });
  assert(ccDone.status === "DONE" && !!ccDone.outcome, `the judge decides it (${ccDone.outcome})`);
  await capacityHolds("after a canon duel");

  // 6b. CP-0 and the Elders: beat one in Mary Geoise and take the seat.
  const agent = await mk("Agente", "CP0", "Mary Geoise", { notoriety: 7_000 });
  const cpState = await getSeatState(agent.c.id, agent.u.id);
  assert(cpState.tiers.length === 1 && cpState.tiers[0].id === "GOROSEI" && cpState.tiers[0].taken === 5, "a CP-0 agent sees the five Elders");
  const elder = (await prisma.worldActor.findMany({ where: { seat: "GOROSEI", busyUntil: null } }))[0];
  await challengeSeat(agent.c.id, agent.u.id, "GOROSEI", "canon", elder.id);
  await win(agent.c.id, agent.u.id);
  const elderAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: elder.id } });
  assert((await seatOf(agent.c.id)) === "GOROSEI" && elderAfter.seat === null && elderAfter.role === "NOTABLE_CIVILIAN" && (elderAfter.rankLabel ?? "").startsWith("Ex-Gorosei"), `the agent takes ${elder.name}'s seat; he is an ex-Elder`);
  assert(elderAfter.status === "ACTIVE", "nobody dies in a seat duel (canon death still needs the owner)");

  // 6c. The revolution: commander by challenge, then a vacant top seat claimed at headquarters.
  const cadre = await mk("Cuadro", "REVOLUTIONARY", "Isla Baltigo", { notoriety: 5_000 });
  const cmd = (await prisma.worldActor.findMany({ where: { seat: "REV_COMMANDER", busyUntil: null } }))[0];
  await challengeSeat(cadre.c.id, cadre.u.id, "REV_COMMANDER", "canon", cmd.id);
  await win(cadre.c.id, cadre.u.id);
  const cmdAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: cmd.id } });
  assert((await seatOf(cadre.c.id)) === "REV_COMMANDER" && cmdAfter.seat === null && (cmdAfter.rankLabel ?? "").includes("destituido"), `the cadre is a Commander; ${cmd.name} is demoted`);
  const { claimVacantSeat } = await import("../src/lib/game/faction-seats");
  await expectError(() => claimVacantSeat(cadre.c.id, cadre.u.id, "REV_CHIEF"), "No hay ningún puesto libre", "an occupied seat cannot be claimed, only challenged");
  await prisma.worldActor.update({ where: { name: "Sabo" }, data: { seat: null } });
  await claimVacantSeat(cadre.c.id, cadre.u.id, "REV_CHIEF");
  assert((await seatOf(cadre.c.id)) === "REV_CHIEF", "a vacant seat is claimed at headquarters by someone who meets everything");
  await capacityHolds("after the revolution and the elders");

  // 7. Wars led from a seat.
  const rev = await mk("Rebel", "REVOLUTIONARY", "Cuartel Marine G-5", { seat: "REV_LEADER", title: "Líder del Ejército Revolucionario" });
  await prisma.worldActor.update({ where: { name: "Monkey D. Dragon" }, data: { seat: null } });
  const plain = await mk("Soldado", "REVOLUTIONARY", "Cuartel Marine G-5");
  await expectError(() => declareWar(plain.c.id, plain.u.id, "REVOLUTION"), "Líder", "a rank-and-file revolutionary cannot declare war");
  await declareWar(rev.c.id, rev.u.id, "REVOLUTION");
  const plainState = await getSovereigntyState(plain.c.id, plain.u.id);
  assert(plainState.war?.kind === "REVOLUTION" && plainState.war.iAmAttacker && plainState.canAssaultHere, "every revolutionary fights in it and can strike a Marine base");
  const baltigo = await prisma.island.findUniqueOrThrow({ where: { name: "Isla Baltigo" } });
  const def = await mk("Defensa", "MARINE", "Isla Baltigo");
  const defState = await getSovereigntyState(def.c.id, def.u.id);
  assert(defState.war?.kind === "REVOLUTION" && !defState.war.iAmAttacker && defState.canAssaultHere, "a marine defends by counter-attacking a revolutionary base");
  await warAssault(def.c.id, def.u.id);
  const defFight = await getOpenJointFightFor(def.c.id);
  assert(!!defFight && defFight.islandId === baltigo.id, "the counter-attack on Baltigo is a real fight");

  const yonko = await mk("Emperador", "PIRATE", "Nuevo Marineford", { emperorSince: new Date(), title: "Yonko" });
  // Put a player on top again (Fujitora may hold it after the forfeit) so the war of justice is exercised.
  await prisma.worldActor.updateMany({ where: { seat: "FLEET_ADMIRAL" }, data: { seat: "ADMIRAL" } });
  await prisma.character.update({ where: { id: b.c.id }, data: { seat: null, title: null } });
  await prisma.character.update({ where: { id: a.c.id }, data: { seat: "FLEET_ADMIRAL", title: "Almirante de Flota" } });
  await capacityHolds("before the war of justice");
  const fleet = a;
  const fa = await prisma.character.findUniqueOrThrow({ where: { id: fleet.c.id } });
  if (fa.seat === "FLEET_ADMIRAL") {
    await declareWar(fleet.c.id, fleet.u.id, "JUSTICE", yonko.c.id);
    const w = await prisma.war.findFirstOrThrow({ where: { kind: "JUSTICE", attackerId: fleet.c.id } });
    assert(w.defenderId === yonko.c.id, "the Fleet Admiral declares a war of justice on a Yonko");
  } else {
    await expectError(() => declareWar(fleet.c.id, fleet.u.id, "JUSTICE", yonko.c.id), "Almirante de Flota", "only the Fleet Admiral declares a war of justice");
  }
  await prisma.character.update({ where: { id: b.c.id }, data: { seat: "ADMIRAL" } });
  await expectError(() => declareWar(b.c.id, b.u.id, "JUSTICE", yonko.c.id), "Almirante de Flota", "an Admiral cannot");
  await expectError(() => declareWar(fleet.c.id, fleet.u.id, "JUSTICE", pirate.c.id), "guerra abierta", "one war at a time");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

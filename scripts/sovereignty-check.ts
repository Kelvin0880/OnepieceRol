process.env.REFEREE_STUB = "1"; // combat is judged by the AI; scripted checks use the deterministic stand-in
process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Sovereign powers end to end (2026-09-25) against the dev DB: the Shichibukai licence (apply, refused cases,
// tribute, frozen bounty, Government can't hunt or arrest, overdue tribute revokes), the Yonko path (requirements,
// a challenge that opens a real joint fight against the canon emperor where they stand, the victory dethroning
// them, handing over their island and asking the owner's verdict instead of killing them), declared wars
// (Marine base assault, three decisive blows end the war) and world figures making the news when they travel.
// Also: CP-0 recruits start on Tequila Wolf. Usage: npx tsx scripts/sovereignty-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  applyForWarlord,
  challengeEmperor,
  declareWar,
  getSovereigntyState,
  handleSovereignFightSettled,
  payWarlordTribute,
  refreshSovereignty,
  reportFigure,
  resignWarlord,
  SovereigntyError,
  warAssault,
} from "../src/lib/game/sovereignty";
import { applyBountyOrNotoriety } from "../src/lib/game/reputation";
import { getOpenJointFightFor } from "../src/lib/game/joint-fight";
import { verdictOptions } from "../src/lib/engine/duel-outcome";
import { createCharacter } from "../src/lib/game/create-character";
import { WARLORD_TRIBUTE_GRACE_MS } from "../src/lib/engine/sovereignty";

let fails = 0;
function check(cond: boolean, label: string) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) fails++;
}
async function refused(fn: () => Promise<unknown>, contains: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (e) {
    return e instanceof SovereigntyError && e.message.includes(contains);
  }
}

const stamp = Date.now() % 1_000_000;
async function mk(tag: string, data: Record<string, unknown>) {
  const u = await prisma.user.create({ data: { username: `sov${tag}${stamp}`, passwordHash: "x" } });
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  return prisma.character.create({ data: { name: `${tag}${stamp}`, faction: "PIRATE", userId: u.id, currentIslandId: foosha.id, hp: 900, maxHp: 900, level: 40, berries: 50_000_000, ...data } });
}

async function main() {
  // ---------- CP-0 start
  const u0 = await prisma.user.create({ data: { username: `sovcp${stamp}`, passwordHash: "x" } });
  const cp = await createCharacter(u0.id, `Agente${stamp}`, "CP0", "swordsman");
  const cpRow = await prisma.character.findUniqueOrThrow({ where: { id: cp.id }, include: { currentIsland: true } });
  check(cpRow.currentIsland.name === "Tequila Wolf" && cpRow.currentIsland.minLevelToEnter === 1 && cpRow.currentIsland.dangerLevel === 1, "a new CP-0 recruit starts on Tequila Wolf, a level-1 island");
  const tw = await prisma.island.findUniqueOrThrow({ where: { name: "Tequila Wolf" } });
  const twLinks = (JSON.parse(tw.connections) as string[]).length;
  const g5 = await prisma.island.findUniqueOrThrow({ where: { name: "Cuartel Marine G-5" } });
  check(twLinks >= 2 && (JSON.parse(g5.connections) as string[]).includes(tw.id), "Tequila Wolf is linked both ways to the East Blue routes");
  check((await prisma.eventTemplate.count({ where: { islandId: tw.id } })) >= 3, "Tequila Wolf has its own story beats");
  check(!!(await prisma.worldActor.findFirst({ where: { name: "Guernica", currentIslandId: tw.id } })), "Guernica, a CP-0 instructor, is placed on Tequila Wolf");

  // ---------- Shichibukai
  const w = await mk("Senor", { bounty: 150_000_000, level: 25 });
  check(await refused(() => applyForWarlord(cp.id, u0.id), "piratas"), "a CP-0 agent cannot apply for a warlord licence");
  const low = await mk("Novato", { bounty: 1_000_000, level: 5 });
  check(await refused(() => applyForWarlord(low.id, low.userId), "rechaza"), "an unknown pirate is refused");
  await applyForWarlord(w.id, w.userId);
  let wr = await prisma.character.findUniqueOrThrow({ where: { id: w.id } });
  check(!!wr.warlordSince && !!wr.warlordTributeDueAt, "a known pirate gets the licence and a tribute deadline");
  check(!!(await prisma.newsItem.findFirst({ where: { characterId: w.id, headline: { contains: "Shichibukai" } } })), "the appointment makes the news");
  await applyBountyOrNotoriety({ id: w.id, name: w.name, faction: w.faction, bounty: wr.bounty, notoriety: 0 }, 5_000_000, []);
  check((await prisma.character.findUniqueOrThrow({ where: { id: w.id } })).bounty === 150_000_000, "a warlord's bounty is frozen");
  check(verdictOptions("MARINE", "PIRATE", true).canCapture === false, "the Government cannot arrest a warlord after a duel");
  const before = wr.berries;
  await payWarlordTribute(w.id, w.userId);
  wr = await prisma.character.findUniqueOrThrow({ where: { id: w.id } });
  check(wr.berries === before - 1_500_000, "the weekly tribute is 1% of the bounty");
  await prisma.character.update({ where: { id: w.id }, data: { warlordTributeDueAt: new Date(Date.now() - WARLORD_TRIBUTE_GRACE_MS - 60_000) } });
  await refreshSovereignty(w.id);
  wr = await prisma.character.findUniqueOrThrow({ where: { id: w.id } });
  check(!wr.warlordSince && !!wr.warlordRevokedAt && wr.bounty === 180_000_000, "an unpaid tribute revokes the licence and raises the bounty 20%");
  check(await refused(() => applyForWarlord(w.id, w.userId), "traición"), "a betrayer cannot reapply for a week");
  const w2 = await mk("Senora", { bounty: 200_000_000, level: 30 });
  await applyForWarlord(w2.id, w2.userId);
  await resignWarlord(w2.id, w2.userId);
  check(!(await prisma.character.findUniqueOrThrow({ where: { id: w2.id } })).warlordSince, "a warlord can resign");

  // ---------- Yonko
  const shanks = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Shanks" } });
  const shanksIsland = shanks.currentIslandId!;
  const hero = await mk("Aspirante", { bounty: 1_500_000_000, level: 40, currentIslandId: shanksIsland });
  const state0 = await getSovereigntyState(hero.id, hero.userId);
  check(!state0.emperor.ok && state0.emperor.checks.filter((c) => !c.met).map((c) => c.id).join(",") === "territory,forces", "the requirement list says exactly what is missing (territory, forces)");
  check(await refused(() => challengeEmperor(hero.id, hero.userId, shanks.id, "spare"), "requisitos"), "an unqualified pirate cannot challenge an emperor");
  // Give them an island and a force.
  const whisky = await prisma.island.findUniqueOrThrow({ where: { name: "Whisky Peak" } });
  const tWhisky = await prisma.territory.findUniqueOrThrow({ where: { islandId: whisky.id } });
  await prisma.territory.update({ where: { id: tWhisky.id }, data: { ownerActorId: null, ownerCharacterId: hero.id, ownerName: hero.name, title: "Señor de Whisky Peak" } });
  for (const n of ["Uno", "Dos", "Tres"]) await prisma.nPCCompanion.create({ data: { characterId: hero.id, name: `${n}${stamp}`, role: "Luchador", hp: 100, maxHp: 100, loyalty: 80 } });
  const state1 = await getSovereigntyState(hero.id, hero.userId);
  check(state1.emperor.ok, "with an island and three nakamas the pirate becomes an aspirant");
  check(!state1.emperor.canProclaim, "with every throne taken there is nothing to proclaim: a throne must be taken");
  const throne = state1.emperor.thrones.find((t) => t.id === shanks.id);
  check(!!throne && throne.here && throne.block === null, "Shanks is listed where he really is, and can be challenged there");
  await prisma.worldActor.update({ where: { id: shanks.id }, data: { busyUntil: null } });
  await challengeEmperor(hero.id, hero.userId, shanks.id, "kill");
  const fight = await getOpenJointFightFor(hero.id);
  check(!!fight && fight.kind === "sovereign" && (JSON.parse(fight.enemyJson) as { name: string }).name === "Shanks", "the challenge opens a real joint fight against Shanks in person");
  check(await refused(() => challengeEmperor(hero.id, hero.userId, shanks.id, "kill"), "espera"), "a second challenge right away hits the cooldown");
  if (fight) await prisma.jointFight.update({ where: { id: fight.id }, data: { status: "CANCELLED" } });

  // Victory is decided by the referee in play; here it is settled directly to check what the win does.
  const shanksHome = await prisma.territory.findFirst({ where: { ownerActorId: shanks.id } });
  const lines = await handleSovereignFightSettled({ contextJson: JSON.stringify({ op: "emperor", actorId: shanks.id, challengerId: hero.id, fate: "kill" }), outcome: "victory", humans: [{ characterId: hero.id, status: "FIGHTING", name: hero.name }] });
  const heroAfter = await prisma.character.findUniqueOrThrow({ where: { id: hero.id } });
  const shanksAfter = await prisma.worldActor.findUniqueOrThrow({ where: { id: shanks.id } });
  check(!!heroAfter.emperorSince && heroAfter.title === "Yonko", "beating Shanks makes the challenger a Yonko");
  check(shanksAfter.role !== "YONKO" && shanksAfter.status === "ACTIVE" && /Ex-Yonko/.test(shanksAfter.rankLabel ?? ""), "Shanks loses his throne but stays alive (no death without the owner)");
  const arc = await prisma.worldArc.findFirst({ where: { targetActorId: shanks.id, status: "AWAITING_CONSENT" }, orderBy: { createdAt: "desc" } });
  check(!!arc && arc.kind === "death" && arc.consent === "PENDING", "asking for his death opens a verdict for the owner at /admin");
  check(!shanksHome || (await prisma.territory.findUniqueOrThrow({ where: { id: shanksHome.id } })).ownerCharacterId === hero.id, "the fallen emperor's islands pass to the winner");
  check((await prisma.grudge.count({ where: { characterId: hero.id } })) >= 3, "the other emperors and the admirals now hold a grudge");
  check(lines.some((l) => l.includes("trono")), "the fight's closing line tells the table what happened");
  const newThrone = await getSovereigntyState(hero.id, hero.userId);
  check(newThrone.isEmperor && newThrone.figure, "the new emperor is a world figure");
  // Undo the canon change so the dev world stays as seeded for other checks.
  await prisma.worldArc.update({ where: { id: arc!.id }, data: { status: "RESOLVED", outcome: "survived", consent: "DENIED" } });
  await prisma.worldActor.update({ where: { id: shanks.id }, data: { role: "YONKO", rankLabel: shanks.rankLabel, currentFocus: null, busyUntil: null } });
  if (shanksHome) await prisma.territory.update({ where: { id: shanksHome.id }, data: { ownerActorId: shanks.id, ownerCharacterId: null, ownerName: shanksHome.ownerName, title: shanksHome.title } });
  await prisma.busterCall.updateMany({ where: { status: "ACTIVE" }, data: { status: "ENDED" } });

  // ---------- Wars
  check(await refused(() => declareWar(w2.id, w2.userId, "MARINE"), "Yonko"), "only an emperor can declare a war");
  await declareWar(hero.id, hero.userId, "MARINE");
  const war = await prisma.war.findFirstOrThrow({ where: { attackerId: hero.id, status: "ACTIVE" } });
  check(war.kind === "MARINE", "the emperor declares war on the Marines");
  check(await refused(() => warAssault(hero.id, hero.userId), "base de la Marina"), "outside a Marine base there is nothing to assault");
  const navarone = await prisma.island.findUniqueOrThrow({ where: { name: "G-8 Navarone" } });
  await prisma.character.update({ where: { id: hero.id }, data: { currentIslandId: navarone.id } });
  await warAssault(hero.id, hero.userId);
  const warFight = await getOpenJointFightFor(hero.id);
  check(!!warFight && warFight.kind === "sovereign", "at G-8 Navarone the assault opens a real fight");
  if (warFight) await prisma.jointFight.update({ where: { id: warFight.id }, data: { status: "CANCELLED" } });
  for (let i = 0; i < 3; i++) {
    await handleSovereignFightSettled({ contextJson: JSON.stringify({ op: "war", warId: war.id, side: "attacker", territoryId: null, assaulterId: hero.id }), outcome: "victory", humans: [{ characterId: hero.id, status: "FIGHTING", name: hero.name }] });
  }
  const warEnd = await prisma.war.findUniqueOrThrow({ where: { id: war.id } });
  check(warEnd.status === "ENDED" && warEnd.outcome === "attacker" && warEnd.attackerScore === 3, "three decisive blows win the war");
  check((await prisma.character.findUniqueOrThrow({ where: { id: hero.id } })).bounty > heroAfter.bounty, "winning the war raises the emperor's bounty");

  // ---------- World figures
  await prisma.character.update({ where: { id: hero.id }, data: { lastFigureNewsAt: null } });
  check(await reportFigure(hero.id, (who) => `${who} llega de prueba`, (who) => `${who} de prueba.`), "an emperor's movements make the news");
  check(!(await reportFigure(hero.id, (who) => `${who} otra vez`, (who) => `${who}.`)), "but the papers wait a while before the next one");
  check(!(await reportFigure(low.id, (who) => `${who} llega`, (who) => `${who}.`)), "an unknown pirate is nobody to the papers");

  // Cleanup: throwaway characters out of the way of other checks.
  await prisma.territory.update({ where: { id: tWhisky.id }, data: { ownerActorId: tWhisky.ownerActorId, ownerCharacterId: null, ownerName: tWhisky.ownerName, title: tWhisky.title } });
  console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error("SCRIPT ERROR", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

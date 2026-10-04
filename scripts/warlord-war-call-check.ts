process.env.JUDGE_STUB = "1";
process.env.REFEREE_STUB = "1";
// Shichibukai in canon wars (2026-10-04): the Government's summons, a Warlord may only enlist on the Government's side
// (free choice between two Emperors), cannot apply for the licence while fighting the Government, and the call goes out
// as news only when a player Warlord exists. Usage (fresh dev DB, seeded): npx tsx scripts/warlord-war-call-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { startCanonWar } from "../src/lib/game/world-wars";
import { applyForWarlord, enlistInCanonWar, getSovereigntyState } from "../src/lib/game/sovereignty";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}
async function rejects(p: Promise<unknown>, part: string, label: string) {
  try {
    await p;
  } catch (e) {
    assert(e instanceof Error && e.message.includes(part), label);
    return;
  }
  throw new Error(`FAIL: ${label} (did not throw)`);
}

const stamp = Date.now() % 1_000_000;
async function mkPirate(name: string, extra: Record<string, unknown> = {}) {
  const u = await prisma.user.create({ data: { username: `${name}${stamp}`, passwordHash: "x" } });
  const c = await createCharacter(u.id, `${name}${stamp}`, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level: 40, hp: 600, maxHp: 600, bounty: 300_000_000, ...extra } });
  return { u, c: await prisma.character.findUniqueOrThrow({ where: { id: c.id } }) };
}

async function warOf(kind: string, name: string) {
  const a = await prisma.worldActor.findFirstOrThrow({ where: { status: "ACTIVE" } });
  return prisma.war.create({ data: { kind, attackerKind: "canon", defenderKind: kind === "EMPEROR" ? "canon" : "player", attackerId: a.id, attackerName: a.name, defenderName: name, nextFrontAt: new Date(Date.now() + 3600_000), logJson: "[]" } });
}

async function main() {
  await prisma.war.deleteMany();
  const warlord = await mkPirate("Warlord", { warlordSince: new Date(), warlordTributeDueAt: new Date(Date.now() + 5 * 86400_000) });
  const free = await mkPirate("Freebooter");

  // --- who may enlist where, as the panel sees it ---
  const marine = await warOf("MARINE", "la Marina");
  const justice = await warOf("JUSTICE", "un Yonko");
  const emperor = await warOf("EMPEROR", "otro Yonko");
  const sw = (await getSovereigntyState(warlord.c.id, warlord.u.id)).worldWars;
  const view = (id: string) => sw.find((w) => w.id === id)!;
  assert(JSON.stringify(view(marine.id).canEnlist) === '["defender"]' && view(marine.id).governmentCall === true, "a Warlord is called to the Government's side (defender) of an Emperor-vs-Marines war");
  assert(JSON.stringify(view(justice.id).canEnlist) === '["attacker"]' && view(justice.id).governmentCall === true, "a Warlord is called to the attacking side of a war of justice");
  assert(view(emperor.id).canEnlist.length === 2 && !view(emperor.id).governmentCall, "an Emperor-vs-Emperor war has no Government side: the Warlord may pick either");
  const fw = (await getSovereigntyState(free.c.id, free.u.id)).worldWars;
  assert(JSON.stringify(fw.find((w) => w.id === marine.id)!.canEnlist) === '["attacker"]' && !fw.find((w) => w.id === marine.id)!.governmentCall, "an ordinary pirate still joins the Emperor against the Marines");

  // --- enlisting ---
  await rejects(enlistInCanonWar(warlord.c.id, warlord.u.id, marine.id, "attacker"), "no puedes alzarte contra el Gobierno", "a Warlord cannot enlist against the Government");
  const ok = await enlistInCanonWar(warlord.c.id, warlord.u.id, marine.id, "defender");
  assert(ok.log[0].includes("llamada del Gobierno"), "answering the call is acknowledged in the log");
  assert((await prisma.character.findUniqueOrThrow({ where: { id: warlord.c.id } })).warlordSince !== null, "answering the call keeps the licence");

  // --- the ordinary pirate fighting the Government cannot apply for the licence ---
  await enlistInCanonWar(free.c.id, free.u.id, marine.id, "attacker");
  await rejects(applyForWarlord(free.c.id, free.u.id), "luchas contra él", "a pirate enlisted against the Government is refused the licence");
  await prisma.war.update({ where: { id: marine.id }, data: { status: "ENDED", endedAt: new Date() } });
  await applyForWarlord(free.c.id, free.u.id);
  assert((await prisma.character.findUniqueOrThrow({ where: { id: free.c.id } })).warlordSince !== null, "once that war has ended the same pirate is granted the licence");

  // --- the summons news: only when a Warlord exists, only for wars with a Government side ---
  await prisma.war.deleteMany();
  const before = await prisma.newsItem.count({ where: { headline: "El Gobierno Mundial convoca a los Shichibukai" } });
  let started = 0;
  let calls = 0;
  for (let i = 0; i < 60 && started < 12; i++) {
    const w = await startCanonWar(new Date(Date.now() + i * 7919 * 3600_000));
    if (!w) continue;
    started++;
    await prisma.war.update({ where: { id: w.id }, data: { status: "ENDED", endedAt: new Date() } });
    const now = await prisma.newsItem.count({ where: { headline: "El Gobierno Mundial convoca a los Shichibukai" } });
    const expected = w.kind !== "EMPEROR";
    assert(now - before - calls === (expected ? 1 : 0), `${w.kind} war ${expected ? "sends" : "does not send"} the Warlord summons`);
    if (expected) calls++;
  }
  assert(started > 0, `at least one canon war started (${started})`);

  await prisma.character.updateMany({ where: { id: { in: [warlord.c.id, free.c.id] } }, data: { warlordSince: null } });
  const countNow = await prisma.newsItem.count({ where: { headline: "El Gobierno Mundial convoca a los Shichibukai" } });
  for (let i = 100; i < 160; i++) {
    const w = await startCanonWar(new Date(Date.now() + i * 7919 * 3600_000));
    if (w) await prisma.war.update({ where: { id: w.id }, data: { status: "ENDED", endedAt: new Date() } });
  }
  assert((await prisma.newsItem.count({ where: { headline: "El Gobierno Mundial convoca a los Shichibukai" } })) === countNow, "with no player Warlord alive the summons is never posted");

  console.log("\nALL PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

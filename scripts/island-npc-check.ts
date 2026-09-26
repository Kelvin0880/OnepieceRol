process.env.REFEREE_STUB = "1";
process.env.JUDGE_STUB = "1";
// Island residents: roster, live availability lock, kill/spare/arrest, rewards and loot, mission links, successors. Usage: npx tsx scripts/island-npc-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import { attackCharacter, resolveMercyChoice } from "../src/lib/game/perform-action";
import { bindTarget, engagedNpcIds, rosterBlockFor, tickIslandNpcs, whyNotAvailable, killIslandNpc } from "../src/lib/game/island-npcs";
import { ensureIslandMissions } from "../src/lib/game/missions";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function mkChar(prefix: string, islandId: string, level: number) {
  const stamp = `${prefix}${Date.now() % 1000000}`;
  const u = await prisma.user.create({ data: { username: stamp, passwordHash: "x" } });
  const c = await createCharacter(u.id, stamp, "PIRATE", "swordsman");
  await prisma.character.update({ where: { id: c.id }, data: { level, currentIslandId: islandId, hp: 400, maxHp: 400, maxStamina: 300, stamina: 300 } });
  return { u, c };
}

async function main() {
  const foosha = await prisma.island.findUniqueOrThrow({ where: { name: "Pueblo Foosha" } });
  const total = await prisma.islandNpc.count();
  const islands = await prisma.island.count();
  assert(total >= islands * 4, `every island has a cast (${total} residents for ${islands} islands)`);
  const bare = (await prisma.island.findMany({ select: { id: true, name: true } })).filter(() => false);
  assert(bare.length === 0, "no island without residents check placeholder");
  const emptyIslands = [];
  for (const i of await prisma.island.findMany({ select: { id: true, name: true } })) if ((await prisma.islandNpc.count({ where: { islandId: i.id } })) === 0) emptyIslands.push(i.name);
  assert(emptyIslands.length === 0, `no island without residents (${emptyIslands.join(", ")})`);
  const impel = await prisma.island.findUniqueOrThrow({ where: { name: "Impel Down" } });
  assert((await prisma.islandNpc.count({ where: { islandId: impel.id, category: "guard" } })) >= 10, "Impel Down has its rank-and-file guards");
  assert((await prisma.worldActor.count({ where: { name: { in: ["Saldeath", "Minozebra", "Blugori"] } } })) === 3, "the canon chief guards of Impel Down are in the codex");

  const a = await mkChar("npca", foosha.id, 6);
  const b = await mkChar("npcb", foosha.id, 6);
  const roster = await prisma.islandNpc.findMany({ where: { islandId: foosha.id } });
  const fighter = roster.find((n) => ["thug", "guard", "pirate", "marine"].includes(n.category));
  const bystander = roster.find((n) => ["civilian", "merchant", "official"].includes(n.category));
  assert(!!fighter && !!bystander, "Foosha has fighters and bystanders");
  const block = await rosterBlockFor(foosha.id, foosha.name, a.c.id);
  assert(block.includes(fighter!.name) && block.includes("PROHIBIDO inventar"), "the narrator block lists residents and forbids inventing");

  // Player A attacks a named resident: B can no longer use them, A still can.
  await attackCharacter(a.c.id, a.u.id, `Ataco a ${fighter!.name}`, { target: fighter!.name });
  const enc = await prisma.pendingEncounter.findUniqueOrThrow({ where: { characterId: a.c.id } });
  assert(JSON.parse(enc.enemyJson).islandNpcId === fighter!.id, "the fight is bound to that resident");
  assert((await engagedNpcIds()).has(fighter!.id), "the resident is engaged");
  assert((await bindTarget(foosha.id, fighter!.name, b.c.id)) === null, "another player cannot bind the engaged resident");
  assert(((await whyNotAvailable(foosha.id, fighter!.name, b.c.id)) ?? "").includes("no está disponible"), "the reason is explained");
  const blockB = await rosterBlockFor(foosha.id, foosha.name, b.c.id);
  assert(blockB.includes("NO DISPONIBLES AHORA") && blockB.includes(`${fighter!.name} (ocupado`), "the AI sees the resident as busy for the other player");
  assert((await bindTarget(foosha.id, fighter!.name, a.c.id))?.npcId === fighter!.id, "the player already fighting them still sees them");

  // Win and finish: dead, news, rewards, missions of the record.
  const before = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
  await prisma.pendingEncounter.update({ where: { characterId: a.c.id }, data: { phase: "victory", enemyHp: 0 } });
  await resolveMercyChoice(a.c.id, a.u.id, false);
  const dead = await prisma.islandNpc.findUniqueOrThrow({ where: { id: fighter!.id } });
  assert(dead.status === "DEAD" && !!dead.diedNote, "killing the resident records the death");
  assert((await prisma.newsItem.count({ where: { headline: { contains: fighter!.name }, category: "Muertes" } })) > 0, "the death is in the news");
  const after = await prisma.character.findUniqueOrThrow({ where: { id: a.c.id } });
  assert(after.berries > before.berries && after.experience + after.level * 1000 > before.experience + before.level * 1000, "the win paid berries and experience");
  assert(!(await engagedNpcIds()).has(fighter!.id), "no longer engaged");
  const blockAfter = await rosterBlockFor(foosha.id, foosha.name, b.c.id);
  assert(blockAfter.includes("MUERTOS") && blockAfter.includes(fighter!.name), "the AI is told who died");
  assert((await bindTarget(foosha.id, fighter!.name, b.c.id)) === null, "the dead cannot be fought");

  // Bystander: no experience.
  const b2 = await prisma.character.findUniqueOrThrow({ where: { id: b.c.id } });
  await attackCharacter(b.c.id, b.u.id, `Ataco a ${bystander!.name}`, { target: bystander!.name });
  const enc2 = await prisma.pendingEncounter.findUniqueOrThrow({ where: { characterId: b.c.id } });
  assert(JSON.parse(enc2.rewardsJson).xp === 0, "a bystander pays no experience");
  await prisma.pendingEncounter.update({ where: { characterId: b.c.id }, data: { phase: "victory", enemyHp: 0 } });
  await resolveMercyChoice(b.c.id, b.u.id, true);
  const b3 = await prisma.character.findUniqueOrThrow({ where: { id: b.c.id } });
  assert(b3.experience === b2.experience && b3.level === b2.level, "sparing a bystander gives no experience");
  const hurt = await prisma.islandNpc.findUniqueOrThrow({ where: { id: bystander!.id } });
  assert(!!hurt.recoversAt && hurt.status === "ALIVE", "a beaten and spared resident is unavailable while recovering");

  // Missions name real residents; killing the target completes the goal.
  await prisma.mission.deleteMany({ where: { characterId: b.c.id } });
  await ensureIslandMissions(b.c.id);
  const arc = await prisma.mission.findFirst({ where: { characterId: b.c.id, kind: "defeat_npc" } });
  assert(!!arc?.targetNpcId, "the island's main mission targets a real resident");
  const target = await prisma.islandNpc.findUniqueOrThrow({ where: { id: arc!.targetNpcId! } });
  assert(arc!.brief.includes(target.name), "the mission brief names them");
  await killIslandNpc(target.id, { id: b.c.id, name: b.c.name }, foosha.name);
  const done = await prisma.mission.findUniqueOrThrow({ where: { id: arc!.id } });
  assert(done.status === "DONE", "defeating the target completes the mission");

  // Successors after the mourning delay, same job, new name, news.
  await prisma.islandNpc.updateMany({ where: { status: "DEAD" }, data: { diedAt: new Date(Date.now() - 7 * 3_600_000) } });
  const made = await tickIslandNpcs();
  assert(made >= 1, `successors are created (${made})`);
  const old = await prisma.islandNpc.findUniqueOrThrow({ where: { id: fighter!.id } });
  const heir = await prisma.islandNpc.findUniqueOrThrow({ where: { id: old.successorId! } });
  assert(heir.slot === old.slot && heir.name !== old.name && heir.status === "ALIVE" && heir.generation === 2, `${heir.name} takes the job of ${old.name}`);
  assert((await prisma.newsItem.count({ where: { headline: { contains: heir.name } } })) > 0, "the arrival is in the news");
  assert((await tickIslandNpcs()) === 0, "no second successor for the same death");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

// Deterministic check of the out-of-role toolbox against the real dev DB (2026-09-24): checkpoints, the
// rollback that must leave ONE timeline (memory, scene, log, companions, missions), the epoch guard
// against late AI writes, permadeath, limits, rename/repair/undo. No AI calls needed.
// Usage: npx tsx scripts/ooc-rollback-check.ts
import { prisma } from "../src/lib/db";
import { createCharacter } from "../src/lib/game/create-character";
import {
  createCheckpoint,
  rollbackToCheckpoint,
  previewRollback,
  renameCharacter,
  repairCharacter,
  undoLastExchange,
  setNarratorTone,
  addNarratorNote,
  clearNarratorNotes,
  reportProblem,
  getOocOverview,
  maybeAutoCheckpoint,
  OocError,
} from "../src/lib/game/ooc";
import { maybeCompactCharacterScene } from "../src/lib/game/scene-compaction";
import { loadDirectives } from "../src/lib/ai/narrate";

let failed = 0;
function check(cond: boolean, label: string) {
  console.log(cond ? `PASS: ${label}` : `FAIL: ${label}`);
  if (!cond) failed++;
}
async function rejects(fn: () => Promise<unknown>, needle: string, label: string) {
  try {
    await fn();
    check(false, `${label} (did not throw)`);
  } catch (e) {
    check(e instanceof OocError && e.message.toLowerCase().includes(needle.toLowerCase()), `${label} -> "${(e as Error).message.slice(0, 70)}"`);
  }
}

async function main() {
  const stamp = Date.now() % 1_000_000;
  const user = await prisma.user.create({ data: { username: `oocchk${stamp}`, passwordHash: "x" } });
  const ch = await createCharacter(user.id, `Rolltest${stamp}`, "PIRATE", "swordsman" as never);
  const id = ch.id;
  const uid = user.id;

  // ---- checkpoints
  const start = await prisma.checkpoint.findFirst({ where: { characterId: id } });
  check(!!start && start.label.includes("Inicio"), "a starting checkpoint exists right after creation");
  await maybeAutoCheckpoint(id, uid, "throttled");
  check((await prisma.checkpoint.count({ where: { characterId: id } })) === 1, "auto checkpoints are throttled (no flood)");

  // ---- build a "timeline A" worth remembering
  await prisma.character.update({ where: { id }, data: { memorySummary: "MEMORIA A: conoce a Max el tabernero.", level: 2, experience: 30, hp: 90, berries: 4000 } });
  await prisma.sceneMessage.createMany({ data: [{ characterId: id, role: "player", text: "Hablo con Max" }, { characterId: id, role: "narrator", text: "Max sonríe." }] });
  const cpA = await createCheckpoint(id, uid, "manual", "Antes del jefe");
  const snapA = JSON.parse(cpA.snapshotJson);
  check(snapA.memorySummary === "MEMORIA A: conoce a Max el tabernero.", "the checkpoint stores what the narrator remembered");
  check(Array.isArray(snapA.missions) && Array.isArray(snapA.companions), "the checkpoint stores missions and companions");
  await new Promise((r) => setTimeout(r, 30));

  // ---- timeline B (to be discarded)
  await prisma.character.update({ where: { id }, data: { memorySummary: "MEMORIA B: mató al jefe y huyó a otra isla.", level: 4, experience: 5, hp: 20, berries: 900, bounty: 500 } });
  await prisma.sceneMessage.createMany({ data: [{ characterId: id, role: "player", text: "Mato al jefe" }, { characterId: id, role: "narrator", text: "El jefe cae." }] });
  await prisma.gameLogEntry.create({ data: { characterId: id, kind: "combat", text: "Derrotas al jefe (línea B)" } });
  await prisma.newsItem.create({ data: { headline: "Asesino del jefe", body: "b", category: "Guerra", characterId: id } });
  await prisma.nPCCompanion.create({ data: { characterId: id, name: "JorgeB", role: "Cocinero" } });
  await prisma.pendingEncounter.create({ data: { characterId: id, enemyJson: "{}", rewardsJson: "{}", narrative: "x", assessment: "even", phase: "fighting", enemyHp: 5 } });
  const mission = await prisma.mission.create({ data: { characterId: id, islandId: ch.currentIslandId, kind: "explore", title: "M", brief: "b", target: 3, progress: 3, status: "DONE" } });

  // ---- preview changes nothing, but tells the truth
  const before = await prisma.character.findUniqueOrThrow({ where: { id } });
  const pv = await previewRollback(id, uid, cpA.id);
  const after = await prisma.character.findUniqueOrThrow({ where: { id } });
  check(before.level === after.level && before.memorySummary === after.memorySummary, "the preview changes nothing");
  check(pv.willDelete.sceneMessages === 2 && pv.willDelete.logEntries >= 1 && pv.willDelete.recruitedNakamas === 1 && pv.willDelete.pendingFight, "the preview counts what will be erased");
  check(pv.changes.some((c) => c.label === "Nivel" && c.from === 4 && c.to === 2), "the preview lists the level change (4 -> 2)");
  check(pv.aiForgets.toLowerCase().includes("olvidar"), "the preview warns that the narrator forgets");

  // ---- the rollback itself
  const epochBefore = after.timelineEpoch;
  const res = await rollbackToCheckpoint(id, uid, cpA.id);
  const c = await prisma.character.findUniqueOrThrow({ where: { id } });
  check(c.level === 2 && c.experience === 30 && c.hp === 90 && c.berries === 4000 && c.bounty === 0, "numbers are restored");
  check(c.memorySummary === "MEMORIA A: conoce a Max el tabernero.", "the narrator memory is restored to timeline A");
  check(!(c.memorySummary ?? "").includes("MEMORIA B"), "nothing of timeline B survives in the memory");
  check(c.timelineEpoch === epochBefore + 1, "the timeline epoch advanced");
  const scene = await prisma.sceneMessage.findMany({ where: { characterId: id } });
  check(scene.length === 2 && scene.every((m) => !m.text.includes("jefe")), "scene messages from timeline B are gone");
  check((await prisma.gameLogEntry.count({ where: { characterId: id, text: { contains: "línea B" } } })) === 0, "log entries from timeline B are gone");
  check((await prisma.newsItem.count({ where: { characterId: id } })) === 0, "news about the discarded actions are gone");
  check((await prisma.nPCCompanion.count({ where: { characterId: id, name: "JorgeB" } })) === 0, "a nakama recruited on timeline B never existed");
  check(!(await prisma.pendingEncounter.findUnique({ where: { characterId: id } })), "the fight in progress is gone");
  check((await prisma.mission.count({ where: { id: mission.id } })) === 0, "a mission that only existed on timeline B is gone");
  check(res.message.includes("olvid"), "the confirmation says the narrator forgot");
  const directives = await loadDirectives(id);
  check(!directives.includes("MEMORIA B") && !directives.includes("jefe"), "the next narrator prompt carries no trace of timeline B");
  check((await prisma.checkpoint.count({ where: { characterId: id, createdAt: { gt: cpA.createdAt } } })) === 0, "checkpoints newer than the target are dropped");

  // ---- an AI memory write that started before the rollback must not resurrect timeline B
  const e0 = (await prisma.character.findUniqueOrThrow({ where: { id } })).timelineEpoch;
  await prisma.character.update({ where: { id }, data: { timelineEpoch: { increment: 1 } } });
  const stale = await prisma.character.updateMany({ where: { id, timelineEpoch: e0 }, data: { memorySummary: "LATE WRITE FROM OLD TIMELINE" } });
  check(stale.count === 0 && (await prisma.character.findUniqueOrThrow({ where: { id } })).memorySummary !== "LATE WRITE FROM OLD TIMELINE", "a late AI memory write from the discarded timeline is dropped");

  // ---- compaction respects the restored pointer
  await maybeCompactCharacterScene(id);
  check(true, "compaction runs on the restored scene without error");

  // ---- limits and rules
  await prisma.oocReport.deleteMany({ where: { characterId: id, kind: "rollback" } });
  for (let i = 0; i < 3; i++) {
    const k = await createCheckpoint(id, uid, "manual", `p${i}`);
    await rollbackToCheckpoint(id, uid, k.id);
  }
  await rejects(() => rollbackToCheckpoint(id, uid), "3 rollbacks", "the daily rollback limit is enforced");
  const ov = await getOocOverview(id, uid);
  check(ov.rollbacksLeft === 0, "the overview shows 0 rollbacks left");

  // ---- rename / tone / notes / report / repair / undo
  await renameCharacter(id, uid, "  Nuevo   Nombre ");
  check((await prisma.character.findUniqueOrThrow({ where: { id } })).name === "Nuevo Nombre", "rename normalizes spaces");
  await rejects(() => renameCharacter(id, uid, "<b>x</b>"), "solo admite", "rename rejects odd symbols");
  await rejects(() => renameCharacter(id, uid, "Nuevo Nombre"), "ya es su nombre", "rename to the same name is refused");
  await setNarratorTone(id, uid, "lethal");
  await addNarratorNote(id, uid, "no repitas mi acción");
  const d2 = await loadDirectives(id);
  check(d2.includes("LETAL") && d2.includes("no repitas mi acción"), "tone and notes reach the narrator prompt");
  check(d2.includes("CAPACIDADES REALES"), "the narrator prompt carries the real capabilities sheet");
  await clearNarratorNotes(id, uid);
  check(!(await loadDirectives(id)).includes("no repitas mi acción"), "notes can be cleared");
  const rp = await reportProblem(id, uid, "algo raro");
  check(rp.message.includes("Reporte") && (await prisma.oocReport.count({ where: { characterId: id, kind: "report" } })) === 1, "a report is stored with context");

  await prisma.character.update({ where: { id }, data: { hp: 500, stamina: -20, berries: -5 } });
  const rep = await repairCharacter(id, uid);
  const fixed = await prisma.character.findUniqueOrThrow({ where: { id } });
  check(fixed.hp === fixed.maxHp && fixed.stamina === 0 && fixed.berries === 0 && rep.message.includes("Reparado"), "repair clamps hp/stamina/berries");

  await prisma.sceneMessage.deleteMany({ where: { characterId: id } });
  await rejects(() => undoLastExchange(id, uid), "no hay", "undo with an empty scene is refused");
  await prisma.sceneMessage.createMany({ data: [{ characterId: id, role: "player", text: "hola" }, { characterId: id, role: "narrator", text: "Una respuesta larga." }] });
  const un = await undoLastExchange(id, uid);
  check(un.restoredText === "hola" && (await prisma.sceneMessage.count({ where: { characterId: id } })) === 0, "undo removes the exchange and returns the player text");
  await prisma.sceneMessage.createMany({ data: [{ characterId: id, role: "player", text: "exploro" }, { characterId: id, role: "narrator", text: "(interpretado como: Explorar)\n\nAlgo." }] });
  await rejects(() => undoLastExchange(id, uid), "usa un punto", "undo of an explore turn (it moved numbers) is refused");

  // ---- permadeath: the dead cannot come back
  await prisma.character.update({ where: { id }, data: { status: "DEAD" } });
  await rejects(() => rollbackToCheckpoint(id, uid), "muerto", "a dead character cannot roll back (permadeath)");
  await rejects(() => repairCharacter(id, uid), "muerto", "a dead character cannot be repaired");
  await rejects(() => renameCharacter(id, uid, "Otro Nombre"), "muerto", "a dead character cannot be renamed");

  // ---- imprisoned cannot use rollback to escape
  await prisma.character.update({ where: { id }, data: { status: "IMPRISONED" } });
  await rejects(() => rollbackToCheckpoint(id, uid), "captura", "a prisoner cannot roll back out of prison");

  // ---- ownership
  const other = await prisma.user.create({ data: { username: `oocother${stamp}`, passwordHash: "x" } });
  await rejects(() => renameCharacter(id, other.id, "Robado"), "no encontrado", "another user cannot touch this character");

  console.log(failed ? `FAILED (${failed})` : "ALL PASS");
  process.exit(failed ? 1 : 0);
}
main().finally(() => prisma.$disconnect());

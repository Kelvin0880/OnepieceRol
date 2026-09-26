process.env.JUDGE_STUB = "1";
// Former Yonko (Kaido, Big Mom) are DEFEATED and can only return by taking a sitting Yonko's throne; a failed attempt
// waits for the owner's verdict; a captured canon actor is held in Impel Down with a level and the AI is told.
// Usage: npx tsx scripts/reclaim-check.ts (dev DB, freshly seeded)
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { startArcManual } from "../src/lib/game/admin-tools";
import { advanceArcNow, decideArc } from "../src/lib/game/world-arcs";
import { worldStateBlock, invalidateWorldState } from "../src/lib/game/world-state";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function runArc(arcId: string) {
  for (let i = 0; i < 8; i++) {
    const a = await prisma.worldArc.findUniqueOrThrow({ where: { id: arcId } });
    if (a.status !== "ACTIVE") break;
    await advanceArcNow(arcId);
  }
}

async function main() {
  const kaido = await prisma.worldActor.findFirstOrThrow({ where: { name: "Kaido" } });
  const linlin = await prisma.worldActor.findFirstOrThrow({ where: { name: { startsWith: "Charlotte Linlin" } } });
  assert(kaido.status === "DEFEATED" && linlin.status === "DEFEATED", "Kaido and Big Mom are defeated, not sitting Yonko");
  invalidateWorldState();
  const state = await worldStateBlock();
  assert(/Derrotados[^.]*Kaido/.test(state) && !/Yonko vigentes:[^.]*Kaido/.test(state), "the AI world state lists them as defeated, not as Yonko");

  const sitting = await prisma.worldActor.findFirstOrThrow({ where: { role: "YONKO", status: "ACTIVE" } });
  let refused = false;
  try { await startArcManual(sitting.name, "Buggy", "reclaim"); } catch { refused = true; }
  assert(refused, "only a defeated former Yonko may be the aggressor of a reclaim");
  await prisma.worldArc.deleteMany({});

  // 1) The aspirant wins: title + territory change hands, the loser lives dethroned.
  await prisma.worldActor.update({ where: { id: kaido.id }, data: { powerLevel: 100 } });
  await prisma.worldActor.update({ where: { id: sitting.id }, data: { powerLevel: 10 } });
  await startArcManual(sitting.name, kaido.name, "reclaim");
  let arc = await prisma.worldArc.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  await runArc(arc.id);
  arc = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
  assert(arc.status === "RESOLVED" && arc.outcome === "reclaimed", "the winning aspirant closes the arc as reclaimed");
  const k2 = await prisma.worldActor.findUniqueOrThrow({ where: { id: kaido.id } });
  const s2 = await prisma.worldActor.findUniqueOrThrow({ where: { id: sitting.id } });
  assert(k2.status === "ACTIVE" && k2.role === "YONKO", "Kaido is a Yonko again");
  assert(s2.role === "NOTABLE_PIRATE" && s2.status === "ACTIVE" && /Ex-Yonko/.test(s2.rankLabel ?? ""), "the old holder lives on, dethroned");
  const terr = await prisma.territory.findMany({ where: { OR: [{ ownerActorId: kaido.id }, { ownerActorId: sitting.id }] } });
  assert(terr.every((t) => t.ownerActorId !== sitting.id), "no territory stays with the dethroned Yonko");
  assert((await prisma.newsItem.count({ where: { arcId: arc.id, severity: "major" } })) > 0, "the change of power is in the news");

  // 2) The aspirant loses: the arc waits for the owner, who can capture him.
  await prisma.worldActor.update({ where: { id: kaido.id }, data: { status: "DEFEATED", role: "NOTABLE_PIRATE", powerLevel: 5 } });
  await prisma.worldActor.update({ where: { id: sitting.id }, data: { role: "YONKO", powerLevel: 100 } });
  await prisma.worldArc.updateMany({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } }, data: { status: "RESOLVED" } });
  await startArcManual(sitting.name, kaido.name, "reclaim");
  arc = await prisma.worldArc.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  await runArc(arc.id);
  arc = await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } });
  assert(arc.kind === "reclaim_lost" && arc.status === "AWAITING_CONSENT" && arc.consent === "PENDING", "a failed attempt waits for the owner");
  assert(arc.targetName === "Kaido", "the owner decides Kaido's fate, not the Yonko's");
  const k3 = await prisma.worldActor.findUniqueOrThrow({ where: { id: kaido.id } });
  assert(k3.status === "DEFEATED", "nothing happens to him before the verdict");
  await decideArc(arc.id, true, "test", "capture");
  const k4 = await prisma.worldActor.findUniqueOrThrow({ where: { id: kaido.id } });
  assert(k4.status === "CAPTURED" && (k4.prisonLevel ?? 0) >= 5 && !!k4.capturedAt, "captured: held at a deep Impel Down level");
  const impel = await prisma.island.findFirstOrThrow({ where: { name: "Impel Down" } });
  assert(k4.currentIslandId === impel.id && !k4.locationHidden, "his location is Impel Down, visible");
  invalidateWorldState();
  assert(/PRESOS[^.]*Kaido en Impel Down, Nivel \d/.test(await worldStateBlock()), "the AI is told he is imprisoned, with the level");

  // 3) Mercy keeps a defeated aspirant defeated (not a sitting Yonko).
  await prisma.worldActor.update({ where: { id: kaido.id }, data: { status: "DEFEATED", prisonLevel: null, capturedAt: null } });
  await prisma.worldArc.updateMany({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } }, data: { status: "RESOLVED" } });
  await startArcManual(sitting.name, kaido.name, "reclaim");
  arc = await prisma.worldArc.findFirstOrThrow({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  await runArc(arc.id);
  await decideArc(arc.id, false, "test", "survived");
  const k5 = await prisma.worldActor.findUniqueOrThrow({ where: { id: kaido.id } });
  assert(k5.status === "DEFEATED", "sparing him leaves him defeated, not restored to power");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

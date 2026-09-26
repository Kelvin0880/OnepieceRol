process.env.JUDGE_STUB = "1";
// Captured canon characters try to get out of Impel Down: alone (breakout) or with their crew's leader (rescue). They can fail or succeed.
// Real AI writes the chapters (slow); the outcome uses the deterministic judge stand-in. Usage: npx tsx scripts/prison-arc-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { advanceArcNow } from "../src/lib/game/world-arcs";

function assert(c: boolean, l: string) {
  if (!c) throw new Error(`FAIL: ${l}`);
  console.log(`PASS: ${l}`);
}

async function runArc(kind: "breakout" | "crew_rescue", targetName: string, aggressorName: string | null) {
  const target = await prisma.worldActor.findFirstOrThrow({ where: { name: targetName } });
  const aggressor = aggressorName ? await prisma.worldActor.findFirstOrThrow({ where: { name: aggressorName } }) : null;
  const arc = await prisma.worldArc.create({
    data: { kind, title: kind === "breakout" ? `La fuga de ${target.name}` : `${aggressor!.name} va a por ${target.name}`, targetActorId: target.id, targetName: target.name, aggressorId: aggressor?.id ?? null, aggressorName: aggressor?.name ?? null, totalStages: 5, nextBeatAt: new Date() },
  });
  for (let i = 0; i < 5; i++) await advanceArcNow(arc.id);
  return { arc: await prisma.worldArc.findUniqueOrThrow({ where: { id: arc.id } }), target: await prisma.worldActor.findUniqueOrThrow({ where: { id: target.id } }) };
}

async function main() {
  const doflamingo = await prisma.worldActor.findFirstOrThrow({ where: { name: "Donquixote Doflamingo" } });
  assert(doflamingo.status === "CAPTURED" && doflamingo.prisonLevel === 6, "Doflamingo starts in cell 6");

  // Alone, in the deepest cell: it fails and he stays.
  const alone = await runArc("breakout", "Donquixote Doflamingo", "Magellan");
  assert(alone.arc.status === "RESOLVED" && alone.arc.outcome === "held" && alone.arc.consent === "NONE", "an attempt on his own fails without any owner verdict");
  assert(alone.target.status === "CAPTURED" && alone.target.prisonLevel === 6, "he is still in his cell");
  const news1 = await prisma.newsItem.findMany({ where: { arcId: alone.arc.id }, orderBy: { createdAt: "asc" } });
  assert(news1.length === 6 && news1.every((n) => n.locationName === "Impel Down"), "every chapter and the ending are news set in Impel Down");
  assert(news1.slice(0, 5).every((n) => !/se fuga de|logra salir/i.test(n.headline)), "no chapter announces the escape before the ending");

  // With his crew's strongest free member outside: the rescue works.
  const rescue = await runArc("crew_rescue", "Donquixote Doflamingo", "Diamante");
  assert(rescue.arc.outcome === "freed", "with Diamante outside the rescue succeeds");
  assert(rescue.target.status === "ACTIVE" && rescue.target.prisonLevel === null && rescue.target.capturedAt === null && rescue.target.locationHidden, "he is free, alive and hidden");
  const last = await prisma.newsItem.findFirst({ where: { arcId: rescue.arc.id }, orderBy: { createdAt: "desc" } });
  assert(!!last && last.severity === "major", "the ending is a major headline");
  const state = await import("../src/lib/game/world-state").then((m) => (m.invalidateWorldState(), m.worldStateBlock()));
  assert(!/PRESOS[^.]*Doflamingo/.test(state), "the AI world state no longer lists him as a prisoner");

  console.log("ALL PASS");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

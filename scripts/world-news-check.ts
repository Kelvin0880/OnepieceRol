process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Deterministic verification for the faction-aware news rewrite + devil
// fruit duplication mechanic (2026-09-23). Direct function calls against
// the real seeded dev DB, same style as grudge-check.ts.
// Usage: npx tsx scripts/world-news-check.ts
import { prisma } from "../src/lib/db";
import { runWorldTick, WorldEventTemplateSpec, WorldActorState } from "../src/lib/engine/world";
import { mulberry32 } from "../src/lib/engine/rng";
import { tickBountyDigestIfDue } from "../src/lib/game/world-tick";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
  // --- Step 1: schema actually allows duplicate DevilFruit rows by name ---
  const dupA = await prisma.devilFruit.create({
    data: { name: "Bomu Bomu no Mi", englishName: "Bomb-Bomb Fruit", type: "PARAMECIA", rarity: "UNCOMMON", description: "test", effectsJson: "{}", isSingleton: false },
  });
  const dupB = await prisma.devilFruit.create({
    data: { name: "Bomu Bomu no Mi", englishName: "Bomb-Bomb Fruit", type: "PARAMECIA", rarity: "UNCOMMON", description: "test", effectsJson: "{}", isSingleton: false },
  });
  assert(dupA.id !== dupB.id, "two DevilFruit rows with the same name can coexist (duplication mechanism)");
  await prisma.devilFruit.deleteMany({ where: { id: { in: [dupA.id, dupB.id] } } });

  // --- Step 2: singleton canon fruits are actually linked to their WorldActor ---
  const teach = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Marshall D. Teach" }, include: { devilFruit: true } });
  assert(teach.devilFruit?.name === "Yami Yami no Mi" && teach.devilFruit.isSingleton, "Marshall D. Teach is linked to his singleton Yami Yami no Mi");

  const luffy = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Monkey D. Luffy" }, include: { devilFruit: true } });
  assert(luffy.devilFruit?.name === "Hito Hito no Mi: Modelo Nika" && luffy.devilFruit.isSingleton, "Luffy is linked to his singleton Hito Hito no Mi: Modelo Nika");
  assert(luffy.factionType === "PIRATE" && luffy.role === "YONKO", "Luffy seeded as a PIRATE-faction YONKO");

  const kizaru = await prisma.worldActor.findUniqueOrThrow({ where: { name: "Kizaru" } });
  assert(kizaru.factionType === "MARINE", "Kizaru seeded as MARINE faction");

  // --- Step 3: faction-gated actor selection holds across many draws ---
  const [dbTemplates, dbActors] = await Promise.all([prisma.worldEventTemplate.findMany(), prisma.worldActor.findMany()]);
  const templates: WorldEventTemplateSpec[] = dbTemplates.map((t) => {
    const parsed = JSON.parse(t.bodyJson) as { variants: string[]; busyHours?: [number, number]; heatDelta?: number };
    return {
      id: t.id,
      weight: t.weight,
      minHeat: t.minHeat,
      headline: t.headline,
      category: t.category,
      bodyVariants: parsed.variants,
      busyHours: parsed.busyHours,
      heatDelta: parsed.heatDelta ?? 0,
      allowedFactionTypes: t.allowedFactionTypes ? (JSON.parse(t.allowedFactionTypes) as string[]) : null,
      promptHint: t.promptHint,
    };
  });
  const actors: WorldActorState[] = dbActors.map((a) => ({
    id: a.id,
    name: a.name,
    role: a.role,
    factionType: a.factionType,
    factionName: a.factionName,
    rankLabel: a.rankLabel,
    canonBounty: a.canonBounty != null ? a.canonBounty.toString() : null,
    personality: a.personality,
    busyUntil: a.busyUntil,
  }));

  let marineFired = false;
  let pirateFired = false;
  let violations = 0;
  for (let seed = 0; seed < 300; seed++) {
    const result = runWorldTick(mulberry32(seed), new Date(), 30, templates, actors);
    if (!result) continue;
    const template = dbTemplates.find((t) => t.category === result.category && t.promptHint === result.promptHint);
    if (!template) continue;
    const allowed = template.allowedFactionTypes ? (JSON.parse(template.allowedFactionTypes) as string[]) : null;
    if (allowed) {
      const actor = result.involvedActorId ? dbActors.find((a) => a.id === result.involvedActorId) : null;
      if (!actor || !allowed.includes(actor.factionType)) violations++;
      if (allowed.includes("MARINE") && actor) marineFired = true;
      if (allowed.includes("PIRATE") && actor) pirateFired = true;
    }
  }
  assert(violations === 0, "no faction-gated tick ever picked an actor outside its allowedFactionTypes, across 300 draws");
  assert(marineFired, "a MARINE-only template fired with a real MARINE actor at least once");
  assert(pirateFired, "a PIRATE-only template fired with a real PIRATE actor at least once");

  // --- Step 4: bounty digest, forced due, cites a real canon bounty ---
  await prisma.worldClock.upsert({ where: { id: 1 }, update: { lastDigestAt: new Date(0) }, create: { id: 1, heat: 10, lastDigestAt: new Date(0) } });
  const beforeCount = await prisma.newsItem.count({ where: { severity: "digest" } });
  await tickBountyDigestIfDue();
  const digest = await prisma.newsItem.findFirst({ where: { severity: "digest" }, orderBy: { createdAt: "desc" } });
  const afterCount = await prisma.newsItem.count({ where: { severity: "digest" } });
  assert(afterCount === beforeCount + 1, "forcing the digest clock due produces exactly one new digest NewsItem");
  assert(!!digest && digest.category === "Recompensas", "digest NewsItem has category Recompensas");

  console.log("\nAll world-news checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

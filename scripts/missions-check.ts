process.env.JUDGE_STUB = "1"; // results are judged by the AI; scripted checks use the deterministic stand-in
// Island missions against the dev DB: generation per level, progress, payout, patron standing, pacing.
// Usage: npx tsx scripts/missions-check.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { ensureIslandMissions, getMissionState, recordMissionEvent } from "../src/lib/game/missions";

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function mk(level: number, islandName: string) {
  const island = await prisma.island.findFirstOrThrow({ where: { name: islandName } });
  const u = await prisma.user.create({ data: { username: `ms${Date.now() % 1_000_000}${level}`, passwordHash: "x" } });
  return prisma.character.create({ data: { name: `Guia${level}`, faction: "PIRATE", userId: u.id, currentIslandId: island.id, level, hp: 100, maxHp: 100, islandsVisited: JSON.stringify([island.id]) } });
}

async function main() {
  const low = await mk(1, "Whisky Peak");
  const high = await mk(30, "Whisky Peak");
  await Promise.all([ensureIslandMissions(low.id), ensureIslandMissions(low.id), ensureIslandMissions(high.id)]);
  const a = await getMissionState(low.id);
  const b = await getMissionState(high.id);
  assert(a!.missions.length === 3, "concurrent ensures still create exactly one batch of three");
  const arcLow = a!.missions.find((m) => m.isArc)!;
  const arcHigh = b!.missions.find((m) => m.isArc)!;
  assert(arcHigh.berries > arcLow.berries && arcHigh.xp > arcLow.xp, "a stronger character gets tougher, better-paid goals");
  assert(!!a!.briefing, "the first visit registers a briefing");

  const explore = a!.missions.find((m) => m.kind === "explore")!;
  let log: string[] = [];
  for (let i = 0; i < explore.target; i++) log = await recordMissionEvent(low.id, { kind: "explore" });
  assert(log.some((l) => l.includes("Misión cumplida")), "finishing the reconnaissance pays out");
  const after = await prisma.character.findUniqueOrThrow({ where: { id: low.id } });
  assert(after.berries === low.berries + explore.berries, "berries are paid exactly");

  for (let i = 0; i < arcLow.target; i++) await recordMissionEvent(low.id, { kind: "win" });
  const patron = await prisma.alliance.findFirst({ where: { characterId: low.id } });
  assert(!!patron && patron.standing > 0, "the arc mission earns standing with the island's power");

  await ensureIslandMissions(low.id);
  const again = await getMissionState(low.id);
  assert(again!.missions.length <= 3 + 1 && again!.missions.filter((m) => m.status === "ACTIVE").length <= 1, "no new batch straight after finishing (pacing)");
  console.log("ALL MISSION CHECKS PASSED");
}
main().finally(() => prisma.$disconnect());

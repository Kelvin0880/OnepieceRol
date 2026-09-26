import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 70)); return s; } return s.replace(a, () => b); }
rw("src/lib/game/island-npcs.ts", (s) => {
  s = once(s, 'import { prisma } from "../db";', 'import type { PrismaClient } from "@prisma/client";\nimport { prisma } from "../db";');
  s = once(s, "export async function seedIslandRoster(entries: SeedRosterEntry[]): Promise<number> {\n  const islands = new Map((await prisma.island", "export async function seedIslandRoster(entries: SeedRosterEntry[], db: PrismaClient = prisma): Promise<number> {\n  const islands = new Map((await db.island");
  s = once(s, "    await prisma.islandNpc.upsert({ where: { name: e.name }, update: data, create: { name: e.name, ...data } });", "    // A resident who died keeps their memorial; only living ones are refreshed.\n    const existing = await db.islandNpc.findUnique({ where: { name: e.name }, select: { status: true } });\n    if (existing?.status === \"DEAD\") continue;\n    await db.islandNpc.upsert({ where: { name: e.name }, update: data, create: { name: e.name, ...data } });");
  return s;
});
rw("prisma/seed.ts", (s) => {
  s = once(s, 'import { IMPEL_ACTORS } from "../src/lib/game/world-actor-impel";', 'import { IMPEL_ACTORS } from "../src/lib/game/world-actor-impel";\nimport { ISLAND_NPC_DATA } from "../src/lib/game/island-npc-data";\nimport { seedIslandRoster } from "../src/lib/game/island-npcs";');
  s = once(s, "  // One-time corrections of where a few canon characters live", "  // The filler cast of every island (bartenders, guards, thugs...): the only named non-canon characters the AI may use.\n  console.log(`Seeded ${await seedIslandRoster(ISLAND_NPC_DATA, prisma)} island residents.`);\n\n  // One-time corrections of where a few canon characters live");
  return s;
});

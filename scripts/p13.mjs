import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return s; } return s.replace(a, () => b); }
rw("src/lib/game/island-npcs.ts", (s) => {
  s = once(s, "islandName: string): Promise<void> {\n  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });\n  if (!n || n.status === \"DEAD\") return;\n  const note = `muerto", "islandName: string): Promise<string[]> {\n  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });\n  if (!n || n.status === \"DEAD\") return [];\n  const note = `muerto");
  s = once(s, "  if (claimed.count === 0) return;\n  await postNews(", "  if (claimed.count === 0) return [];\n  await postNews(");
  s = once(s, "  await creditMissions(npcId, by);\n}\n\n/** A resident was beaten and spared", "  return creditMissions(npcId, by);\n}\n\n/** A resident was beaten and spared");
  s = once(s, "islandName: string): Promise<void> {\n  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });\n  if (!n || n.status === \"DEAD\") return;\n  const arrest", "islandName: string): Promise<string[]> {\n  const n = await prisma.islandNpc.findUnique({ where: { id: npcId } });\n  if (!n || n.status === \"DEAD\") return [];\n  const arrest");
  s = once(s, "  await creditMissions(npcId, by);\n}\n\n/** Defeating", "  return creditMissions(npcId, by);\n}\n\n/** Defeating");
  s = once(s, "async function creditMissions(npcId: string, by: { id?: string; credit?: string[] }): Promise<void> {", "async function creditMissions(npcId: string, by: { id?: string; credit?: string[] }): Promise<string[]> {");
  s = once(s, "  for (const id of ids) await recordMissionEvent(id, { kind: \"npc\", npcId }).catch(() => []);\n}", "  const mine: string[] = [];\n  for (const id of ids) {\n    const logs = await recordMissionEvent(id, { kind: \"npc\", npcId }).catch(() => [] as string[]);\n    if (id === by.id) mine.push(...logs);\n  }\n  return mine;\n}");
  return s;
});
rw("src/lib/game/perform-action.ts", (s) => {
  s = once(s, "    if (spare) await defeatIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name, faction: character.faction }, character.currentIsland.name);\n    else await killIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name }, character.currentIsland.name);", "    log.push(...(spare ? await defeatIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name, faction: character.faction }, character.currentIsland.name) : await killIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name }, character.currentIsland.name)));");
  return s;
});

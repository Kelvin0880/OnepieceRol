import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return s; } return s.replace(a, () => b); }
rw("src/lib/game/missions.ts", (s) => {
  s = once(s, "  const neighbours = await openNeighbours(island.connections, c.level);\n", "  const neighbours = await openNeighbours(island.connections, c.level);\n  const { loadRoster, engagedNpcIds } = await import(\"./island-npcs\");\n  const { npcState } = await import(\"../engine/island-npc\");\n  const rosterAll = await loadRoster(island.id);\n  const engaged = await engagedNpcIds(characterId);\n  const residents = rosterAll.filter((n) => npcState(n, new Date(), engaged).usable).map((n) => ({ id: n.id, name: n.name, title: n.title, category: n.category, level: n.level }));\n");
  s = once(s, "openNeighbours: neighbours });", "openNeighbours: neighbours, residents });");
  s = once(s, "      patronActorId: s.isArc ? patronActorId : null,\n    })),", "      patronActorId: s.isArc ? patronActorId : null,\n      giverNpcId: s.giverNpcId ?? null,\n      targetNpcId: s.targetNpcId ?? null,\n    })),");
  s = once(s, "const gain = progressGain({ kind: m.kind as MissionKind, progress: m.progress, target: m.target, destination: m.destination }, event);", "const gain = progressGain({ kind: m.kind as MissionKind, progress: m.progress, target: m.target, destination: m.destination, targetNpcId: m.targetNpcId }, event);");
  return s;
});
rw("src/lib/game/island-npcs.ts", (s) => {
  s = once(s, "export async function killIslandNpc(npcId: string, by: { id?: string; name: string }, islandName: string): Promise<void> {", "export async function killIslandNpc(npcId: string, by: { id?: string; name: string; credit?: string[] }, islandName: string): Promise<void> {");
  s = once(s, "export async function defeatIslandNpc(npcId: string, by: { id?: string; name: string; faction: string }, islandName: string): Promise<void> {", "export async function defeatIslandNpc(npcId: string, by: { id?: string; name: string; faction: string; credit?: string[] }, islandName: string): Promise<void> {");
  s = once(s, "    { islandId: n.islandId, locationName: islandName }\n  );\n}\n\n/** A resident was beaten and spared", "    { islandId: n.islandId, locationName: islandName }\n  );\n  await creditMissions(npcId, by);\n}\n\n/** A resident was beaten and spared");
  s = once(s, "    await prisma.islandNpc.update({\n      where: { id: npcId },\n      data: { recoversAt: new Date(now + WOUNDED_MS)", "    await prisma.islandNpc.update({\n      where: { id: npcId },\n      data: { recoversAt: new Date(now + WOUNDED_MS)");
  s = once(s, "export async function tickIslandNpcs(", `/** Defeating (or killing) the resident a mission asks for advances it for everyone who fought them. */
async function creditMissions(npcId: string, by: { id?: string; credit?: string[] }): Promise<void> {
  const { recordMissionEvent } = await import("./missions");
  const ids = new Set([...(by.credit ?? []), ...(by.id ? [by.id] : [])]);
  for (const id of ids) await recordMissionEvent(id, { kind: "npc", npcId }).catch(() => []);
}

export async function tickIslandNpcs(`);
  // after the arrest/wound branches in defeatIslandNpc: credit
  s = once(s, "      data: { recoversAt: new Date(now + WOUNDED_MS), stateNote: `herido por la paliza de ${by.name}`, memoryJson: appendMemory(n.memoryJson, `${by.name} lo derrotó y le perdonó la vida`) },\n    });\n  }\n}", "      data: { recoversAt: new Date(now + WOUNDED_MS), stateNote: `herido por la paliza de ${by.name}`, memoryJson: appendMemory(n.memoryJson, `${by.name} lo derrotó y le perdonó la vida`) },\n    });\n  }\n  await creditMissions(npcId, by);\n}");
  // retarget missions when a successor takes over
  s = once(s, "      taken.add(name);\n      made++;", "      taken.add(name);\n      made++;\n      const pending = await prisma.mission.findMany({ where: { targetNpcId: d.id, status: \"ACTIVE\" } });\n      for (const m of pending) {\n        await prisma.mission.update({ where: { id: m.id }, data: { targetNpcId: created.id, title: m.title.split(d.name).join(name), brief: m.brief.split(d.name).join(name) } });\n      }");
  return s;
});
rw("src/lib/game/joint-fight.ts", (s) => {
  s = once(s, "await killIslandNpc(enemy.islandNpcId, { id: leader.id, name: team }, place);", "await killIslandNpc(enemy.islandNpcId, { id: leader.id, name: team, credit: humans.map((h) => h.characterId) }, place);");
  s = once(s, "await defeatIslandNpc(enemy.islandNpcId, { id: leader.id, name: team, faction: leader.faction }, place);", "await defeatIslandNpc(enemy.islandNpcId, { id: leader.id, name: team, faction: leader.faction, credit: humans.map((h) => h.characterId) }, place);");
  return s;
});

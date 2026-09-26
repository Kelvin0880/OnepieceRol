import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
rw("src/lib/ai/narrate.ts", (s) => {
  s = s.replace('import { worldStateBlock } from "../game/world-state";', 'import { worldStateBlock } from "../game/world-state";\nimport { allowedNamesFor, rosterBlockFor } from "../game/island-npcs";\nimport { inventedNames } from "../engine/island-npc";');
  s = s.replace(
    "  const names = (await loadRealPlayers(characterId).catch(() => [])).map((p) => p.name);\n  return (text) => isValidNarration(text) && voicesRealPlayer(text, names) === null && !inventsSystemResult(text);",
    "  const names = (await loadRealPlayers(characterId).catch(() => [])).map((p) => p.name);\n  const allowed = await allowedNamesForCharacter(characterId);\n  return (text) => isValidNarration(text) && voicesRealPlayer(text, names) === null && !inventsSystemResult(text) && inventedNames(text, allowed).length === 0;"
  );
  s = s.replace("/** Rejects a narration where an invented voice", `/** Names the AI may use at the character's current island (roster, canon, players, own people); empty when the lookup fails. */
export async function allowedNamesForCharacter(characterId: string): Promise<string[]> {
  try {
    const c = await prisma.character.findUnique({ where: { id: characterId }, select: { currentIslandId: true } });
    return c ? await allowedNamesFor(characterId, c.currentIslandId) : [];
  } catch {
    return [];
  }
}

/** Rejects a narration where an invented voice`);
  s = s.replace("    const players = realPlayersBlock(await loadRealPlayers(characterId));\n    const worldState = await worldStateBlock();\n    const isle = await prisma.island.findUnique({ where: { id: c.currentIslandId }, select: { name: true, dangerLevel: true } });",
    "    const players = realPlayersBlock(await loadRealPlayers(characterId));\n    const worldState = await worldStateBlock();\n    const isle = await prisma.island.findUnique({ where: { id: c.currentIslandId }, select: { name: true, dangerLevel: true } });\n    const roster = isle ? await rosterBlockFor(c.currentIslandId, isle.name, characterId).catch(() => \"\") : \"\";");
  s = s.replace("${presence ? `\n\n${presence}` : \"\"}${directivesBlock(", "${presence ? `\n\n${presence}` : \"\"}${roster ? `\n\n${roster}` : \"\"}${directivesBlock(");
  s = s.replace("    const issues = checkConsistency(parsed, bounds);\n", "    const issues = checkConsistency(parsed, bounds);\n    const knownNames = meta.characterId ? await allowedNamesForCharacter(meta.characterId) : [];\n    const madeUp = knownNames.length ? inventedNames(`${parsed.narration} ${parsed.rivalIntent ?? \"\"}`, knownNames) : [];\n    if (madeUp.length > 0) issues.push(`Inventaste personajes con nombre que no existen en esta isla (${madeUp.join(\", \")}): PROHIBIDO. Usa solo los HABITANTES de la lista, los personajes canon o gente anónima (\"un guardia\").`);\n");
  return s;
});

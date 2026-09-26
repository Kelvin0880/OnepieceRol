import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return s; } return s.replace(a, () => b); }
rw("src/lib/engine/island-npc.ts", (s) => {
  s = once(s, '  return `${n.title}. ${n.personality}${n.weapon ? ` Arma: ${n.weapon}.` : ""}${abilities.length ? ` Sabe hacer: ${abilities.join(", ")}.` : " Sin técnicas especiales: pelea como lo que es."}`;',
    '  const fighting = isFighter(n.category) ? (abilities.length ? ` Sabe hacer: ${abilities.join(", ")}.` : " Sin técnicas especiales: pelea como lo que es.") : " NO es un combatiente: se defiende con torpeza, suplica, huye o pide ayuda a gritos.";\n  return `${n.title}. ${n.personality}${n.weapon ? ` Arma: ${n.weapon}.` : ""}${fighting}`;');
  return s;
});
rw("src/lib/game/island-npcs.ts", (s) => {
  s = once(s, "  kit: string;\n  stats: { hp: number; atk: number; def: number; spd: number };\n}", "  kit: string;\n  category: string;\n  fighter: boolean;\n  rewards: { berries: number; xp: number };\n  stats: { hp: number; atk: number; def: number; spd: number };\n}");
  s = once(s, "return { npcId: n.id, name: n.name, level: n.level, personality: n.personality, kit: npcSummaryForFight(n), stats: npcStats(n.level) };",
    "return { npcId: n.id, name: n.name, level: n.level, personality: n.personality, kit: npcSummaryForFight(n), category: n.category, fighter: isFighter(n.category), rewards: npcRewards(n.level, n.category), stats: npcStats(n.level, n.category) };");
  s = once(s, "  npcStats,\n", "  isFighter,\n  npcRewards,\n  npcStats,\n");
  return s;
});
rw("src/lib/game/perform-action.ts", (s) => {
  s = once(s, "  islandNpcId?: string;\n", "  islandNpcId?: string;\n  /** Category of that resident (guard, thug, civilian...): decides what defeating them pays. */\n  npcCategory?: string;\n");
  s = once(s, "isBoss: false, level: bound.level, personality: bound.personality, islandNpcId: bound.npcId }", "isBoss: false, level: bound.level, personality: bound.personality, islandNpcId: bound.npcId, npcCategory: bound.category }");
  s = once(s, "islandNpcId: resident.npcId, hp:", "islandNpcId: resident.npcId, npcCategory: resident.category, hp:");
  // rewards of the scene fight
  s = once(s,
`      rewardsJson: JSON.stringify({
        berries: 0,
        xp: tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      } satisfies StoredRewards),
      narrative: \`\${character.name} ataca a \${name}.\`,`,
`      rewardsJson: JSON.stringify({
        berries: bound ? bound.rewards.berries : 0,
        xp: bound ? bound.rewards.xp : tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      } satisfies StoredRewards),
      narrative: \`\${character.name} ataca a \${name}.\`,`);
  s = once(s,
`        berries: 0,
        xp: tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      },
      stakes: \`\${character.name} ha atacado a \${name}.\`,`,
`        berries: bound ? bound.rewards.berries : 0,
        xp: bound ? bound.rewards.xp : tierXp(tier),
        bounty: 0,
        islandDanger: character.currentIsland.dangerLevel,
      },
      stakes: \`\${character.name} ha atacado a \${name}.\`,`);
  // mercy: bystanders pay only their purse; fighters may drop what they carried
  s = once(s,
`  const berriesDelta = rewards.berries + Math.round(berryReward(rewards.islandDanger, enemy.isBoss) * mercyMultiplier);
  const baseBounty = rewards.bounty + bountyReward(rewards.islandDanger, character.level, enemy.isBoss);`,
`  const bystander = !!enemy.islandNpcId && !!enemy.npcCategory && !isFighter(enemy.npcCategory);
  const berriesDelta = rewards.berries + (bystander ? 0 : Math.round(berryReward(rewards.islandDanger, enemy.isBoss) * mercyMultiplier));
  const baseBounty = bystander ? 0 : rewards.bounty + bountyReward(rewards.islandDanger, character.level, enemy.isBoss);`);
  s = once(s, "  const xpDelta = rewards.xp + 10;", "  const xpDelta = bystander ? 0 : rewards.xp + 10;");
  s = once(s,
`  if (spare) {
    log.push(\`Decides perdonar a \${enemy.name} y lo dejas ir con vida.\`);`,
`  if (enemy.islandNpcId && enemy.npcCategory && !spare && isFighter(enemy.npcCategory)) {
    const item = npcLoot(\`\${enemy.islandNpcId}:\${pending.id}\`, enemy.npcCategory, enemy.level ?? 2);
    if (item) {
      const note = await grantItem(character.id, item, 1);
      const def = getItemDef(item);
      log.push(note ?? \`Registras el cuerpo de \${enemy.name} y encuentras: \${def?.name ?? item}.\`);
    }
  }
  if (bystander && !spare) log.push(\`\${enemy.name} no era un combatiente: no hay gloria en esto, solo lo poco que llevaba encima.\`);

  if (spare) {
    log.push(\`Decides perdonar a \${enemy.name} y lo dejas ir con vida.\`);`);
  s = once(s, 'import { bindRandomFighter,', 'import { isFighter, npcLoot } from "../engine/island-npc";\nimport { bindRandomFighter,');
  return s;
});

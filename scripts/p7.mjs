import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 70)); return s; } return s.replace(a, () => b); }

rw("src/lib/game/perform-action.ts", (s) => {
  s = once(s, "interface StoredEnemy {\n  name: string;", "interface StoredEnemy {\n  name: string;\n  /** The island resident (IslandNpc) this enemy is: while the fight lasts nobody else can use them; their death/injury is recorded. */\n  islandNpcId?: string;");
  s = once(s, 'import { postNews', 'import { bindRandomFighter, bindTarget, defeatIslandNpc, killIslandNpc, noteNpc, whyNotAvailable } from "./island-npcs";\nimport { postNews');
  s = once(s,
`  const name = cleanTargetName(opts.target);
  const playerBase = toCombatant(character);
  const built = buildSceneEnemy(name, { ...playerBase, hp: character.maxHp, maxHp: character.maxHp }, tier);
  const enemy: StoredEnemy = {
    name,
    hp: built.maxHp,
    atk: built.atk,
    def: built.def,
    spd: built.spd,
    isBoss: tier === "elite",
    level: built.level,
  };
  const assessment = assessThreat(playerBase, built);`,
`  // The target must be someone who exists: a free resident of the island. Nobody named = an anonymous bystander.
  const bound = opts.target ? await bindTarget(character.currentIslandId, opts.target, character.id) : null;
  if (!bound && opts.target) {
    const why = await whyNotAvailable(character.currentIslandId, opts.target, character.id);
    if (why) throw new GameActionError(why);
  }
  const name = bound ? bound.name : cleanTargetName(opts.target);
  const playerBase = toCombatant(character);
  const built = buildSceneEnemy(name, { ...playerBase, hp: character.maxHp, maxHp: character.maxHp }, tier);
  const enemy: StoredEnemy = bound
    ? { name, hp: bound.stats.hp, atk: bound.stats.atk, def: bound.stats.def, spd: bound.stats.spd, isBoss: false, level: bound.level, personality: bound.personality, islandNpcId: bound.npcId }
    : { name, hp: built.maxHp, atk: built.atk, def: built.def, spd: built.spd, isBoss: tier === "elite", level: built.level };
  const assessment = assessThreat(playerBase, bound ? { name, hp: enemy.hp, maxHp: enemy.hp, atk: enemy.atk, def: enemy.def, spd: enemy.spd } : built);`);
  // random encounters: the enemy is a real resident when one is free
  s = once(s,
`    let enemy: StoredEnemy = {
      name: resolution.enemy.name,
      hp: resolution.enemy.hp,
      atk: Math.round(resolution.enemy.atk * tierMultiplier),
      def: resolution.enemy.def,
      spd: resolution.enemy.spd,
      isBoss: !!resolution.enemy.isBoss,
      personality: resolution.enemy.personality,
      worldActorId: resolution.enemy.worldActorId,
    };`,
`    let enemy: StoredEnemy = {
      name: resolution.enemy.name,
      hp: resolution.enemy.hp,
      atk: Math.round(resolution.enemy.atk * tierMultiplier),
      def: resolution.enemy.def,
      spd: resolution.enemy.spd,
      isBoss: !!resolution.enemy.isBoss,
      personality: resolution.enemy.personality,
      worldActorId: resolution.enemy.worldActorId,
    };
    if (!enemy.isBoss && !enemy.worldActorId) {
      const resident = await bindRandomFighter(character.currentIslandId, \`\${beat}:\${character.id}\`, character.id);
      if (resident) enemy = { ...enemy, name: resident.name, personality: resident.personality, level: resident.level, islandNpcId: resident.npcId, hp: Math.max(enemy.hp, resident.stats.hp), atk: Math.max(enemy.atk, resident.stats.atk) };
    }`);
  // mercy: kill / spare of a resident
  s = once(s,
`  if (spare) {
    log.push(\`Decides perdonar a \${enemy.name} y lo dejas ir con vida.\`);`,
`  if (enemy.islandNpcId) {
    if (spare) await defeatIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name, faction: character.faction }, character.currentIsland.name);
    else await killIslandNpc(enemy.islandNpcId, { id: character.id, name: character.name }, character.currentIsland.name);
  }

  if (spare) {
    log.push(\`Decides perdonar a \${enemy.name} y lo dejas ir con vida.\`);`);
  return s;
});

rw("src/lib/game/joint-fight.ts", (s) => {
  s = once(s, "  worldActorId?: string;\n  isActor?: boolean;\n}", "  worldActorId?: string;\n  /** Island resident (IslandNpc) fought here: locked for everyone else, fate recorded when the fight ends. */\n  islandNpcId?: string;\n  isActor?: boolean;\n}");
  s = once(s, "  if (closing.length) await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: \"Narrador\", text: closing.join(\" \") } });\n}",
`  if (enemy.islandNpcId) {
    const { killIslandNpc, defeatIslandNpc, noteNpc } = await import("./island-npcs");
    const place = (await prisma.island.findUnique({ where: { id: fight.islandId }, select: { name: true } }))?.name ?? "la isla";
    const lead = humans[0];
    const leader = lead ? await prisma.character.findUnique({ where: { id: lead.characterId }, select: { id: true, name: true, faction: true } }) : null;
    const team = humans.map((h) => h.name).join(", ");
    if (outcome === "victory" && leader) {
      const fate = await judgeFate({ victim: { name: enemy.name, level: enemy.level ?? 2, durability: 20, willpower: 20, faction: "PIRATE" }, cause: \`Fue derrotado en combate por \${team}.\`, killer: { name: team, isBoss: false }, islandName: place, islandDanger: rewards.islandDanger, characterId: leader.id });
      if (fate.fate === "death") await killIslandNpc(enemy.islandNpcId, { id: leader.id, name: team }, place);
      else await defeatIslandNpc(enemy.islandNpcId, { id: leader.id, name: team, faction: leader.faction }, place);
    } else if (outcome === "defeat") {
      await noteNpc(enemy.islandNpcId, \`Derrotó a \${team} en \${place}\`);
    }
  }
  if (closing.length) await prisma.jointFightMessage.create({ data: { fightId, authorCharacterId: null, authorName: "Narrador", text: closing.join(" ") } });
}`);
  return s;
});

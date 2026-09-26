import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
rw("prisma/schema.prisma", (s) => s.replace("  successorId String?\n  generation  Int       @default(1)", "  // CAPTURED: held by the law until recoversAt; a beaten-but-spared resident is unavailable until recoversAt too.\n  recoversAt  DateTime?\n  stateNote   String?\n  successorId String?\n  generation  Int       @default(1)").replace("status      String    @default(\"ALIVE\") // ALIVE | DEAD\n  diedAt", "status      String    @default(\"ALIVE\") // ALIVE | DEAD | CAPTURED\n  diedAt"));
rw("src/lib/engine/island-npc.ts", (s) => {
  s = s.replace("  memoryJson: string | null;\n  generation: number;\n}", "  memoryJson: string | null;\n  generation: number;\n  recoversAt?: Date | null;\n  stateNote?: string | null;\n}");
  s = s.replace("export function parseList(", `/** What a resident is doing right now. Only a free, living one can be talked to or fought; everyone else is off-limits to the AI and to other players. */
export function npcState(n: IslandNpcRow, now: Date, engaged: Set<string>): { usable: boolean; label: string } {
  if (n.status === "DEAD") return { usable: false, label: "muerto" };
  if (n.status === "CAPTURED") return { usable: false, label: n.stateNote ? \`capturado (\${n.stateNote})\` : "capturado por la ley" };
  if (n.recoversAt && n.recoversAt.getTime() > now.getTime()) return { usable: false, label: n.stateNote ?? "herido, recuperándose" };
  if (engaged.has(n.id)) return { usable: false, label: "ocupado peleando con otro aventurero" };
  return { usable: true, label: "disponible" };
}

export function parseList(`);
  s = s.replace("export function matchNpc(roster: IslandNpcRow[], text: string): IslandNpcRow | null {", "export function matchNpc(roster: IslandNpcRow[], text: string, unavailable: Set<string> = new Set()): IslandNpcRow | null {");
  s = s.replace('  const alive = roster.filter((n) => n.status === "ALIVE");\n  for (const n of alive) {\n    const full', '  const alive = roster.filter((n) => n.status === "ALIVE" && !unavailable.has(n.id));\n  for (const n of alive) {\n    const full');
  s = s.replace('export function pickCombatNpc(roster: IslandNpcRow[], seed: string, wanted: string[] = ["thug", "guard", "pirate", "marine"]): IslandNpcRow | null {\n  const pool = roster.filter((n) => n.status === "ALIVE" && wanted.includes(n.category));', 'export function pickCombatNpc(roster: IslandNpcRow[], seed: string, wanted: string[] = ["thug", "guard", "pirate", "marine"], unavailable: Set<string> = new Set()): IslandNpcRow | null {\n  const pool = roster.filter((n) => n.status === "ALIVE" && !unavailable.has(n.id) && wanted.includes(n.category));');
  const a = s.indexOf("export function rosterBlock");
  const b = s.indexOf("export function npcSummaryForFight");
  const block = `export function rosterBlock(islandName: string, roster: IslandNpcRow[], now = new Date(), engaged: Set<string> = new Set(), maxUsable = 14): string {
  const states = roster.map((n) => ({ n, st: npcState(n, now, engaged) }));
  const usable = states.filter((x) => x.st.usable).slice(0, maxUsable);
  const busy = states.filter((x) => !x.st.usable && x.n.status !== "DEAD");
  const dead = states.filter((x) => x.n.status === "DEAD").slice(-4);
  if (usable.length === 0 && busy.length === 0 && dead.length === 0) return "";
  const lines = usable.map(({ n }) => {
    const mem = parseList(n.memoryJson).slice(-3);
    return \`- \${n.name} — \${n.title} (nivel \${n.level}, \${n.category}): \${n.personality}\${mem.length ? \` MEMORIA: \${mem.join("; ")}\` : ""}\`;
  });
  const away = busy.length ? \`\nNO DISPONIBLES AHORA (no aparecen en escena, nadie puede hablar ni pelear con ellos): \${busy.map(({ n, st }) => \`\${n.name} (\${st.label})\`).join("; ")}.\` : "";
  const gone = dead.length ? \`\nMUERTOS (ya no aparecen, solo se los recuerda): \${dead.map(({ n }) => \`\${n.name}\${n.diedNote ? \` (\${n.diedNote})\` : ""}\`).join("; ")}.\` : "";
  return \`HABITANTES DE \${islandName} (los únicos personajes de relleno con nombre propio permitidos aquí, con su estado en tiempo real):\n\${lines.join("\n")}\${away}\${gone}\n\${ROSTER_RULE}\`;
}

`;
  return s.slice(0, a) + block + s.slice(b);
});

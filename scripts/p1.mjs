import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); s = fn(s); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
rw("src/lib/game/world-tick.ts", (s) => s
  .replace('import { tickAdmiralDispatch } from "./admiral-dispatch";', 'import { tickAdmiralDispatch } from "./admiral-dispatch";\nimport { tickIslandNpcs } from "./island-npcs";')
  .replace("  void tickAdmiralDispatch();\n", "  void tickAdmiralDispatch();\n  // A dead resident's job gets a new named successor after a while.\n  void tickIslandNpcs();\n"));
rw("src/lib/game/world-arcs.ts", (s) => s.replace("pinned: pinnedIds.has(a.id) ||", 'pinned: pinnedIds.has(a.id) || a.factionName === "Impel Down" ||'));

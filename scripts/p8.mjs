import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 70)); return s; } return s.replace(a, () => b); }
rw("src/lib/game/rescue-raid.ts", (s) => {
  s = once(s, 'import { actorCombatStats } from "../engine/guardian";', 'import { actorCombatStats } from "../engine/guardian";\nimport { IMPEL_LEVEL_GUARD } from "./world-actor-impel";');
  s = once(s, "  const stats = actorCombatStats(req.guardPower);\n", "  const stats = actorCombatStats(req.guardPower);\n  // The chief guard of that level is a canon character, not an invented jailer.\n  const guard = await prisma.worldActor.findUnique({ where: { name: IMPEL_LEVEL_GUARD[cell] ?? IMPEL_LEVEL_GUARD[1] } });\n");
  s = once(s, 'enemy: { name: `Guardia mayor del ${prisonLabel(cell).replace("Impel Down, ", "")}`, ...stats, isBoss: true, personality: "Carcelero implacable de Impel Down: no deja salir a nadie" },',
    'enemy: guard\n        ? { name: guard.name, ...stats, isBoss: true, personality: guard.personality ?? "Carcelero implacable de Impel Down: no deja salir a nadie", worldActorId: guard.id }\n        : { name: `Guardia mayor del ${prisonLabel(cell).replace("Impel Down, ", "")}`, ...stats, isBoss: true, personality: "Carcelero implacable de Impel Down: no deja salir a nadie" },');
  return s;
});
rw("prisma/seed.ts", (s) => {
  s = once(s, 'import { WAVE4_ACTORS, WAVE4_RELOCATIONS } from "../src/lib/game/world-actor-wave4";', 'import { WAVE4_ACTORS, WAVE4_RELOCATIONS } from "../src/lib/game/world-actor-wave4";\nimport { IMPEL_ACTORS } from "../src/lib/game/world-actor-impel";');
  s = once(s, "for (const e of [...EXTRA_ACTORS, ...MORE_ACTORS, ...WAVE4_ACTORS]) {", "for (const e of [...EXTRA_ACTORS, ...MORE_ACTORS, ...WAVE4_ACTORS, ...IMPEL_ACTORS]) {");
  return s;
});

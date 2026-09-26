import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return s; } return s.replace(a, () => b); }
rw("src/lib/ai/world-happening.ts", (s) => {
  s = once(s, "islands: { name: string; sea: string; danger: number; control: string | null }[];", "islands: { name: string; sea: string; danger: number; control: string | null; residents?: string[] }[];");
  s = once(s, "(3) Inventa nombres propios para los personajes nuevos. ", "(3) NO inventes personajes con nombre: los protagonistas del suceso son SOLO habitantes de la lista de la isla elegida (con su oficio) o gente anónima (\\\"un pescador\\\"). Nunca mates ni captures a un habitante en la noticia. ");
  s = once(s, '`- ${i.name} (${i.sea}, peligro ${i.danger}${i.control ? `, controla: ${i.control}` : ""})`', '`- ${i.name} (${i.sea}, peligro ${i.danger}${i.control ? `, controla: ${i.control}` : ""})${i.residents?.length ? ` — habitantes: ${i.residents.join("; ")}` : ""}`');
  return s;
});
rw("src/lib/game/world-happenings.ts", (s) => {
  s = once(s, "    const seeds = pickSeeds(rng, [], 3);\n", "    const seeds = pickSeeds(rng, [], 3);\n    const npcs = await prisma.islandNpc.findMany({ where: { status: \"ALIVE\" }, select: { name: true, title: true, islandId: true } });\n");
  s = once(s, "islands: islands.map((i) => ({ name: i.name, sea: String(i.sea), danger: i.dangerLevel, control: i.factionControl })),", "islands: islands.map((i) => ({ name: i.name, sea: String(i.sea), danger: i.dangerLevel, control: i.factionControl, residents: npcs.filter((n) => n.islandId === i.id).slice(0, 6).map((n) => `${n.name} (${n.title})`) })),");
  return s;
});

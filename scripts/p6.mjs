import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
rw("src/lib/ai/narrate-prompt.ts", (s) => {
  const a = s.indexOf('  "NOMBRES PROPIOS: todo personaje que inventes');
  const b = s.indexOf("\n", a);
  return s.slice(0, a) + '  "NOMBRES PROPIOS: NUNCA inventes personajes con nombre. Los únicos con nombre propio son los HABITANTES de la isla (lista abajo), los personajes canon y los jugadores; para cada papel (tabernero, guardia, rival, marino, comerciante) usa a quien de esa lista tenga ese oficio y respeta su personalidad y su memoria. Si nadie de la lista encaja, usa a alguien anónimo de fondo sin nombre (\\"un pescador\\") que no protagonice ni pelee como personaje. " +' + s.slice(b);
});
rw("src/lib/ai/referee-prompt.ts", (s) => {
  const a = s.indexOf('  "El rival siempre tiene NOMBRE propio');
  const b = s.indexOf("\n", a);
  return s.slice(0, a) + '  "El rival y todo aliado suyo usan SOLO el nombre que les da la lista de combatientes o la lista de HABITANTES/canon: JAMÁS inventes un nombre nuevo (si hacen falta más enemigos, usa a otros habitantes disponibles de la lista o gente anónima sin nombre, como \\"otro guardia\\"). " +' + s.slice(b);
});

import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
rw("src/lib/engine/island-npc.ts", (s) => {
  const a = s.indexOf("const INTRO_RE");
  const b = s.indexOf("/** Names the text presents");
  const re = 'const PERSON = "(?:hombre|hombres|mujer|tipo|tío|chico|chica|muchacho|muchacha|anciano|anciana|viejo|vieja|joven|sujeto|individuo|figura|guardia|guardián|soldado|marine|pirata|matón|bandido|tabernero|tabernera|camarero|camarera|mercader|comerciante|capitán|teniente|sargento|niño|niña|pescador|cocinero|cocinera|líder|jefe|jefa|vendedor|vendedora)";\nconst INTRO_RE = new RegExp(`\\b${PERSON}\\b[^.!?\\n]{0,40}?\\b(?:llamad[oa]s?|apodad[oa]s?|conocid[oa]s? como|de nombre)\\s+(?:["“«\'])?([A-ZÁÉÍÓÚÑ][\\wáéíóúñü\'’-]{2,}(?:\\s+[A-ZÁÉÍÓÚÑ][\\wáéíóúñü\'’-]{2,})?)`, "gi");\n\n';
  return s.slice(0, a) + re + s.slice(b);
});

import fs from "fs";
const f = "src/lib/engine/island-npc.ts";
let s = fs.readFileSync(f, "utf8");
const crlf = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");
const a = s.indexOf("/** Names the text presents as new characters");
const bt = "`";
const block = String.raw`const NAME = String.raw${bt}([A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñü'’-]{2,})?)${bt};
const PERSON_LC = PERSON.replace("(?:", "(?:").replace(/\|/g, "|");
// "Es Makino, la tabernera" / "Soy Rocco." / "me llamo Bruno"
const IS_RE = new RegExp(String.raw${bt}(?:^|[.!?—"“»]\s*|\n\s*)(?:Es|Era|Soy|Eres)\s+${"$"}{NAME}\s*(?:,\s*(?:el|la|un|una)\b|[.—])${bt}, "g");
const SELF_RE = new RegExp(String.raw${bt}\b(?:[Mm]e llamo|[Mm]i nombre es|[Ss]e llama|[Ss]e llamaba)\s+${"$"}{NAME}${bt}, "g");
// "Harlan Reed, el nuevo guardia" / "Makino, la tabernera"
const APPOSITION_RE = new RegExp(String.raw${bt}${"$"}{NAME},\s+(?:el|la|un|una)(?:\s+(?:nuev[oa]|antigu[oa]|joven|viej[oa]|veterano|veterana))?\s+${"$"}{PERSON}\b${bt}, "g");

function cleanName(raw: string): string {
  return raw.trim().split(/\s+/).filter((w, i, arr) => arr.slice(0, i + 1).every((x) => x[0] !== x[0].toLowerCase())).join(" ");
}

/** Names the text presents as characters ("un hombre llamado Vorgen", "Es Makino, la tabernera") that are not in the allowed set. */
export function inventedNames(text: string, allowed: string[]): string[] {
  const ok = allowed.map(strip);
  const out: string[] = [];
  const found: string[] = [];
  for (const m of text.matchAll(INTRO_RE)) found.push(m[1]);
  for (const re of [IS_RE, SELF_RE, APPOSITION_RE]) for (const m of text.matchAll(re)) found.push(m[1]);
  for (const raw of found) {
    const n = cleanName(raw);
    if (!n) continue;
    const s = strip(n);
    if (ok.some((a) => a === s || a.includes(s) || s.includes(a) || a.split(/\s+/).includes(s.split(/\s+/)[0]))) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
`;
s = s.slice(0, a) + block;
s = s.replace('const PERSON_LC = PERSON.replace("(?:", "(?:").replace(/\\|/g, "|");\n', "");
fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);

import fs from "fs";
function rw(f, fn) { let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n"); const o = s; s = fn(s); if (s === o) console.log("NO CHANGE", f); if (crlf) s = s.replace(/\n/g, "\r\n"); fs.writeFileSync(f, s); }
function once(s, a, b) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 70)); return s; } return s.replace(a, () => b); }
rw("src/app/codex/page.tsx", (s) => {
  s = once(s, 'useState<"canon" | "players" | "prison">("canon")', 'useState<"canon" | "players" | "prison" | "residents">("canon")');
  s = once(s, '        <button onClick={() => setSection("players")}', '        <button onClick={() => setSection("residents")} className={`px-3 py-1.5 rounded text-sm border ${section === "residents" ? "border-gold-bright text-gold-bright" : "border-white/15 text-ink-dim"}`} data-testid="codex-tab-residents">\n          Habitantes\n        </button>\n        <button onClick={() => setSection("players")}');
  s = once(s, '      {section === "prison" && <PrisonSection actors={actors ?? []} />}', '      {section === "prison" && <PrisonSection actors={actors ?? []} />}\n\n      {section === "residents" && <ResidentsSection />}');
  s = once(s, "function PrisonSection(", 'import ResidentsSection from "./ResidentsSection";\n\nfunction PrisonSection(');
  return s;
});

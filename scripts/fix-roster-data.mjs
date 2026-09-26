import fs from "fs";
const f = "src/lib/game/island-npc-data.ts";
let t = fs.readFileSync(f, "utf8");
const m = t.match(/= (\[[\s\S]*\]);/);
let arr = JSON.parse(m[1]);
arr = arr.filter((r) => !(r.island === "Impel Down" && (r.slot === "taberna-de-imperio" || r.slot === "mercader-de-provisiones")));
let json = JSON.stringify(arr, null, 1);
const rename = {
  "Mistress Velora": "Señora Velora",
  "Kael the Gear": "Kael el Engranaje",
  "Lieutenant Corvus": "Teniente Corvus",
  "Old Man Saltscar": "Viejo Cicatriz de Sal",
  "Old Man Gorbo": "Viejo Gorbo",
  "Elder Kenta": "Anciano Kenta",
  "Old Man Grift": "Viejo Grift",
};
for (const [a, b] of Object.entries(rename)) json = json.split(a).join(b);
t = t.replace(m[0], () => `= ${json};`);
fs.writeFileSync(f, t);
console.log(JSON.parse(json).length);

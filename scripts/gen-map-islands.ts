// Prints the docs/mapa.html ISLANDS entries for the phase-2 islands straight from the seeded DB,
// so the static map never drifts from prisma/seed.ts. Usage: npx tsx scripts/gen-map-islands.ts
import "dotenv/config";
import { prisma } from "../src/lib/db";

const NEW: Record<string, { key: string; x: number; y: number }> = {
  "Isla Drum": { key: "drum", x: 1200, y: 190 },
  Skypiea: { key: "skypiea", x: 1350, y: 80 },
  "Water 7": { key: "waterSeven", x: 1250, y: 480 },
  "Archipiélago Sabaody": { key: "sabaody", x: 1250, y: 600 },
  "Isla Gyojin": { key: "fishMan", x: 1100, y: 615 },
  "Punk Hazard": { key: "punkHazard", x: 950, y: 600 },
  "Whole Cake Island": { key: "wholeCake", x: 800, y: 610 },
  "País de Wano": { key: "wano", x: 660, y: 610 },
  "Laugh Tale": { key: "laughTale", x: 560, y: 650 },
  "Isla Abismo": { key: "abyss", x: 1620, y: 110 },
  "Mary Geoise": { key: "maryGeoise", x: 1620, y: 400 },
};

async function main() {
  const rows = await prisma.island.findMany({ include: { poneglyph: true } });
  const out: string[] = [];
  for (const r of rows) {
    const n = NEW[r.name];
    if (!n) continue;
    out.push(
      `  { key: ${JSON.stringify(n.key)}, name: ${JSON.stringify(r.name)}, sea: ${JSON.stringify(r.sea === "NEW_WORLD" ? "New World" : r.sea)}, danger: ${r.dangerLevel}, minLevel: ${r.minLevelToEnter}, faction: ${JSON.stringify(r.factionControl)}, poneglyph: ${r.hasPoneglyph}${r.poneglyph ? `, poneglyphName: ${JSON.stringify(r.poneglyph.codeName)}` : ""}, x: ${n.x}, y: ${n.y},\n    desc: ${JSON.stringify(r.description)},\n    hook: ${JSON.stringify(r.arcHook ?? "")} },`
    );
  }
  console.log(out.join("\n"));
  await prisma.$disconnect();
}
main();

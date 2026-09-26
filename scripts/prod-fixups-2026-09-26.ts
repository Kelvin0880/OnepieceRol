// One-off, idempotent: Kaido and Big Mom become defeated former Yonko; Barbosa's Foosha mission is closed (he did destroy the gang).
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { recordMissionEvent } from "../src/lib/game/missions";

async function main() {
  for (const [name, rank, desc] of [
    ["Kaido", "Ex-Yonko (derrotado)", "Fue el Emperador de las Bestias, la criatura más fuerte del mundo. Derrotado y sin trono, busca recuperar su título atacando a un Yonko en activo."],
    ["Charlotte Linlin (Big Mom)", "Ex-Yonko (derrotada)", "Fue la Emperatriz del Dulce y reina de Totto Land. Derrotada y sin trono, busca recuperar su título atacando a un Yonko en activo."],
  ] as const) {
    const r = await prisma.worldActor.updateMany({ where: { name, status: "ACTIVE" }, data: { status: "DEFEATED", role: "NOTABLE_PIRATE", rankLabel: rank, description: desc, currentFocus: null, busyUntil: null } });
    console.log(name, "updated:", r.count);
  }
  const barb = await prisma.character.findFirst({ where: { name: { startsWith: "Barbosa" } }, select: { id: true, name: true, level: true, experience: true, berries: true } });
  if (!barb) return console.log("no Barbosa");
  const m = await prisma.mission.findFirst({ where: { characterId: barb.id, status: "ACTIVE", kind: "win_fights", title: { contains: "Pueblo Foosha" } } });
  if (!m) return console.log("Barbosa's mission already closed");
  console.log("before:", barb, m.progress + "/" + m.target);
  console.log((await recordMissionEvent(barb.id, { kind: "win" })).join(" | "));
  console.log("after:", await prisma.character.findUnique({ where: { id: barb.id }, select: { level: true, experience: true, berries: true } }));
}
main().finally(() => prisma.$disconnect());

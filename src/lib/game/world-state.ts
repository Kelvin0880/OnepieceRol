import { prisma } from "../db";
import { describeWorldState } from "../engine/world-state";

let cache: { at: number; text: string } | null = null;
const TTL_MS = 60_000;

export function invalidateWorldState() {
  cache = null;
}

/** The world facts every narrator/referee must obey (who rules, who is imprisoned, who fell, what is happening). Cached for a minute. */
export async function worldStateBlock(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.text;
  try {
    const [actors, playerYonko, arcs, dispatches] = await Promise.all([
      prisma.worldActor.findMany({ where: { OR: [{ role: "YONKO", status: "ACTIVE" }, { status: { in: ["CAPTURED", "DEFEATED", "DECEASED"] } }] }, select: { name: true, role: true, status: true, prisonLevel: true } }),
      prisma.character.findMany({ where: { status: "ALIVE", OR: [{ emperorSince: { not: null } }, { title: { contains: "Yonko" } }] }, select: { name: true } }),
      prisma.worldArc.findMany({ where: { status: { in: ["ACTIVE", "AWAITING_CONSENT"] } }, select: { title: true } }),
      prisma.admiralDispatch.findMany({ where: { status: { in: ["EN_ROUTE", "ARRIVED"] } }, select: { admiralName: true, targetIslandName: true, status: true } }).catch(() => []),
    ]);
    const text = describeWorldState({
      yonko: [...actors.filter((a) => a.role === "YONKO" && a.status === "ACTIVE").map((a) => a.name), ...playerYonko.map((p) => `${p.name} (jugador)`)],
      prisoners: actors.filter((a) => a.status === "CAPTURED").map((a) => ({ name: a.name, cell: a.prisonLevel })),
      defeated: actors.filter((a) => a.status === "DEFEATED").map((a) => a.name),
      fallen: actors.filter((a) => a.status === "DECEASED").map((a) => a.name),
      events: [...arcs.map((a) => a.title), ...dispatches.map((d) => `el almirante ${d.admiralName} ${d.status === "EN_ROUTE" ? "navega hacia" : "está atacando"} ${d.targetIslandName}`)],
    });
    cache = { at: Date.now(), text };
    return text;
  } catch {
    return "";
  }
}

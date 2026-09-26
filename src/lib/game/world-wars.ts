import { prisma } from "../db";
import type { War, WorldActor } from "@prisma/client";
import { canonWarCandidates, CANON_WAR_GAP_MS, frontDue, frontPower, FRONT_INTERVAL_MS, pickCanonWar, warDeclarationText, WAR_KIND_LABEL, type CanonWarKind, type WarSide } from "../engine/world-wars";
import { isRevolutionBase, pickBySeed } from "../engine/faction-seats";
import { isMarineBase, warOutcome } from "../engine/sovereignty";
import { judgeMatch } from "../ai/judge";
import { postNews } from "./death-resolution";
import { invalidateWorldState } from "./world-state";

const HOUR = 3600_000;
const OFF_LIMITS = new Set(["Cuartel Marine G-5", "Nuevo Marineford", "Marineford", "Mary Geoise", "Impel Down", "Enies Lobby", "Isla Baltigo", "Tequila Wolf"]);
export const LIBERATED = "Liberada por el Ejército Revolucionario";
export const OCCUPIED = "Ocupada por la Marina";

const parse = <T>(json: string | null | undefined, fallback: T): T => {
  try {
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const isCanonWar = (w: Pick<War, "attackerKind">) => w.attackerKind === "canon";

function logLine(w: War, line: string): string {
  return JSON.stringify([...parse<string[]>(w.logJson, []), line].slice(-20));
}

/** The fighters a side can put on a front: the leader's own people (an Emperor's crew, the Marines, the Revolution). */
async function sideRoster(w: War, side: WarSide): Promise<WorldActor[]> {
  const kind = w.kind as CanonWarKind;
  const leaderId = side === "attacker" ? w.attackerId : w.defenderId;
  const leader = leaderId && (side === "attacker" ? w.attackerKind : w.defenderKind) === "canon" ? await prisma.worldActor.findUnique({ where: { id: leaderId } }) : null;
  const now = new Date();
  const free = { status: "ACTIVE", OR: [{ busyUntil: null }, { busyUntil: { lt: now } }] };
  const gov = (side === "defender" && (kind === "REVOLUTION" || kind === "MARINE")) || (side === "attacker" && kind === "JUSTICE");
  if (gov) return prisma.worldActor.findMany({ where: { ...free, factionType: { in: ["MARINE", "CIPHER_POL"] }, role: { notIn: ["GOROSEI", "HIDDEN_RULER", "NOTABLE_CIVILIAN"] }, factionName: { not: "Impel Down" } }, orderBy: { powerLevel: "desc" }, take: 6 });
  if (side === "attacker" && kind === "REVOLUTION") return prisma.worldActor.findMany({ where: { ...free, factionType: "REVOLUTIONARY" }, orderBy: { powerLevel: "desc" }, take: 6 });
  if (!leader) return [];
  const crew = await prisma.worldActor.findMany({ where: { ...free, factionName: leader.factionName, id: { not: leader.id } }, orderBy: { powerLevel: "desc" }, take: 5 });
  return [leader, ...crew];
}

/** Where the next front is fought: the defender's ground. */
async function theaterFor(w: War, seed: string): Promise<{ id: string; name: string } | null> {
  const kind = w.kind as CanonWarKind;
  const islands = await prisma.island.findMany({ select: { id: true, name: true, factionControl: true } });
  if (kind === "REVOLUTION" || kind === "MARINE") return pickBySeed(islands.filter((i) => isMarineBase(i.factionControl)), seed);
  if (!w.defenderId) return null;
  const held = await prisma.territory.findMany({ where: { ownerActorId: w.defenderId } });
  const ids = held.map((t) => t.islandId);
  if (ids.length) return pickBySeed(islands.filter((i) => ids.includes(i.id)), seed);
  const d = await prisma.worldActor.findUnique({ where: { id: w.defenderId } });
  const home = islands.find((i) => i.id === (d?.homeIslandId ?? d?.currentIslandId));
  return home ?? null;
}

function fighter(a: WorldActor, power: number) {
  const kit = parse<string[]>(a.abilitiesJson, []).slice(0, 5).join("; ");
  return { name: a.name, level: power, atk: power * 10, def: power * 9, kit: kit || undefined };
}

/** One front of a canon war, judged: the sides' champions meet on the defender's ground and the winner scores a blow. */
export async function runFront(warId: string, now = new Date()): Promise<string | null> {
  const w = await prisma.war.findUnique({ where: { id: warId } });
  if (!w || w.status !== "ACTIVE" || !isCanonWar(w)) return null;
  const claimed = await prisma.war.updateMany({ where: { id: w.id, status: "ACTIVE", nextFrontAt: w.nextFrontAt }, data: { nextFrontAt: new Date(now.getTime() + FRONT_INTERVAL_MS) } });
  if (claimed.count === 0) return null;
  const seed = `${w.id}:${w.attackerScore + w.defenderScore}:${Math.floor(now.getTime() / HOUR)}`;
  const [atk, def, place] = await Promise.all([sideRoster(w, "attacker"), sideRoster(w, "defender"), theaterFor(w, seed)]);
  const a = pickBySeed(atk.slice(0, 3), `${seed}:a`);
  const d = pickBySeed(def.slice(0, 3), `${seed}:d`);
  if (!a || !d) return null;
  const verdict = await judgeMatch(
    fighter(a, frontPower(a.powerLevel, w.attackerPlayerBlows)),
    fighter(d, frontPower(d.powerLevel, w.defenderPlayerBlows)),
    `Frente de guerra (${WAR_KIND_LABEL[w.kind as CanonWarKind]}) en ${place?.name ?? "el mar"}: ${a.name} al frente de ${w.attackerName} contra ${d.name} al frente de ${w.defenderName}. Es una batalla, no a muerte.`
  );
  const attackerWon = verdict.winner === "a";
  const winner = attackerWon ? a : d;
  const loser = attackerWon ? d : a;
  const line = `Frente de ${place?.name ?? "alta mar"}: ${winner.name} se impone a ${loser.name}.`;
  await prisma.war.update({ where: { id: w.id }, data: { ...(attackerWon ? { attackerScore: { increment: 1 } } : { defenderScore: { increment: 1 } }), logJson: logLine(w, line) } });
  await postNews(
    `${line.replace(/\.$/, "")}`,
    `En la guerra de ${w.attackerName} contra ${w.defenderName}, ${winner.name} ha ganado el frente de ${place?.name ?? "alta mar"}${verdict.reason && verdict.reason !== "stub" ? `: ${verdict.reason}` : "."} ${loser.name} se retira a reorganizarse. Los combatientes de cada bando pueden seguir golpeando.`,
    "Guerra",
    undefined,
    "normal",
    place ? { locationName: place.name, islandId: place.id } : undefined
  );
  await prisma.worldActor.update({ where: { id: loser.id }, data: { busyUntil: new Date(now.getTime() + 6 * HOUR), currentFocus: `Se repliega tras perder un frente` } });
  await settleCanonWarIfDone(w.id, now);
  return line;
}

/** Territory, control of islands and reputations move with the outcome; nobody dies or is captured. */
export async function settleCanonWarIfDone(warId: string, now = new Date()): Promise<boolean> {
  const w = await prisma.war.findUnique({ where: { id: warId } });
  if (!w || w.status !== "ACTIVE" || !isCanonWar(w)) return false;
  const result = warOutcome({ attacker: w.attackerScore, defender: w.defenderScore }, w.startedAt, now);
  if (!result) return false;
  const claimed = await prisma.war.updateMany({ where: { id: w.id, status: "ACTIVE" }, data: { status: "ENDED", outcome: result, endedAt: now } });
  if (claimed.count === 0) return false;
  const kind = w.kind as CanonWarKind;
  const effects: string[] = [];
  if (result === "stalemate") {
    await postNews(`Tregua: ${w.attackerName} y ${w.defenderName} se retiran`, `Siete días de guerra (${w.attackerScore}-${w.defenderScore}) sin un vencedor claro. Ambos bandos lamen sus heridas.`, "Guerra", undefined, "normal");
    invalidateWorldState();
    return true;
  }
  const islands = await prisma.island.findMany({ select: { id: true, name: true, factionControl: true } });
  const attackerWon = result === "attacker";
  if (kind === "REVOLUTION") {
    if (attackerWon) {
      const occupied = islands.find((i) => (i.factionControl ?? "").startsWith(OCCUPIED));
      const target = occupied ?? pickBySeed(islands.filter((i) => i.factionControl === "Marina" && !OFF_LIMITS.has(i.name)), w.id);
      if (target) {
        await prisma.island.update({ where: { id: target.id }, data: { factionControl: occupied ? "Ejército Revolucionario" : LIBERATED } });
        effects.push(occupied ? `${target.name} vuelve a manos de la Revolución.` : `${target.name} queda liberada del control de la Marina.`);
      }
    } else {
      const liberated = islands.find((i) => i.factionControl === LIBERATED);
      const target = liberated ?? islands.find((i) => isRevolutionBase(i.factionControl) && !OFF_LIMITS.has(i.name));
      if (target) {
        await prisma.island.update({ where: { id: target.id }, data: { factionControl: liberated ? "Marina" : OCCUPIED } });
        effects.push(liberated ? `La Marina recupera ${target.name}.` : `La Marina ocupa ${target.name}, refugio revolucionario.`);
      }
    }
  } else if (kind === "EMPEROR" && w.defenderId) {
    const winnerId = attackerWon ? w.attackerId : w.defenderId;
    const loserId = attackerWon ? w.defenderId : w.attackerId;
    const winnerName = attackerWon ? w.attackerName : w.defenderName;
    const lost = await prisma.territory.findFirst({ where: { ownerActorId: loserId } });
    if (lost) {
      await prisma.territory.update({ where: { id: lost.id }, data: { ownerActorId: winnerId, homeActorId: winnerId, ownerName: winnerName } });
      effects.push(`${islands.find((i) => i.id === lost.islandId)?.name ?? "Uno de sus dominios"} pasa a la bandera de ${winnerName}.`);
    }
  } else {
    const yonkoId = kind === "JUSTICE" ? w.defenderId : w.attackerId;
    const yonkoWon = kind === "JUSTICE" ? !attackerWon : attackerWon;
    const y = yonkoId ? await prisma.worldActor.findUnique({ where: { id: yonkoId } }) : null;
    if (y?.canonBounty) {
      const factor = yonkoWon ? 1.1 : 1;
      if (factor > 1) {
        await prisma.worldActor.update({ where: { id: y.id }, data: { canonBounty: BigInt(Math.round(Number(y.canonBounty) * factor)) } });
        effects.push(`La recompensa de ${y.name} sube un 10%.`);
      }
    }
    if (y && !yonkoWon) {
      await prisma.worldActor.update({ where: { id: y.id }, data: { busyUntil: new Date(now.getTime() + 24 * HOUR), currentFocus: "Reorganiza su flota tras perder la guerra" } });
      effects.push(`${y.name} se retira a reorganizar su flota.`);
    }
  }
  const winner = attackerWon ? w.attackerName : w.defenderName;
  const loser = attackerWon ? w.defenderName : w.attackerName;
  await postNews(`${winner} gana la guerra contra ${loser}`, `${WAR_KIND_LABEL[kind]}: termina ${w.attackerScore}-${w.defenderScore}. ${effects.join(" ")}`.trim(), "Guerra", undefined, "major");
  await prisma.worldClock.update({ where: { id: 1 }, data: { heat: { increment: 10 } } }).catch(() => {});
  invalidateWorldState();
  return true;
}

/** A pirate (or a hunter) chooses a side in a canon war. */
export async function enlistInWar(characterId: string, warId: string, side: WarSide): Promise<void> {
  const w = await prisma.war.findUnique({ where: { id: warId } });
  if (!w || w.status !== "ACTIVE") throw new Error("Esa guerra ya no está en marcha.");
  const map = parse<Record<string, WarSide>>(w.enlistedJson, {});
  map[characterId] = side;
  await prisma.war.update({ where: { id: w.id }, data: { enlistedJson: JSON.stringify(map) } });
}

export async function startCanonWar(now = new Date()): Promise<War | null> {
  const [actors, openWars] = await Promise.all([
    prisma.worldActor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, role: true, factionType: true, seat: true, powerLevel: true, status: true } }),
    prisma.war.findMany({ where: { status: "ACTIVE" } }),
  ]);
  const busy = new Set(openWars.flatMap((w) => [w.attackerId, w.defenderId].filter(Boolean) as string[]));
  // One Revolution war at a time, whoever started it.
  const candidates = canonWarCandidates(actors).filter((c) => !(c.kind === "REVOLUTION" && openWars.some((w) => w.kind === "REVOLUTION")));
  const plan = pickCanonWar(candidates, busy, `war:${Math.floor(now.getTime() / HOUR)}`);
  if (!plan) return null;
  const text = warDeclarationText(plan);
  const war = await prisma.war.create({
    data: {
      kind: plan.kind,
      attackerKind: "canon",
      defenderKind: plan.defender ? "canon" : "player",
      attackerId: plan.attacker.id,
      attackerName: plan.attacker.name,
      defenderId: plan.defender?.id ?? null,
      defenderName: plan.defenderName,
      nextFrontAt: new Date(now.getTime() + 2 * HOUR),
      logJson: JSON.stringify([`${plan.attacker.name} declara la guerra a ${plan.defenderName}.`]),
    },
  });
  await postNews(text.headline, text.body, "Guerra", undefined, "major");
  invalidateWorldState();
  return war;
}

let ticking = false;

/** Fire-and-forget from the world tick: fronts every few hours, endings, and a new canon war every few days. */
export async function tickCanonWars(now = new Date()): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const open = await prisma.war.findMany({ where: { status: "ACTIVE", attackerKind: "canon" } });
    for (const w of open) {
      if (await settleCanonWarIfDone(w.id, now)) continue;
      if (frontDue(w.nextFrontAt, now)) await runFront(w.id, now);
    }
    if (open.length > 0) return;
    const last = await prisma.war.findFirst({ where: { attackerKind: "canon" }, orderBy: { startedAt: "desc" } });
    if (last && now.getTime() - last.startedAt.getTime() < CANON_WAR_GAP_MS) return;
    await startCanonWar(now);
  } catch {
    // the world tick never fails a request
  } finally {
    ticking = false;
  }
}

/** Running wars for the AI's world facts. */
export async function warsSummary(): Promise<string[]> {
  const wars = await prisma.war.findMany({ where: { status: "ACTIVE" }, select: { attackerName: true, defenderName: true, attackerScore: true, defenderScore: true } });
  return wars.map((w) => `guerra abierta: ${w.attackerName} contra ${w.defenderName} (${w.attackerScore}-${w.defenderScore})`);
}

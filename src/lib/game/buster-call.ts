import { prisma } from "../db";
import { BUSTER_DURATION_MS, BUSTER_WAVES, waveEnemy, waveRewards, bombardmentDamage, busterStatusNow } from "../engine/buster-call";
import { postNews, handleDeathCheck } from "./death-resolution";
import { notifyIsland } from "./notify";
import { startJointFight, freePartyMemberIds, getOpenJointFightFor, JointFightError } from "./joint-fight";
import { CharacterStatus, BusterCall } from "@prisma/client";

export class BusterCallError extends Error {}

const parse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

export async function startBusterCall(islandId: string, reason: string): Promise<BusterCall | null> {
  const active = await prisma.busterCall.findFirst({ where: { islandId, status: "ACTIVE" } });
  if (active) return null;
  const island = await prisma.island.findUnique({ where: { id: islandId } });
  if (!island) return null;
  const bc = await prisma.busterCall.create({ data: { islandId, reason, endsAt: new Date(Date.now() + BUSTER_DURATION_MS) } });
  await postNews(
    `¡BUSTER CALL sobre ${island.name}!`,
    `${reason} El Gobierno Mundial ha ordenado el asedio: tres oleadas de buques de guerra se acercan a ${island.name} y, si nadie las detiene, la isla será bombardeada. Quien no quiera arder, que la abandone.`,
    "Gobierno Mundial",
    undefined,
    "major"
  );
  await notifyIsland(islandId, "buster-call");
  return bc;
}

/** Everything still on the island when the fleet opens fire takes a brutal hit, with the ordinary death roll for those it drops. */
async function bombard(bc: BusterCall): Promise<string[]> {
  const island = await prisma.island.findUniqueOrThrow({ where: { id: bc.islandId } });
  const present = await prisma.character.findMany({ where: { currentIslandId: bc.islandId, status: CharacterStatus.ALIVE }, include: { currentIsland: true, companions: true } });
  const newsLog: string[] = [];
  const dead: string[] = [];
  for (const c of present) {
    const hp = c.hp - bombardmentDamage(c.maxHp);
    if (hp <= 0) {
      const d = await handleDeathCheck(c, hp, `Murió bajo el bombardeo de la Buster Call sobre ${island.name}.`, newsLog);
      if (d.died) dead.push(c.name);
      else await prisma.character.update({ where: { id: c.id }, data: { hp: d.finalHp } });
    } else await prisma.character.update({ where: { id: c.id }, data: { hp } });
  }
  const { loseTerritoryToFleet } = await import("./territory");
  await loseTerritoryToFleet(bc.islandId);
  await postNews(
    `${island.name} es bombardeada`,
    `La flota de la Buster Call abrió fuego: ${present.length} personas estaban en la isla${dead.length ? ` y ${dead.join(", ")} no sobrevivió` : ", todas sobrevivieron por poco"}.`,
    "Gobierno Mundial",
    undefined,
    "major"
  );
  await notifyIsland(bc.islandId, "buster-call");
  return dead;
}

/** Applies what the clock decides: a siege that ran out of time falls and bombards. */
export async function refreshBusterCall(bc: BusterCall, now = new Date()): Promise<BusterCall> {
  if (bc.status !== "ACTIVE") return bc;
  const status = busterStatusNow(bc.wavesBroken, bc.endsAt.getTime(), now.getTime());
  if (status === "ACTIVE") return bc;
  const claimed = await prisma.busterCall.updateMany({ where: { id: bc.id, status: "ACTIVE" }, data: { status } });
  if (claimed.count === 0) return prisma.busterCall.findUniqueOrThrow({ where: { id: bc.id } });
  if (status === "FALLEN") await bombard(bc);
  return prisma.busterCall.findUniqueOrThrow({ where: { id: bc.id } });
}

export async function getBusterCallState(characterId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me) return null;
  const raw = await prisma.busterCall.findFirst({ where: { islandId: me.currentIslandId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (!raw) return null;
  const bc = await refreshBusterCall(raw);
  if (bc.status !== "ACTIVE") return null;
  const muster = parse<string[]>(bc.musterJson, []);
  return {
    id: bc.id,
    reason: bc.reason,
    wave: bc.wave,
    waves: BUSTER_WAVES,
    wavesBroken: bc.wavesBroken,
    waveName: waveEnemy(bc.wave, me.currentIsland.dangerLevel).name,
    endsAt: bc.endsAt,
    msLeft: Math.max(0, bc.endsAt.getTime() - Date.now()),
    iAmMustered: muster.includes(me.id),
    musterCount: muster.length,
  };
}

async function requireOnSiegedIsland(characterId: string, userId: string) {
  const me = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!me || me.userId !== userId) throw new BusterCallError("Personaje no encontrado.");
  if (me.status !== CharacterStatus.ALIVE) throw new BusterCallError("No puedes hacer esto en tu estado actual.");
  const raw = await prisma.busterCall.findFirst({ where: { islandId: me.currentIslandId, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  if (!raw) throw new BusterCallError("Esta isla no está bajo asedio.");
  const bc = await refreshBusterCall(raw);
  if (bc.status !== "ACTIVE") throw new BusterCallError("El asedio ya terminó.");
  return { me, bc };
}

export async function musterBusterCall(characterId: string, userId: string, join: boolean) {
  const { me, bc } = await requireOnSiegedIsland(characterId, userId);
  const muster = parse<string[]>(bc.musterJson, []);
  const next = join ? [...new Set([...muster, me.id])].slice(-16) : muster.filter((id) => id !== me.id);
  await prisma.busterCall.update({ where: { id: bc.id }, data: { musterJson: JSON.stringify(next) } });
  await notifyIsland(me.currentIslandId, "buster-call");
  return { log: [join ? "Te sumas a la defensa de la isla." : "Abandonas la línea de defensa."] };
}

export async function defendAgainstWave(characterId: string, userId: string) {
  const { me, bc } = await requireOnSiegedIsland(characterId, userId);
  if (await getOpenJointFightFor(me.id)) throw new BusterCallError("Ya estás metido en una pelea.");
  const muster = parse<string[]>(bc.musterJson, []);
  const candidates = [...new Set([me.id, ...muster, ...(await freePartyMemberIds(me.id))])];
  const here = await prisma.character.findMany({ where: { id: { in: candidates }, currentIslandId: me.currentIslandId, status: CharacterStatus.ALIVE } });
  const ready: string[] = [];
  for (const c of here) if (c.id === me.id || !(await getOpenJointFightFor(c.id))) ready.push(c.id);
  const enemy = waveEnemy(bc.wave, me.currentIsland.dangerLevel);
  try {
    const started = await startJointFight({
      kind: "raid",
      characterIds: ready,
      enemy: { ...enemy, isBoss: true },
      rewards: waveRewards(bc.wave, me.currentIsland.dangerLevel),
      stakes: `Buster Call sobre ${me.currentIsland.name}: oleada ${bc.wave} de ${BUSTER_WAVES}. Si no se detiene la flota, la isla arde.`,
      context: { busterCallId: bc.id, wave: bc.wave },
    });
    return { log: [`Comienza la oleada ${bc.wave}. Todos los defensores describen su movimiento.`], fightId: started.fightId };
  } catch (err) {
    if (err instanceof JointFightError) throw new BusterCallError(err.message);
    throw err;
  }
}

/** Called by joint-fight.ts when a raid-kind fight carrying a busterCallId ends. */
export async function handleBusterWaveSettled(contextJson: string, outcome: "victory" | "defeat" | null): Promise<string[]> {
  const ctx = parse<{ busterCallId?: string }>(contextJson, {});
  if (!ctx.busterCallId) return [];
  const bc = await prisma.busterCall.findUnique({ where: { id: ctx.busterCallId } });
  if (!bc || bc.status !== "ACTIVE") return [];
  const island = await prisma.island.findUniqueOrThrow({ where: { id: bc.islandId } });
  if (outcome !== "victory") return ["La oleada os hace retroceder: la flota sigue avanzando y el tiempo corre."];
  const wavesBroken = bc.wavesBroken + 1;
  if (wavesBroken >= BUSTER_WAVES) {
    await prisma.busterCall.update({ where: { id: bc.id }, data: { status: "REPELLED", wavesBroken } });
    await postNews(`${island.name} rechaza la Buster Call`, `Contra todo pronóstico, los defensores de ${island.name} hundieron las tres oleadas de la flota del Gobierno Mundial. Una hazaña que nadie olvidará.`, "Guerra", undefined, "major");
    await notifyIsland(bc.islandId, "buster-call");
    return ["¡La última oleada se hunde! La Buster Call ha sido repelida."];
  }
  await prisma.busterCall.update({ where: { id: bc.id }, data: { wavesBroken, wave: bc.wave + 1 } });
  await notifyIsland(bc.islandId, "buster-call");
  return [`Oleada ${bc.wave} hundida. Se acerca la siguiente: ${waveEnemy(bc.wave + 1, island.dangerLevel).name}.`];
}

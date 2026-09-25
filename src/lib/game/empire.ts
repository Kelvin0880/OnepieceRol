import { CharacterStatus } from "@prisma/client";
import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { companionSheet, parseCompanionProfile } from "../engine/companions";
import { incomeAccrued, GARRISON_MAX } from "../engine/territory";
import { ERRAND_INFO, ERRAND_KINDS, ErrandKind, errandDone, garrisonLabel, msUntilFall, readErrand, resolveErrand, troopCount, writeErrand } from "../engine/empire";
import { refreshTerritory } from "./territory";
import { grantXp } from "./xp";
import { notifyCharacters } from "../realtime";

export class EmpireError extends Error {}

interface Domain {
  islandId: string;
  islandName: string;
  title: string;
  garrison: number;
  garrisonLabel: string;
  troops: number;
  msUntilFall: number;
  pendingIncome: number | null;
  isOwner: boolean;
  here: boolean;
}

const REPORT_KIND = "errand";

/** Pays out every finished errand of this character's nakamas. Compare-and-swap on the stored profile keeps a double poll from paying twice. */
export async function settleErrands(characterId: string): Promise<string[]> {
  const rows = await prisma.nPCCompanion.findMany({ where: { characterId, status: CharacterStatus.ALIVE, profileJson: { contains: "errand" } } });
  const due = rows.filter((n) => {
    const e = readErrand(n.profileJson);
    return e && errandDone(e, Date.now());
  });
  if (due.length === 0) return [];
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { currentIsland: true } });
  if (!c) return [];
  const lines: string[] = [];
  for (const n of due) {
    const e = readErrand(n.profileJson)!;
    const claimed = await prisma.nPCCompanion.updateMany({ where: { id: n.id, profileJson: n.profileJson }, data: { profileJson: writeErrand(n.profileJson, null) } });
    if (claimed.count === 0) continue;

    const target = e.islandId ? await prisma.island.findUnique({ where: { id: e.islandId } }) : null;
    const danger = target?.dangerLevel ?? c.currentIsland.dangerLevel;
    const sheet = companionSheet(n.role, c.level, n.loyalty, parseCompanionProfile(n.profileJson));
    const out = resolveErrand(liveRng(), e.kind, sheet.atk + sheet.def + sheet.spd, danger);
    let line: string;
    if (!out.success) {
      const hp = Math.max(1, n.hp - Math.round(n.maxHp * out.hpLossFraction));
      await prisma.nPCCompanion.update({ where: { id: n.id }, data: { hp } });
      line = `${n.name} vuelve de «${ERRAND_INFO[e.kind].label}» con las manos vacías y malherido: la misión se torció.`;
    } else if (e.kind === "patrol") {
      const t = e.islandId ? await prisma.territory.findUnique({ where: { islandId: e.islandId } }) : null;
      const held = t && t.ownerCharacterId;
      if (held) await prisma.territory.update({ where: { id: t.id }, data: { garrison: Math.min(GARRISON_MAX, t.garrison + out.garrisonGain) } });
      line = held ? `${n.name} vuelve de patrullar ${target?.name ?? "el dominio"}: la guarnición sube +${out.garrisonGain}.` : `${n.name} vuelve de patrullar, pero el dominio ya no era tuyo.`;
    } else if (e.kind === "tribute") {
      await prisma.character.update({ where: { id: characterId }, data: { berries: { increment: out.berries } } });
      line = `${n.name} vuelve con ฿ ${out.berries.toLocaleString("es-ES")} en tributos de los puertos aliados.`;
    } else {
      const fresh = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
      const gained = await grantXp(fresh.experience, fresh.level, out.xp);
      await prisma.character.update({ where: { id: characterId }, data: { experience: gained.xp, level: gained.level } });
      line = `${n.name} vuelve de explorar el mar con rumores y rutas: +${out.xp} XP para ti.`;
    }
    await prisma.gameLogEntry.create({ data: { characterId, kind: REPORT_KIND, text: line } });
    lines.push(line);
  }
  if (lines.length) notifyCharacters([characterId], "errand");
  return lines;
}

export async function getEmpire(characterId: string) {
  await settleErrands(characterId);
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { companions: { orderBy: { joinedAt: "asc" } }, crew: true } });
  if (!c) return null;

  const owned = await prisma.territory.findMany({ where: { OR: [{ ownerCharacterId: c.id }, ...(c.crewId ? [{ ownerCrewId: c.crewId }] : [])] } });
  const domains: Domain[] = [];
  for (const raw of owned) {
    const t = await refreshTerritory(raw);
    if (!t.ownerCharacterId) continue; // lost while refreshing
    const island = await prisma.island.findUnique({ where: { id: t.islandId } });
    if (!island) continue;
    const mine = t.ownerCharacterId === c.id;
    domains.push({
      islandId: island.id,
      islandName: island.name,
      title: t.title,
      garrison: t.garrison,
      garrisonLabel: garrisonLabel(t.garrison),
      troops: troopCount(t.garrison, island.dangerLevel),
      msUntilFall: msUntilFall(t.garrison, t.lastPressureAt.getTime(), Date.now()),
      pendingIncome: mine ? incomeAccrued(island.dangerLevel, Date.now() - t.lastIncomeAt.getTime()) : null,
      isOwner: mine,
      here: island.id === c.currentIslandId,
    });
  }

  const commanders = c.companions
    .filter((n) => n.status === CharacterStatus.ALIVE)
    .map((n) => {
      const sheet = companionSheet(n.role, c.level, n.loyalty, parseCompanionProfile(n.profileJson));
      const e = readErrand(n.profileJson);
      return {
        id: n.id,
        name: n.name,
        role: n.role,
        epithet: sheet.epithet ?? null,
        hp: n.hp,
        maxHp: n.maxHp,
        power: sheet.atk + sheet.def + sheet.spd,
        errand: e ? { kind: e.kind, label: ERRAND_INFO[e.kind].label, msLeft: Math.max(0, e.endsAt - Date.now()), islandName: domains.find((d) => d.islandId === e.islandId)?.islandName ?? null } : null,
      };
    });

  const reports = await prisma.gameLogEntry.findMany({ where: { characterId, kind: REPORT_KIND }, orderBy: { createdAt: "desc" }, take: 5 });
  return {
    domains,
    commanders,
    errands: ERRAND_KINDS.map((k) => ({ kind: k, ...ERRAND_INFO[k] })),
    reports: reports.map((r) => ({ text: r.text, at: r.createdAt })),
    crewName: c.crew?.name ?? null,
  };
}

export async function sendOnErrand(characterId: string, userId: string, companionId: string, kind: ErrandKind, islandId?: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, include: { companions: true } });
  if (!c || c.userId !== userId) throw new EmpireError("Personaje no encontrado.");
  if (c.status !== CharacterStatus.ALIVE) throw new EmpireError("No puedes dar órdenes en tu estado actual.");
  await settleErrands(characterId);
  const n = await prisma.nPCCompanion.findFirst({ where: { id: companionId, characterId } });
  if (!n || n.status !== CharacterStatus.ALIVE) throw new EmpireError("Ese nakama no está disponible.");
  if (readErrand(n.profileJson)) throw new EmpireError(`${n.name} ya está en una misión.`);
  if (n.hp / n.maxHp <= 0.5) throw new EmpireError(`${n.name} está demasiado herido para salir.`);

  if (kind === "patrol") {
    if (!islandId) throw new EmpireError("Elige qué dominio patrullar.");
    const t = await prisma.territory.findUnique({ where: { islandId } });
    if (!t || t.ownerCharacterId !== c.id) throw new EmpireError("Solo puedes patrullar un dominio que sostienes tú.");
    if (t.garrison >= GARRISON_MAX) throw new EmpireError("Esa guarnición ya está al máximo.");
  }
  const now = Date.now();
  const errand = { kind, startedAt: now, endsAt: now + ERRAND_INFO[kind].durationMs, islandId: kind === "patrol" ? islandId : undefined };
  const claimed = await prisma.nPCCompanion.updateMany({ where: { id: n.id, profileJson: n.profileJson }, data: { profileJson: writeErrand(n.profileJson, errand) } });
  if (claimed.count === 0) throw new EmpireError(`${n.name} ya está en una misión.`);
  notifyCharacters([characterId], "errand");
  return { log: [`${n.name} sale a «${ERRAND_INFO[kind].label}». Volverá en ${Math.round(ERRAND_INFO[kind].durationMs / 60000)} min.`] };
}

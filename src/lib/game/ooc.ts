import { prisma } from "../db";
import { CharacterStatus } from "@prisma/client";
import {
  AUTO_CHECKPOINT_MIN_GAP_MS,
  MAX_AUTO_CHECKPOINTS,
  MAX_ROLLBACKS_PER_DAY,
  CharacterSnapshot,
  NarratorTone,
  canRollback,
  checkpointLabel,
  gearSignature,
  diffSnapshot,
  planRepair,
  planRollback,
  validateCharacterName,
} from "../engine/ooc";
import { OocProposal, appendNote } from "../ai/ooc-prompt";
import { askOocAssistant } from "../ai/ooc";
import { getOpenDuelFor } from "./duel";
import { getOpenJointFightFor } from "./joint-fight";
import { notifyCharacters } from "../realtime";
import { notifyParty } from "./notify";
import { maybeCompactCharacterScene } from "./scene-compaction";

export class OocError extends Error {}

const MAX_MANUAL_CHECKPOINTS = 10;

async function loadOwned(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({
    where: { id: characterId },
    include: { currentIsland: true, pendingEncounter: true, crew: true, companions: true, _count: { select: { inventory: true } } },
  });
  if (!c || c.userId !== userId) throw new OocError("Personaje no encontrado.");
  return c;
}

type Owned = Awaited<ReturnType<typeof loadOwned>>;

function snapshotOf(c: Owned, missions: { id: string; progress: number; status: string }[] = []): CharacterSnapshot {
  return {
    level: c.level, experience: c.experience, hp: c.hp, maxHp: c.maxHp, stamina: c.stamina, maxStamina: c.maxStamina,
    berries: c.berries, bounty: c.bounty, notoriety: c.notoriety,
    strength: c.strength, agility: c.agility, durability: c.durability, willpower: c.willpower, intellect: c.intellect,
    observationHaki: c.observationHaki, armamentHaki: c.armamentHaki, currentIslandId: c.currentIslandId,
    memorySummary: c.memorySummary ?? null,
    sceneCompactedUntil: c.sceneCompactedUntil ? c.sceneCompactedUntil.toISOString() : null,
    missions,
    companions: c.companions.map((n) => ({ id: n.id, hp: n.hp, status: n.status })),
    gearSignature: gearSignature({ weaponId: c.equippedWeaponId, fruitId: c.devilFruitId, inventoryCount: c._count.inventory }),
  };
}

async function missionState(characterId: string) {
  return (await prisma.mission.findMany({ where: { characterId }, select: { id: true, progress: true, status: true } })).map((m) => ({ id: m.id, progress: m.progress, status: m.status }));
}

// ---------- restore points ----------

export async function createCheckpoint(characterId: string, userId: string, kind: "auto" | "manual", reason: string) {
  const c = await loadOwned(characterId, userId);
  if (c.status !== CharacterStatus.ALIVE) throw new OocError("Solo un personaje vivo puede guardar un punto de restauración.");
  if (kind === "manual") {
    const manual = await prisma.checkpoint.count({ where: { characterId, kind: "manual" } });
    if (manual >= MAX_MANUAL_CHECKPOINTS) throw new OocError(`Ya tienes ${MAX_MANUAL_CHECKPOINTS} puntos manuales; borra alguno antes.`);
  }
  const row = await prisma.checkpoint.create({ data: { characterId, kind, label: checkpointLabel(kind, reason), snapshotJson: JSON.stringify(snapshotOf(c, await missionState(characterId))) } });
  if (kind === "auto") {
    const autos = await prisma.checkpoint.findMany({ where: { characterId, kind: "auto" }, orderBy: { createdAt: "desc" }, select: { id: true }, skip: MAX_AUTO_CHECKPOINTS });
    if (autos.length) await prisma.checkpoint.deleteMany({ where: { id: { in: autos.map((a) => a.id) } } });
  }
  return row;
}

/** Best-effort, throttled: called on every action, cheap when nothing is due, never fails the action. */
export async function maybeAutoCheckpoint(characterId: string, userId: string, reason: string, force = false): Promise<void> {
  try {
    if (!force) {
      const last = await prisma.checkpoint.findFirst({ where: { characterId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      if (last && Date.now() - last.createdAt.getTime() < AUTO_CHECKPOINT_MIN_GAP_MS) return;
    }
    await createCheckpoint(characterId, userId, "auto", reason);
  } catch {
    // a missing restore point must never break a game action
  }
}

export async function deleteCheckpoint(characterId: string, userId: string, checkpointId: string) {
  await loadOwned(characterId, userId);
  const r = await prisma.checkpoint.deleteMany({ where: { id: checkpointId, characterId } });
  if (r.count === 0) throw new OocError("Ese punto de restauración no existe.");
}

async function rollbacksLast24h(characterId: string) {
  return prisma.oocReport.count({ where: { characterId, kind: "rollback", createdAt: { gt: new Date(Date.now() - 24 * 3600 * 1000) } } });
}

async function resolveRollbackTarget(characterId: string, userId: string, checkpointId?: string) {
  const c = await loadOwned(characterId, userId);
  const [duel, joint, used] = await Promise.all([getOpenDuelFor(characterId), getOpenJointFightFor(characterId), rollbacksLast24h(characterId)]);
  const verdict = canRollback({
    dead: c.status === CharacterStatus.DEAD,
    imprisoned: c.status === CharacterStatus.IMPRISONED,
    inDuelOrJointFight: duel?.status === "ACTIVE" || !!joint,
    rollbacksLast24h: used,
  });
  if (!verdict.ok) throw new OocError(verdict.reason);
  const cp = checkpointId
    ? await prisma.checkpoint.findFirst({ where: { id: checkpointId, characterId } })
    : await prisma.checkpoint.findFirst({ where: { characterId }, orderBy: { createdAt: "desc" } });
  if (!cp) throw new OocError("No hay ningún punto de restauración al que volver.");
  const snap = JSON.parse(cp.snapshotJson) as CharacterSnapshot;
  const signature = gearSignature({ weaponId: c.equippedWeaponId, fruitId: c.devilFruitId, inventoryCount: c._count.inventory });
  return { c, cp, snap, used, plan: planRollback(snap, signature, c.berries) };
}

/** Everything a rollback would erase, counted, so the player sees the cost BEFORE confirming. Changes nothing. */
export async function previewRollback(characterId: string, userId: string, checkpointId?: string) {
  const { c, cp, snap, plan } = await resolveRollbackTarget(characterId, userId, checkpointId);
  const after = { characterId, createdAt: { gt: cp.createdAt } };
  const [scene, logs, news, laterCompanions, snapIsland] = await Promise.all([
    prisma.sceneMessage.count({ where: after }),
    prisma.gameLogEntry.count({ where: after }),
    prisma.newsItem.count({ where: after }),
    prisma.nPCCompanion.count({ where: { characterId, joinedAt: { gt: cp.createdAt } } }),
    prisma.island.findUnique({ where: { id: snap.currentIslandId }, select: { name: true } }),
  ]);
  const changes = diffSnapshot(snap, { ...snapshotOf(c), berries: c.berries }, { snapshot: snapIsland?.name ?? c.currentIsland.name, current: c.currentIsland.name }, plan.berriesRestored);
  return {
    label: cp.label,
    createdAt: cp.createdAt.toISOString(),
    willDelete: { sceneMessages: scene, logEntries: logs, newsItems: news, recruitedNakamas: laterCompanions, pendingFight: !!c.pendingEncounter },
    changes,
    berriesKept: !plan.berriesRestored,
    aiForgets: "El narrador olvidará todo lo ocurrido después de ese punto: solo recordará la historia hasta ahí. No se puede deshacer.",
  };
}

export async function rollbackToCheckpoint(characterId: string, userId: string, checkpointId?: string) {
  const { cp, snap, used, plan } = await resolveRollbackTarget(characterId, userId, checkpointId);
  const island = await prisma.island.findUnique({ where: { id: snap.currentIslandId }, select: { id: true } });
  if (!island) plan.data.currentIslandId = (await prisma.character.findUniqueOrThrow({ where: { id: characterId }, select: { currentIslandId: true } })).currentIslandId;

  // Old snapshots did not carry the narrator memory: forgetting is always safer than remembering a timeline that never happened.
  const memory = snap.memorySummary === undefined ? null : snap.memorySummary;
  const compactedUntil = snap.sceneCompactedUntil ? new Date(snap.sceneCompactedUntil) : null;
  const after = { characterId, createdAt: { gt: cp.createdAt } };

  await prisma.$transaction([
    prisma.character.update({
      where: { id: characterId },
      data: { ...plan.data, staminaUpdatedAt: new Date(), memorySummary: memory, sceneCompactedUntil: compactedUntil, sceneClearedAt: null, timelineEpoch: { increment: 1 } },
    }),
    prisma.pendingEncounter.deleteMany({ where: { characterId } }),
    prisma.sceneMessage.deleteMany({ where: after }),
    prisma.gameLogEntry.deleteMany({ where: after }),
    prisma.bountyLogEntry.deleteMany({ where: after }),
    prisma.newsItem.deleteMany({ where: { ...after, arcId: null } }),
    prisma.checkpoint.deleteMany({ where: { characterId, createdAt: { gt: cp.createdAt } } }),
    prisma.oocReport.create({ data: { characterId, kind: "rollback", text: `Volvió a «${cp.label}» (${cp.createdAt.toISOString()})`, contextJson: JSON.stringify({ berriesRestored: plan.berriesRestored }) } }),
    prisma.gameLogEntry.create({ data: { characterId, kind: "ooc", text: `Vuelves al punto «${cp.label}». Todo lo posterior se borró de tu historia y el narrador ya no lo recuerda.` } }),
  ]);

  // Companions: those recruited after the point never existed on this timeline; the rest return to their state then.
  await prisma.nPCCompanion.deleteMany({ where: { characterId, joinedAt: { gt: cp.createdAt } } });
  for (const n of snap.companions ?? []) {
    await prisma.nPCCompanion.updateMany({ where: { id: n.id, characterId }, data: { hp: n.hp, status: n.status as CharacterStatus, ...(n.status === "ALIVE" ? { deathCause: null, diedAt: null } : {}) } });
  }
  // Missions: same idea. Progress and completion go back to how they were.
  for (const m of snap.missions ?? []) await prisma.mission.updateMany({ where: { id: m.id, characterId }, data: { progress: m.progress, status: m.status } });
  await prisma.mission.deleteMany({ where: { characterId, createdAt: { gt: cp.createdAt } } });

  notifyCharacters([characterId], "ooc");
  return {
    message:
      `Volviste a «${cp.label}». Todo lo posterior se borró y el narrador lo olvidó: la historia continúa desde ahí.` +
      (plan.berriesRestored ? "" : " Tus berries actuales se conservaron porque tu equipo cambió desde entonces (no hay reembolsos)."),
    rollbacksLeft: MAX_ROLLBACKS_PER_DAY - used - 1,
  };
}

// ---------- small fixes ----------

export async function repairCharacter(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  if (c.status === CharacterStatus.DEAD) throw new OocError("Un personaje muerto no se repara: la muerte es permanente.");
  const plan = planRepair(c);
  const notes = [...plan.notes];
  const data: Record<string, unknown> = { ...plan.changes };
  // A stuck party turn lock or dangling party pointer is the other classic "the AI stopped answering".
  if (c.partyId) {
    const party = await prisma.party.findUnique({ where: { id: c.partyId } });
    if (!party) {
      data.partyId = null;
      notes.push("escena compartida que ya no existe");
    } else if (party.awaitingNarrator && Date.now() - party.updatedAt.getTime() > 3 * 60 * 1000) {
      await prisma.party.update({ where: { id: party.id }, data: { awaitingNarrator: false } });
      notes.push("turno de escena compartida atascado");
      notifyParty(party.id);
    }
  }
  if (c.pendingEncounter && !c.pendingEncounter.enemyJson) {
    await prisma.pendingEncounter.delete({ where: { characterId } });
    notes.push("encuentro sin enemigo");
  }
  if (Object.keys(data).length) await prisma.character.update({ where: { id: characterId }, data });
  await prisma.oocReport.create({ data: { characterId, kind: "repair", text: notes.length ? notes.join(", ") : "sin cambios" } });
  notifyCharacters([characterId], "ooc");
  return { message: notes.length ? `Reparado: ${notes.join(", ")}.` : "Todo estaba en orden: no encontré nada que reparar." };
}

export async function undoLastExchange(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  if (c.status !== CharacterStatus.ALIVE) throw new OocError("Este personaje ya no puede actuar.");
  if (c.pendingEncounter) throw new OocError("Hay una pelea en curso: no se puede borrar un intercambio que ya se juzgó. Usa un punto de restauración si hace falta.");
  if (c.partyId && !c.isSeparatedFromParty) throw new OocError("En escena compartida no se puede deshacer: otros jugadores ya la están leyendo.");
  const last = await prisma.sceneMessage.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: 8 });
  const narrator = last.find((m) => m.role === "narrator");
  if (!narrator) throw new OocError("No hay ninguna respuesta del narrador que deshacer.");
  if (narrator.text.startsWith("(interpretado como:") && !/^\(interpretado como: (Narrar|Explorar)\)/.test(narrator.text)) {
    throw new OocError("Esa respuesta tuvo efectos de juego (combate, entrenamiento, etc.) y no se puede borrar sin un rollback.");
  }
  if (/^\(interpretado como: Explorar\)/.test(narrator.text)) throw new OocError("Explorar pudo mover berries, vida o experiencia: para eso usa un punto de restauración.");
  const player = last.find((m) => m.role === "player" && m.createdAt <= narrator.createdAt);
  await prisma.sceneMessage.deleteMany({ where: { id: { in: [narrator.id, ...(player ? [player.id] : [])] } } });
  await prisma.oocReport.create({ data: { characterId, kind: "undo", text: "Deshizo el último intercambio de la escena" } });
  notifyCharacters([characterId], "ooc");
  return { message: "Borré la última respuesta del narrador. Tu mensaje vuelve a la caja para que lo reescribas.", restoredText: player?.text ?? null };
}

/** Fresh screen and fresh short-term context; the long-term summary of the story stays, and what was not yet summarised is folded into it in the background. */
export async function clearScene(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  if (c.pendingEncounter) throw new OocError("Hay una pelea en curso: termínala antes de limpiar la escena.");
  if (c.partyId && !c.isSeparatedFromParty) throw new OocError("En escena compartida no se puede limpiar: otros jugadores la están leyendo.");
  void maybeCompactCharacterScene(characterId, { force: true });
  await prisma.character.update({ where: { id: characterId }, data: { sceneClearedAt: new Date() } });
  await prisma.oocReport.create({ data: { characterId, kind: "undo", text: "Limpió la escena" } });
  notifyCharacters([characterId], "ooc");
  return { message: "Escena limpia. El narrador conserva el resumen de tu historia pero empieza sin el chat reciente: escribe lo que haces ahora." };
}

export async function renameCharacter(characterId: string, userId: string, rawName: string) {
  const c = await loadOwned(characterId, userId);
  if (c.status === CharacterStatus.DEAD) throw new OocError("Un personaje muerto ya no puede cambiar de nombre.");
  const v = validateCharacterName(rawName);
  if (!v.ok) throw new OocError(v.reason);
  if (v.name === c.name) throw new OocError("Ese ya es su nombre.");
  await prisma.character.update({ where: { id: characterId }, data: { name: v.name } });
  await prisma.oocReport.create({ data: { characterId, kind: "rename", text: `${c.name} → ${v.name}` } });
  await prisma.gameLogEntry.create({ data: { characterId, kind: "ooc", text: `A partir de ahora se te conoce como ${v.name}.` } });
  if (c.partyId) notifyParty(c.partyId);
  notifyCharacters([characterId], "ooc");
  return { message: `Ahora tu personaje se llama ${v.name}. Las noticias antiguas conservan el nombre anterior.` };
}

export async function renameCrew(characterId: string, userId: string, rawName: string) {
  const c = await loadOwned(characterId, userId);
  if (!c.crew) throw new OocError("No tienes tripulación.");
  if (!c.isCaptain) throw new OocError("Solo el capitán puede renombrar la tripulación.");
  const v = validateCharacterName(rawName);
  if (!v.ok) throw new OocError(v.reason);
  const clash = await prisma.crew.findFirst({ where: { name: v.name, NOT: { id: c.crew.id } } });
  if (clash) throw new OocError("Ya existe una tripulación con ese nombre.");
  await prisma.crew.update({ where: { id: c.crew.id }, data: { name: v.name } });
  await prisma.oocReport.create({ data: { characterId, kind: "rename", text: `Tripulación: ${c.crew.name} → ${v.name}` } });
  const members = await prisma.character.findMany({ where: { crewId: c.crew.id }, select: { id: true } });
  notifyCharacters(members.map((m) => m.id), "ooc");
  return { message: `La tripulación ahora se llama ${v.name}.` };
}

export async function setNarratorTone(characterId: string, userId: string, tone: NarratorTone) {
  await loadOwned(characterId, userId);
  await prisma.character.update({ where: { id: characterId }, data: { narratorTone: tone } });
  await prisma.oocReport.create({ data: { characterId, kind: "tone", text: tone } });
  const label = tone === "lethal" ? "letal" : tone === "story" ? "historia" : "equilibrado";
  return { message: `Tono del narrador: ${label}. Solo cambia cómo actúan y hablan los enemigos; el resultado lo sigue juzgando el árbitro.` };
}

export async function addNarratorNote(characterId: string, userId: string, note: string) {
  const c = await loadOwned(characterId, userId);
  await prisma.character.update({ where: { id: characterId }, data: { oocNotes: appendNote(c.oocNotes, note) } });
  return { message: "Guardado: el narrador lo tendrá en cuenta desde ahora." };
}

export async function clearNarratorNotes(characterId: string, userId: string) {
  await loadOwned(characterId, userId);
  await prisma.character.update({ where: { id: characterId }, data: { oocNotes: null } });
  return { message: "Borré tus indicaciones para el narrador." };
}

export async function reportProblem(characterId: string, userId: string, text: string) {
  const c = await loadOwned(characterId, userId);
  const scene = await prisma.sceneMessage.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: 6 });
  await prisma.oocReport.create({
    data: {
      characterId,
      kind: "report",
      text: text.slice(0, 1000),
      contextJson: JSON.stringify({
        snapshot: snapshotOf(c),
        island: c.currentIsland.name,
        pendingEncounter: c.pendingEncounter ? { phase: c.pendingEncounter.phase, enemyHp: c.pendingEncounter.enemyHp, round: c.pendingEncounter.roundNumber } : null,
        lastScene: scene.reverse().map((m) => `${m.role}: ${m.text.slice(0, 300)}`),
      }),
    },
  });
  return { message: "Reporte enviado con el estado de tu personaje y las últimas líneas de la escena. Gracias." };
}

export async function setScenePact(characterId: string, userId: string, text: string) {
  const c = await loadOwned(characterId, userId);
  if (c.partyId && !c.isSeparatedFromParty) {
    await prisma.party.update({ where: { id: c.partyId }, data: { scenePact: text } });
    await prisma.partySceneMessage.create({ data: { partyId: c.partyId, authorCharacterId: null, authorName: "Fuera de rol", text: `${c.name} propuso un pacto de escena: «${text}». El narrador lo montará dentro del rol.` } });
    notifyParty(c.partyId);
    return { message: "Pacto guardado para todo el grupo. El narrador lo organizará en la historia." };
  }
  await prisma.character.update({ where: { id: characterId }, data: { oocNotes: appendNote(c.oocNotes, `PACTO DE ESCENA: ${text}`) } });
  return { message: "Pacto guardado como indicación para tu narrador (no estás en escena compartida)." };
}

export async function clearScenePact(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  if (c.partyId) {
    await prisma.party.update({ where: { id: c.partyId }, data: { scenePact: null } });
    notifyParty(c.partyId);
  }
  return { message: "Pacto de escena borrado." };
}

/** The single entry point every confirmed proposal (AI-suggested or a manual button) goes through, re-validated here. */
export async function applyOocAction(characterId: string, userId: string, action: OocProposal): Promise<{ message: string; restoredText?: string | null }> {
  switch (action.type) {
    case "rename": return renameCharacter(characterId, userId, action.name);
    case "rename_crew": return renameCrew(characterId, userId, action.name);
    case "undo_last": return undoLastExchange(characterId, userId);
    case "clear_scene": return clearScene(characterId, userId);
    case "rollback": return rollbackToCheckpoint(characterId, userId);
    case "repair": return repairCharacter(characterId, userId);
    case "set_tone": return setNarratorTone(characterId, userId, action.tone);
    case "add_note": return addNarratorNote(characterId, userId, action.note);
    case "clear_notes": return clearNarratorNotes(characterId, userId);
    case "report": return reportProblem(characterId, userId, action.text);
    case "set_pact": return setScenePact(characterId, userId, action.text);
    case "clear_pact": return clearScenePact(characterId, userId);
  }
}

// ---------- overview + chat ----------

export async function getOocOverview(characterId: string, userId: string) {
  const c = await loadOwned(characterId, userId);
  const [checkpoints, used, party] = await Promise.all([
    prisma.checkpoint.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: 20 }),
    rollbacksLast24h(characterId),
    c.partyId ? prisma.party.findUnique({ where: { id: c.partyId }, select: { scenePact: true } }) : null,
  ]);
  return {
    tone: c.narratorTone,
    notes: c.oocNotes,
    pact: party?.scenePact ?? null,
    isCaptain: c.isCaptain,
    crewName: c.crew?.name ?? null,
    rollbacksLeft: Math.max(0, MAX_ROLLBACKS_PER_DAY - used),
    checkpoints: checkpoints.map((k) => ({ id: k.id, kind: k.kind, label: k.label, createdAt: k.createdAt.toISOString() })),
  };
}

/**
 * The out-of-role chat is deliberately ephemeral: the client keeps the few last turns in memory and
 * sends them along; nothing is stored, so closing the panel wipes it and no tokens are spent re-reading old chats.
 */
export async function oocChat(characterId: string, userId: string, text: string, history: { role: "player" | "assistant"; text: string }[] = []) {
  const c = await loadOwned(characterId, userId);
  const [scene, cpCount, used, party] = await Promise.all([
    prisma.sceneMessage.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.checkpoint.count({ where: { characterId } }),
    rollbacksLast24h(characterId),
    c.partyId ? prisma.party.findUnique({ where: { id: c.partyId }, select: { scenePact: true } }) : null,
  ]);
  return askOocAssistant(
    {
      characterName: c.name, faction: c.faction, level: c.level, hp: c.hp, maxHp: c.maxHp, stamina: c.stamina, maxStamina: c.maxStamina,
      islandName: c.currentIsland.name, status: c.status, tone: c.narratorTone, notes: c.oocNotes,
      crewName: c.crew?.name, isCaptain: c.isCaptain, inParty: !!c.partyId && !c.isSeparatedFromParty, partyPact: party?.scenePact,
      hasPendingFight: !!c.pendingEncounter, checkpoints: cpCount, rollbacksLeft: Math.max(0, MAX_ROLLBACKS_PER_DAY - used),
      memorySummary: c.memorySummary,
      recentScene: scene.reverse().map((m) => `${m.role === "player" ? "[Jugador]" : "[Narrador]"}: ${m.text.slice(0, 260)}`),
      history: history.slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 400) })),
    },
    text,
    { characterId }
  );
}

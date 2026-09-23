import { prisma } from "../db";
import { liveRng } from "../engine/rng";
import { attemptPrisonRescue, rescueSucceeded } from "../engine/rescue";
import { combatPower } from "../engine/encounter";
import { computeBailBerries, isBailAllowed } from "../engine/economy";
import { impelDownCell, impelDownRescueLevel, CELL_LABELS, IMPEL_FAILED_RESCUE_HP_FRACTION } from "../engine/impel-down";
import { toCombatant } from "./derive";
import { postNews } from "./death-resolution";
import { attemptEscape, applyEscapeResult, escapeDifficulty, escapeModifier, escapeCooldownLeftMs, levelsToEscape, ESCAPE_COOLDOWN_MS, BRIG_LOCKDOWN_MS, CAUGHT_HP_FRACTION } from "../engine/escape";
import { rollBusterCall } from "../engine/buster-call";
import { classifyPlayerAction } from "../ai/classify-action";
import { narrateExplore } from "../ai/narrate";
import { applyBountyOrNotoriety } from "./reputation";
import { startBusterCall } from "./buster-call";
import { CharacterStatus } from "@prisma/client";

export class PrisonError extends Error {}

export async function captureCharacter(
  character: {
    id: string;
    name: string;
    maxHp: number;
    currentIslandId: string;
    currentIsland: { name: string; dangerLevel: number };
    level: number;
    devilFruitId?: string | null;
    faction?: string;
    bounty?: number;
    notoriety?: number;
  },
  capturedByPower: number,
  reason: string,
  newsLog: string[]
) {
  const hasDevilFruit = !!character.devilFruitId;
  const cell = impelDownCell(character.faction ?? "", character.bounty ?? 0, character.notoriety ?? 0);
  const impel = cell > 0 ? await prisma.island.findUnique({ where: { name: "Impel Down" } }) : null;
  const inImpelDown = !!impel;
  const bailAllowed = !inImpelDown && isBailAllowed({ faction: character.faction ?? "", bounty: character.bounty ?? 0, notoriety: character.notoriety ?? 0 });
  // The very wanted are shipped to Impel Down itself: the prisoner is now on
  // that island, so whoever wants them back has to get there first.
  await prisma.character.update({
    where: { id: character.id },
    data: {
      status: CharacterStatus.IMPRISONED,
      hp: Math.max(1, Math.round(character.maxHp * 0.15)),
      ...(impel ? { currentIslandId: impel.id } : {}),
    },
  });
  await prisma.imprisonment.create({
    data: {
      characterId: character.id,
      islandId: impel ? impel.id : character.currentIslandId,
      reason,
      cellLevel: inImpelDown ? cell : 0,
      minRescueLevel: inImpelDown ? impelDownRescueLevel(capturedByPower, cell) : Math.round(capturedByPower),
      bailBerries: bailAllowed ? computeBailBerries(character.currentIsland.dangerLevel, character.level, hasDevilFruit) : null,
    },
  });
  const headline = inImpelDown
    ? `${character.name} es enviado a Impel Down (${CELL_LABELS[cell]})`
    : `${character.name} ha sido capturado en ${character.currentIsland.name}`;
  const kairosekiNote = hasDevilFruit ? " Le colocan grilletes de Kairoseki: su fruta no le servirá de nada mientras siga preso." : "";
  await postNews(
    headline,
    `${reason} ${
      inImpelDown
        ? "Es demasiado peligroso para cualquier fianza: lo trasladan a Impel Down, donde solo un rescate de proporciones épicas lo sacaría."
        : bailAllowed
        ? "Ahora espera tras las rejas: alguien deberá pagar su fianza o venir a rescatarlo."
        : "Es demasiado peligroso para admitir fianza: solo un rescate o una fuga lo sacará de allí."
    }${kairosekiNote}`,
    "Gobierno Mundial",
    character.id,
    "major"
  );
  newsLog.push(headline);
}

async function loadImprisonedOwnedCharacter(characterId: string, userId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: { imprisonment: { include: { island: true } } },
  });
  if (!character || character.userId !== userId) throw new PrisonError("Personaje no encontrado.");
  if (character.status !== CharacterStatus.IMPRISONED || !character.imprisonment) {
    throw new PrisonError("Este personaje no está encarcelado.");
  }
  return character;
}

export async function payBail(characterId: string, userId: string) {
  const character = await loadImprisonedOwnedCharacter(characterId, userId);
  const imprisonment = character.imprisonment!;
  if (imprisonment.bailBerries == null) throw new PrisonError("No se admite fianza para esta captura.");
  if (character.berries < imprisonment.bailBerries) throw new PrisonError("No tienes suficientes berries para la fianza.");

  await prisma.character.update({
    where: { id: character.id },
    data: { status: CharacterStatus.ALIVE, berries: character.berries - imprisonment.bailBerries, hp: Math.max(5, Math.round(character.maxHp * 0.3)) },
  });
  await prisma.imprisonment.update({ where: { id: imprisonment.id }, data: { releasedAt: new Date() } });
  await prisma.imprisonment.delete({ where: { id: imprisonment.id } });

  const log = [`Pagas ${imprisonment.bailBerries.toLocaleString("es-ES")} berries y recuperas tu libertad.`];
  await prisma.gameLogEntry.create({ data: { characterId: character.id, kind: "prison", text: log[0] } });
  return { log };
}

export async function attemptRescue(rescuerCharacterId: string, userId: string, prisonerCharacterId: string) {
  const rescuer = await prisma.character.findUnique({
    where: { id: rescuerCharacterId },
    include: { devilFruit: true, equippedWeapon: true, currentIsland: true },
  });
  if (!rescuer || rescuer.userId !== userId) throw new PrisonError("Personaje no encontrado.");
  if (rescuer.status !== CharacterStatus.ALIVE) throw new PrisonError("Tu personaje no puede intentar un rescate en este estado.");
  if (rescuer.id === prisonerCharacterId) throw new PrisonError("No puedes rescatarte a ti mismo.");

  const prisoner = await prisma.character.findUnique({
    where: { id: prisonerCharacterId },
    include: { imprisonment: true, currentIsland: true },
  });
  if (!prisoner || prisoner.status !== CharacterStatus.IMPRISONED || !prisoner.imprisonment) {
    throw new PrisonError("Ese personaje no está encarcelado.");
  }
  if (prisoner.imprisonment.islandId !== rescuer.currentIslandId) {
    throw new PrisonError("Debes estar en la misma isla que el prisionero para intentar rescatarlo.");
  }

  const rescuerPower = combatPower(toCombatant(rescuer));
  const check = attemptPrisonRescue(liveRng(), rescuerPower, prisoner.imprisonment.minRescueLevel, !!prisoner.devilFruitId);
  const newsLog: string[] = [];

  if (rescueSucceeded(check)) {
    let escapeIsland: { id: string } | null = null;
    if (prisoner.imprisonment.cellLevel > 0) {
      // Freed prisoners are smuggled off the island — they can't be left stranded somewhere their level can't even enter.
      escapeIsland = await prisma.island.findUnique({ where: { name: "Loguetown" } });
    }
    await prisma.character.update({
      where: { id: prisoner.id },
      data: { status: CharacterStatus.ALIVE, hp: Math.max(5, Math.round(prisoner.maxHp * 0.3)), ...(escapeIsland ? { currentIslandId: escapeIsland.id } : {}) },
    });
    await prisma.imprisonment.update({ where: { id: prisoner.imprisonment.id }, data: { rescuedById: rescuer.id, releasedAt: new Date() } });
    await prisma.imprisonment.delete({ where: { id: prisoner.imprisonment.id } });

    const log = [`¡Logras liberar a ${prisoner.name}! Ambos escapan antes de que lleguen refuerzos.`];
    await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
    await prisma.gameLogEntry.create({ data: { characterId: prisoner.id, kind: "prison", text: `${rescuer.name} te rescata de tu celda.` } });
    const headline = `${rescuer.name} libera a ${prisoner.name}`;
    await postNews(headline, `En una fuga audaz en ${rescuer.currentIsland.name}, ${rescuer.name} logró sacar a ${prisoner.name} de su celda.`, "Gobierno Mundial", rescuer.id, "major");
    newsLog.push(headline);
    // Breaking someone out of the deep levels is exactly what the fleet exists for.
    if (prisoner.imprisonment.cellLevel > 0 && rollBusterCall(liveRng(), prisoner.imprisonment.cellLevel)) {
      const bc = await startBusterCall(prisoner.imprisonment.islandId, `El rescate de ${prisoner.name} desde ${CELL_LABELS[prisoner.imprisonment.cellLevel]} ha desatado la furia del Gobierno.`);
      if (bc) log.push("Las sirenas se disparan a vuestra espalda: el Gobierno ha ordenado una Buster Call sobre la isla.");
    }
    return { success: true, log, newsPosted: newsLog };
  }

  if (check.outcome === "critical_fail") {
    await captureCharacter(
      { ...rescuer, level: rescuer.level, currentIsland: rescuer.currentIsland },
      prisoner.imprisonment.minRescueLevel,
      `El intento de rescate de ${prisoner.name} salió terriblemente mal.`,
      newsLog
    );
    const log = [`El rescate fracasa por completo: ${rescuer.name} también es capturado.`];
    await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
    return { success: false, rescuerCaptured: true, log, newsPosted: newsLog };
  }

  if (prisoner.imprisonment.cellLevel > 0) {
    // Impel Down's guards don't let a failed intruder leave unscathed.
    const wound = Math.round(rescuer.maxHp * IMPEL_FAILED_RESCUE_HP_FRACTION);
    await prisma.character.update({ where: { id: rescuer.id }, data: { hp: Math.max(1, rescuer.hp - wound) } });
    const log = [`El intento de rescate fracasa. Los carceleros de Impel Down te hieren gravemente (-${wound} de vida) antes de que logres retirarte.`];
    await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
    return { success: false, rescuerCaptured: false, log, newsPosted: newsLog };
  }

  const log = [`El intento de rescate fracasa. ${rescuer.name} logra retirarse antes de ser descubierto.`];
  await prisma.gameLogEntry.create({ data: { characterId: rescuer.id, kind: "prison", text: log[0] } });
  return { success: false, rescuerCaptured: false, log, newsPosted: newsLog };
}

/**
 * Breaking out from the inside (engine/escape.ts). The prisoner describes a
 * plan; the classifier only judges how clever it is (a bounded roll modifier),
 * the engine rolls, and the AI narrates. A brig is one obstacle, Impel Down one
 * per level. Getting out of a deep cell can bring the Buster Call down on the
 * island — everyone still there pays for it.
 */
export async function attemptPrisonEscape(characterId: string, userId: string, plan: string) {
  const character = await loadImprisonedOwnedCharacter(characterId, userId);
  const jail = character.imprisonment!;
  const full = await prisma.character.findUniqueOrThrow({ where: { id: character.id }, include: { currentIsland: true } });
  const now = new Date();
  const left = escapeCooldownLeftMs(jail.lastEscapeAttemptAt, now);
  if (left > 0) throw new PrisonError(`Los guardias siguen atentos tras tu último intento. Espera ${Math.ceil(left / 60_000)} min antes de volver a intentarlo.`);

  const classified = await classifyPlayerAction(plan, ["sneak"], {});
  const tactic = classified.action === "sneak" ? classified.tacticModifier : 0;
  const state = { progress: jail.escapeProgress, alert: jail.alert, cellLevel: jail.cellLevel };
  const difficulty = escapeDifficulty(jail.cellLevel, jail.minRescueLevel, jail.alert);
  const modifier = escapeModifier({
    agility: full.agility,
    willpower: full.willpower,
    intellect: full.intellect,
    level: full.level,
    tacticModifier: tactic,
    hasDevilFruit: !!full.devilFruitId,
  });
  const result = attemptEscape(liveRng(), modifier, difficulty);
  const step = applyEscapeResult(state, result);
  const newsLog: string[] = [];
  const need = levelsToEscape(jail.cellLevel);
  const where = jail.cellLevel > 0 ? CELL_LABELS[jail.cellLevel] : "la celda";

  const baseNarrative =
    result === "breakthrough"
      ? `Tu plan sale mejor de lo soñado: en un solo movimiento dejas atrás dos niveles de ${where}.`
      : result === "climb"
      ? `Tu plan funciona: consigues ascender un nivel sin que suene la alarma.`
      : result === "setback"
      ? "Tu intento se topa con una ronda inesperada y tienes que volver a tu celda antes de que noten nada, pero los guardias están más alerta."
      : "Te descubren en pleno intento. Los carceleros te reducen a golpes y te arrastran de vuelta.";
  const narrated = await narrateExplore(
    {
      characterName: full.name,
      faction: full.faction,
      level: full.level,
      islandName: full.currentIsland.name,
      islandDescription: full.currentIsland.description,
      outcomeTier: result === "breakthrough" ? "critical_success" : result === "climb" ? "success" : result === "setback" ? "fail" : "critical_fail",
      baseFlavorText: `${full.name} intenta fugarse de ${where}.`,
      baseNarrative,
      berries: 0,
      xp: 0,
      bounty: 0,
      hpLoss: result === "caught" ? Math.round(full.maxHp * CAUGHT_HP_FRACTION) : 0,
      intentText: plan,
    },
    { characterId: full.id }
  );
  const log = [...narrated];

  if (step.free) {
    const escapeIsland = jail.cellLevel > 0 ? await prisma.island.findUnique({ where: { name: "Loguetown" } }) : null;
    await prisma.character.update({
      where: { id: full.id },
      data: { status: CharacterStatus.ALIVE, hp: Math.max(5, Math.round(full.maxHp * 0.3)), ...(escapeIsland ? { currentIslandId: escapeIsland.id } : {}) },
    });
    await prisma.imprisonment.delete({ where: { id: jail.id } });
    const jailbreakPenalty = jail.cellLevel > 0 ? (full.faction === "PIRATE" ? 40_000_000 * jail.cellLevel : 250 * jail.cellLevel) : full.faction === "PIRATE" ? 2_000_000 : 20;
    await applyBountyOrNotoriety(full, jailbreakPenalty, newsLog, "Fuga de prisión");
    log.push(`¡Estás libre! Consigues salir de ${jail.cellLevel > 0 ? "Impel Down" : "la prisión"}${escapeIsland ? " y te pierdes camino de Loguetown" : ""}.`);
    await postNews(
      jail.cellLevel > 0 ? `${full.name} se fuga de Impel Down` : `${full.name} se fuga de prisión`,
      `${full.name} logró salir por su propio pie de ${where}${jail.cellLevel > 0 ? ", algo que el Gobierno Mundial creía imposible" : ""}. La caza vuelve a estar abierta.`,
      "Gobierno Mundial",
      full.id,
      "major"
    );
    if (jail.cellLevel > 0 && rollBusterCall(liveRng(), jail.cellLevel)) {
      const bc = await startBusterCall(jail.islandId, `La fuga de ${full.name} desde ${where} ha sido considerada una amenaza intolerable.`);
      if (bc) log.push("Detrás de ti, las sirenas de Impel Down se disparan: el Gobierno ha ordenado una Buster Call.");
    }
    await prisma.gameLogEntry.create({ data: { characterId: full.id, kind: "prison", text: log.join(" ") } });
    return { success: true, free: true, log, newsPosted: newsLog };
  }

  const patch: { escapeProgress: number; alert: number; cellLevel: number; lastEscapeAttemptAt: Date; minRescueLevel?: number } = {
    escapeProgress: step.state.progress,
    alert: step.state.alert,
    cellLevel: step.state.cellLevel,
    lastEscapeAttemptAt: result === "caught" && jail.cellLevel === 0 ? new Date(now.getTime() + BRIG_LOCKDOWN_MS - ESCAPE_COOLDOWN_MS) : now,
  };
  if (result === "caught") {
    const wound = Math.round(full.maxHp * CAUGHT_HP_FRACTION);
    await prisma.character.update({ where: { id: full.id }, data: { hp: Math.max(1, full.hp - wound) } });
    if (step.state.cellLevel > jail.cellLevel) {
      patch.minRescueLevel = jail.minRescueLevel + 15 + Math.round(jail.minRescueLevel * 0.1);
      log.push(`Te arrastran a un nivel más profundo: ${CELL_LABELS[step.state.cellLevel]}.`);
    } else if (jail.cellLevel === 0) log.push("Te aíslan y refuerzan la vigilancia: tardarás más en poder volver a intentarlo.");
    log.push(`Pierdes ${wound} de vida en la paliza.`);
  } else if (result === "climb" || result === "breakthrough") {
    log.push(`Progreso de fuga: ${step.state.progress}/${need}.`);
  } else log.push(`Los guardias están más alerta (alerta ${step.state.alert}/5).`);
  await prisma.imprisonment.update({ where: { id: jail.id }, data: patch });
  await prisma.gameLogEntry.create({ data: { characterId: full.id, kind: "prison", text: log.join(" ") } });
  return { success: false, free: false, log, newsPosted: newsLog };
}

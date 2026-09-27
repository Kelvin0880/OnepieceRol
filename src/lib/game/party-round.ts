// Shared crew scene in rounds: the narrator opens, every member writes their action, then the narrator answers ALL of them at once.
import { prisma } from "../db";
import { narratePartyScene } from "../ai/narrate";
import { extractCombatMarker } from "../engine/referee";
import { missingMembers, orderedActions, parseRound, roundComplete } from "../engine/party-round";
import { notifyParty } from "./notify";
import { writePartyMessage } from "./party";
import { maybeCompactPartyScene } from "./scene-compaction";

/** The party can dissolve mid-flight (a member left/died while the narrator was answering); losing that race is not an error. */
async function safePartyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
  try {
    await prisma.party.update({ where: { id }, data });
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("Record to update not found")) throw err;
  }
}

export class PartyRoundError extends Error {}

async function memberIdsInOrder(partyId: string, turnOrderJson: string): Promise<{ id: string; name: string; faction: string; level: number }[]> {
  const members = await prisma.character.findMany({ where: { partyId }, select: { id: true, name: true, faction: true, level: true } });
  const order = JSON.parse(turnOrderJson) as string[];
  return [...members].sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
}

/**
 * Read-only: whose turn it is right now — the narrator opens (or answers), then every member acts once in join order,
 * then the narrator answers again, in a loop. Null means it's genuinely open (a fresh lap with nobody blocked). A
 * sentinel "__narrator__" id means the AI's answer to the last lap is still in flight: nobody may act until it lands.
 */
export async function whoseTurn(partyId: string): Promise<{ id: string; name: string } | null> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return null;
  if (party.awaitingNarrator) return { id: "__narrator__", name: "el narrador" };
  const members = await memberIdsInOrder(party.id, party.turnOrder);
  const actions = parseRound(party.roundActionsJson);
  const nextId = missingMembers(members.map((m) => m.id), actions)[0];
  if (!nextId) return null;
  return { id: nextId, name: members.find((m) => m.id === nextId)?.name ?? "otro miembro" };
}

/** Records this member's action for the round in strict turn order. Returns whether everyone has now acted. */
export async function submitRoundAction(character: { id: string; name: string }, partyId: string, text: string): Promise<{ allIn: boolean; waitingFor: string[] }> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) throw new PartyRoundError("El grupo ya no existe.");
  if (party.awaitingNarrator) throw new PartyRoundError("El narrador está respondiendo a la ronda: espera un momento.");
  const members = await memberIdsInOrder(party.id, party.turnOrder);
  const actions = parseRound(party.roundActionsJson);
  if (actions[character.id]) throw new PartyRoundError("Ya has enviado tu acción de esta ronda: espera a tus compañeros o pide que el narrador responda ya.");
  const ids = members.map((m) => m.id);
  const missing = missingMembers(ids, actions);
  if (missing[0] && missing[0] !== character.id) {
    throw new PartyRoundError(`Espera tu turno: le toca a ${members.find((m) => m.id === missing[0])?.name ?? "otro miembro"}.`);
  }
  actions[character.id] = text;
  const claimed = await prisma.party.updateMany({
    where: { id: party.id, awaitingNarrator: false, roundActionsJson: party.roundActionsJson },
    data: { roundActionsJson: JSON.stringify(actions), roundStartedAt: party.roundStartedAt ?? new Date() },
  });
  if (claimed.count === 0) throw new PartyRoundError("Otra acción se te adelantó en la ronda: vuelve a enviarla.");
  await writePartyMessage(party.id, character.id, character.name, text);
  return { allIn: roundComplete(ids, actions), waitingFor: missingMembers(ids, actions).map((id) => members.find((m) => m.id === id)?.name ?? "otro miembro") };
}

/**
 * The narrator answers every action of the round in one message. `force` answers with whoever already acted — only when a member
 * explicitly closes the round early (`closePartyRound`); there is no automatic time limit, a round waits for everyone for as long
 * as it takes. `appendText` folds a mechanical action's own echo (e.g. "X explora: ...") into this SAME message instead of a second
 * one right after it — two "Narrador" bubbles back to back for one beat reads like the narrator answered everyone separately.
 * Returns the narration, or null when there was nothing to answer / another request already took the round.
 */
export async function resolvePartyRound(partyId: string, force = false, appendText?: string): Promise<string | null> {
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { messages: { orderBy: { createdAt: "desc" }, take: 14 } } });
  if (!party || party.awaitingNarrator) return null;
  const members = await memberIdsInOrder(party.id, party.turnOrder);
  const actions = parseRound(party.roundActionsJson);
  const ids = members.map((m) => m.id);
  const ordered = orderedActions(ids, actions);
  if (ordered.length === 0 || (!force && !roundComplete(ids, actions))) return null;
  const claimed = await prisma.party.updateMany({ where: { id: party.id, awaitingNarrator: false, roundActionsJson: party.roundActionsJson }, data: { awaitingNarrator: true } });
  if (claimed.count === 0) return null;
  await notifyParty(party.id);
  try {
    const anyone = await prisma.character.findUnique({ where: { id: ordered[0].characterId }, include: { currentIsland: true } });
    if (!anyone) throw new PartyRoundError("Nadie del grupo sigue aquí.");
    const named = ordered.map((a) => ({ name: members.find((m) => m.id === a.characterId)?.name ?? "Alguien", text: a.text }));
    const rawText = await narratePartyScene(
      {
        islandName: anyone.currentIsland.name,
        islandDescription: anyone.currentIsland.description,
        partyRoster: members.map((m) => ({ name: m.name, faction: m.faction, level: m.level })),
        actingCharacterName: named.map((n) => n.name).join(", "),
        playerText: named.map((n) => n.text).join("\n"),
        actions: named,
        recentParty: [...party.messages].reverse().map((m) => `${m.authorName}: ${m.text.length > 1800 ? m.text.slice(-1800) : m.text}`),
        memorySummary: party.memorySummary ?? undefined,
      },
      { partyId: party.id }
    );
    const marked = extractCombatMarker(rawText);
    const text = marked.text;
    const fightNotice = marked.attacker ? await import("./perform-action").then((m) => m.startFightFromNarration(ordered[0].characterId, marked.attacker!)).catch(() => null) : null;
    const shown = [text, fightNotice, appendText].filter(Boolean).join("\n\n");
    await writePartyMessage(party.id, null, "Narrador", shown);
    const now = Date.now();
    await prisma.sceneMessage.createMany({
      data: ordered.flatMap((a, i) => [
        { characterId: a.characterId, role: "player", text: a.text, createdAt: new Date(now - 5 - i) },
        { characterId: a.characterId, role: "narrator", text, createdAt: new Date(now + i) },
      ]),
    });
    await safePartyUpdate(party.id, { roundActionsJson: "{}", roundStartedAt: null, awaitingNarrator: false });
    await notifyParty(party.id);
    void maybeCompactPartyScene(party.id);
    return text;
  } catch (err) {
    await safePartyUpdate(party.id, { awaitingNarrator: false });
    await notifyParty(party.id);
    throw err;
  }
}

/** "Que el narrador responda ya": any member closes the round with the actions already in. */
export async function closePartyRound(characterId: string, userId: string): Promise<{ log: string[] }> {
  const ch = await prisma.character.findUnique({ where: { id: characterId } });
  if (!ch || ch.userId !== userId) throw new PartyRoundError("Personaje no encontrado.");
  if (!ch.partyId) throw new PartyRoundError("No estás compartiendo una escena con tu tripulación ahora mismo.");
  const party = await prisma.party.findUnique({ where: { id: ch.partyId } });
  if (!party || Object.keys(parseRound(party.roundActionsJson)).length === 0) throw new PartyRoundError("Todavía nadie ha escrito su acción en esta ronda.");
  const text = await resolvePartyRound(party.id, true);
  return { log: text ? [text] : ["El narrador ya está respondiendo a la ronda."] };
}

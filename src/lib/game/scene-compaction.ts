import { prisma } from "../db";
import { logError } from "../log-error";
import { summarizeTranscript } from "../ai/narrate";

/**
 * Silent context compaction. Narration prompts carry the last dozen scene
 * messages plus a bounded `memorySummary`; without this, anything older than
 * those dozen messages was simply forgotten during a long roleplay session.
 * Here, once enough older messages pile up beyond the recent window, they are
 * folded into the summary in the background (fire-and-forget, never awaited by
 * the player's request, never throws) and marked as compacted — so the AI keeps
 * the whole story while prompt size stays flat. Nothing about it is visible to
 * the player: the on-screen transcript is untouched.
 */
export const KEEP_RECENT_MESSAGES = 12;
export const MIN_COMPACTION_BATCH = 10;
const LINE_MAX_CHARS = 700;

export function shouldCompact(uncompactedCount: number): boolean {
  return uncompactedCount >= KEEP_RECENT_MESSAGES + MIN_COMPACTION_BATCH;
}

const inFlight = new Set<string>();

function clip(text: string): string {
  return text.length > LINE_MAX_CHARS ? `${text.slice(0, LINE_MAX_CHARS)}…` : text;
}

export async function maybeCompactCharacterScene(characterId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight.has(characterId)) return;
  inFlight.add(characterId);
  try {
    const character = await prisma.character.findUnique({ where: { id: characterId }, select: { memorySummary: true, sceneCompactedUntil: true, timelineEpoch: true } });
    if (!character) return;
    const messages = await prisma.sceneMessage.findMany({
      where: { characterId, ...(character.sceneCompactedUntil ? { createdAt: { gt: character.sceneCompactedUntil } } : {}) },
      orderBy: { createdAt: "asc" },
    });
    if (opts.force ? messages.length < 2 : !shouldCompact(messages.length)) return;
    const older = opts.force ? messages : messages.slice(0, messages.length - KEEP_RECENT_MESSAGES);
    const lines = older.map((m) => (m.role === "player" ? `[Jugador]: ${clip(m.text)}` : `[Narrador]: ${clip(m.text)}`));
    const summary = await summarizeTranscript(character.memorySummary, lines, { characterId });
    if (!summary) return;
    // A rollback while this summary was being written bumps the epoch: the discarded timeline must not be written back.
    await prisma.character.updateMany({ where: { id: characterId, timelineEpoch: character.timelineEpoch }, data: { memorySummary: summary, sceneCompactedUntil: older[older.length - 1].createdAt } });
  } catch (err) {
    await logError("scene-compaction/character", err, { characterId });
  } finally {
    inFlight.delete(characterId);
  }
}

export async function maybeCompactPartyScene(partyId: string): Promise<void> {
  if (inFlight.has(partyId)) return;
  inFlight.add(partyId);
  try {
    const party = await prisma.party.findUnique({ where: { id: partyId }, select: { memorySummary: true, compactedUntil: true } });
    if (!party) return;
    const messages = await prisma.partySceneMessage.findMany({
      where: { partyId, ...(party.compactedUntil ? { createdAt: { gt: party.compactedUntil } } : {}) },
      orderBy: { createdAt: "asc" },
    });
    if (!shouldCompact(messages.length)) return;
    const older = messages.slice(0, messages.length - KEEP_RECENT_MESSAGES);
    const lines = older.map((m) => `[${m.authorName}]: ${clip(m.text)}`);
    const summary = await summarizeTranscript(party.memorySummary, lines, { partyId });
    if (!summary) return;
    await prisma.party.update({ where: { id: partyId }, data: { memorySummary: summary, compactedUntil: older[older.length - 1].createdAt } });
  } catch (err) {
    await logError("scene-compaction/party", err, { partyId });
  } finally {
    inFlight.delete(partyId);
  }
}

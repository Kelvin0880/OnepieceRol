// Game pause (owner switch, see PAUSA.md): while paused nothing advances and nothing spends AI. On resume every
// clock the world keeps in the database is moved forward by the time spent paused, so nothing "catches up".

export const PAUSED_MESSAGE = "El juego está en pausa por ahora. Puedes mirar, pero nadie puede jugar hasta que vuelva.";

const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
const OPEN_WHILE_PAUSED = ["/api/auth/login", "/api/auth/logout"];

/** True when the request must be refused while the game is paused (decided by method + path only). */
export function blockedWhilePaused(method: string, pathname: string): boolean {
  if (OPEN_WHILE_PAUSED.includes(pathname)) return false;
  // Reading a character runs the lazy world logic (voyages land, errands settle, fights time out...), so even
  // GETs are refused there. Portraits are plain image bytes.
  if (/^\/api\/characters\/[^/]+\/portrait\/?$/.test(pathname) && method.toUpperCase() === "GET") return false;
  if (/^\/api\/characters\/[^/]+(\/|$)/.test(pathname)) return true;
  return !READ_METHODS.includes(method.toUpperCase());
}

export function shiftDate(value: Date, deltaMs: number): Date {
  return new Date(value.getTime() + deltaMs);
}

export interface ShiftRule {
  model: string;
  columns: string[];
  /** Only rows still "live" (a finished fight's clock means nothing). */
  where?: Record<string, unknown>;
}

// Every DateTime column of schema.prisma must be listed here or in PAUSE_IGNORE (pause.test.ts enforces it), so a
// new clock cannot be added without deciding what a pause does to it.
export const PAUSE_SHIFT: ShiftRule[] = [
  {
    model: "Character",
    columns: ["lastStudyAt", "lastTrainedAt", "staminaUpdatedAt", "lastTravelAt", "voyageArrivesAt", "lastEmperorChallengeAt", "warlordTributeDueAt", "warlordRevokedAt", "lastFigureNewsAt", "lastSeatChallengeAt", "lastSeatDefenseAt"],
  },
  { model: "CharacterStyle", columns: ["lastTrainedAt"] },
  { model: "Party", columns: ["roundStartedAt"] },
  { model: "JointFight", columns: ["roundStartedAt", "updatedAt"], where: { status: "ACTIVE" } },
  { model: "Duel", columns: ["updatedAt"], where: { status: { in: ["PROPOSED", "ACTIVE"] } } },
  { model: "CanonChallenge", columns: ["updatedAt"], where: { stage: { in: ["READY", "WON"] } } },
  { model: "CrewInvite", columns: ["createdAt"], where: { status: "PENDING" } },
  { model: "PlayerEvent", columns: ["createdAt"], where: { status: { in: ["OPEN", "RESOLVING"] } } },
  { model: "Imprisonment", columns: ["capturedAt", "lastEscapeAttemptAt"], where: { releasedAt: null } },
  { model: "WorldActor", columns: ["busyUntil", "locationUpdatedAt", "capturedAt"] },
  { model: "Consequence", columns: ["dueAt"], where: { resolvedAt: null } },
  { model: "WorldClock", columns: ["lastTickAt", "lastDigestAt", "lastTournamentAt"] },
  { model: "Territory", columns: ["lastPressureAt", "lastIncomeAt", "lastActivityAt", "voteDeadline"] },
  { model: "BusterCall", columns: ["startedAt", "endsAt"], where: { status: "ACTIVE" } },
  { model: "Raid", columns: ["voteDeadline", "lastActivityAt", "resolvedAt"] },
  { model: "WorldArc", columns: ["nextBeatAt"], where: { status: { not: "RESOLVED" } } },
  { model: "Tournament", columns: ["startsAt", "roundEndsAt"], where: { status: { in: ["ANNOUNCED", "RUNNING"] } } },
  { model: "War", columns: ["nextFrontAt", "startedAt"], where: { status: "ACTIVE" } },
  { model: "AdmiralDispatch", columns: ["departedAt", "arrivesAt", "returnsAt"], where: { status: { not: "ENDED" } } },
  { model: "IslandNpc", columns: ["diedAt", "recoversAt"] },
  { model: "SeatChallenge", columns: ["resolveAt", "expiresAt"] },
];

/** Columns a pause deliberately leaves alone: history ("when it happened") or pointers into message times. */
export const PAUSE_IGNORE: string[] = [
  "WorldClock.pausedAt", // the switch itself
  "Character.lastSeenAt", // "online" means seen in the last minutes of real time
  "Character.emperorSince",
  "Character.warlordSince",
  "Character.seatSince",
  "Character.sceneCompactedUntil", // pointer into scene message times, which are not shifted
  "Character.sceneClearedAt",
  "Character.portraitUpdatedAt",
  "Character.diedAt",
  "Crew.flagImageUpdatedAt",
  "Party.compactedUntil",
  "GroupBattle.resolvedAt",
  "JointFightParticipant.joinedAt",
  "Imprisonment.releasedAt",
  "NPCCompanion.joinedAt",
  "NPCCompanion.diedAt",
  "Grudge.lastIncidentAt",
  "Consequence.resolvedAt",
  "Mission.completedAt",
  "WorldArc.decidedAt",
  "Tournament.announcedAt",
  "Tournament.finishedAt",
  "War.endedAt",
  "PlayerEvent.resolvedAt",
  "PlayerEventEntry.submittedAt",
  "AdmiralDispatch.arrivedAt",
  "AdmiralDispatch.endedAt",
  "IslandSecretFound.foundAt",
];

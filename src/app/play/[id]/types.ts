// Shapes of GET /api/characters/[id] as the play screen consumes them.

import type { PanelCompanion, PanelCrew } from "./CrewPanel";

export interface Island {
  id: string;
  name: string;
  description: string;
  dangerLevel: number;
  factionControl: string | null;
  poneglyphId?: string | null;
}

export interface Weapon {
  id: string;
  name: string;
  kind: string;
  grade: string;
  atkBonus: number;
  description: string;
}

export interface DevilFruit {
  id: string;
  name: string;
  englishName: string;
  type: string;
  rarity: string;
  description: string;
}

export interface Companion {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  status: string;
}

export interface LogEntry {
  id: string;
  text: string;
  kind: string;
  createdAt: string;
}

export interface SceneMsg {
  id: string;
  role: "player" | "narrator";
  text: string;
  createdAt: string;
}

export interface CrewMember {
  id: string;
  name: string;
  level: number;
  faction: string;
  status: string;
  currentIslandId: string;
  partyId: string | null;
  isSeparatedFromParty: boolean;
}

export interface PartyMsg {
  id: string;
  authorCharacterId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface PartyState {
  id: string;
  turnOrder: string[];
  turnIndex: number;
  awaitingNarrator: boolean;
  members: { id: string; name: string }[];
  messages: PartyMsg[];
}

export interface Crew {
  id: string;
  name: string;
  flagDesc: string;
  shipName: string;
  totalBounty: number;
  reputation: number;
  captainId: string;
  inviteCode: string;
  members: CrewMember[];
}

export interface OtherHere {
  id: string;
  name: string;
  faction: string;
  level: number;
  bounty: number;
  notoriety: number;
  hostile: boolean;
  crew: { id: string; name: string } | null;
}

export interface PrisonerHere {
  id: string;
  name: string;
  faction: string;
  level: number;
}

export interface Imprisonment {
  reason: string;
  bailBerries: number | null;
  cellLevel: number;
  minRescueLevel: number;
  capturedAt: string;
  escapeProgress: number;
  escapeNeeded: number;
  alert: number;
  escapeCooldownMs: number;
}

export interface TerritoryState {
  id: string;
  islandName: string;
  status: "HELD" | "CONQUEST" | "CLAIM_VOTE";
  stage: string | null;
  stageLabel: string | null;
  stages: { id: string; label: string }[];
  ownerName: string;
  title: string;
  heldByPlayers: boolean;
  isOwner: boolean;
  garrison: number | null;
  holderName: string | null;
  holderHome: boolean;
  muster: { id: string; name: string }[];
  iAmMustered: boolean;
  contributions: { id: string; name: string; points: number }[];
  votes: { voter: string; candidate: string }[];
  myVote: string | null;
  iContributed: boolean;
  voteDeadline: string | null;
  fortifyCost: number | null;
  pendingIncome: number | null;
  canAssault: boolean;
}

export interface RaidState {
  knowsTruth: boolean;
  onRaidIsland: boolean;
  islandName: string;
  cooldownMs: number;
  status: string | null;
  phase: number;
  phases: number;
  phaseName: string;
  iAmLeader: boolean;
  iAmMustered: boolean;
  muster: { id: string; name: string }[];
  maxParticipants: number;
  allies: { id: string; name: string }[];
  standings: { actorId: string; name: string; standing: number; pledged: boolean }[];
  voting: { candidates: { id: string; name: string }[]; deadline: string | null; iVoted: boolean; iCanVote: boolean } | null;
}

export interface MissionsState {
  islandName: string;
  briefing: { text: string; ready: boolean } | null;
  missions: { id: string; kind: string; title: string; brief: string; progress: number; target: number; berries: number; xp: number; tier: number; isArc: boolean; status: string }[];
}

export interface BlackMarketState {
  offers: { id: string; name: string; description: string; price: number }[];
  msToRefresh: number;
  deals: number;
}

export interface CanonActorHere {
  id: string;
  name: string;
  rank: string;
  factionName: string;
  power: number;
  personality: string | null;
  isYonko: boolean;
  minLevel: number;
  withBlock: string | null;
  againstBlock: string | null;
  openMission: string | null;
}

export interface CanonHereState {
  actors: CanonActorHere[];
  challenge: { id: string; actorId: string; actorName: string; stage: string; msLeft: number | null; note: string | null } | null;
}

export interface IslandCastEntry {
  id: string;
  name: string;
  title: string;
  category: string;
  level: number;
  fighter: boolean;
  state: string;
  usable: boolean;
  dead: boolean;
  personality: string;
  memory: string[];
  diedNote: string | null;
}

export interface RescueRaidState {
  groupSize: number;
  prisoners: { actorId: string; name: string; factionName: string; cell: number; place: string; minLevel: number; minPeople: number; blockReason: string | null }[];
}

export interface CaptivesState {
  islandName: string;
  governmentHere: boolean;
  hint: string;
  captives: { id: string; name: string; level: number; reward: number; msLeft: number }[];
}

export interface AdmiralAlertState {
  id: string;
  admiralName: string;
  islandName: string;
  status: "EN_ROUTE" | "ARRIVED";
  arrivesAt: string;
  msLeft: number;
  hunted: boolean;
  fightActive: boolean;
}

export interface BusterCallState {
  id: string;
  reason: string;
  wave: number;
  waves: number;
  wavesBroken: number;
  waveName: string;
  endsAt: string;
  msLeft: number;
  iAmMustered: boolean;
  musterCount: number;
}

export interface DuelResult {
  aId: string;
  bId: string;
  winner: "a" | "b" | "draw";
  aHpLeft: number;
  bHpLeft: number;
}

export interface BattleSummary {
  id: string;
  status: "PROPOSED" | "ACTIVE" | "RESOLVED" | "DECLINED";
  isChallenger: boolean;
  opponentCrewName: string;
  matchupCount: number;
  resultJson: string | null;
  createdAt: string;
}

export interface Character {
  portraitUpdatedAt?: string | null;
  id: string;
  name: string;
  faction: string;
  status: string;
  level: number;
  experience: number;
  hp: number;
  maxHp: number;
  berries: number;
  bounty: number;
  notoriety: number;
  strength: number;
  agility: number;
  durability: number;
  willpower: number;
  intellect: number;
  attributePoints: number;
  observationHaki: number;
  armamentHaki: number;
  conquerorsHaki: boolean;
  stamina: number;
  maxStamina: number;
  fatigue: string;
  fruitMastery: number;
  fruitAwakened: boolean;
  fruitPhase: string | null;
  title?: string | null;
  poneglyphsRead: string;
  poneglyphHeat: number;
  currentIsland: Island;
  devilFruit: DevilFruit | null;
  equippedWeapon: Weapon | null;
  ownedWeapons: Weapon[];
  logs: LogEntry[];
  sceneMessages: SceneMsg[];
  deathCause: string | null;
  pendingEncounter: {
    phase: "threat" | "fighting" | "victory";
    assessment: "weaker" | "even" | "superior";
    enemyName: string;
  } | null;
  crew: PanelCrew | null;
  companions: PanelCompanion[];
  isCaptain: boolean;
  pendingCrewInvites: number;
  imprisonment: Imprisonment | null;
  partyId: string | null;
  isSeparatedFromParty: boolean;
}

export interface AdminHint {
  pending: number;
}

export interface WorldEventHere {
  arcId: string;
  title: string;
  stage: number;
  totalStages: number;
  locationName: string | null;
  minLevel: number;
  canIntervene: boolean;
  reason: string | null;
  target: string;
  aggressor: string | null;
  defenders: number;
  helpers: number;
}

export interface DuelState {
  id: string;
  lethal: boolean;
  hostile: boolean;
  status: "PROPOSED" | "ACTIVE" | "FINISHED";
  round: number;
  isChallenger: boolean;
  opponentName: string;
  me: { hp: number; maxHp: number; submitted: boolean };
  opponent: { hp: number; maxHp: number; submitted: boolean };
  winnerId: string | null;
  resolution: "VERDICT" | "FLEE_PLEA" | null;
  pleaByMe: boolean;
  pleaText: string | null;
  verdict: { canCapture: boolean; captureLabel: string | null } | null;
  messages: { id: string; authorName: string; isNarrator: boolean; mine: boolean; text: string }[];
}

export interface JointFightState {
  id: string;
  kind: string;
  status: "ACTIVE" | "WON" | "LOST";
  round: number;
  /** Everyone answered but the referee never judged the round. */
  stalled?: boolean;
  stakes: string | null;
  enemy: { name: string; hp: number; maxHp: number; isBoss: boolean };
  me: { status: "FIGHTING" | "DOWN" | "FLED"; submitted: boolean; hp: number; maxHp: number } | null;
  participants: { name: string; isNpc: boolean; hp: number; maxHp: number; status: "FIGHTING" | "DOWN" | "FLED"; submitted: boolean }[];
  messages: { id: string; authorName: string; isNarrator: boolean; mine: boolean; text: string }[];
}

export interface StateResponse {
  worldEvent: WorldEventHere | null;
  admin: AdminHint | null;
  character: Character;
  connectedIslands: Island[];
  voyage: { toName: string; fromName: string; arrivesAt: string; msLeft: number } | null;
  othersHere: OtherHere[];
  prisonersHere: PrisonerHere[];
  crewBattles: BattleSummary[];
  party: PartyState | null;
  duel: DuelState | null;
  jointFight: JointFightState | null;
  territory: TerritoryState | null;
  busterCall: BusterCallState | null;
  admiralAlert: AdmiralAlertState | null;
  captives: CaptivesState | null;
  rescueRaid: RescueRaidState | null;
  canonHere: CanonHereState | null;
  islandCast: IslandCastEntry[];
  raid: RaidState | null;
  blackMarket: BlackMarketState | null;
  coliseum: { status: string; kindLabel: string; prize: string; startsAt: string; onDressrosa: boolean; registered: boolean; round: string | null } | null;
  missions: MissionsState | null;
  error?: string;
}

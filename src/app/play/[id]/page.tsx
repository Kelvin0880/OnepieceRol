"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import AttributesCard from "./AttributesCard";
import InventoryPanel from "./InventoryPanel";
import StylesPanel from "./StylesPanel";
import ColiseumPanel from "./ColiseumPanel";
import VoyagePanel from "./VoyagePanel";
import EmpirePanel from "./EmpirePanel";
import DenDenPanel from "./DenDenPanel";
import OocPanel from "./OocPanel";
import CrewPanel, { type PanelCompanion, type PanelCrew } from "./CrewPanel";
import { characterCondition, conditionLabel } from "@/lib/engine/condition";
import { xpToNextLevel } from "@/lib/engine/economy";
import { factionTitle, rankProgress, type FactionKey } from "@/lib/engine/progression";
import { crewNounForFaction } from "@/lib/engine/crew-noun";
import { CELL_LABELS } from "@/lib/engine/impel-down";

interface Island {
  id: string;
  name: string;
  description: string;
  dangerLevel: number;
  factionControl: string | null;
  poneglyphId?: string | null;
}

interface Weapon {
  id: string;
  name: string;
  kind: string;
  grade: string;
  atkBonus: number;
  description: string;
}

interface DevilFruit {
  id: string;
  name: string;
  englishName: string;
  type: string;
  rarity: string;
  description: string;
}

interface Companion {
  id: string;
  name: string;
  role: string;
  hp: number;
  maxHp: number;
  status: string;
}

interface LogEntry {
  id: string;
  text: string;
  kind: string;
  createdAt: string;
}

interface SceneMsg {
  id: string;
  role: "player" | "narrator";
  text: string;
  createdAt: string;
}

interface CrewMember {
  id: string;
  name: string;
  level: number;
  faction: string;
  status: string;
  currentIslandId: string;
  partyId: string | null;
  isSeparatedFromParty: boolean;
}

interface PartyMsg {
  id: string;
  authorCharacterId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
}

interface PartyState {
  id: string;
  turnOrder: string[];
  turnIndex: number;
  awaitingNarrator: boolean;
  members: { id: string; name: string }[];
  messages: PartyMsg[];
}

interface Crew {
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

interface OtherHere {
  id: string;
  name: string;
  faction: string;
  level: number;
  bounty: number;
  notoriety: number;
  hostile: boolean;
  crew: { id: string; name: string } | null;
}

interface PrisonerHere {
  id: string;
  name: string;
  faction: string;
  level: number;
}

interface Imprisonment {
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

interface TerritoryState {
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

interface RaidState {
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

interface MissionsState {
  islandName: string;
  briefing: { text: string; ready: boolean } | null;
  missions: { id: string; kind: string; title: string; brief: string; progress: number; target: number; berries: number; xp: number; tier: number; isArc: boolean; status: string }[];
}

interface BlackMarketState {
  offers: { id: string; name: string; description: string; price: number }[];
  msToRefresh: number;
  deals: number;
}

interface BusterCallState {
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

interface DuelResult {
  aId: string;
  bId: string;
  winner: "a" | "b" | "draw";
  aHpLeft: number;
  bHpLeft: number;
}

interface BattleSummary {
  id: string;
  status: "PROPOSED" | "ACTIVE" | "RESOLVED" | "DECLINED";
  isChallenger: boolean;
  opponentCrewName: string;
  matchupCount: number;
  resultJson: string | null;
  createdAt: string;
}

interface Character {
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

interface AdminHint {
  pending: number;
}

interface WorldEventHere {
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

interface DuelState {
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

interface JointFightState {
  id: string;
  kind: string;
  status: "ACTIVE" | "WON" | "LOST";
  round: number;
  stakes: string | null;
  enemy: { name: string; hp: number; maxHp: number; isBoss: boolean };
  me: { status: "FIGHTING" | "DOWN" | "FLED"; submitted: boolean; hp: number; maxHp: number } | null;
  participants: { name: string; isNpc: boolean; hp: number; maxHp: number; status: "FIGHTING" | "DOWN" | "FLED"; submitted: boolean }[];
  messages: { id: string; authorName: string; isNarrator: boolean; mine: boolean; text: string }[];
}

interface StateResponse {
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
  raid: RaidState | null;
  blackMarket: BlackMarketState | null;
  coliseum: { status: string; kindLabel: string; prize: string; startsAt: string; onDressrosa: boolean; registered: boolean; round: string | null } | null;
  missions: MissionsState | null;
  error?: string;
}

const ASSESSMENT_LABEL: Record<string, { text: string; color: string }> = {
  weaker: { text: "Parece más débil que tú", color: "text-emerald-300" },
  even: { text: "Parece un rival parejo", color: "text-gold" },
  superior: { text: "Parece superior a ti — cuidado", color: "text-blood" },
};

const CONDITION_COLOR: Record<string, string> = {
  ileso: "text-emerald-300",
  rasguñado: "text-gold",
  herido: "text-gold-bright",
  malherido: "text-orange-400",
  "al borde de la muerte": "text-blood",
};

const FACTION_LABEL: Record<string, string> = {
  PIRATE: "Pirata",
  MARINE: "Marine",
  REVOLUTIONARY: "Revolucionario",
  BOUNTY_HUNTER: "Cazarrecompensas",
  CP0: "CP-0",
};

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-ink-dim mb-0.5">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded bg-black/30 overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<string[]>([]);
  const [arcIntro, setArcIntro] = useState<{ islandName: string; hook: string } | null>(null);
  const [crewName, setCrewName] = useState("");
  const [crewFlag, setCrewFlag] = useState("");
  const [crewShip, setCrewShip] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [crewError, setCrewError] = useState<string | null>(null);
  const [crewBusy, setCrewBusy] = useState(false);
  const [challengeCrewId, setChallengeCrewId] = useState<string | null>(null);
  const [matchups, setMatchups] = useState<Record<string, string>>({});
  const [battleError, setBattleError] = useState<string | null>(null);
  const [battleBusy, setBattleBusy] = useState(false);
  const [battleLethal, setBattleLethal] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [escapePlan, setEscapePlan] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [closeFightOpen, setCloseFightOpen] = useState(false);
  const [closeFightNote, setCloseFightNote] = useState("");
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [ooc, setOoc] = useState<{ starter?: string } | null>(null);
  const [showCrew, setShowCrew] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showStyles, setShowStyles] = useState(false);
  const [showColiseum, setShowColiseum] = useState(false);
  const [showVoyage, setShowVoyage] = useState(false);
  const [showEmpire, setShowEmpire] = useState(false);
  const [showDenDen, setShowDenDen] = useState(false);
  const [fleeOpen, setFleeOpen] = useState(false);
  const [fleeText, setFleeText] = useState("");
  const [confirmYield, setConfirmYield] = useState(false);
  const sceneEndRef = useRef<HTMLDivElement>(null);
  const duelBoxRef = useRef<HTMLDivElement>(null);
  const jointBoxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/characters/${id}`);
    const d = await res.json();
    if (!res.ok) {
      setError(d.error ?? "No se pudo cargar el personaje.");
      return;
    }
    setData(d);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Presence ("who else is here") and world state drift on their own, so
  // poll softly instead of requiring the player to act to see updates.
  // Server-Sent Events push a refresh the instant something shared changes (a crewmate's move, a fight
  // resolving...). The poll stays as the safety net and only slows down while the stream is healthy.
  const streamHealthy = useRef(false);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource(`/api/characters/${id}/stream`);
    let timer: ReturnType<typeof setTimeout> | null = null;
    es.addEventListener("ready", () => {
      streamHealthy.current = true;
    });
    es.addEventListener("refresh", () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => load(), 150);
    });
    es.onerror = () => {
      streamHealthy.current = false;
    };
    return () => {
      es.close();
      if (timer) clearTimeout(timer);
      streamHealthy.current = false;
    };
  }, [id, load]);

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (!streamHealthy.current || tick % 3 === 0) load();
    }, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    // Scroll only the duel transcript box, not the whole page.
    const box = duelBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [data?.duel?.messages.length]);

  useEffect(() => {
    const box = jointBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [data?.jointFight?.messages.length]);

  useEffect(() => {
    sceneEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [data?.character.sceneMessages.length, data?.party?.messages.length, busy]);

  async function doCrewAction(body: Record<string, unknown>) {
    setCrewBusy(true);
    setCrewError(null);
    try {
      const res = await fetch(`/api/characters/${id}/crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setCrewError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      setCrewName("");
      setCrewFlag("");
      setCrewShip("");
      setJoinCode("");
      await load();
    } finally {
      setCrewBusy(false);
    }
  }

  async function doBattleAction(body: Record<string, unknown>) {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const res = await fetch(`/api/characters/${id}/battle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      setChallengeCrewId(null);
      setMatchups({});
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  async function doPrisonAction(body: Record<string, unknown>, path = "prison") {
    setBattleBusy(true);
    setBattleError(null);
    try {
      const res = await fetch(`/api/characters/${id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setBattleError(result.error ?? "No se pudo completar la acción.");
        return;
      }
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  // A retry of the same action reuses its requestId, so if the first attempt
  // actually reached the server (slow AI, dropped connection) the server hands
  // back that result instead of running the turn twice.
  const pendingRequest = useRef<{ key: string; id: string } | null>(null);

  async function doWorldEvent(side: "defend" | "assist" | "chaos") {
    if (!data?.worldEvent) return;
    setBattleBusy(true);
    setBattleError(null);
    try {
      const res = await fetch(`/api/characters/${id}/world-event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "intervene", arcId: data.worldEvent.arcId, side }) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) setBattleError(result.error ?? "No se pudo intervenir.");
      else if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      await load();
    } finally {
      setBattleBusy(false);
    }
  }

  async function doAction(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    const key = JSON.stringify(body);
    if (!pendingRequest.current || pendingRequest.current.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() };
    try {
      const res = await fetch(`/api/characters/${id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, requestId: pendingRequest.current.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        pendingRequest.current = null;
        setError(result.error ?? "No se pudo completar la acción.");
        return false;
      }
      pendingRequest.current = null;
      if (result.log) setFeed((f) => [...result.log, ...f].slice(0, 60));
      if (result.arcIntro) setArcIntro(result.arcIntro);
      if (result.confirmRequired === "leave_party") setShowLeaveConfirm(true);
      await load();
      return true;
    } catch {
      setError("La respuesta tardó demasiado o se cortó la conexión. Tu acción puede haberse procesado: mira la escena. Si no aparece, vuelve a enviar — no se duplicará.");
      for (const ms of [3000, 9000, 20000]) setTimeout(() => load(), ms);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function doDuelOp(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/characters/${id}/duel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) setError(result.error ?? "No se pudo completar la acción del duelo.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitFreeText() {
    const text = freeText.trim();
    if (!text || busy) return;
    const ok = await doAction({ freeText: text });
    if (ok) setFreeText("");
  }

  if (error && !data) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-blood">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <p className="text-ink-dim">Cargando personaje...</p>
      </main>
    );
  }

  const { character, connectedIslands, voyage, party, duel, jointFight, territory, busterCall, raid, blackMarket, coliseum, missions } = data;
  const duelActive = duel?.status === "ACTIVE";
  const jointActive = jointFight?.status === "ACTIVE";
  const isDead = character.status === "DEAD";
  const isImprisoned = character.status === "IMPRISONED";

  // Party turn-gating never applies while resolving a personal fight — you
  // can't be blocked from fighting for your life by whose turn it is in
  // the group scene (see resolvePartyFreeTextAction in perform-action.ts).
  const isMyPartyTurn = party ? party.turnOrder[party.turnIndex] === character.id : true;
  const partyBlocksInput = !!party && !character.pendingEncounter && !duelActive && !jointActive && (party.awaitingNarrator || !isMyPartyTurn);
  const partyTurnLabel = !party || character.pendingEncounter || jointActive
    ? null
    : party.awaitingNarrator
    ? "El narrador está pensando..."
    : isMyPartyTurn
    ? "Es tu turno."
    : `Le toca a ${party.members.find((m) => m.id === party.turnOrder[party.turnIndex])?.name ?? "otro miembro del grupo"}.`;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto p-4 md:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold-bright">{character.name}</h1>
          <p className="text-sm text-gold">
            {character.title ? `${character.title} · ` : ""}{factionTitle(character.faction as FactionKey, character.bounty, character.notoriety)}
          </p>
          <p className="text-sm text-ink-dim">
            {FACTION_LABEL[character.faction]} · Nv. {character.level} · {character.currentIsland.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowCrew(true)} data-testid="crew-open-header">
            {crewNounForFaction(character.faction as FactionKey)}
            {character.pendingCrewInvites > 0 && <span className="ml-1.5 text-[11px] px-1.5 rounded bg-blood text-white">{character.pendingCrewInvites}</span>}
          </button>
          {(coliseum || character.currentIsland.name === "Dressrosa") && (
            <button className={coliseum && coliseum.onDressrosa && coliseum.status === "ANNOUNCED" && !coliseum.registered ? "btn-gold px-3 py-1.5 text-sm" : "btn-ghost px-3 py-1.5 text-sm"} onClick={() => setShowColiseum(true)} data-testid="coliseum-open">
              Coliseo
            </button>
          )}
          {(character.companions.length > 0 || territory?.isOwner) && (
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowEmpire(true)} data-testid="empire-open">
              Imperio
            </button>
          )}
          {!isDead && !isImprisoned && (
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowDenDen(true)} data-testid="denden-open">
              Den Den Mushi
            </button>
          )}
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowVoyage(true)} data-testid="voyage-open">
            Rumbo
          </button>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowStyles(true)} data-testid="styles-open">
            Estilos
          </button>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowInventory(true)} data-testid="inventory-open">
            Inventario
            {(character.attributePoints ?? 0) > 0 && <span className="ml-1.5 text-[11px] px-1.5 rounded bg-blood text-white" title="Puntos de atributo por repartir">{character.attributePoints}</span>}
          </button>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setOoc({})} data-testid="ooc-open">
            Fuera de rol
          </button>
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setShowGuideModal(true)}>
            Mapa y Guía
          </button>
          {data.admin && (
            <Link href="/admin" className={`px-3 py-1.5 text-sm ${data.admin.pending > 0 ? "btn-gold" : "btn-ghost"}`} data-testid="admin-header-link">
              Administración
              {data.admin.pending > 0 && <span className="ml-1.5 text-[11px] px-1.5 rounded bg-blood text-white">{data.admin.pending}</span>}
            </Link>
          )}
          <Link href="/codex" className="btn-ghost px-3 py-1.5 text-sm">
            Códice
          </Link>
          <Link href="/news" className="btn-ghost px-3 py-1.5 text-sm">
            Noticias
          </Link>
          <Link href="/" className="btn-ghost px-3 py-1.5 text-sm">
            Mis personajes
          </Link>
        </div>
      </div>

      {showDenDen && <DenDenPanel characterId={character.id} onClose={() => setShowDenDen(false)} />}
      {showEmpire && <EmpirePanel characterId={character.id} onClose={() => setShowEmpire(false)} onChanged={() => load()} />}
      {showVoyage && <VoyagePanel characterId={character.id} onClose={() => setShowVoyage(false)} onChanged={() => load()} />}
      {showColiseum && <ColiseumPanel characterId={character.id} onClose={() => setShowColiseum(false)} onChanged={() => load()} />}

      {showStyles && <StylesPanel characterId={character.id} onClose={() => setShowStyles(false)} onChanged={() => load()} />}

      {showInventory && <InventoryPanel characterId={character.id} onClose={() => setShowInventory(false)} onChanged={() => load()} />}

      {showCrew && (
        <CrewPanel
          characterId={character.id}
          characterName={character.name}
          characterLevel={character.level}
          isCaptain={character.isCaptain}
          faction={character.faction}
          crew={character.crew}
          companions={character.companions}
          factionNoun={crewNounForFaction(character.faction as FactionKey)}
          onClose={() => setShowCrew(false)}
          onChanged={() => load()}
        />
      )}

      {ooc && (
        <OocPanel
          characterId={character.id}
          starter={ooc.starter}
          onClose={() => setOoc(null)}
          onChanged={() => load()}
          onRestoreText={(t) => setFreeText(t)}
        />
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowGuideModal(false)}
        >
          <div className="panel p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-gold-bright mb-2">Mapa y Guía del Jugador</h3>
            <p className="text-sm text-ink-dim mb-4">
              Referencia externa (se abre en una pestaña nueva): un mapa interactivo de todas las islas con su peligro,
              nivel mínimo y conexiones, y la guía completa de cómo se juega — incluyendo cómo se sube de nivel de verdad.
            </p>
            <div className="flex flex-col gap-2">
              <a
                className="btn-gold px-4 py-2 text-sm text-center"
                href="https://kelvin0880.github.io/OnepieceRol/mapa.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir mapa de ruta
              </a>
              <a
                className="btn-ghost px-4 py-2 text-sm text-center"
                href="https://kelvin0880.github.io/OnepieceRol/guia.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir guía del jugador
              </a>
            </div>
            <button className="btn-ghost px-3 py-1.5 text-xs mt-4 w-full" onClick={() => setShowGuideModal(false)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {arcIntro && (
        <div className="panel p-5" style={{ borderColor: "var(--gold)" }}>
          <p className="text-xs text-gold-bright uppercase tracking-wide mb-1">Llegas por primera vez a</p>
          <h2 className="font-display text-xl text-gold-bright mb-2">{arcIntro.islandName}</h2>
          <p className="text-sm text-ink italic mb-4">{arcIntro.hook}</p>
          <button className="btn-gold px-4 py-2 text-sm" onClick={() => setArcIntro(null)}>
            Continuar
          </button>
        </div>
      )}

      {isDead && (
        <div className="panel p-4 border-blood text-blood" style={{ borderColor: "var(--blood)" }}>
          <p className="font-display">{character.name} ha caído.</p>
          <p className="text-sm mt-1 text-ink-dim">{character.deathCause}</p>
        </div>
      )}

      {isImprisoned && character.imprisonment && (
        <div className="panel p-4" style={{ borderColor: "var(--gold)" }}>
          <p className="font-display text-gold-bright">Encarcelado en {character.currentIsland.name}</p>
          <p className="text-sm mt-1 text-ink-dim">{character.imprisonment.reason}</p>
          <p className="text-xs mt-2 text-ink-dim">
            {character.imprisonment.cellLevel > 0 && (
              <span className="block text-blood mb-1">Recluido en Impel Down — {CELL_LABELS[character.imprisonment.cellLevel]}. Sin fianza posible.</span>
            )}
            Nivel de poder necesario para rescatarte: <span className="text-gold">{character.imprisonment.minRescueLevel}</span>
          </p>
          {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {character.imprisonment.bailBerries != null ? (
              <button
                className="btn-gold px-4 py-2 text-sm"
                disabled={battleBusy || character.berries < character.imprisonment.bailBerries}
                onClick={() => doPrisonAction({ op: "bail" })}
              >
                Pagar fianza (฿ {character.imprisonment.bailBerries.toLocaleString("es-ES")})
              </button>
            ) : (
              <span className="text-xs text-ink-dim">Esta captura no admite fianza.</span>
            )}
            <span className="text-xs text-ink-dim">o espera a que un aliado venga a rescatarte, o intenta fugarte tú mismo.</span>
          </div>
          <div className="mt-4 border-t border-[--line] pt-3">
            <p className="text-sm font-display text-gold">Plan de fuga</p>
            <p className="text-xs text-ink-dim mb-2">
              Progreso: {character.imprisonment.escapeProgress}/{character.imprisonment.escapeNeeded} {character.imprisonment.cellLevel > 0 ? "niveles" : "obstáculo"} · Alerta de los guardias: {character.imprisonment.alert}/5. Cada intento tiene enfriamiento de 30 min; si te pillan, te llevan a un nivel más profundo y te hieren.
            </p>
            <textarea
              className="w-full bg-sea-deep border border-[--line] rounded px-3 py-2 text-sm outline-none focus:border-gold resize-none"
              rows={3}
              placeholder="Ej: Espero al cambio de ronda, aflojo el barrote que llevo días limando y me cuelo por el conducto de ventilación."
              value={escapePlan}
              maxLength={3000}
              disabled={battleBusy || character.imprisonment.escapeCooldownMs > 0}
              onChange={(e) => setEscapePlan(e.target.value)}
            />
            <button
              className="btn-gold px-4 py-2 text-sm mt-2"
              disabled={battleBusy || !escapePlan.trim() || character.imprisonment.escapeCooldownMs > 0}
              onClick={async () => {
                await doPrisonAction({ op: "escape", plan: escapePlan });
                setEscapePlan("");
              }}
            >
              {character.imprisonment.escapeCooldownMs > 0 ? `Espera ${Math.ceil(character.imprisonment.escapeCooldownMs / 60000)} min` : "Intentar la fuga"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* Main column */}
        <div className="flex flex-col gap-4">
          {duel && (
            <div className="panel p-4" style={{ borderColor: "var(--gold)" }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-gold-bright">
                  {duel.hostile ? "Caza" : "Duelo"} contra {duel.opponentName}
                  {duel.lethal && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blood text-white align-middle">A MUERTE</span>}
                </h3>
                <span className="text-xs text-ink-dim flex items-center gap-2">
                  {duel.status === "PROPOSED" ? "Reto pendiente" : duel.status === "ACTIVE" ? `Ronda ${duel.round}` : "Terminado"}
                  <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setOoc({ starter: "Sobre este duelo (fuera de rol): " })}>
                    Fuera de rol
                  </button>
                </span>
              </div>
              {duel.status !== "PROPOSED" && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <StatBar label="Tú" value={duel.me.hp} max={duel.me.maxHp} color="var(--blood)" />
                    {duel.status === "ACTIVE" && <p className="text-[11px] text-ink-dim mt-0.5">{duel.me.submitted ? "Movimiento enviado" : "Falta tu movimiento"}</p>}
                  </div>
                  <div>
                    <StatBar label={duel.opponentName} value={duel.opponent.hp} max={duel.opponent.maxHp} color="var(--blood)" />
                    {duel.status === "ACTIVE" && <p className="text-[11px] text-ink-dim mt-0.5">{duel.opponent.submitted ? "Ya movió" : "Pensando su movimiento..."}</p>}
                  </div>
                </div>
              )}
              <div ref={duelBoxRef} className="flex flex-col gap-2 max-h-72 overflow-y-auto mb-3">
                {duel.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${m.mine ? "self-end" : "self-start"} ${
                      m.isNarrator ? "bg-black/25" : m.mine ? "" : "bg-black/10 border border-[--line]"
                    }`}
                    style={m.mine ? { background: "var(--gold)", color: "var(--sea-deep)" } : undefined}
                  >
                    {!m.mine && <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-0.5">{m.authorName}</div>}
                    {m.text}
                  </div>
                ))}
              </div>
              {duel.status === "PROPOSED" && !duel.isChallenger && (
                <div>
                  {duel.hostile && <p className="text-sm text-blood mb-2">¡Te están dando caza! Si huyes, se decide por velocidad: puedes escapar… o que te alcancen.</p>}
                  <div className="flex gap-2">
                    <button className="btn-gold px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "respond", duelId: duel.id, accept: true })}>
                      {duel.hostile ? "Plantar cara" : duel.lethal ? "Aceptar duelo a muerte" : "Aceptar duelo"}
                    </button>
                    {duel.hostile ? (
                      <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => setFleeOpen((v) => !v)} data-testid="hunt-flee">
                        Intentar huir
                      </button>
                    ) : (
                      <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "respond", duelId: duel.id, accept: false })}>
                        Rechazar
                      </button>
                    )}
                  </div>
                </div>
              )}
              {duel.status === "PROPOSED" && !duel.isChallenger && duel.hostile && fleeOpen && !duel.resolution && (
                <div className="mt-2 flex flex-col gap-2" data-testid="duel-flee-box">
                  <textarea className="w-full text-sm bg-transparent border border-[--line] rounded px-3 py-2 min-h-20" placeholder="Describe cómo intentas escapar de la caza…" value={fleeText} onChange={(e) => setFleeText(e.target.value)} data-testid="duel-flee-text" />
                  <button className="btn-gold px-3 py-1.5 text-xs self-start" disabled={busy || fleeText.trim().length < 5} onClick={async () => { await doDuelOp({ op: "flee", duelId: duel.id, text: fleeText.trim() }); setFleeText(""); setFleeOpen(false); }} data-testid="duel-flee-send">
                    Enviar intento de huida
                  </button>
                </div>
              )}
              {duel.status === "PROPOSED" && duel.isChallenger && (
                <button className="btn-ghost px-4 py-2 text-sm" disabled={busy} onClick={() => doDuelOp({ op: "cancel", duelId: duel.id })}>
                  Cancelar reto
                </button>
              )}
              {duel.status === "ACTIVE" && !duel.resolution && (
                <div data-testid="duel-controls">
                  <p className="text-xs text-ink-dim">
                    Describe tu movimiento abajo: cómo atacas y cómo te defiendes (lo que intentas, no lo que consigues). Cuando ambos hayáis movido, el árbitro lee las dos acciones a la vez y decide cuánta vida y aguante pierde cada uno. Solo te hieren si tu propio texto lo permite.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!confirmYield ? (
                      <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setConfirmYield(true)} data-testid="duel-yield">
                        Perdí
                      </button>
                    ) : (
                      <>
                        <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => { setConfirmYield(false); doDuelOp({ op: "yield", duelId: duel.id }); }} data-testid="duel-yield-confirm">
                          Sí, me doy por vencido
                        </button>
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setConfirmYield(false)}>
                          Seguir peleando
                        </button>
                      </>
                    )}
                    {duel.lethal && (
                      <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setFleeOpen((v) => !v)} data-testid="duel-flee">
                        Intentar huir
                      </button>
                    )}
                  </div>
                  {duel.lethal && fleeOpen && (
                    <div className="mt-2 flex flex-col gap-2" data-testid="duel-flee-box">
                      <textarea className="w-full text-sm bg-transparent border border-[--line] rounded px-3 py-2 min-h-20" placeholder="Describe cómo intentas escapar…" value={fleeText} onChange={(e) => setFleeText(e.target.value)} data-testid="duel-flee-text" />
                      <button className="btn-gold px-3 py-1.5 text-xs self-start" disabled={busy || fleeText.trim().length < 5} onClick={async () => { await doDuelOp({ op: "flee", duelId: duel.id, text: fleeText.trim() }); setFleeText(""); setFleeOpen(false); }} data-testid="duel-flee-send">
                        Enviar intento de huida
                      </button>
                    </div>
                  )}
                  {duel.lethal && <p className="text-[11px] text-ink-dim mt-2">Es a muerte: si te rindes, tu vencedor decide tu destino; si intentas huir, tu rival decide si te deja. Lo pactado entre vosotros fuera del juego es lo que manda.</p>}
                </div>
              )}
              {(duel.status === "ACTIVE" || duel.status === "PROPOSED") && duel.resolution === "FLEE_PLEA" && (
                <div className="rounded border border-gold/50 p-3" data-testid="duel-flee-plea">
                  {duel.pleaByMe ? (
                    <p className="text-sm">Has intentado huir. Esperando a que {duel.opponentName} decida si te deja escapar…</p>
                  ) : (
                    <>
                      <p className="text-sm mb-2">
                        <strong>{duel.opponentName}</strong> intenta huir: <em>{duel.pleaText}</em>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "flee_decide", duelId: duel.id, allow: true })} data-testid="duel-flee-allow">
                          Permitir la huida
                        </button>
                        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "flee_decide", duelId: duel.id, allow: false })} data-testid="duel-flee-deny">
                          Impedirla (el duelo sigue)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {duel.status === "ACTIVE" && duel.resolution === "VERDICT" && (
                <div className="rounded border border-blood/60 p-3" data-testid="duel-verdict">
                  {duel.verdict ? (
                    <>
                      <p className="text-sm mb-2">{duel.opponentName} ha caído o se ha rendido. Tú decides su destino (lo acordado fuera del juego manda):</p>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "kill" })} data-testid="duel-kill">
                          Matar
                        </button>
                        {duel.verdict.canCapture && (
                          <button className="btn-gold px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "capture" })} data-testid="duel-capture">
                            {duel.verdict.captureLabel}
                          </button>
                        )}
                        <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "verdict", duelId: duel.id, choice: "spare" })} data-testid="duel-spare">
                          Perdonar la vida
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">Estás a merced de {duel.opponentName}. Esperando su decisión…</p>
                  )}
                </div>
              )}
              {duel.status === "FINISHED" && (
                <p className="text-sm text-gold-bright">{duel.winnerId === character.id ? "¡Has ganado el duelo!" : duel.winnerId ? "Has perdido el duelo." : "El duelo terminó sin vencedor: la huida fue permitida."}</p>
              )}
            </div>
          )}
          {busterCall && !isDead && (
            <div className="panel p-4" style={{ borderColor: "var(--blood)", background: "rgba(120,20,20,0.18)" }} data-testid="buster-call">
              <h3 className="font-display text-lg text-blood">¡BUSTER CALL sobre {character.currentIsland.name}!</h3>
              <p className="text-sm text-ink-dim mt-1">{busterCall.reason}</p>
              <p className="text-sm mt-2">
                Oleada {busterCall.wave}/{busterCall.waves}: <span className="text-gold">{busterCall.waveName}</span> · Hundidas: {busterCall.wavesBroken}/{busterCall.waves} · Tiempo: {Math.ceil(busterCall.msLeft / 60000)} min
              </p>
              <p className="text-xs text-ink-dim mt-1">Si el tiempo se agota, la flota bombardea la isla: todos los que sigan aquí reciben un golpe brutal y el juez decide el destino de quien caiga. Defiende o zarpa.</p>
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="btn-gold px-4 py-2 text-sm" disabled={battleBusy || !!jointActive} onClick={() => doPrisonAction({ op: "defend" }, "buster-call")}>
                  Defender contra la oleada
                </button>
                <button className="btn-ghost px-3 py-2 text-xs" disabled={battleBusy} onClick={() => doPrisonAction({ op: busterCall.iAmMustered ? "unmuster" : "muster" }, "buster-call")}>
                  {busterCall.iAmMustered ? "Salir de la línea de defensa" : "Sumarme a la defensa"} ({busterCall.musterCount})
                </button>
              </div>
            </div>
          )}
          {missions && !isDead && !isImprisoned && (
            <div className="panel p-4" style={{ borderColor: "var(--gold)" }} data-testid="missions-panel">
              <h3 className="font-display text-lg text-gold-bright">Panorama y misiones de {missions.islandName}</h3>
              {missions.briefing && (
                <details className="mt-2">
                  <summary className="text-sm text-gold cursor-pointer">Lo que debes saber de esta isla (toca para leer)</summary>
                  <p className="text-sm mt-2 whitespace-pre-line" data-testid="island-briefing">
                    {missions.briefing.ready ? missions.briefing.text : "El narrador está reuniendo el panorama de la isla..."}
                  </p>
                </details>
              )}
              <div className="mt-3 space-y-3">
                {missions.missions.map((m) => (
                  <div key={m.id} data-testid="mission" style={{ opacity: m.status === "DONE" ? 0.55 : 1 }}>
                    <p className="text-sm">
                      <span className="text-gold">{m.status === "DONE" ? "✓ " : ""}{m.title}</span>
                      <span className="text-xs text-ink-dim"> · ฿ {m.berries.toLocaleString("es-ES")} · {m.xp} XP</span>
                    </p>
                    <p className="text-xs text-ink-dim">{m.brief}</p>
                    <StatBar label={`Progreso`} value={m.progress} max={m.target} color="var(--gold)" />
                  </div>
                ))}
                {missions.missions.length === 0 && <p className="text-xs text-ink-dim">Por ahora no hay encargos nuevos aquí: vuelve en un rato.</p>}
              </div>
            </div>
          )}
          {raid && !isDead && !isImprisoned && (
            <div className="panel p-4" style={{ borderColor: "var(--gold)" }} data-testid="raid-panel">
              <h3 className="font-display text-lg text-gold-bright">El Trono Vacío de {raid.islandName}</h3>
              {!raid.knowsTruth ? (
                <p className="text-sm text-ink-dim mt-1">Sientes que hay un poder oculto tras estos muros, pero aún no sabes cómo enfrentarlo. Solo quien ha llegado a Laugh Tale conoce la verdad.</p>
              ) : (
                <>
                  <p className="text-sm text-ink-dim mt-1">
                    {raid.status ? `Fase ${raid.phase}/${raid.phases}: ${raid.phaseName}.` : "Nadie ha reunido aún una coalición."}
                    {raid.cooldownMs > 0 && ` La guardia se reorganiza (${Math.ceil(raid.cooldownMs / 60000)} min).`}
                  </p>
                  {raid.muster.length > 0 && (
                    <p className="text-sm mt-2">
                      Coalición ({raid.muster.length}/{raid.maxParticipants}): <span className="text-gold">{raid.muster.map((m) => m.name).join(", ")}</span>
                    </p>
                  )}
                  {raid.allies.length > 0 && <p className="text-sm mt-1">Aliados: <span className="text-gold">{raid.allies.map((a) => a.name).join(", ")}</span></p>}
                  {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
                  {raid.status !== "CLAIM_VOTE" && raid.status !== "ACTIVE" && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {!raid.iAmMustered ? (
                        <button className="btn-gold px-4 py-2 text-sm" disabled={battleBusy || !raid.onRaidIsland || raid.cooldownMs > 0} onClick={() => doPrisonAction({ op: "muster" }, "raid")}>
                          {raid.status ? "Unirme a la coalición" : "Reunir una coalición"}
                        </button>
                      ) : (
                        <button className="btn-ghost px-3 py-2 text-xs" disabled={battleBusy} onClick={() => doPrisonAction({ op: "unmuster" }, "raid")}>Abandonar la coalición</button>
                      )}
                      {raid.iAmLeader && raid.status === "MUSTERING" && (
                        <button className="btn-gold px-4 py-2 text-sm" disabled={battleBusy || !!jointActive} onClick={() => doPrisonAction({ op: "launch" }, "raid")} data-testid="raid-launch">
                          ¡Dar la orden de asalto!
                        </button>
                      )}
                    </div>
                  )}
                  {raid.iAmLeader && raid.status === "MUSTERING" && raid.standings.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-ink-dim mb-1">Aliados de renombre que confían en ti:</p>
                      <div className="flex flex-wrap gap-2">
                        {raid.standings.map((s) => (
                          <button key={s.actorId} className="btn-ghost px-3 py-1 text-xs" disabled={battleBusy || s.pledged || s.standing < 60} onClick={() => doPrisonAction({ op: "pledge", actorId: s.actorId }, "raid")}>
                            {s.name} ({s.standing}/60){s.pledged ? " ✓" : ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {raid.voting && (
                    <div className="mt-3" data-testid="raid-vote">
                      <p className="text-sm">El Rey Sin Nombre ha caído. ¿Quién será el Rey de los Piratas?</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {raid.voting.candidates.map((c) => (
                          <button key={c.id} className="btn-gold px-3 py-1 text-xs" disabled={battleBusy || !raid.voting!.iCanVote} onClick={() => doPrisonAction({ op: "vote", candidateId: c.id }, "raid")}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                      {raid.voting.iVoted && <p className="text-xs text-ink-dim mt-1">Tu voto está registrado.</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {blackMarket && !isDead && !isImprisoned && (
            <div className="panel p-4" style={{ borderColor: "var(--blood)" }} data-testid="black-market">
              <h3 className="font-display text-lg text-gold-bright">Mercado negro</h3>
              <p className="text-xs text-ink-dim">Sin preguntas y sin garantías: cualquier trato puede ser una trampa de la Marina. El género cambia en {Math.ceil(blackMarket.msToRefresh / 60000)} min.</p>
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
              <div className="mt-2 space-y-2">
                {blackMarket.offers.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gold">{o.name}</p>
                      <p className="text-xs text-ink-dim">{o.description}</p>
                    </div>
                    <button className="btn-ghost px-3 py-1 text-xs whitespace-nowrap" disabled={battleBusy || character.berries < o.price} onClick={() => doPrisonAction({ op: "buy", offerId: o.id }, "black-market")}>
                      ฿ {o.price.toLocaleString("es-ES")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {territory && !isDead && !isImprisoned && (
            <div className="panel p-4" style={{ borderColor: "var(--gold)" }} data-testid="territory-panel">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg text-gold-bright">Dominio de {territory.islandName}</h3>
                <span className="text-xs text-ink-dim">
                  {territory.status === "HELD" ? (territory.heldByPlayers ? "En manos de jugadores" : "Bajo un poder local") : territory.status === "CONQUEST" ? "Asalto en curso" : "Votación abierta"}
                </span>
              </div>
              <p className="text-sm">
                Dueño: <span className="text-gold">{territory.ownerName}</span> — {territory.title}
              </p>
              {territory.garrison != null && <StatBar label="Guarnición" value={territory.garrison} max={100} color="var(--gold)" />}
              {territory.status === "CONQUEST" && (
                <div className="mt-2 text-sm">
                  <div className="flex gap-1 mb-2">
                    {territory.stages.map((s) => (
                      <span key={s.id} className={`text-xs px-2 py-0.5 rounded border ${s.id === territory.stage ? "border-gold text-gold" : "border-[--line] text-ink-dim"}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-ink-dim">Frente actual: {territory.stageLabel}. {territory.stage === "HOLDER" && !territory.holderHome && `${territory.holderName} no está en la isla: hay que esperar a que regrese.`}</p>
                </div>
              )}
              {territory.contributions.length > 0 && (
                <p className="text-xs text-ink-dim mt-2">Aportes: {territory.contributions.map((c) => `${c.name} ${c.points}`).join(" · ")}</p>
              )}
              {territory.muster.length > 0 && territory.status !== "CLAIM_VOTE" && <p className="text-xs text-ink-dim mt-1">Hueste reunida: {territory.muster.map((m) => m.name).join(", ")}</p>}
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {territory.canAssault && !jointActive && (
                  <>
                    <button className="btn-ghost px-3 py-1.5 text-xs" disabled={battleBusy} onClick={() => doPrisonAction({ op: territory.iAmMustered ? "unmuster" : "muster" }, "territory")}>
                      {territory.iAmMustered ? "Retirarme de la hueste" : "Sumarme a la hueste"}
                    </button>
                    <button className="btn-gold px-4 py-1.5 text-sm" disabled={battleBusy} onClick={() => doPrisonAction({ op: "assault" }, "territory")}>
                      Asaltar ({territory.status === "CONQUEST" ? territory.stageLabel : "el ejército"})
                    </button>
                  </>
                )}
                {territory.isOwner && (
                  <>
                    <button className="btn-gold px-3 py-1.5 text-xs" disabled={battleBusy || !territory.pendingIncome} onClick={() => doPrisonAction({ op: "collect" }, "territory")}>
                      Cobrar tributos (฿ {(territory.pendingIncome ?? 0).toLocaleString("es-ES")})
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" disabled={battleBusy || !territory.fortifyCost} onClick={() => doPrisonAction({ op: "fortify" }, "territory")}>
                      Reforzar guarnición (฿ {(territory.fortifyCost ?? 0).toLocaleString("es-ES")})
                    </button>
                    <button className="btn-ghost px-3 py-1.5 text-xs" disabled={battleBusy || !!jointActive || (territory.garrison ?? 100) >= 100} onClick={() => doPrisonAction({ op: "defend" }, "territory")}>
                      Repeler fuerza de retoma
                    </button>
                  </>
                )}
              </div>
              {territory.status === "CLAIM_VOTE" && (
                <div className="mt-3">
                  <p className="text-sm text-gold">La resistencia ha caído. Quienes participaron votan quién se queda la isla (peso = lo aportado).</p>
                  {territory.voteDeadline && <p className="text-xs text-ink-dim">Cierra: {new Date(territory.voteDeadline).toLocaleString("es-ES")} o cuando voten todos.</p>}
                  {territory.iContributed ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {territory.contributions.map((c) => (
                        <button key={c.id} className={territory.myVote === c.id ? "btn-gold px-3 py-1.5 text-xs" : "btn-ghost px-3 py-1.5 text-xs"} disabled={battleBusy} onClick={() => doPrisonAction({ op: "vote", candidateId: c.id }, "territory")}>
                          Votar por {c.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-ink-dim mt-1">Solo votan quienes participaron en la conquista.</p>
                  )}
                  {territory.votes.length > 0 && <p className="text-xs text-ink-dim mt-2">Votos: {territory.votes.map((v) => `${v.voter} → ${v.candidate}`).join(" · ")}</p>}
                </div>
              )}
            </div>
          )}
          {data.worldEvent && (
            <div className="panel p-4" style={{ borderColor: "var(--gold)" }} data-testid="world-event-panel">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display text-lg text-gold-bright">Evento mundial: {data.worldEvent.title}</h3>
                <span className="text-xs text-orange-300">
                  Capítulo {data.worldEvent.stage}/{data.worldEvent.totalStages}
                </span>
              </div>
              <p className="text-sm text-ink-dim mb-2">
                Algo grande está pasando aquí{data.worldEvent.locationName ? `, en ${data.worldEvent.locationName}` : ""}. {data.worldEvent.target}
                {data.worldEvent.aggressor ? ` y ${data.worldEvent.aggressor}` : ""} están en el centro. Con nivel suficiente ({data.worldEvent.minLevel}+) puedes meterte: pelearás contra una vanguardia y tu victoria inclina la historia.
              </p>
              <p className="text-xs text-ink-dim mb-2">
                Defensores: {data.worldEvent.defenders} · Aliados del agresor: {data.worldEvent.helpers}
              </p>
              {data.worldEvent.reason ? (
                <p className="text-xs text-orange-300" data-testid="world-event-reason">
                  {data.worldEvent.reason}
                </p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button className="btn-gold px-3 py-1.5 text-xs" disabled={battleBusy || !!jointActive} onClick={() => doWorldEvent("defend")} data-testid="intervene-defend">
                    Defender a {data.worldEvent.target}
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={battleBusy || !!jointActive} onClick={() => doWorldEvent("assist")} data-testid="intervene-assist">
                    Apoyar a {data.worldEvent.aggressor ?? "los perseguidores"}
                  </button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" disabled={battleBusy || !!jointActive} onClick={() => doWorldEvent("chaos")} data-testid="intervene-chaos">
                    Pelear contra todos
                  </button>
                </div>
              )}
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
            </div>
          )}

          {jointFight && (
            <div className="panel p-4" style={{ borderColor: "var(--blood)" }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-lg text-gold-bright">
                  Pelea en grupo contra {jointFight.enemy.name}
                  {jointFight.enemy.isBoss && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blood text-white align-middle">JEFE</span>}
                </h3>
                <span className="text-xs text-ink-dim flex items-center gap-2">
                  {jointFight.status === "ACTIVE" ? `Ronda ${jointFight.round}` : jointFight.status === "WON" ? "Victoria" : "Derrota"}
                  <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => setOoc({ starter: "Sobre esta pelea en grupo (fuera de rol): " })}>
                    Fuera de rol
                  </button>
                </span>
              </div>
              {jointFight.stakes && <p className="text-xs text-ink-dim mb-2">{jointFight.stakes}</p>}
              <p className="text-sm mb-3">Te enfrentas a <span className="text-gold-bright">{jointFight.enemy.name}</span>. Cómo va la pelea lo cuenta el árbitro en la escena.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {jointFight.participants.map((p) => (
                  <div key={p.name} data-testid="joint-participant">
                    {p.isNpc ? <p className="text-sm">{p.name} (NPC)</p> : <StatBar label={p.name} value={p.hp} max={p.maxHp} color="var(--gold)" />}
                    <p className="text-[11px] text-ink-dim mt-0.5">
                      {p.status === "DOWN" ? "Caído" : p.status === "FLED" ? "Huyó" : jointFight.status !== "ACTIVE" ? "" : p.isNpc ? "Lucha por su cuenta" : p.submitted ? "Movimiento enviado" : "Falta su movimiento"}
                    </p>
                  </div>
                ))}
              </div>
              <div ref={jointBoxRef} className="flex flex-col gap-2 max-h-80 overflow-y-auto mb-3">
                {jointFight.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${m.mine ? "self-end" : "self-start"} ${m.isNarrator ? "bg-black/25" : m.mine ? "" : "bg-black/10 border border-[--line]"}`}
                    style={m.mine ? { background: "var(--gold)", color: "var(--sea-deep)" } : undefined}
                  >
                    {!m.mine && <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-0.5">{m.authorName}</div>}
                    {m.text}
                  </div>
                ))}
              </div>
              {jointFight.status === "ACTIVE" && jointFight.me?.status === "FIGHTING" && (
                <p className="text-xs text-ink-dim">
                  {jointFight.me.submitted
                    ? "Movimiento enviado. Esperando a tus aliados: cada quien responde a su ritmo, la ronda se resuelve cuando todos han movido."
                    : "Describe tu movimiento abajo (lo que intentas, no lo que consigues). Cuando todos hayáis movido, el árbitro lo lee a la vez. Puedes escribir que huyes: el árbitro decide quién escapa."}
                </p>
              )}
              {jointFight.status === "ACTIVE" && jointFight.me?.status === "DOWN" && <p className="text-sm text-blood">Estás caído. Tus aliados deciden el desenlace: si vencen, te sacan con vida; si caen, el juez decide tu destino.</p>}
            </div>
          )}
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg">{character.currentIsland.name}</h2>
              <span className="text-xs text-ink-dim">Peligro {character.currentIsland.dangerLevel}/10</span>
            </div>
            <p className="text-sm text-ink-dim mb-4">{character.currentIsland.description}</p>
            {character.currentIsland.poneglyphId && !(JSON.parse(character.poneglyphsRead || "[]") as string[]).includes(character.currentIsland.poneglyphId) && !isDead && !isImprisoned && (
              <p className="text-xs text-gold mb-3" data-testid="stealth-hint">Aquí hay un Poneglifo custodiado. Puedes enfrentarte a sus guardianes… o describir cómo te infiltras a escondidas para leerlo sin ser visto (cuesta 15 de estamina; si te descubren, viene el guardián).</p>
            )}

            {!isDead && !isImprisoned && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-ink-dim">¿Qué haces?</label>
                  {partyTurnLabel && <span className={`text-xs ${isMyPartyTurn && !party?.awaitingNarrator ? "text-gold" : "text-ink-dim italic"}`}>{partyTurnLabel}</span>}
                </div>
                {showLeaveConfirm && (
                  <div className="panel p-3 mb-2" style={{ borderColor: "var(--gold)" }}>
                    <p className="text-sm mb-2">¿Quieres separarte de tus nakamas?</p>
                    <div className="flex gap-2">
                      <button
                        className="btn-gold px-3 py-1.5 text-xs"
                        onClick={async () => {
                          setShowLeaveConfirm(false);
                          await doAction({ action: "confirm_leave_party" });
                        }}
                      >
                        Sí, separarme
                      </button>
                      <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setShowLeaveConfirm(false)}>
                        No, seguir con ellos
                      </button>
                    </div>
                  </div>
                )}
                <textarea
                  className="w-full bg-sea-deep border border-[--line] rounded px-3 py-2 text-sm outline-none focus:border-gold resize-none"
                  rows={4}
                  placeholder={
                    jointActive
                      ? jointFight?.me?.status === "DOWN"
                        ? "Estás caído: espera el desenlace."
                        : "Ej: Cubro a mis nakamas con mi guardia y contraataco a su costado."
                      : duelActive
                      ? "Ej: Giro sobre mi pie y intento un tajo ascendente a su guardia, rodeando su flanco."
                      : character.pendingEncounter?.phase === "threat"
                      ? "Ej: Desenfundo mi espada y cargo contra él sin dudar."
                      : character.pendingEncounter?.phase === "victory"
                      ? "Ej: Le perdono la vida y le advierto que no vuelva."
                      : partyBlocksInput
                      ? "Espera tu turno..."
                      : "Ej: Entro al bar y me fijo si alguien interesante anda por ahí."
                  }
                  value={freeText}
                  disabled={busy || partyBlocksInput || (jointActive && (jointFight?.me?.status !== "FIGHTING" || !!jointFight?.me?.submitted))}
                  onChange={(e) => setFreeText(e.target.value)}
                  maxLength={6000}
                  onKeyDown={(e) => {
                    // Plain Enter is a line break (needed on mobile to separate what
                    // you say from what you do); sending is the button or Ctrl/Cmd+Enter.
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      submitFreeText();
                    }
                  }}
                />
                <p className="text-[11px] text-ink-dim mt-1">
                  Enter = salto de línea. Escribe lo que <em>dices</em> entre comillas y lo que <em>haces</em> aparte; lo que escribes es tu intención — el resultado lo decide el juego. Envía con el botón o Ctrl+Enter.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button className="btn-gold px-4 py-2 text-sm" disabled={busy || partyBlocksInput || !freeText.trim()} onClick={submitFreeText}>
                    Actuar
                  </button>
                  {party && (
                    <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => setShowLeaveConfirm(true)}>
                      Separarte del grupo
                    </button>
                  )}
                  {busy && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-dim">
                      <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                      Pensando...
                    </span>
                  )}
                </div>
              </div>
            )}

            {!isDead && !isImprisoned && (character.pendingEncounter?.phase === "threat" || character.pendingEncounter?.phase === "fighting") && (
              <div className="panel p-3 mb-3" style={{ borderColor: "var(--blood)" }}>
                <p className="text-sm mb-1">
                  {character.pendingEncounter.phase === "threat" ? "Te enfrentas a" : "Sigues luchando contra"}{" "}
                  <span className="text-gold-bright">{character.pendingEncounter.enemyName}</span>.
                </p>
                <p className={`text-xs mb-2 ${ASSESSMENT_LABEL[character.pendingEncounter.assessment].color}`}>
                  {ASSESSMENT_LABEL[character.pendingEncounter.assessment].text}
                </p>
                {character.pendingEncounter.phase === "fighting" && (
                  <div className="mt-2">
                    {!closeFightOpen ? (
                      <button data-testid="close-fight-open" className="text-xs underline text-ink-dim" onClick={() => setCloseFightOpen(true)}>
                        ¿La pelea se atascó o ya terminó? Finalizarla
                      </button>
                    ) : (
                      <div className="panel p-2" data-testid="close-fight-panel">
                        <p className="text-xs mb-1">La IA leerá toda la pelea y decidirá cómo terminó de verdad (quién ganó, quién perdió o si nadie). Si quieres, cuéntale qué pasó:</p>
                        <textarea className="w-full text-sm mb-2" rows={2} maxLength={500} placeholder="Opcional: por ejemplo, «ya lo derroté en el mensaje anterior»" value={closeFightNote} onChange={(e) => setCloseFightNote(e.target.value)} />
                        <div className="flex gap-2">
                          <button
                            data-testid="close-fight-confirm"
                            className="btn text-xs"
                            disabled={busy}
                            onClick={async () => {
                              const ok = await doAction({ action: "close_fight", note: closeFightNote.trim() || undefined });
                              if (ok) {
                                setCloseFightOpen(false);
                                setCloseFightNote("");
                              }
                            }}
                          >
                            {busy ? "Juzgando..." : "Sí, finalizar la pelea"}
                          </button>
                          <button className="text-xs underline text-ink-dim" onClick={() => setCloseFightOpen(false)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isDead && !isImprisoned && character.pendingEncounter?.phase === "victory" && (
              <div className="panel p-3 mb-3">
                <p className="text-sm">
                  <span className="text-gold-bright">{character.pendingEncounter.enemyName}</span> está derrotado y a tu merced. ¿Qué haces?
                </p>
              </div>
            )}

            {!isDead && !isImprisoned && !character.pendingEncounter && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-dim">O, para lo simple:</span>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy || partyBlocksInput}
                  onClick={() => (party ? doAction({ freeText: "Me pongo a entrenar un rato." }) : doAction({ action: "train" }))}
                >
                  Entrenar
                </button>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  disabled={busy || partyBlocksInput}
                  onClick={() => (party ? doAction({ freeText: "Me tomo un momento para descansar." }) : doAction({ action: "rest" }))}
                >
                  Descansar
                </button>
              </div>
            )}

            {voyage && (
              <div className="mt-4 rounded border border-gold/50 p-3 text-sm" data-testid="voyage-banner">
                En alta mar: {voyage.fromName} → <strong>{voyage.toName}</strong>. Llegarás en unos {Math.max(1, Math.ceil(voyage.msLeft / 60000))} min. Hasta entonces no puedes explorar, entrenar ni descansar.
              </div>
            )}

            {connectedIslands.length > 0 && !voyage && !isDead && !isImprisoned && !character.pendingEncounter && (
              <div className="mt-4 pt-4 border-t border-[--line]">
                <p className="text-xs text-ink-dim mb-2">Zarpar hacia:</p>
                <div className="flex flex-wrap gap-2">
                  {connectedIslands.map((isl) => (
                    <button
                      key={isl.id}
                      className="btn-ghost px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => doAction({ action: "travel", targetIslandId: isl.id })}
                    >
                      {isl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isDead && (
            <div className="panel p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-sm text-ink-dim">{party ? "Escena compartida" : "Escena"}</h3>
                <button
                  className="btn-ghost px-2 py-1 text-[11px]"
                  onClick={() => setOoc({ starter: party ? "Somos varios en la escena y queremos pactar algo: " : "El narrador se equivocó en esto: " })}
                  data-testid="ooc-scene"
                >
                  Fuera de rol
                </button>
              </div>
              <div className="flex flex-col gap-3 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
                {party ? (
                  <>
                    {party.messages.length === 0 && <p className="text-sm text-ink-dim italic">La escena del grupo empieza aquí.</p>}
                    {party.messages.map((m) => {
                      const mine = m.authorCharacterId === character.id;
                      const isNarrator = m.authorCharacterId === null;
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-line ${mine ? "self-end" : "self-start"} ${
                            isNarrator ? "bg-black/25 whitespace-pre-line" : mine ? "" : "bg-black/10 border border-[--line]"
                          }`}
                          style={mine ? { background: "var(--gold)", color: "var(--sea-deep)" } : undefined}
                        >
                          {!mine && <div className="text-[10px] uppercase tracking-wide text-ink-dim mb-0.5">{m.authorName}</div>}
                          {m.text}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {character.sceneMessages.length === 0 && (
                      <p className="text-sm text-ink-dim italic">Escribe qué haces arriba para empezar a rolear.</p>
                    )}
                    {character.sceneMessages.map((m) =>
                      m.role === "player" ? (
                        <div key={m.id} className="self-end max-w-[85%] rounded-lg px-3 py-2 text-sm" style={{ background: "var(--gold)", color: "var(--sea-deep)" }}>
                          {m.text}
                        </div>
                      ) : (
                        <div key={m.id} className="self-start max-w-[85%] rounded-lg px-3 py-2 text-sm bg-black/25 whitespace-pre-line">
                          {m.text}
                        </div>
                      )
                    )}
                  </>
                )}
                {busy && (
                  <div className="self-start max-w-[85%] rounded-lg px-3 py-2 text-sm bg-black/25 flex items-center gap-1.5 text-ink-dim italic">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                    narrando...
                  </div>
                )}
                <div ref={sceneEndRef} />
              </div>
            </div>
          )}

          {data.othersHere.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Aventureros en esta isla</h3>
              <div className="flex flex-col gap-2">
                {data.othersHere.map((o) => (
                  <div key={o.id} className="text-sm flex items-center justify-between">
                    <span>
                      {o.name} <span className="text-ink-dim text-xs">· Nv. {o.level} · {FACTION_LABEL[o.faction]}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {o.crew && <span className="text-xs text-gold">{o.crew.name}</span>}
                      {!isDead && !isImprisoned && !duel && !character.pendingEncounter && (
                        <>
                          <button className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => doDuelOp({ op: "challenge", opponentId: o.id })}>
                            Retar a duelo
                          </button>
                          <button
                            className="px-2 py-0.5 text-xs rounded border border-[--blood] text-blood hover:bg-blood hover:text-white"
                            disabled={busy}
                            onClick={() => doDuelOp({ op: "challenge", opponentId: o.id, lethal: true })}
                          >
                            {o.hostile ? "Cazar a muerte" : "Duelo a muerte"}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isDead && !isImprisoned && data.prisonersHere.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Prisioneros en esta isla</h3>
              <div className="flex flex-col gap-2">
                {data.prisonersHere.map((p) => (
                  <div key={p.id} className="text-sm flex items-center justify-between">
                    <span>
                      {p.name} <span className="text-ink-dim text-xs">· Nv. {p.level} · {FACTION_LABEL[p.faction]}</span>
                    </span>
                    <button
                      className="btn-ghost px-3 py-1 text-xs"
                      disabled={battleBusy}
                      onClick={() => doPrisonAction({ op: "rescue", targetCharacterId: p.id })}
                    >
                      Rescatar
                    </button>
                  </div>
                ))}
              </div>
              {battleError && <p className="text-blood text-xs mt-2">{battleError}</p>}
            </div>
          )}

          {character.crew && character.crew.captainId === character.id && !isDead && !isImprisoned && (() => {
            const rivalCrews = new Map<string, { id: string; name: string; members: OtherHere[] }>();
            for (const o of data.othersHere) {
              if (!o.crew || o.crew.id === character.crew!.id) continue;
              const entry = rivalCrews.get(o.crew.id) ?? { id: o.crew.id, name: o.crew.name, members: [] };
              entry.members.push(o);
              rivalCrews.set(o.crew.id, entry);
            }
            const myMembersHere = character.crew!.members.filter((m) => m.currentIslandId === character.currentIsland.id && m.status === "ALIVE");
            if (rivalCrews.size === 0) return null;

            return (
              <div className="panel p-4">
                <h3 className="font-display text-sm text-ink-dim mb-2">Desafiar a otra tripulación</h3>
                {!challengeCrewId ? (
                  <div className="flex flex-wrap gap-2">
                    {[...rivalCrews.values()].map((rc) => (
                      <button key={rc.id} className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(rc.id)}>
                        Desafiar a {rc.name} ({rc.members.length})
                      </button>
                    ))}
                  </div>
                ) : (
                  (() => {
                    const rival = rivalCrews.get(challengeCrewId);
                    if (!rival) return null;
                    const rows = myMembersHere.slice(0, rival.members.length);
                    const chosenOpponents = new Set(Object.values(matchups));
                    return (
                      <div className="flex flex-col gap-2">
                        {rows.map((mine) => (
                          <div key={mine.id} className="flex items-center gap-2 text-sm">
                            <span className="w-32 truncate">{mine.name}</span>
                            <span className="text-ink-dim">vs</span>
                            <select
                              className="flex-1 bg-sea-deep border border-[--line] rounded px-2 py-1 text-xs outline-none focus:border-gold"
                              value={matchups[mine.id] ?? ""}
                              onChange={(e) => setMatchups((m) => ({ ...m, [mine.id]: e.target.value }))}
                            >
                              <option value="">— elegir rival —</option>
                              {rival.members
                                .filter((r) => r.id === matchups[mine.id] || !chosenOpponents.has(r.id))
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} (Nv. {r.level})
                                  </option>
                                ))}
                            </select>
                          </div>
                        ))}
                        <label className="flex items-center gap-2 text-xs text-ink-dim mt-1">
                          <input type="checkbox" checked={battleLethal} onChange={(e) => setBattleLethal(e.target.checked)} data-testid="battle-lethal" />
                          A muerte (el vencedor de cada duelo decide matar, capturar o perdonar; lo pactáis fuera del juego)
                        </label>
                        {battleError && <p className="text-blood text-xs">{battleError}</p>}
                        <div className="flex gap-2 mt-1">
                          <button
                            className="btn-gold px-3 py-1.5 text-xs"
                            disabled={battleBusy || rows.some((r) => !matchups[r.id])}
                            onClick={() =>
                              doBattleAction({
                                op: "propose",
                                targetCrewId: rival.id,
                                matchups: rows.map((r) => ({ myCharacterId: r.id, opponentCharacterId: matchups[r.id] })),
                                lethal: battleLethal,
                              })
                            }
                          >
                            Proponer batalla
                          </button>
                          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setChallengeCrewId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })()}

          {data.crewBattles.length > 0 && (
            <div className="panel p-4">
              <h3 className="font-display text-sm text-ink-dim mb-2">Batallas de tripulación</h3>
              <div className="flex flex-col gap-3">
                {data.crewBattles.map((b) => {
                  const result: { victor: "a" | "b" | "draw"; duels: DuelResult[] } | null = b.resultJson ? JSON.parse(b.resultJson) : null;
                  const won = result && ((b.isChallenger && result.victor === "a") || (!b.isChallenger && result.victor === "b"));
                  return (
                    <div key={b.id} className="text-sm border-b border-[--line] pb-2 last:border-0">
                      <div className="flex justify-between">
                        <span>
                          {b.isChallenger ? "Desafiaste a" : "Te desafió"} {b.opponentCrewName} ({b.matchupCount} vs {b.matchupCount})
                        </span>
                        <span
                          className={
                            b.status === "PROPOSED" || b.status === "ACTIVE" ? "text-gold" : b.status === "DECLINED" ? "text-ink-dim" : won ? "text-emerald-300" : "text-blood"
                          }
                        >
                          {b.status === "PROPOSED" ? "Pendiente" : b.status === "ACTIVE" ? "En curso: un duelo por pareja" : b.status === "DECLINED" ? "Rechazada" : won ? "Victoria" : "Derrota"}
                        </span>
                      </div>
                      {b.status === "PROPOSED" && !b.isChallenger && (
                        <div className="flex gap-2 mt-2">
                          <button className="btn-gold px-3 py-1 text-xs" disabled={battleBusy} onClick={() => doBattleAction({ op: "respond", battleId: b.id, accept: true })}>
                            Aceptar
                          </button>
                          <button className="btn-ghost px-3 py-1 text-xs" disabled={battleBusy} onClick={() => doBattleAction({ op: "respond", battleId: b.id, accept: false })}>
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-blood text-sm">{error}</p>}

          <div className="panel p-4 flex-1">
            <h3 className="font-display text-sm text-ink-dim mb-0.5">Bitácora</h3>
            <p className="text-xs text-ink-dim/70 mb-2">Resumen mecánico rápido — la escena completa está arriba.</p>
            <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
              {feed.length === 0 &&
                character.logs.map((l) => (
                  <p key={l.id} className="text-sm border-b border-[--line] pb-2">
                    {l.text}
                  </p>
                ))}
              {feed.map((line, i) => (
                <p key={i} className="text-sm border-b border-[--line] pb-2">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="panel p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-ink-dim">Estado</span>
              <span className={`text-sm font-display ${CONDITION_COLOR[characterCondition(character.hp, character.maxHp)]}`}>
                {conditionLabel(characterCondition(character.hp, character.maxHp))}
              </span>
            </div>
            <StatBar label="Vida" value={character.hp} max={character.maxHp} color="var(--blood)" />
            <div data-testid="xp-bar">
              <StatBar label={`Experiencia (nivel ${character.level} → ${character.level + 1})`} value={character.experience} max={xpToNextLevel(character.level)} color="var(--gold)" />
              <p className="text-[11px] text-ink-dim mt-0.5">
                Faltan {Math.max(0, xpToNextLevel(character.level) - character.experience)} XP para el nivel {character.level + 1}. Se gana explorando y venciendo enemigos; entrenar no da nivel, sube el Haki.
              </p>
            </div>
            <div>
              <StatBar label={`Estamina (${character.fatigue})`} value={character.stamina} max={character.maxStamina} color="#4a90c2" />
              {character.stamina < character.maxStamina * 0.25 && (
                <p className="text-xs text-orange-400 mt-1">Tu cuerpo flaquea: golpeas y te defiendes peor. Descansa para recuperar el aliento.</p>
              )}
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-dim">Berries</span>
              <span className="text-gold-bright">฿ {character.berries.toLocaleString("es-ES")}</span>
            </div>
            {(() => {
              const r = rankProgress(character.faction as FactionKey, character.bounty, character.notoriety);
              const fmt = (n: number) => n.toLocaleString("es-ES");
              return (
                <div data-testid="rank-progress">
                  <div className="flex justify-between text-xs text-ink-dim mb-0.5">
                    <span>Rango: <span className="text-gold-bright">{r.title}</span></span>
                    <span>{r.nextTitle ? `→ ${r.nextTitle}` : "cima"}</span>
                  </div>
                  <div className="h-2 rounded bg-black/30 overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${Math.max(r.fraction > 0 ? 2 : 0, r.fraction * 100)}%`, background: "var(--gold)" }} />
                  </div>
                  <p className="text-[11px] text-ink-dim mt-0.5">
                    {r.target !== null
                      ? `${r.metric}: ${fmt(r.value)} / ${fmt(r.target)} · faltan ${fmt(r.remaining ?? 0)} para «${r.nextTitle}». El ascenso es automático y sale en las noticias.`
                      : `${r.metric}: ${fmt(r.value)} · has llegado al escalón más alto.`}
                  </p>
                </div>
              );
            })()}
            {character.faction === "PIRATE" && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-dim">Recompensa</span>
                <span className="text-gold-bright">฿ {character.bounty.toLocaleString("es-ES")}</span>
              </div>
            )}
            {character.faction !== "PIRATE" && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-dim">Mérito</span>
                <span className="text-gold-bright">{character.notoriety.toLocaleString("es-ES")}</span>
              </div>
            )}
            {character.poneglyphHeat > 0 && (
              <div className="pt-2 border-t border-[--line]">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blood">Perseguido</span>
                  <span className="text-blood">{character.poneglyphHeat}/150</span>
                </div>
                <p className="text-xs text-ink-dim">Lo que sabes te hace un objetivo. Explorar puede traer cazadores.</p>
              </div>
            )}
          </div>

          <div className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-2">Atributos</h3>
            <AttributesCard
              characterId={character.id}
              level={character.level}
              points={character.attributePoints ?? 0}
              values={{ strength: character.strength, agility: character.agility, durability: character.durability, willpower: character.willpower, intellect: character.intellect }}
              onChanged={() => load()}
            />
            <div className="mt-3 pt-3 border-t border-[--line] flex flex-col gap-2">
              <StatBar label="Haki de Observación" value={character.observationHaki} max={100} color="var(--gold)" />
              <StatBar label="Haki de Armadura" value={character.armamentHaki} max={100} color="var(--gold)" />
              {character.conquerorsHaki && <p className="text-xs text-gold-bright mt-1">✦ Portador del Haki del Rey Supremo</p>}
            </div>
          </div>

          <div className="panel p-4">
            <h3 className="font-display text-sm text-ink-dim mb-2">Equipo</h3>
            {character.devilFruit ? (
              <div className="mb-3">
                <p className="text-sm text-gold-bright">{character.devilFruit.name}</p>
                <p className="text-xs text-ink-dim">{character.devilFruit.description}</p>
                <p className="text-xs text-blood mt-1">✦ No puede nadar — el mar es su debilidad de por vida.</p>
                <div className="mt-2">
                  <StatBar label={`Dominio: ${character.fruitPhase ?? ""}`} value={character.fruitMastery} max={100} color="#9b6fd6" />
                  <p className="text-[11px] text-ink-dim mt-1">
                    {character.fruitAwakened
                      ? "Tu fruta ha despertado: su poder es total."
                      : character.fruitMastery >= 100
                      ? "Dominio máximo. Solo un combate al límite (un jefe, o ganar al borde de la muerte) puede provocar el Despertar."
                      : "Úsala en combate (descríbelo) o entrena con ella para dominarla y desbloquear sus fases."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-dim mb-3">Sin fruta del diablo.</p>
            )}
            {character.equippedWeapon ? (
              <div>
                <p className="text-sm">{character.equippedWeapon.name}</p>
                <p className="text-xs text-ink-dim">
                  {character.equippedWeapon.kind} · +{character.equippedWeapon.atkBonus} ATQ
                </p>
              </div>
            ) : (
              <p className="text-xs text-ink-dim">Sin arma equipada.</p>
            )}
            {(() => {
              const count = (JSON.parse(character.poneglyphsRead || "[]") as string[]).length;
              return count > 0 ? (
                <p className="text-xs text-gold mt-2 pt-2 border-t border-[--line]">
                  Poneglifos descifrados: {count}/4
                </p>
              ) : null;
            })()}
          </div>

          <div className="panel p-4" data-testid="crew-summary">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-sm text-ink-dim">{crewNounForFaction(character.faction as FactionKey)}</h3>
              <button className="btn-gold px-3 py-1 text-xs" onClick={() => setShowCrew(true)} data-testid="crew-open">
                Abrir panel
                {character.pendingCrewInvites > 0 && <span className="ml-1.5 text-[11px] px-1.5 rounded bg-blood text-white">{character.pendingCrewInvites}</span>}
              </button>
            </div>
            {character.crew ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {character.crew.hasEmblem && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/crews/${character.crew.id}/emblem?v=${character.crew.emblemVersion}`} alt="" className="w-8 h-8 rounded border border-gold/40 object-cover" />
                  )}
                  <p className="text-sm text-gold-bright">{character.crew.name}</p>
                </div>
                <p className="text-xs text-ink-dim">
                  {character.crew.members.length} miembro{character.crew.members.length === 1 ? "" : "s"} · Barco: {character.crew.shipName}
                </p>
                {!party &&
                  character.isSeparatedFromParty &&
                  character.crew.members.some((m) => m.id !== character.id && m.status === "ALIVE" && m.currentIslandId === character.currentIsland.id) && (
                    <button className="btn-gold px-3 py-1.5 text-xs mt-1" disabled={busy} onClick={() => doAction({ action: "rejoin_party" })}>
                      Unirme al grupo
                    </button>
                  )}
              </div>
            ) : (
              <p className="text-xs text-ink-dim">{character.faction === "BOUNTY_HUNTER" ? "Los cazarrecompensas trabajan en solitario." : "Sin tripulación. Ábrela para fundar una, aceptar invitaciones o unirte con un código."}</p>
            )}
            {character.companions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-[--line] flex flex-col gap-1" data-testid="companion-summary">
                <p className="text-xs text-ink-dim">Nakamas NPC (siempre a tu nivel):</p>
                {character.companions.map((c) => (
                  <div key={c.id} className="text-xs flex justify-between">
                    <span className={c.status !== "ALIVE" ? "text-blood line-through" : ""}>
                      {c.name} · {c.role} · Nv. {c.level}
                    </span>
                    <span className="text-ink-dim">
                      {c.hp}/{c.maxHp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
